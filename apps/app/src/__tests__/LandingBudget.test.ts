import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { checkLandingBudget } from "../../../../scripts/landing-budget.mjs";

const chunk = (fileName: string, code: string, imports: string[] = []) => ({
  fileName,
  code,
  imports,
  isEntry: fileName === "entry.js",
  moduleIds: fileName === "home.js" ? ["/app/src/routes/index.lazy.tsx"] : [],
});

describe("landing JavaScript budget", () => {
  it("counts lazy Home and shared static imports once, but excludes other lazy pages", () => {
    const chunks = [
      chunk("entry.js", "entry", ["shared.js"]),
      chunk("home.js", "home", ["shared.js"]),
      chunk("shared.js", "é", ["entry.js"]),
      chunk("account.js", "x".repeat(250000)),
    ];
    const result = checkLandingBudget(chunks);
    expect(result.files.sort()).toEqual(["entry.js", "home.js", "shared.js"]);
    expect(result.raw).toBe(11);
    expect(result.gzip).toBe(
      ["entry", "home", "é"].reduce(
        (sum, code) => sum + gzipSync(code).byteLength,
        0,
      ),
    );
  });
  it("fails when Home or an imported chunk cannot be accounted for", () => {
    expect(() => checkLandingBudget([chunk("entry.js", "")])).toThrow(
      "could not locate",
    );
    expect(() =>
      checkLandingBudget([
        chunk("entry.js", "", ["missing.js"]),
        chunk("home.js", ""),
      ]),
    ).toThrow("cannot account");
  });
  it("fails on excessive raw bytes even for highly compressible code", () => {
    expect(() =>
      checkLandingBudget([
        chunk("entry.js", "x".repeat(240001)),
        chunk("home.js", ""),
      ]),
    ).toThrow("Budget exceeded");
  });
  it("fails on excessive gzip bytes even below the raw limit", () => {
    let state = 42;
    const code = Array.from({ length: 180000 }, () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return String.fromCharCode(32 + ((state >>> 0) % 95));
    }).join("");
    expect(Buffer.byteLength(code)).toBeLessThan(240000);
    expect(() =>
      checkLandingBudget([chunk("entry.js", code), chunk("home.js", "")]),
    ).toThrow("Budget exceeded");
  });
});
