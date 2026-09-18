import { expect, test } from "@playwright/test";
import {
  checkDivergence,
  type Fingerprint,
  type PortfolioEntry,
  parseFingerprintBlock,
  sameFamily,
  summarize,
} from "../scripts/lib/divergence";

/**
 * Divergence rules, proven by tests rather than trusted — same pattern as
 * schema.spec.ts (pure data-level tests; no page, no server).
 */

const block = (json: string): string => `# Concept\n\n\`\`\`json fingerprint\n${json}\n\`\`\`\n`;

const validFingerprint = {
  client: "test-client",
  metaphorFamily: "proofing-basket",
  pageForm: "spine-rail",
  accentHex: "#3f6f8f",
  fontPairing: "editorial",
};

const entry = (over: Partial<PortfolioEntry>): PortfolioEntry => ({
  client: "shipped-site",
  date: "2026-07",
  businessType: "cafe",
  metaphorFamily: "time-of-day-arc",
  pageForm: "band-stack",
  accentHex: "#d9a441",
  fontPairing: "poster",
  ...over,
});

const fp = (over: Partial<Fingerprint>): Fingerprint => ({
  ...validFingerprint,
  ...over,
});

/** live values that agree with the fingerprint, so staleness never interferes. */
const liveFor = (f: Fingerprint): { fontPairing: string; accentHex: string } => ({
  fontPairing: f.fontPairing,
  accentHex: f.accentHex,
});

test.describe("parseFingerprintBlock", () => {
  test("parses a valid block", () => {
    const result = parseFingerprintBlock(block(JSON.stringify(validFingerprint)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fingerprint.metaphorFamily).toBe("proofing-basket");
  });

  test("parses the fallback info string (```fingerprint)", () => {
    const result = parseFingerprintBlock(
      `\`\`\`fingerprint\n${JSON.stringify(validFingerprint)}\n\`\`\``,
    );
    expect(result.ok).toBe(true);
  });

  test("no block → reason no-block, message names --print-template", () => {
    const result = parseFingerprintBlock("# Concept with no block\n");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no-block");
      expect(result.message).toContain("--print-template");
    }
  });

  test("rejects a non-slug metaphorFamily (rephrasing cannot defeat the check)", () => {
    const result = parseFingerprintBlock(
      block(JSON.stringify({ ...validFingerprint, metaphorFamily: "Time Of Day!" })),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("bad-field");
  });

  test("rejects an unknown fontPairing", () => {
    const result = parseFingerprintBlock(
      block(JSON.stringify({ ...validFingerprint, fontPairing: "comic-sans" })),
    );
    expect(result.ok).toBe(false);
  });

  test("rejects an argues entry with a short why", () => {
    const result = parseFingerprintBlock(
      block(
        JSON.stringify({
          ...validFingerprint,
          argues: [{ against: "shipped-site", axis: "metaphorFamily", why: "because" }],
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("40");
  });

  test("strips a BOM before matching", () => {
    const result = parseFingerprintBlock(`﻿${block(JSON.stringify(validFingerprint))}`);
    expect(result.ok).toBe(true);
  });
});

test.describe("sameFamily (anti-gaming)", () => {
  test("exact match", () => {
    expect(sameFamily("time-of-day-arc", "time-of-day-arc")).toBe(true);
  });
  test("token-set rephrasing is the same family", () => {
    expect(sameFamily("time-of-day-arc", "arc-of-the-day")).toBe(true);
  });
  test("genuinely different families do not match", () => {
    expect(sameFamily("proofing-basket", "time-of-day-arc")).toBe(false);
  });
});

test.describe("checkDivergence", () => {
  test("clean divergence → no findings beyond screenshot/furniture noise", () => {
    const f = fp({});
    const { findings } = checkDivergence(f, [entry({})], liveFor(f));
    expect(findings.filter((x) => x.severity === "fail")).toEqual([]);
  });

  test("metaphor repeat fails", () => {
    const f = fp({ metaphorFamily: "time-of-day-arc" });
    const { findings } = checkDivergence(f, [entry({})], liveFor(f));
    expect(findings.some((x) => x.rule === "metaphor-repeat" && x.severity === "fail")).toBe(true);
  });

  test("a valid argues entry downgrades the metaphor repeat to a warning", () => {
    const f = fp({
      metaphorFamily: "time-of-day-arc",
      argues: [
        {
          against: "shipped-site",
          axis: "metaphorFamily",
          why: "This client's world genuinely demands the repeat for reasons specific to them.",
        },
      ],
    });
    const { findings } = checkDivergence(f, [entry({})], liveFor(f));
    const repeat = findings.find((x) => x.rule === "metaphor-repeat");
    expect(repeat?.severity).toBe("warn");
  });

  test("pairing + accent hue family collision fails", () => {
    const f = fp({ fontPairing: "poster", accentHex: "#e09a2e" }); // amber-gold, like the entry
    const { findings } = checkDivergence(f, [entry({})], liveFor(f));
    expect(
      findings.some((x) => x.rule === "pairing-accent-collision" && x.severity === "fail"),
    ).toBe(true);
  });

  test("same pairing with a DIFFERENT accent family does not collide", () => {
    const f = fp({ fontPairing: "poster", accentHex: "#3f6f8f" }); // blue vs amber-gold
    const { findings } = checkDivergence(f, [entry({})], liveFor(f));
    expect(findings.some((x) => x.rule === "pairing-accent-collision")).toBe(false);
  });

  test("form + metaphor collision is NOT overridable by argues", () => {
    const f = fp({
      metaphorFamily: "time-of-day-arc",
      pageForm: "band-stack",
      argues: [
        {
          against: "shipped-site",
          axis: "metaphorFamily",
          why: "Even a fully argued metaphor repeat cannot excuse repeating the page form too.",
        },
        {
          against: "shipped-site",
          axis: "pageForm",
          why: "An argues entry for the pageForm axis exists but this rule must ignore it entirely.",
        },
      ],
    });
    const { findings } = checkDivergence(f, [entry({})], liveFor(f));
    const collision = findings.find((x) => x.rule === "form-metaphor-collision");
    expect(collision?.severity).toBe("fail");
  });

  test("stale fingerprint: fontPairing disagrees with business.json", () => {
    const f = fp({ fontPairing: "editorial" });
    const { findings } = checkDivergence(f, [entry({})], {
      fontPairing: "classic",
      accentHex: f.accentHex,
    });
    expect(findings.some((x) => x.rule === "stale-fingerprint" && x.severity === "fail")).toBe(
      true,
    );
  });

  test("stale fingerprint: accent hue family disagrees with business.json", () => {
    const f = fp({ accentHex: "#3f6f8f" }); // blue
    const { findings } = checkDivergence(f, [entry({})], {
      fontPairing: f.fontPairing,
      accentHex: "#d9a441", // amber-gold
    });
    expect(findings.some((x) => x.rule === "stale-fingerprint" && x.severity === "fail")).toBe(
      true,
    );
  });

  test("furniture used in 2+ entries warns", () => {
    const f = fp({ furniture: ["marquee-ticker"] });
    const entries = [
      entry({ client: "site-a", furniture: ["marquee-ticker"] }),
      entry({ client: "site-b", metaphorFamily: "ritual-sequence", furniture: ["marquee-ticker"] }),
    ];
    const { findings } = checkDivergence(f, entries, liveFor(f));
    expect(findings.some((x) => x.rule === "furniture-frequency")).toBe(true);
  });
});

test.describe("summarize", () => {
  test("counts families and lists unused pairings", () => {
    const summary = summarize([
      entry({}),
      entry({ client: "b", fontPairing: "poster" }),
      entry({ client: "c", fontPairing: "bold" }),
    ]);
    expect(summary.fontPairings.get("poster")).toBe(2);
    expect(summary.unusedPairings).not.toContain("poster");
    expect(summary.unusedPairings).toContain("classic");
    expect(summary.accentFamilies.get("amber-gold")).toBe(3);
  });
});
