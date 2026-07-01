import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  THEME_PRESETS,
  THEME_FONTS,
  THEME_RADII,
  THEME_BACKGROUNDS,
  DEFAULT_THEME,
  isValidHex,
  type SurveyTheme,
} from "@/lib/survey-theme";
import { RotateCcw, Sparkles, Loader2 } from "lucide-react";
import { generateTheme } from "@/lib/theme-ai.functions";

// Display-only remap of preset ids → studio-branded names.
// Preset ids (in survey-theme.ts) stay the same so persisted themes still resolve.
const PRESET_LABEL: Record<string, string> = {
  ink: "Minimal Ivory",
  coral: "Warm SaaS",
  rose: "Playful Pulse",
  forest: "Fresh Gradient",
  indigo: "Editorial Dark",
  solar: "Sunlit",
};

const FONT_LABEL: Record<string, string> = {
  sans: "Clean",
  serif: "Editorial",
  soft: "Friendly",
  mono: "Technical",
};

const VIBE_CHIPS = [
  "Minimal Ivory",
  "Warm SaaS",
  "Playful Pulse",
  "Fresh Gradient",
  "Editorial Dark",
];

export function ThemePanel({
  theme,
  onChange,
}: {
  theme: SurveyTheme;
  onChange: (next: SurveyTheme) => void;
}) {
  const [hexDraft, setHexDraft] = useState(theme.accent ?? "");
  const [prompt, setPrompt] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generateFn = useServerFn(generateTheme);
  const aiMut = useMutation({
    mutationFn: (p: string) => generateFn({ data: { prompt: p } }),
    onSuccess: (next) => {
      if (!next || Object.keys(next).length === 0) {
        toast.message("No theme changes inferred — try a more specific prompt.");
        return;
      }
      const merged: SurveyTheme = { ...theme, ...next };
      if (next.preset && !next.accent) delete merged.accent;
      onChange(merged);
      setPrompt("");
      toast.success("Theme updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submitPrompt(text?: string) {
    const v = (text ?? prompt).trim();
    if (!v || aiMut.isPending) return;
    aiMut.mutate(v);
  }

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
      <div className="space-y-5 px-5 pb-5 pt-4">
        {/* Header */}
        <div>
          <h2 className="font-display text-sm font-semibold tracking-tight text-foreground">
            Form Design
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Customize how this survey looks and feels before you publish.
          </p>
        </div>

        {/* AI prompt — hero */}
        <Group label="Describe the look you want">
          <div className="rounded-xl border border-input bg-background px-2.5 py-2 focus-within:border-signal/60">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-1 h-4 w-4 shrink-0 text-signal" />
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitPrompt();
                  }
                }}
                placeholder="Example: warm orange, soft corners, ivory background, premium SaaS feel"
                disabled={aiMut.isPending}
                rows={2}
                className="min-h-[46px] flex-1 resize-none bg-transparent py-0.5 text-xs leading-relaxed outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
              />
            </div>
            <div className="mt-2 flex items-center justify-end">
              <button
                onClick={() => submitPrompt()}
                disabled={aiMut.isPending || !prompt.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-signal px-3 py-1.5 text-[11px] font-medium text-signal-foreground transition-opacity disabled:opacity-40"
              >
                {aiMut.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Generate theme
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {VIBE_CHIPS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setPrompt(s);
                  submitPrompt(s);
                }}
                disabled={aiMut.isPending}
                className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-signal/60 hover:text-foreground disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
        </Group>

        {/* Accent color */}
        <Group
          label="Accent color"
          hint="Controls buttons, selected states, and progress indicators."
        >
          <div className="flex flex-wrap gap-2.5">
            {THEME_PRESETS.map((p) => {
              const active = (theme.preset ?? "coral") === p.id && !theme.accent;
              const label = PRESET_LABEL[p.id] ?? p.name;
              return (
                <button
                  key={p.id}
                  onClick={() => update({ preset: p.id, accent: undefined })}
                  title={label}
                  aria-label={label}
                  className={`group relative h-9 w-9 overflow-hidden rounded-full ring-1 transition-transform hover:-translate-y-0.5 ${active ? "ring-2 ring-foreground" : "ring-border"}`}
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

        <Group label="Custom accent color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={
                isValidHex(hexDraft)
                  ? hexDraft.startsWith("#")
                    ? hexDraft
                    : `#${hexDraft}`
                  : "#FF7A45"
              }
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

        <Group label="Typography">
          <SegmentedControl
            value={theme.font ?? "sans"}
            options={THEME_FONTS.map((f) => ({ id: f.id, label: FONT_LABEL[f.id] ?? f.label }))}
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
    </div>
  );
}

function Group({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      {hint && <div className="mb-2 -mt-0.5 text-[11px] text-muted-foreground/80">{hint}</div>}
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
