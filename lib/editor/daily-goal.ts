"use client";

/** Local-only writing-goal tracking: words added today, per project. */

const PREFIX = "inkwell:daily";

export function todayStamp(date = new Date()) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function storageKey(projectId: string, date = new Date()) {
  return `${PREFIX}:${projectId}:${todayStamp(date)}`;
}

export function readDailyWords(projectId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function addDailyWords(projectId: string, delta: number): number {
  if (typeof window === "undefined" || !Number.isFinite(delta) || delta <= 0) return readDailyWords(projectId);
  try {
    const next = readDailyWords(projectId) + Math.round(delta);
    window.localStorage.setItem(storageKey(projectId), String(next));
    // prune older days so the key space stays tiny
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(`${PREFIX}:${projectId}:`) && key !== storageKey(projectId)) {
        window.localStorage.removeItem(key);
      }
    }
    return next;
  } catch {
    return readDailyWords(projectId);
  }
}
