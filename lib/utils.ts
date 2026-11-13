import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function relativeTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

export function formatNumber(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("en-US");
}

export function wordCount(text: string | null | undefined) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function initials(name: string | null | undefined, fallback = "W") {
  if (!name) return fallback;
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "untitled";
}

export function readingTime(words: number) {
  const mins = Math.max(1, Math.round(words / 250));
  return `${mins} min read`;
}

export function truncate(s: string | null | undefined, n = 140) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export function isImage(mime: string | null | undefined) {
  return !!mime && mime.startsWith("image/");
}
