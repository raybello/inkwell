import { describe, expect, it, vi } from "vitest";
import {
  formatDate,
  initials,
  newId,
  readingTime,
  relativeTime,
  slugify,
  truncate,
  wordCount,
} from "@/lib/utils";

describe("newId", () => {
  it("prefixes the id and never repeats", () => {
    const a = newId("layer");
    const b = newId("layer");
    expect(a.startsWith("layer-")).toBe(true);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(10);
  });

  it("falls back to getRandomValues when randomUUID is unavailable", () => {
    const uuid = crypto.randomUUID;
    // Simulate a non-secure context (http://LAN-ip), where randomUUID is absent.
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const id = newId("asset");
      expect(id).toMatch(/^asset-[0-9a-f]{32}$/);
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", { value: uuid, configurable: true });
    }
  });
});

describe("formatting helpers", () => {
  it("wordCount counts runs, not spaces", () => {
    expect(wordCount("one  two\tthree\nfour")).toBe(4);
    expect(wordCount("")).toBe(0);
    expect(wordCount(null)).toBe(0);
  });

  it("slugify is stable and never returns empty", () => {
    expect(slugify("The Salt Road!")).toBe("the-salt-road");
    expect(slugify("  ---  ")).toBe("untitled");
    expect(slugify("x".repeat(100)).length).toBeLessThanOrEqual(60);
  });

  it("truncate adds the ellipsis at the limit", () => {
    expect(truncate("abc", 10)).toBe("abc");
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
    expect(truncate(null)).toBe("");
  });

  it("initials takes at most two words", () => {
    expect(initials("George R.R. Martin")).toBe("GR");
    expect(initials(null)).toBe("W");
  });

  it("readingTime floors at one minute", () => {
    expect(readingTime(0)).toBe("1 min read");
    expect(readingTime(500)).toBe("2 min read");
  });

  it("relativeTime buckets correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
    const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();
    expect(relativeTime(iso(0))).toBe("just now");
    expect(relativeTime(iso(5))).toBe("5m ago");
    expect(relativeTime(iso(120))).toBe("2h ago");
    expect(relativeTime(iso(60 * 24 * 3))).toBe("3d ago");
    expect(relativeTime(iso(60 * 24 * 40))).toBe("Apr 22, 2026");
    expect(relativeTime(null)).toBe("—");
    expect(formatDate(null)).toBe("—");
    vi.useRealTimers();
  });
});
