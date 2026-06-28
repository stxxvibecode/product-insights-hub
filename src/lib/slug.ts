export function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40) || "survey";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}