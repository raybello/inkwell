import { describe, expect, it } from "vitest";
import {
  clampRpm,
  generateApiKey,
  hashApiKey,
  isApiScope,
  normalizeScopes,
  parseApiKey,
  safeHashEqual,
} from "@/lib/api/keys";
import { API_SCOPES } from "@/lib/api/types";

describe("api key format", () => {
  it("generates a key that parses back to its own prefix", () => {
    const { key, prefix, hash } = generateApiKey();
    const parsed = parseApiKey(key);
    expect(parsed).not.toBeNull();
    expect(parsed!.prefix).toBe(prefix);
    expect(hash).toBe(hashApiKey(key));
  });

  it("two generated keys never collide", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const { key } = generateApiKey();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("every generated key parses back to its exact stored prefix", () => {
    for (let i = 0; i < 2_000; i++) {
      const { key, prefix } = generateApiKey();
      expect(parseApiKey(key)?.prefix).toBe(prefix);
    }
  });

  it("rejects malformed keys", () => {
    for (const bad of ["", "   ", "short", "ink_live_x", "ink_live_tooshortprefixandsecret_x", "live_abcdefghij_abcdefghij", "ink_live_abcdefghij_", "ink_live_@@@@@@@@@@@_aaaaaaaaaaaaaaaaaaaa"]) {
      expect(parseApiKey(bad)).toBeNull();
    }
  });

  it("hash is deterministic sha256 hex", () => {
    const h = hashApiKey("ink_live_testprefix_thesecretvaluehere1234");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashApiKey("ink_live_testprefix_thesecretvaluehere1234"));
  });
});

describe("safeHashEqual", () => {
  it("compares equal strings true, unequal false", () => {
    const a = "a".repeat(64);
    expect(safeHashEqual(a, a)).toBe(true);
    expect(safeHashEqual(a, "b".repeat(64))).toBe(false);
  });

  it("rejects mismatched lengths and non-strings without throwing", () => {
    expect(safeHashEqual("abc", "abcd")).toBe(false);
    // Deliberately passing wrong types to prove the guard never throws.
    expect(safeHashEqual(null as never, "abc")).toBe(false);
    expect(safeHashEqual("abc", undefined as never)).toBe(false);
  });
});

describe("normalizeScopes", () => {
  it("keeps only known scopes, deduped", () => {
    const known = [API_SCOPES[0], API_SCOPES[0], API_SCOPES[1]];
    const out = normalizeScopes([...known, "not-a-scope", 42, null]);
    expect(out).toEqual([API_SCOPES[0], API_SCOPES[1]]);
  });

  it("returns [] for non-array input", () => {
    expect(normalizeScopes(undefined)).toEqual([]);
    expect(normalizeScopes("projects:read")).toEqual([]);
  });

  it("isApiScope agrees with the canonical list", () => {
    for (const s of API_SCOPES) expect(isApiScope(s)).toBe(true);
    expect(isApiScope("everything:admin")).toBe(false);
  });
});

describe("clampRpm", () => {
  it("clamps to 1..6000 and falls back on junk", () => {
    expect(clampRpm(50)).toBe(50);
    expect(clampRpm(0)).toBe(1);
    expect(clampRpm(-5)).toBe(1);
    expect(clampRpm(99_999)).toBe(6000);
    expect(clampRpm(42.6)).toBe(43);
    expect(clampRpm("nope")).toBe(100);
    expect(clampRpm(undefined, 250)).toBe(250);
  });
});
