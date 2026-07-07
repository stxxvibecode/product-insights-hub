import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Palette } from "lucide-react";
import {
  DEFAULT_WORKSPACE_BRAND_PROFILE,
  getWorkspaceBrandProfile,
  saveWorkspaceBrandProfile,
  themeFromBrand,
  workspaceBrandToFormPatch,
  type WorkspaceBrandProfile,
} from "@/lib/brand.functions";
import { themeStyle, backgroundClass } from "@/lib/survey-theme";

const FONT_STYLES = ["modern", "editorial", "technical", "friendly"];
const BUTTON_STYLES = ["rounded", "pill", "square"];
const LAYOUTS = [
  { id: "one_question_at_a_time", label: "One question at a time" },
  { id: "single_page", label: "Single page" },
];
const TONES = ["professional", "friendly", "direct", "playful", "executive"];

export function BrandProfileCard() {
  const qc = useQueryClient();
  const fetchBrand = useServerFn(getWorkspaceBrandProfile);
  const saveBrand = useServerFn(saveWorkspaceBrandProfile);
  const { data, isLoading } = useQuery({
    queryKey: ["workspace-brand"],
    queryFn: () => fetchBrand(),
  });

  const [draft, setDraft] = useState<WorkspaceBrandProfile | null>(null);
  useEffect(() => {
    if (data && !draft) setDraft(data);
  }, [data, draft]);

  const save = useMutation({
    mutationFn: (profile: WorkspaceBrandProfile) => saveBrand({ data: profile }),
    onSuccess: (saved) => {
      qc.setQueryData(["workspace-brand"], saved);
      qc.invalidateQueries({ queryKey: ["workspace-brand"] });
      toast.success("Brand profile saved — new forms will inherit it automatically.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewTheme = useMemo(
    () => themeFromBrand(workspaceBrandToFormPatch(draft ?? DEFAULT_WORKSPACE_BRAND_PROFILE)),
    [draft],
  );

  if (isLoading || !draft) {
    return (
      <div className="mt-8 grid h-40 place-items-center rounded-2xl border border-border bg-card text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  function set<K extends keyof WorkspaceBrandProfile>(key: K, value: WorkspaceBrandProfile[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  return (
    <div className="mt-8 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Palette className="h-4 w-4 text-signal" /> Workspace brand profile
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Every new form — AI-generated, template, or manual — inherits these settings
            automatically. Override branding on a specific form without changing this profile.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Workspace / company name">
              <input
                value={draft.brand_name}
                onChange={(e) => set("brand_name", e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal/60"
              />
            </Field>
            <Field label="Logo URL">
              <input
                value={draft.logo_url ?? ""}
                onChange={(e) => set("logo_url", e.target.value.trim() || null)}
                placeholder="https://…/logo.png"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal/60"
              />
            </Field>
          </div>

          <Field
            label="Product description"
            hint="The AI uses this to write product-specific questions and copy."
          >
            <textarea
              value={draft.product_description}
              onChange={(e) => set("product_description", e.target.value)}
              rows={2}
              placeholder="e.g. A project management platform for freelance designers."
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal/60"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-4">
            <ColorField
              label="Primary"
              value={draft.primary_color}
              onChange={(v) => set("primary_color", v)}
            />
            <ColorField
              label="Background"
              value={draft.background_color}
              onChange={(v) => set("background_color", v)}
            />
            <ColorField
              label="Text"
              value={draft.text_color}
              onChange={(v) => set("text_color", v)}
            />
            <ColorField
              label="Accent"
              value={draft.accent_color}
              onChange={(v) => set("accent_color", v)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Font style">
              <Select
                value={draft.font_style}
                options={FONT_STYLES}
                onChange={(v) => set("font_style", v)}
              />
            </Field>
            <Field label="Button style">
              <Select
                value={draft.button_style}
                options={BUTTON_STYLES}
                onChange={(v) => set("button_style", v)}
              />
            </Field>
            <Field label="Default tone">
              <Select value={draft.tone} options={TONES} onChange={(v) => set("tone", v)} />
            </Field>
          </div>

          <Field label="Default form layout">
            <div className="inline-flex w-full rounded-md border border-border bg-background p-0.5">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => set("form_layout", l.id)}
                  className={`flex-1 rounded px-2 py-1.5 text-xs transition-colors ${draft.form_layout === l.id ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Default thank-you message">
            <textarea
              value={draft.default_thank_you_message}
              onChange={(e) => set("default_thank_you_message", e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal/60"
            />
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => draft && save.mutate(draft)}
              disabled={save.isPending || !draft.brand_name.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2 text-sm font-medium text-signal-foreground disabled:opacity-50"
            >
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save brand profile
            </button>
            <button
              onClick={() =>
                setDraft({
                  ...DEFAULT_WORKSPACE_BRAND_PROFILE,
                  workspace_id: draft.workspace_id,
                  brand_name: draft.brand_name,
                  product_description: draft.product_description,
                })
              }
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reset design to defaults
            </button>
          </div>
        </div>

        {/* Live brand preview */}
        <div
          className={`overflow-hidden rounded-xl border border-border p-5 ${backgroundClass(previewTheme)}`}
          style={themeStyle(previewTheme)}
        >
          <div className="flex items-center gap-2">
            {draft.logo_url ? (
              <img src={draft.logo_url} alt="" className="h-6 w-6 rounded object-contain" />
            ) : (
              <span className="grid h-6 w-6 place-items-center rounded bg-signal text-[10px] font-bold text-signal-foreground">
                {draft.brand_name.slice(0, 1).toUpperCase() || "A"}
              </span>
            )}
            <span className="text-xs font-medium">{draft.brand_name || "Your brand"}</span>
          </div>
          <div className="mt-5 text-lg font-semibold leading-snug">
            How was your experience with {draft.brand_name || "our product"}?
          </div>
          <div className="mt-4 space-y-1.5">
            {["Excellent", "Good", "Could be better"].map((o, i) => (
              <div
                key={o}
                className="flex items-center gap-2 border border-border px-3 py-2 text-xs"
                style={{ borderRadius: "var(--radius)" }}
              >
                <span className="grid h-4 w-4 place-items-center rounded-full border border-border text-[9px]">
                  {String.fromCharCode(65 + i)}
                </span>
                {o}
              </div>
            ))}
          </div>
          <button
            className="mt-4 bg-signal px-4 py-1.5 text-xs font-medium text-signal-foreground"
            style={{ borderRadius: "var(--radius)" }}
          >
            OK
          </button>
          <div className="mt-5 border-t border-border pt-3 text-[10px] text-muted-foreground">
            {draft.default_thank_you_message}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
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
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      {hint && <div className="-mt-0.5 mb-2 text-[11px] text-muted-foreground/80">{hint}</div>}
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#FF7A45"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded-md border border-border bg-transparent"
          aria-label={label}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs uppercase outline-none focus:border-signal/60"
        />
      </div>
    </Field>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm capitalize outline-none focus:border-signal/60"
    >
      {options.map((o) => (
        <option key={o} value={o} className="capitalize">
          {o}
        </option>
      ))}
    </select>
  );
}
