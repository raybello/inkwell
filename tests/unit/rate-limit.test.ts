import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumeRateLimit, resetRateLimits } from "@/lib/api/rate-limit";

describe("consumeRateLimit (token bucket)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    resetRateLimits();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("grants up to the limit then blocks with a retry-after", () => {
    const rpm = 5;
    for (let i = 0; i < rpm; i++) {
      const r = consumeRateLimit("key-a", rpm);
      expect(r.retryAfter).toBe(0);
      expect(r.remaining).toBe(rpm - i - 1);
    }
    const blocked = consumeRateLimit("key-a", rpm);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("refills over time at rpm/60 tokens per second", () => {
    const rpm = 60; // 1 token per second
    consumeRateLimit("key-b", rpm); // 59 left
    for (let i = 0; i < 59; i++) consumeRateLimit("key-b", rpm); // drain
    expect(consumeRateLimit("key-b", rpm).retryAfter).toBeGreaterThan(0);
    vi.advanceTimersByTime(10_000); // +10 tokens
    const r = consumeRateLimit("key-b", rpm);
    expect(r.retryAfter).toBe(0);
    expect(r.remaining).toBe(9);
  });

  it("buckets are independent per key id", () => {
    consumeRateLimit("key-c", 1);
    expect(consumeRateLimit("key-c", 1).retryAfter).toBeGreaterThan(0);
    expect(consumeRateLimit("key-d", 1).retryAfter).toBe(0);
  });

  it("rpm=0 falls back to 100; negative clamps to 1", () => {
    expect(consumeRateLimit("key-e", 0).limit).toBe(100);
    expect(consumeRateLimit("key-f", -3).limit).toBe(1);
  });

  it("never exceeds the cap after a long idle period", () => {
    const rpm = 3;
    consumeRateLimit("key-g", rpm);
    vi.advanceTimersByTime(60 * 60 * 1000); // an hour idle
    for (let i = 0; i < rpm; i++) expect(consumeRateLimit("key-g", rpm).retryAfter).toBe(0);
    expect(consumeRateLimit("key-g", rpm).retryAfter).toBeGreaterThan(0);
  });
});
