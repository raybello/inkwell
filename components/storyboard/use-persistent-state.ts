"use client";

import * as React from "react";

/**
 * Small localStorage-backed state for view preferences (zoom, colour mode).
 * Reads after mount so SSR markup and the first client render always agree.
 */
export function usePersistentState<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): [T, (next: T) => void] {
  const [value, setValue] = React.useState<T>(fallback);
  const allowedRef = React.useRef(allowed);
  allowedRef.current = allowed;

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw && (allowedRef.current as readonly string[]).includes(raw)) {
        setValue(raw as T);
      }
    } catch {
      // storage can be unavailable (private mode, quota) — keep the fallback
    }
  }, [key]);

  const update = React.useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // ignore
      }
    },
    [key],
  );

  return [value, update];
}

export function usePersistentFlag(
  key: string,
  fallback: boolean,
): [boolean, (next: boolean) => void] {
  const [value, setValue] = usePersistentState<"on" | "off">(key, fallback ? "on" : "off", [
    "on",
    "off",
  ]);
  const update = React.useCallback(
    (next: boolean) => setValue(next ? "on" : "off"),
    [setValue],
  );
  return [value === "on", update];
}
