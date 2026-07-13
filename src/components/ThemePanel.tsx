import { useEffect, useMemo, useRef, useState } from "react";
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
import { RotateCcw, Sparkles, Loader2, Plus, Trash2 } from "lucide-react";
import { generateTheme } from "@/lib/theme-ai.functions";
import type { TextFocus } from "@/components/QuestionPreview";

// Display-only remap of preset ids → studio-branded names.
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

export type ThemePanelTab = "content" | "size" | "style";

export type ThemePanelContent = {
  survey: {
    id: string;
    title: string;
    description: string | null;
    welcome_screen: { title?: string; description?: string; button?: string } | null;
    thank_you_screen: { title?: string; description?: string } | null;
  };
  questions: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    config: Record<string, unknown> | null;
  }>;
  onUpdateSurvey: (patch: {
    title?: string;
    description?: string | null;
    welcome_screen?: { title?: string; description?: string; button?: string } | null;
    thank_you_screen?: { title?: string; description?: string } | null;
  }) => void;
  onUpdateQuestion: (
    id: string,
    patch: { title?: string; description?: string | null; config?: Record<string, unknown> },
  ) => void;
};

export function ThemePanel({
  theme,
  onChange,
  defaultTab = "style",
  focus,
  content,
}: {
  theme: SurveyTheme;
  onChange: (next: SurveyTheme) => void;
  defaultTab?: ThemePanelTab;
  focus?: TextFocus | null;
  content?: ThemePanelContent;
}) {
  const [tab, setTab] = useState<ThemePanelTab>(defaultTab);
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

  // Auto-switch tab when a focus payload comes in.
  useEffect(() => {
    if (!focus) return;
    setTab("content");
  }, [focus]);

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

  const hasContent = Boolean(content);

  const tabs: Array<{ id: ThemePanelTab; label: string }> = useMemo(() => {
    const base: Array<{ id: ThemePanelTab; label: string }> = [];
    if (hasContent) base.push({ id: "content", label: "Content" });
    base.push({ id: "size", label: "Size" });
    base.push({ id: "style", label: "Style" });
    return base;
  }, [hasContent]);

  return (
    <div className="bg-background/60">
      <div className="space-y-5 px-5 pb-5 pt-4">
        {/* Header + AI prompt (always visible) */}
        <div>
          <h2 className="font-display text-sm font-semibold tracking-tight text-foreground">
            Form Design
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Edit text, size, and style — the canvas is your form.
          </p>
        </div>

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
                placeholder="Example: warm orange, larger headings, spacious layout"
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
                Generate
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

        {/* Tabs */}
        <div role="tablist" className="inline-flex w-full rounded-lg border border-border bg-background p-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded px-2 py-1.5 text-[11px] transition-colors ${tab === t.id ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "content" && content && (
          <ContentTab content={content} focus={focus ?? null} />
        )}

        {tab === "size" && <SizeTab theme={theme} update={update} />}

        {tab === "style" && (
          <StyleTab
            theme={theme}
            update={update}
            hexDraft={hexDraft}
            onHexChange={onHexChange}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Content -------------------------------- */

function ContentTab({ content, focus }: { content: ThemePanelContent; focus: TextFocus | null }) {
  const { survey, questions, onUpdateSurvey, onUpdateQuestion } = content;
  const welcome = survey.welcome_screen ?? {};
  const thanks = survey.thank_you_screen ?? {};

  return (
    <div className="space-y-6">
      <Section title="Form">
        <TextField
          label="Title"
          value={survey.title}
          onCommit={(v) => onUpdateSurvey({ title: v.trim() || survey.title })}
        />
        <TextField
          label="Description"
          value={survey.description ?? ""}
          multiline
          onCommit={(v) => onUpdateSurvey({ description: v.trim() ? v : null })}
        />
      </Section>

      <Section title="Welcome screen">
        <TextField
          label="Headline"
          value={welcome.title ?? ""}
          placeholder="We'd love your input."
          onCommit={(v) => onUpdateSurvey({ welcome_screen: { ...welcome, title: v } })}
        />
        <TextField
          label="Subtitle"
          value={welcome.description ?? ""}
          multiline
          placeholder="It takes about a minute."
          onCommit={(v) => onUpdateSurvey({ welcome_screen: { ...welcome, description: v } })}
        />
        <TextField
          label="Start button"
          value={welcome.button ?? ""}
          placeholder="Start"
          onCommit={(v) => onUpdateSurvey({ welcome_screen: { ...welcome, button: v } })}
        />
      </Section>

      <Section title="Questions" hint="Click any question in the canvas to jump here.">
        <div className="space-y-3">
          {questions.map((q, i) => (
            <QuestionBlock
              key={q.id}
              index={i}
              q={q}
              autoOpen={focus ? "questionId" in focus && focus.questionId === q.id : false}
              focus={focus && "questionId" in focus && focus.questionId === q.id ? focus : null}
              onUpdate={(patch) => onUpdateQuestion(q.id, patch)}
            />
          ))}
          {questions.length === 0 && (
            <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              No questions yet. Add one from the canvas.
            </div>
          )}
        </div>
      </Section>

      <Section title="Thank-you screen">
        <TextField
          label="Headline"
          value={thanks.title ?? ""}
          placeholder="Thank you."
          onCommit={(v) => onUpdateSurvey({ thank_you_screen: { ...thanks, title: v } })}
        />
        <TextField
          label="Message"
          value={thanks.description ?? ""}
          multiline
          placeholder="Your response was recorded."
          onCommit={(v) => onUpdateSurvey({ thank_you_screen: { ...thanks, description: v } })}
        />
      </Section>
    </div>
  );
}

function QuestionBlock({
  index,
  q,
  autoOpen,
  focus,
  onUpdate,
}: {
  index: number;
  q: ThemePanelContent["questions"][number];
  autoOpen: boolean;
  focus: TextFocus | null;
  onUpdate: (patch: {
    title?: string;
    description?: string | null;
    config?: Record<string, unknown>;
  }) => void;
}) {
  const [open, setOpen] = useState(autoOpen);
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen, focus]);

  const cfg = (q.config ?? {}) as {
    options?: string[];
    minLabel?: string;
    maxLabel?: string;
  };
  const options = cfg.options ?? [];
  const isChoice = q.type === "single_choice" || q.type === "multi_choice";
  const isScale = q.type === "scale";

  return (
    <div className="rounded-lg border border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="font-mono text-[10px] text-muted-foreground">
          Q{String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {q.title || "Untitled question"}
        </span>
        <span className="text-[10px] text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <TextField
            label="Title"
            value={q.title}
            autoFocusOn={focus?.kind === "question-title"}
            onCommit={(v) => v.trim() && v.trim() !== q.title && onUpdate({ title: v.trim() })}
          />
          <TextField
            label="Description"
            value={q.description ?? ""}
            multiline
            autoFocusOn={focus?.kind === "question-description"}
            onCommit={(v) => onUpdate({ description: v.trim() ? v : null })}
          />
          {isChoice && (
            <OptionsEditor
              options={options}
              focusIndex={focus?.kind === "question-option" ? focus.index : null}
              onChange={(next) => onUpdate({ config: { ...cfg, options: next } })}
            />
          )}
          {isScale && (
            <div className="grid grid-cols-2 gap-2">
              <TextField
                label="Min label"
                value={cfg.minLabel ?? "Low"}
                autoFocusOn={focus?.kind === "scale-min"}
                onCommit={(v) => onUpdate({ config: { ...cfg, minLabel: v.trim() || "Low" } })}
              />
              <TextField
                label="Max label"
                value={cfg.maxLabel ?? "High"}
                autoFocusOn={focus?.kind === "scale-max"}
                onCommit={(v) => onUpdate({ config: { ...cfg, maxLabel: v.trim() || "High" } })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OptionsEditor({
  options,
  focusIndex,
  onChange,
}: {
  options: string[];
  focusIndex: number | null;
  onChange: (next: string[]) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Options
      </div>
      <div className="space-y-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <OptionInput
              value={opt}
              autoFocusOn={focusIndex === i}
              onCommit={(v) => {
                const next = options.slice();
                next[i] = v;
                onChange(next);
              }}
            />
            <button
              type="button"
              onClick={() => options.length > 1 && onChange(options.filter((_, j) => j !== i))}
              disabled={options.length <= 1}
              className="text-muted-foreground hover:text-rose-400 disabled:opacity-30"
              aria-label="Remove option"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...options, `Option ${options.length + 1}`])}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add option
        </button>
      </div>
    </div>
  );
}

function OptionInput({
  value,
  autoFocusOn,
  onCommit,
}: {
  value: string;
  autoFocusOn?: boolean;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (autoFocusOn && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [autoFocusOn]);
  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = draft.trim();
        if (!v) {
          setDraft(value);
          return;
        }
        if (v !== value) onCommit(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:border-signal/60"
    />
  );
}

function TextField({
  label,
  value,
  placeholder,
  multiline,
  autoFocusOn,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  autoFocusOn?: boolean;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (autoFocusOn && ref.current) {
      ref.current.focus();
      if ("select" in ref.current) ref.current.select();
    }
  }, [autoFocusOn]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      {multiline ? (
        <textarea
          ref={(el) => {
            ref.current = el;
          }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-signal/60"
        />
      ) : (
        <input
          ref={(el) => {
            ref.current = el;
          }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-signal/60"
        />
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </div>
        {hint && <div className="text-[10px] text-muted-foreground/70">{hint}</div>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/* --------------------------------- Size ---------------------------------- */

function SizeTab({
  theme,
  update,
}: {
  theme: SurveyTheme;
  update: (patch: Partial<SurveyTheme>) => void;
}) {
  return (
    <div className="space-y-5">
      <Group label="Text scale" hint="Master multiplier for every text size.">
        <SegmentedControl
          value={theme.text_scale ?? "m"}
          options={[
            { id: "s", label: "S" },
            { id: "m", label: "M" },
            { id: "l", label: "L" },
          ]}
          onChange={(v) => update({ text_scale: v })}
        />
      </Group>
      <Group label="Heading size">
        <SegmentedControl
          value={theme.heading_size ?? "lg"}
          options={[
            { id: "sm", label: "SM" },
            { id: "md", label: "MD" },
            { id: "lg", label: "LG" },
            { id: "xl", label: "XL" },
          ]}
          onChange={(v) => update({ heading_size: v })}
        />
      </Group>
      <Group label="Body size">
        <SegmentedControl
          value={theme.body_size ?? "md"}
          options={[
            { id: "sm", label: "SM" },
            { id: "md", label: "MD" },
            { id: "lg", label: "LG" },
          ]}
          onChange={(v) => update({ body_size: v })}
        />
      </Group>
      <Group label="Button size">
        <SegmentedControl
          value={theme.button_size ?? "md"}
          options={[
            { id: "sm", label: "SM" },
            { id: "md", label: "MD" },
            { id: "lg", label: "LG" },
          ]}
          onChange={(v) => update({ button_size: v })}
        />
      </Group>
      <Group label="Density" hint="Spacing between the elements of a question.">
        <SegmentedControl
          value={theme.density ?? "comfortable"}
          options={[
            { id: "compact", label: "Compact" },
            { id: "comfortable", label: "Comfortable" },
            { id: "spacious", label: "Spacious" },
          ]}
          onChange={(v) => update({ density: v })}
        />
      </Group>
    </div>
  );
}

/* -------------------------------- Style ---------------------------------- */

function StyleTab({
  theme,
  update,
  hexDraft,
  onHexChange,
}: {
  theme: SurveyTheme;
  update: (patch: Partial<SurveyTheme>) => void;
  hexDraft: string;
  onHexChange: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <Group label="Accent color" hint="Buttons, selected states, and progress indicators.">
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
        onClick={() => update({ ...DEFAULT_THEME })}
        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="h-3 w-3" /> Reset to default
      </button>
    </div>
  );
}

/* ------------------------------- Primitives ------------------------------- */

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