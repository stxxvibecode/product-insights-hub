import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { SurveyTheme } from "./survey-theme";
import { fontFromBrandStyle, radiusFromButtonStyle } from "./survey-theme";

export type WorkspaceBrandProfile = {
  workspace_id: string;
  brand_name: string;
  product_description: string;
  logo_url: string | null;
  primary_color: string;
  background_color: string;
  text_color: string;
  accent_color: string;
  font_style: string;
  button_style: string;
  form_layout: string;
  tone: string;
  default_thank_you_message: string;
};

export type BrandSnapshot = WorkspaceBrandProfile;

export type WorkspaceBrandFormPatch = Partial<Omit<WorkspaceBrandProfile, "workspace_id">> & {
  preset?: string;
  accent?: string;
  background?: SurveyTheme["background"];
  font?: SurveyTheme["font"];
  radius?: SurveyTheme["radius"];
  hide_logo?: boolean;
};

export const DEFAULT_WORKSPACE_BRAND_PROFILE: WorkspaceBrandProfile = {
  workspace_id: "",
  brand_name: "Insightform",
  product_description: "A product feedback platform for modern product teams.",
  logo_url: null,
  primary_color: "#FF7A45",
  background_color: "#0D0F14",
  text_color: "#F2F2F0",
  accent_color: "#FF7A45",
  font_style: "modern",
  button_style: "rounded",
  form_layout: "one_question_at_a_time",
  tone: "professional",
  default_thank_you_message: "Thanks for your feedback. Your input helps us improve the product.",
};

export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export function workspaceBrandToFormPatch(
  profile: WorkspaceBrandProfile | null | undefined,
): WorkspaceBrandFormPatch {
  if (!profile) return {};
  return {
    primary_color: profile.primary_color,
    background_color: profile.background_color,
    text_color: profile.text_color,
    accent_color: profile.accent_color,
    font_style: profile.font_style,
    button_style: profile.button_style,
    form_layout: profile.form_layout,
    tone: profile.tone,
    default_thank_you_message: profile.default_thank_you_message,
    brand_name: profile.brand_name,
    product_description: profile.product_description,
    logo_url: profile.logo_url,
  };
}

export function mergeBrandPatch(
  base: WorkspaceBrandFormPatch,
  patch: WorkspaceBrandFormPatch,
): WorkspaceBrandFormPatch {
  return {
    ...base,
    ...patch,
    logo_url: patch.logo_url !== undefined ? patch.logo_url : base.logo_url,
  };
}

export function resolveWorkspaceBrand(
  workspace: WorkspaceBrandProfile | null | undefined,
  overrides: WorkspaceBrandFormPatch | null | undefined,
): WorkspaceBrandFormPatch {
  return mergeBrandPatch(
    workspaceBrandToFormPatch(workspace ?? DEFAULT_WORKSPACE_BRAND_PROFILE),
    overrides ?? {},
  );
}

export function themeFromBrand(profile: WorkspaceBrandFormPatch): SurveyTheme {
  const accent =
    normalizeHex(profile.accent_color) ??
    normalizeHex(profile.primary_color) ??
    normalizeHex(profile.accent) ??
    DEFAULT_WORKSPACE_BRAND_PROFILE.accent_color;
  const background =
    normalizeHex(profile.background_color) ?? DEFAULT_WORKSPACE_BRAND_PROFILE.background_color;
  const text = normalizeHex(profile.text_color) ?? DEFAULT_WORKSPACE_BRAND_PROFILE.text_color;
  const resolved: SurveyTheme = {
    preset: profile.preset,
    accent,
    background: profile.background ?? "solid",
    font: profile.font ?? fontFromBrandStyle(profile.font_style) ?? "sans",
    radius: profile.radius ?? radiusFromButtonStyle(profile.button_style) ?? "soft",
    tone: profile.tone ?? DEFAULT_WORKSPACE_BRAND_PROFILE.tone,
    button_style: profile.button_style ?? DEFAULT_WORKSPACE_BRAND_PROFILE.button_style,
    form_layout: profile.form_layout ?? DEFAULT_WORKSPACE_BRAND_PROFILE.form_layout,
    default_thank_you_message:
      profile.default_thank_you_message ??
      DEFAULT_WORKSPACE_BRAND_PROFILE.default_thank_you_message,
    brand_name: profile.brand_name ?? DEFAULT_WORKSPACE_BRAND_PROFILE.brand_name,
    product_description:
      profile.product_description ?? DEFAULT_WORKSPACE_BRAND_PROFILE.product_description,
    logo_url: profile.logo_url ?? null,
    primary_color: profile.primary_color ?? accent,
    background_color: background,
    text_color: text,
    accent_color: accent,
    font_style: profile.font_style ?? DEFAULT_WORKSPACE_BRAND_PROFILE.font_style,
    hide_logo: profile.hide_logo ?? false,
  };
  return resolved;
}

export function themeDiff(
  next: WorkspaceBrandFormPatch,
  baseline: WorkspaceBrandFormPatch,
): WorkspaceBrandFormPatch {
  const diff: WorkspaceBrandFormPatch = {};
  const keys: (keyof WorkspaceBrandFormPatch)[] = [
    "preset",
    "accent",
    "background",
    "font",
    "radius",
    "tone",
    "button_style",
    "form_layout",
    "default_thank_you_message",
    "brand_name",
    "product_description",
    "logo_url",
    "primary_color",
    "background_color",
    "text_color",
    "accent_color",
    "font_style",
    "hide_logo",
  ];
  for (const key of keys) {
    const nextValue = next[key];
    const baseValue = baseline[key];
    if (nextValue === undefined) continue;
    if (key === "logo_url") {
      if ((nextValue ?? null) !== (baseValue ?? null))
        diff.logo_url = (nextValue ?? null) as string | null;
      continue;
    }
    if (nextValue !== baseValue) diff[key] = nextValue as never;
  }
  return diff;
}

const WorkspaceBrandSchema = z.object({
  workspace_id: z.string().uuid().optional(),
  brand_name: z.string().min(1).max(120),
  product_description: z.string().max(500),
  logo_url: z.string().url().nullable().optional(),
  primary_color: z.string().regex(/^#?[0-9a-fA-F]{6}$/),
  background_color: z.string().regex(/^#?[0-9a-fA-F]{6}$/),
  text_color: z.string().regex(/^#?[0-9a-fA-F]{6}$/),
  accent_color: z.string().regex(/^#?[0-9a-fA-F]{6}$/),
  font_style: z.string().min(1).max(40),
  button_style: z.string().min(1).max(40),
  form_layout: z.string().min(1).max(80),
  tone: z.string().min(1).max(80),
  default_thank_you_message: z.string().max(300),
});

export const getWorkspaceBrandProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("workspace_brand_profiles")
      .select("*")
      .eq("workspace_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as WorkspaceBrandProfile;
    return {
      ...DEFAULT_WORKSPACE_BRAND_PROFILE,
      workspace_id: context.userId,
    };
  });

export const saveWorkspaceBrandProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: WorkspaceBrandProfile) => WorkspaceBrandSchema.parse(d))
  .handler(async ({ data, context }) => {
    const parsed = WorkspaceBrandSchema.parse({ ...data, workspace_id: context.userId });
    const payload = { ...parsed, workspace_id: context.userId };
    const { data: saved, error } = await context.supabase
      .from("workspace_brand_profiles")
      .upsert(payload, { onConflict: "workspace_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return saved as WorkspaceBrandProfile;
  });

export function brandSummary(profile: WorkspaceBrandFormPatch | null | undefined): string {
  const tone = profile?.tone ?? DEFAULT_WORKSPACE_BRAND_PROFILE.tone;
  const layout = profile?.form_layout ?? DEFAULT_WORKSPACE_BRAND_PROFILE.form_layout;
  const brand = profile?.brand_name ?? DEFAULT_WORKSPACE_BRAND_PROFILE.brand_name;
  return `${brand} · ${tone} · ${layout}`;
}

export function brandCopy(profile: WorkspaceBrandFormPatch | null | undefined) {
  const resolved = resolveWorkspaceBrand(DEFAULT_WORKSPACE_BRAND_PROFILE, profile ?? {});
  return {
    name: resolved.brand_name ?? DEFAULT_WORKSPACE_BRAND_PROFILE.brand_name,
    productDescription:
      resolved.product_description ?? DEFAULT_WORKSPACE_BRAND_PROFILE.product_description,
    thankYou:
      resolved.default_thank_you_message ??
      DEFAULT_WORKSPACE_BRAND_PROFILE.default_thank_you_message,
    tone: resolved.tone ?? DEFAULT_WORKSPACE_BRAND_PROFILE.tone,
    layout: resolved.form_layout ?? DEFAULT_WORKSPACE_BRAND_PROFILE.form_layout,
    buttonStyle: resolved.button_style ?? DEFAULT_WORKSPACE_BRAND_PROFILE.button_style,
    logoUrl: resolved.logo_url ?? null,
  };
}

export type QuestionInsightMetadata = {
  question_id: string;
  question_text: string;
  question_type: string;
  insight_kind: string;
  product_area: string;
  priority_signal: string;
};

const QUESTION_METADATA_MAP: Record<
  string,
  { insight_kind: string; product_area: string; priority_signal: string }
> = {
  short_text: { insight_kind: "signal", product_area: "general", priority_signal: "medium" },
  long_text: { insight_kind: "signal", product_area: "general", priority_signal: "medium" },
  email: { insight_kind: "contact", product_area: "general", priority_signal: "weak" },
  number: { insight_kind: "metric", product_area: "general", priority_signal: "medium" },
  single_choice: {
    insight_kind: "classification",
    product_area: "general",
    priority_signal: "medium",
  },
  multi_choice: {
    insight_kind: "classification",
    product_area: "general",
    priority_signal: "medium",
  },
  rating: { insight_kind: "sentiment", product_area: "general", priority_signal: "strong" },
  nps: { insight_kind: "loyalty", product_area: "general", priority_signal: "strong" },
  scale: { insight_kind: "sentiment", product_area: "general", priority_signal: "strong" },
  yes_no: { insight_kind: "binary", product_area: "general", priority_signal: "medium" },
};

export function buildQuestionInsightMetadata(input: {
  question_id: string;
  question_text: string;
  question_type: string;
  insight_kind?: string;
  product_area?: string;
  priority_signal?: string;
}): QuestionInsightMetadata {
  const fallback = QUESTION_METADATA_MAP[input.question_type] ?? QUESTION_METADATA_MAP.short_text;
  return {
    question_id: input.question_id,
    question_text: input.question_text,
    question_type: input.question_type,
    insight_kind: input.insight_kind ?? fallback.insight_kind,
    product_area: input.product_area ?? fallback.product_area,
    priority_signal: input.priority_signal ?? fallback.priority_signal,
  };
}

export function serializeBrandProfile(profile: WorkspaceBrandProfile): Json {
  return profile as unknown as Json;
}

export function deserializeBrandProfile(
  value: Json | null | undefined,
): WorkspaceBrandProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as WorkspaceBrandProfile;
}
