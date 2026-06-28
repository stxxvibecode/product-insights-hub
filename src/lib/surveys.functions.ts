import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { makeSlug } from "./slug";

export const listSurveys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("surveys")
      .select("id, title, description, slug, status, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    // Counts in a follow-up call (RLS-safe simple aggregate per survey)
    const ids = (data ?? []).map((s) => s.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: resp } = await context.supabase
        .from("responses")
        .select("survey_id")
        .in("survey_id", ids);
      for (const r of resp ?? []) {
        counts[r.survey_id] = (counts[r.survey_id] ?? 0) + 1;
      }
    }
    return (data ?? []).map((s) => ({ ...s, response_count: counts[s.id] ?? 0 }));
  });

export const createSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; description?: string }) =>
    z.object({ title: z.string().min(1).max(120), description: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase
      .from("surveys")
      .insert({
        owner_id: context.userId,
        title: data.title,
        description: data.description ?? null,
        slug: makeSlug(data.title),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const getSurvey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: survey, error } = await context.supabase
      .from("surveys")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: questions } = await context.supabase
      .from("questions")
      .select("*")
      .eq("survey_id", data.id)
      .order("position", { ascending: true });
    return { survey, questions: questions ?? [] };
  });

export const updateSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    title?: string;
    description?: string | null;
    status?: "draft" | "live" | "closed";
    welcome_screen?: { title: string; description: string; button: string };
    thank_you_screen?: { title: string; description: string };
    theme?: Record<string, unknown>;
  }) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(120).optional(),
        description: z.string().max(500).nullable().optional(),
        status: z.enum(["draft", "live", "closed"]).optional(),
        welcome_screen: z
          .object({ title: z.string().max(120), description: z.string().max(500), button: z.string().max(40) })
          .optional(),
        thank_you_screen: z
          .object({ title: z.string().max(120), description: z.string().max(500) })
          .optional(),
        theme: z
          .object({
            preset: z.string().max(40).optional(),
            accent: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional(),
            background: z.enum(["solid", "gradient", "dots"]).optional(),
            font: z.enum(["sans", "serif", "mono", "soft"]).optional(),
            radius: z.enum(["sharp", "soft", "pill"]).optional(),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: updated, error } = await context.supabase
      .from("surveys")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

export const deleteSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("surveys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });