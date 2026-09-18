/**
 * Headless "open now" logic — the question a phone visitor actually arrives
 * with. Ported from a shipped client build and kept here because the logic
 * is genuinely tricky (ranges that cross midnight in both directions,
 * specialHours overrides, the restaurant's time zone rather than the
 * device's) and the naive implementation ships a perf trap (docs/TRAPS.md:
 * constructing Intl.DateTimeFormat for a named zone pulls ICU data —
 * ~160ms of main-thread time under Lighthouse throttle, enough to delay the
 * hero LCP).
 *
 * The pure functions are exported for tests; the DOM side is a headless
 * contract like form.ts, wired once in BaseLayout and inert on pages
 * without a matching element.
 *
 * Markup contract (docs/RECIPES.md recipe 11) — design is entirely yours:
 *
 *   <p data-open-now data-schedule={schedule} hidden
 *      data-label-open="…" data-label-closed="…"
 *      data-label-until="…" data-label-opens="…">
 *     <span data-open-now-text></span>
 *   </p>
 *
 * where `schedule` is `serializeSchedule(business.data)` (server side, in
 * the component's frontmatter) and the labels come from the CLIENT's own
 * content schema — the template ships no copy. The element ships `hidden`:
 * the full hours table elsewhere on the page is the no-JS answer, and a
 * status that is silently WRONG is worse than one that is absent. When it
 * resolves, the element becomes visible and carries `data-open` while the
 * business is open — style both states in CSS.
 */

export interface HoursRange {
  open: string;
  close: string;
}
export interface Schedule {
  week: { day: string; ranges: HoursRange[] }[];
  special: { date: string; ranges: HoursRange[] }[];
}
export interface OpenState {
  isOpen: boolean;
  /** Closing time "HH:MM" of the active range, when open. */
  until?: string;
  /** Next opening time "HH:MM" (today or a later day), when closed. */
  nextOpen?: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Serialize business.data hours for the data-schedule attribute. */
export function serializeSchedule(data: {
  hours: { day: string; ranges: HoursRange[] }[];
  specialHours: { date: string; ranges: HoursRange[] }[];
}): string {
  return JSON.stringify({
    week: data.hours.map((entry) => ({ day: entry.day, ranges: entry.ranges })),
    special: data.specialHours.map((entry) => ({ date: entry.date, ranges: entry.ranges })),
  } satisfies Schedule);
}

/** "09:30" → 570. Returns null on anything that isn't HH:MM. */
export function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * A range whose close is at or before its open runs past midnight —
 * "09:00–00:00" closes at 1440, not at 0.
 */
export function closeMinutes(range: HoursRange): number | null {
  const open = toMinutes(range.open);
  const close = toMinutes(range.close);
  if (open === null || close === null) return null;
  return close <= open ? close + 1440 : close;
}

export interface ZonedNow {
  /** 0 = Sunday … 6 = Saturday. */
  dayIndex: number;
  /** Minutes since local midnight. */
  minutes: number;
  /** "YYYY-MM-DD" in the business's zone, for specialHours lookup. */
  date: string;
}

/** specialHours (חגים) override the weekday entirely for that date. */
function rangesOn(schedule: Schedule, dayIndex: number, date?: string): HoursRange[] {
  if (date !== undefined) {
    const override = schedule.special.find((entry) => entry.date === date);
    if (override !== undefined) return override.ranges;
  }
  return schedule.week.find((entry) => entry.day === DAYS[dayIndex])?.ranges ?? [];
}

/** Pure resolver — testable without a DOM or a clock. */
export function resolveOpenState(schedule: Schedule, now: ZonedNow): OpenState {
  for (const range of rangesOn(schedule, now.dayIndex, now.date)) {
    const start = toMinutes(range.open);
    const end = closeMinutes(range);
    if (start === null || end === null) continue;
    if (now.minutes >= start && now.minutes < end) {
      return { isOpen: true, until: range.close };
    }
  }

  // Still inside a range that began yesterday and ran past midnight.
  const yesterday = (now.dayIndex + 6) % 7;
  for (const range of rangesOn(schedule, yesterday)) {
    const end = closeMinutes(range);
    if (end !== null && end > 1440 && now.minutes < end - 1440) {
      return { isOpen: true, until: range.close };
    }
  }

  // The next opening: later today, else the first range of the next day that
  // has one.
  for (const range of rangesOn(schedule, now.dayIndex, now.date)) {
    const start = toMinutes(range.open);
    if (start !== null && start > now.minutes) {
      return { isOpen: false, nextOpen: range.open };
    }
  }
  for (let ahead = 1; ahead <= 7; ahead += 1) {
    const upcoming = rangesOn(schedule, (now.dayIndex + ahead) % 7);
    const first = upcoming[0];
    if (first !== undefined) return { isOpen: false, nextOpen: first.open };
  }
  return { isOpen: false };
}

/**
 * Weekday index and minutes-since-midnight in the business's zone, whatever
 * the device is set to — a diner checking from abroad wants the
 * restaurant's hours, not their own.
 */
export function zonedNow(timeZone = "Asia/Jerusalem", at = new Date()): ZonedNow | null {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const find = (type: string): string => parts.find((part) => part.type === type)?.value ?? "";
  const dayIndex = DAYS.indexOf(find("weekday"));
  const hour = Number(find("hour"));
  const minute = Number(find("minute"));
  if (dayIndex < 0 || Number.isNaN(hour) || Number.isNaN(minute)) return null;

  return {
    dayIndex,
    minutes: hour * 60 + minute,
    date: `${find("year")}-${find("month")}-${find("day")}`,
  };
}

function renderOpenNow(): void {
  const now = zonedNow();
  if (now === null) return;

  for (const el of document.querySelectorAll<HTMLElement>("[data-open-now]")) {
    const target = el.querySelector<HTMLElement>("[data-open-now-text]");
    const raw = el.dataset.schedule;
    if (target === null || raw === undefined) continue;

    let schedule: Schedule;
    try {
      schedule = JSON.parse(raw) as Schedule;
    } catch {
      continue;
    }

    const state = resolveOpenState(schedule, now);
    const labelOpen = el.dataset.labelOpen ?? "";
    const labelClosed = el.dataset.labelClosed ?? "";
    const labelUntil = el.dataset.labelUntil ?? "";
    const labelOpens = el.dataset.labelOpens ?? "";

    let text: string;
    if (state.isOpen) {
      text = state.until === undefined ? labelOpen : `${labelOpen} · ${labelUntil} ${state.until}`;
    } else {
      text =
        state.nextOpen === undefined
          ? labelClosed
          : `${labelClosed} · ${labelOpens}${state.nextOpen}`;
    }

    target.textContent = text;
    el.toggleAttribute("data-open", state.isOpen);
    el.hidden = false;
  }
}

/**
 * Deferred off the critical path ON PURPOSE — see the ICU note in the module
 * doc. The element is hidden until it resolves, so arriving a frame or two
 * late costs nothing and the first paint stays fast.
 */
export function setupOpenNow(): void {
  if (document.querySelector("[data-open-now]") === null) return;
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => renderOpenNow(), { timeout: 1500 });
    return;
  }
  window.setTimeout(renderOpenNow, 200);
}
