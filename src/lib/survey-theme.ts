import type { CSSProperties } from "react";

export type SurveyTheme = {
  preset?: string;
  accent?: string;
  background?: "solid" | "gradient" | "dots";
  font?: "sans" | "serif" | "mono" | "soft";
  radius?: "sharp" | "soft" | "pill";
};

export type ThemePreset = {
  id: string;
  name: string;
  accent: string;
  accentForeground: string;
  surface: string;
  swatch: string[];
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "coral",
    name: "Signal Coral",
    accent: "#FF7A45",
    accentForeground: "#1a0e08",
    surface: "#181a22",
    swatch: ["#181a22", "#FF7A45", "#F5E6D8"],
  },
  {
    id: "ink",
    name: "Ink & Ivory",
    accent: "#F2EAD8",
    accentForeground: "#0c0d10",
    surface: "#0c0d10",
    swatch: ["#0c0d10", "#F2EAD8", "#8C8678"],
  },
  {
    id: "forest",
    name: "Forest",
    accent: "#6FC2B0",
    accentForeground: "#06231f",
    surface: "#0e1a18",
    swatch: ["#0e1a18", "#6FC2B0", "#E8F1EE"],
  },
  {
    id: "indigo",
    name: "Studio Indigo",
    accent: "#7AA2F7",
    accentForeground: "#0a1024",
    surface: "#0f1322",
    swatch: ["#0f1322", "#7AA2F7", "#E6ECFA"],
  },
  {
    id: "rose",
    name: "Rose",
    accent: "#F472B6",
    accentForeground: "#260a17",
    surface: "#1a1018",
    swatch: ["#1a1018", "#F472B6", "#F8E6EE"],
  },
  {
    id: "solar",
    name: "Solar",
    accent: "#FFD166",
    accentForeground: "#2a1d05",
    surface: "#1a1608",
    swatch: ["#1a1608", "#FFD166", "#F8EFD2"],
  },
];

export const DEFAULT_THEME: SurveyTheme = {
  preset: "coral",
  background: "solid",
  font: "sans",
  radius: "soft",
};

const FONT_STACKS: Record<NonNullable<SurveyTheme["font"]>, string> = {
  sans: `"Inter Tight", ui-sans-serif, system-ui, sans-serif`,
  serif: `"Instrument Serif", ui-serif, Georgia, serif`,
  mono: `"JetBrains Mono", ui-monospace, monospace`,
  soft: `"DM Sans", ui-sans-serif, system-ui, sans-serif`,
};

const RADIUS_VALUES: Record<NonNullable<SurveyTheme["radius"]>, string> = {
  sharp: "0.125rem",
  soft: "0.75rem",
  pill: "1.5rem",
};

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function readableForeground(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.5 ? "#1a1208" : "#fff8f0";
}

export function resolvePreset(theme: SurveyTheme | null | undefined): ThemePreset {
  const t = theme ?? {};
  const preset = THEME_PRESETS.find((p) => p.id === (t.preset ?? "coral")) ?? THEME_PRESETS[0];
  return preset;
}

export function themeStyle(theme: SurveyTheme | null | undefined): CSSProperties {
  const t = { ...DEFAULT_THEME, ...(theme ?? {}) };
  const preset = resolvePreset(t);
  const accent = t.accent ?? preset.accent;
  const accentForeground = t.accent ? readableForeground(t.accent) : preset.accentForeground;
  const font = FONT_STACKS[t.font ?? "sans"];
  const radius = RADIUS_VALUES[t.radius ?? "soft"];
  const style = {
    // Override design tokens scoped to the themed subtree.
    "--signal": accent,
    "--signal-foreground": accentForeground,
    "--ring": accent,
    "--radius": radius,
    "--t-accent": accent,
    "--t-accent-foreground": accentForeground,
    "--t-surface": preset.surface,
    fontFamily: font,
  } as CSSProperties & Record<string, string>;
  return style;
}

export function backgroundClass(theme: SurveyTheme | null | undefined): string {
  const bg = theme?.background ?? "solid";
  if (bg === "gradient") {
    return "bg-[radial-gradient(circle_at_20%_-10%,color-mix(in_oklab,var(--t-accent)_22%,transparent),transparent_55%),radial-gradient(circle_at_80%_110%,color-mix(in_oklab,var(--t-accent)_14%,transparent),transparent_60%)]";
  }
  if (bg === "dots") {
    return "bg-[radial-gradient(color-mix(in_oklab,var(--t-accent)_18%,transparent)_1px,transparent_1px)] [background-size:14px_14px]";
  }
  return "";
}

export function isValidHex(s: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(s.trim());
}

export const THEME_FONTS: Array<{ id: NonNullable<SurveyTheme["font"]>; label: string }> = [
  { id: "sans", label: "Inter Tight" },
  { id: "serif", label: "Instrument Serif" },
  { id: "soft", label: "DM Sans" },
  { id: "mono", label: "JetBrains Mono" },
];

export const THEME_RADII: Array<{ id: NonNullable<SurveyTheme["radius"]>; label: string }> = [
  { id: "sharp", label: "Sharp" },
  { id: "soft", label: "Soft" },
  { id: "pill", label: "Pill" },
];

export const THEME_BACKGROUNDS: Array<{ id: NonNullable<SurveyTheme["background"]>; label: string }> = [
  { id: "solid", label: "Solid" },
  { id: "gradient", label: "Gradient" },
  { id: "dots", label: "Dots" },
];