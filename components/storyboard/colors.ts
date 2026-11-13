/**
 * Corkboard colour coding. Values come from chapter metadata (pov / arc /
 * subplot) which is free text, so the colour is derived from a stable hash
 * rather than a fixed enum — the same name keeps the same colour everywhere.
 */

const PALETTE = [
  "#c8814a", // amber
  "#7d9a7e", // sage
  "#8b6b8f", // plum
  "#5f8a8b", // teal
  "#b06a5d", // brick
  "#a8894f", // ochre
  "#6b7fa8", // slate
  "#8f8f5a", // olive
];

export const UNASSIGNED_COLOR = "#7a6b5b";
export const UNASSIGNED_LABEL = "Unassigned";

export function colorForValue(value: string | null | undefined): string {
  const key = (value ?? "").trim();
  if (!key) return UNASSIGNED_COLOR;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function labelForValue(value: string | null | undefined): string {
  const key = (value ?? "").trim();
  return key || UNASSIGNED_LABEL;
}

export interface LegendEntry {
  value: string;
  label: string;
  color: string;
  count: number;
}

export function buildLegend(
  values: (string | null | undefined)[],
): LegendEntry[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = (raw ?? "").trim();
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => {
      if (!a[0]) return 1;
      if (!b[0]) return -1;
      return a[0].localeCompare(b[0]);
    })
    .map(([value, count]) => ({
      value,
      label: labelForValue(value),
      color: colorForValue(value),
      count,
    }));
}
