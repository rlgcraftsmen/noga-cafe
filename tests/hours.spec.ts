import { expect, test } from "@playwright/test";
import { closeMinutes, resolveOpenState, type Schedule, toMinutes } from "../src/lib/hours";

/**
 * Open-now logic tests — pure data, no browser (the repo's only runner is
 * Playwright, same as schema.spec.ts).
 *
 * The tricky cases here all shipped bugs (or nearly did) in real builds:
 * ranges that run past midnight in both directions, specialHours overrides,
 * and the day AFTER a past-midnight range while it is still open.
 */

/** Sun–Thu 09:00–23:30, Fri 09:00–15:00, Sat closed, one holiday override. */
const schedule: Schedule = {
  week: [
    { day: "Sunday", ranges: [{ open: "09:00", close: "23:30" }] },
    { day: "Monday", ranges: [{ open: "09:00", close: "23:30" }] },
    { day: "Tuesday", ranges: [{ open: "09:00", close: "23:30" }] },
    { day: "Wednesday", ranges: [{ open: "09:00", close: "23:30" }] },
    { day: "Thursday", ranges: [{ open: "09:00", close: "23:30" }] },
    { day: "Friday", ranges: [{ open: "09:00", close: "15:00" }] },
    { day: "Saturday", ranges: [] },
  ],
  special: [{ date: "2026-09-23", ranges: [] }],
};

/** Sat night ranges that cross midnight: Sat 20:00–02:00. */
const lateNight: Schedule = {
  week: [
    { day: "Saturday", ranges: [{ open: "20:00", close: "02:00" }] },
    { day: "Sunday", ranges: [] },
  ],
  special: [],
};

test.describe("toMinutes / closeMinutes", () => {
  test("parses HH:MM and rejects junk", () => {
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("9:30")).toBe(570);
    expect(toMinutes("late")).toBeNull();
    expect(toMinutes("09:3")).toBeNull();
  });

  test("close at or before open runs past midnight", () => {
    expect(closeMinutes({ open: "09:00", close: "00:00" })).toBe(1440);
    expect(closeMinutes({ open: "20:00", close: "02:00" })).toBe(1560);
    expect(closeMinutes({ open: "09:00", close: "17:00" })).toBe(17 * 60);
  });
});

test.describe("resolveOpenState", () => {
  test("open mid-range, reports the closing time", () => {
    const state = resolveOpenState(schedule, {
      dayIndex: 0,
      minutes: 12 * 60,
      date: "2026-09-20",
    });
    expect(state).toEqual({ isOpen: true, until: "23:30" });
  });

  test("closed before opening, reports today's opening", () => {
    const state = resolveOpenState(schedule, {
      dayIndex: 0,
      minutes: 8 * 60,
      date: "2026-09-20",
    });
    expect(state).toEqual({ isOpen: false, nextOpen: "09:00" });
  });

  test("closed after closing, reports the NEXT day's opening", () => {
    const state = resolveOpenState(schedule, {
      dayIndex: 4, // Thursday 23:45
      minutes: 23 * 60 + 45,
      date: "2026-09-24",
    });
    expect(state).toEqual({ isOpen: false, nextOpen: "09:00" });
  });

  test("closed day (empty ranges) skips to the next open day", () => {
    const state = resolveOpenState(schedule, {
      dayIndex: 6, // Saturday — explicit closed day
      minutes: 12 * 60,
      date: "2026-09-26",
    });
    expect(state).toEqual({ isOpen: false, nextOpen: "09:00" });
  });

  test("specialHours override an open weekday to closed", () => {
    const state = resolveOpenState(schedule, {
      dayIndex: 3, // a Wednesday that is a chag
      minutes: 12 * 60,
      date: "2026-09-23",
    });
    expect(state.isOpen).toBe(false);
  });

  test("open inside a past-midnight range, same evening", () => {
    const state = resolveOpenState(lateNight, {
      dayIndex: 6, // Saturday 23:59
      minutes: 23 * 60 + 59,
      date: "2026-09-26",
    });
    expect(state).toEqual({ isOpen: true, until: "02:00" });
  });

  test("STILL open after midnight — the range began yesterday", () => {
    const state = resolveOpenState(lateNight, {
      dayIndex: 0, // Sunday 00:30, inside Saturday's 20:00–02:00
      minutes: 30,
      date: "2026-09-27",
    });
    expect(state).toEqual({ isOpen: true, until: "02:00" });
  });

  test("closed once yesterday's past-midnight range ends", () => {
    const state = resolveOpenState(lateNight, {
      dayIndex: 0, // Sunday 02:30
      minutes: 150,
      date: "2026-09-27",
    });
    expect(state.isOpen).toBe(false);
  });

  test("no hours at all: closed with no next opening", () => {
    const empty: Schedule = { week: [], special: [] };
    const state = resolveOpenState(empty, { dayIndex: 2, minutes: 600, date: "2026-09-22" });
    expect(state).toEqual({ isOpen: false });
  });
});
