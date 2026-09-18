import { expect, test } from "@playwright/test";
import business from "../src/content/business/business.json" with { type: "json" };
import { businessSchema } from "../src/content/business.schema";

/**
 * Schema guard tests — proof that the build-failing rules actually fail.
 *
 * These are the checks that keep a client site honest (typo'd keys, wrong
 * WhatsApp format, impossible dates, duplicate weekdays). A guard that
 * silently stops working is worse than no guard, because the whole workflow
 * is built on trusting it — so each one gets a negative test here.
 *
 * Pure data tests: no browser, no page. They run inside the Playwright suite
 * because that is the repo's only runner.
 */

type Json = Record<string, unknown>;

/** Deep clone of the real skeleton, typed loosely so cases can corrupt it. */
function corrupt(mutate: (draft: Json) => void): Json {
  const draft = JSON.parse(JSON.stringify(business)) as Json;
  mutate(draft);
  return draft;
}

/** Narrow helper — every path used below exists in the skeleton. */
function at(draft: Json, path: string): Json {
  let node: unknown = draft;
  for (const key of path.split(".")) {
    node = (node as Json)[key];
  }
  return node as Json;
}

test.describe("business.schema guards", () => {
  test("the shipped skeleton parses", () => {
    const result = businessSchema.safeParse(JSON.parse(JSON.stringify(business)));
    expect(result.success, JSON.stringify(result.error?.issues.slice(0, 3))).toBe(true);
  });

  const cases: Array<{ name: string; mutate: (draft: Json) => void }> = [
    {
      name: "unknown key at a nested path (a typo like 'emial')",
      mutate: (d) => {
        at(d, "data.contact").emial = "typo@example.com";
      },
    },
    {
      name: "unknown key deep in the frozen legal core",
      mutate: (d) => {
        at(d, "content.legal.accessibility.coordinator").phonee = "050-1234567";
      },
    },
    {
      name: "duplicate weekday in hours",
      mutate: (d) => {
        (at(d, "data").hours as unknown[]).push({
          day: "Sunday",
          label: "כפול",
          ranges: [],
        });
      },
    },
    {
      name: "zero-length opening range",
      mutate: (d) => {
        ((at(d, "data").hours as Json[])[0] as Json).ranges = [{ open: "09:00", close: "09:00" }];
      },
    },
    {
      name: "impossible calendar date in the accessibility statement",
      mutate: (d) => {
        at(d, "content.legal.accessibility").statementDate = "2026-13-45";
      },
    },
    {
      name: "siteUrl with a trailing slash (double-slash JSON-LD @ids)",
      mutate: (d) => {
        at(d, "data.seo").siteUrl = "https://real-client.co.il/";
      },
    },
    {
      name: "whatsapp in local format (broken wa.me link)",
      mutate: (d) => {
        at(d, "data.contact").whatsapp = "0501234567";
      },
    },
    {
      name: "malformed Google tag id",
      mutate: (d) => {
        at(d, "data.analytics").gtagId = "UA-12345";
      },
    },
  ];

  for (const { name, mutate } of cases) {
    test(`rejects: ${name}`, () => {
      expect(businessSchema.safeParse(corrupt(mutate)).success).toBe(false);
    });
  }
});
