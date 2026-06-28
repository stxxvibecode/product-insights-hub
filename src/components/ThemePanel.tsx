import { useEffect, useRef, useState } from "react";
import {
  THEME_PRESETS,
  THEME_FONTS,
  THEME_RADII,
  THEME_BACKGROUNDS,
  DEFAULT_THEME,
  isValidHex,
  type SurveyTheme,
} from "@/lib/survey-theme";
import { Paintbrush, RotateCcw } from "lucide-react";

export function ThemePanel({
  theme,
  onChange,
}: {
  theme: SurveyTheme;
  onChange: (next: SurveyTheme) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(theme.accent ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHexDraft(theme.accent ?? "");
  }, [theme.accent]);

  function update(patch: Partial<SurveyTheme>) {
    onChange({ ...theme, ...patch });
  }

  function onHexChange(v: string) {
    setHexDraft(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (isValidHex(v)) {
        const hex = v.startsWith("#") ? v : `#${v}`;
        update({ accent: hex });
      } else if (v === "") {
        update({ accent: undefined });
      }
    }, 350);
  }

  return (
    <div className="border-b border-border bg-background/60">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="inline-flex items-center gap-2">
          <Paintbrush className="h-3 w-3" />
          Brand & theme
        </span>
        <span className="font-mono text-[10px] normal-case tracking-normal">
          {open ? "Hide" : "Customize"}
        </span>
      </button>
      {open && (
        <div className="space-y-4 px-4 pb-4 pt-1">
          <Group label="Palette">
            <div className="flex flex-wrap gap-2">
              {THEME_PRESETS.map((p) => {
                const active = (theme.preset ?? "coral") === p.id && !theme.accent;
                return (
                  <button
                    key={p.id}
                    onClick={() => update({ preset: p.id, accent: undefined })}
                    title={p.name}
                    className={`group relative h-8 w-8 overflow-hidden rounded-full ring-1 transition-transform hover:-translate-y-0.5 ${active ? "ring-2 ring-foreground" : "ring-border"}`}
                    style={{ background: p.swatch[0] }}
                  >
                    <span
                      className="absolute inset-1 rounded-full"
                      style={{ background: p.accent }}
                    />
                  </button>
                );
              })}
            </div>
          </Group>

          <Group label="Custom accent">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={isValidHex(hexDraft) ? (hexDraft.startsWith("#") ? hexDraft : `#${hexDraft}`) : "#FF7A45"}
                onChange={(e) => onHexChange(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded-md border border-border bg-transparent"
                aria-label="Accent color"
              />
              <input
                value={hexDraft}
                onChange={(e) => onHexChange(e.target.value)}
                placeholder="#FF7A45"
                className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs uppercase outline-none focus:border-signal/60"
              />
            </div>
          </Group>

          <Group label="Background">
            <SegmentedControl
              value={theme.background ?? "solid"}
              options={THEME_BACKGROUNDS}
              onChange={(v) => update({ background: v })}
            />
          </Group>

          <Group label="Font">
            <SegmentedControl
              value={theme.font ?? "sans"}
              options={THEME_FONTS}
              onChange={(v) => update({ font: v })}
            />
          </Group>

          <Group label="Corners">
            <SegmentedControl
              value={theme.radius ?? "soft"}
              options={THEME_RADII}
              onChange={(v) => update({ radius: v })}
            />
          </Group>

          <button
            onClick={() => onChange({ ...DEFAULT_THEME })}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> Reset to default
          </button>
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-md border border-border bg-background p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 rounded px-2 py-1 text-[11px] transition-colors ${value === o.id ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}