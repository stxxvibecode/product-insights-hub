import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { makeSlug } from "./slug";

export const listSurveys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { limit?: number; offset?: number; status?: "draft" | "live" | "closed" }) =>
    z
      .object({
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
        status: z.enum(["draft", "live", "closed"]).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const limit = data.limit ?? 50;
    const offset = data.offset ?? 0;
    let q = context.supabase
      .from("surveys")
      .select("id, title, description, slug, status, updated_at", { count: "exact" })
      .eq("is_edit_draft", false)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((s) => s.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: resp } = await context.supabase
        .from("responses")
        .select("survey_id")
        .in("survey_id", ids);
      for (const r of resp ?? []) counts[r.survey_id] = (counts[r.survey_id] ?? 0) + 1;
    }
    const withCounts = (rows ?? []).map((s) => ({ ...s, response_count: counts[s.id] ?? 0 }));
    return { rows: withCounts, total: count ?? withCounts.length, limit, offset };
  });

// Lightweight list for sidebar Recents — no counts, minimal columns.
export const listRecentSurveys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { limit?: number }) =>
    z.object({ limit: z.number().int().min(1).max(20).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const limit = data.limit ?? 5;
    const { data: rows, error } = await context.supabase
      .from("surveys")
      .select("id, title, updated_at")
      .eq("is_edit_draft", false)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; description?: string }) =>
    z
      .object({ title: z.string().min(1).max(120), description: z.string().max(500).optional() })
      .parse(d),
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
  .inputValidator(
    (d: {
      id: string;
      title?: string;
      description?: string | null;
      status?: "draft" | "live" | "closed";
      welcome_screen?: { title: string; description: string; button: string };
      thank_you_screen?: { title: string; description: string };
      theme?: Record<string, unknown>;
      brand_overrides?: Record<string, unknown>;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          title: z.string().min(1).max(120).optional(),
          description: z.string().max(500).nullable().optional(),
          status: z.enum(["draft", "live", "closed"]).optional(),
          welcome_screen: z
            .object({
              title: z.string().max(120),
              description: z.string().max(500),
              button: z.string().max(40),
            })
            .optional(),
          thank_you_screen: z
            .object({ title: z.string().max(120), description: z.string().max(500) })
            .optional(),
          theme: z
            .object({
              preset: z.string().max(40).optional(),
              accent: z
                .string()
                .regex(/^#?[0-9a-fA-F]{6}$/)
                .optional(),
              background: z.enum(["solid", "gradient", "dots"]).optional(),
              font: z.enum(["sans", "serif", "mono", "soft"]).optional(),
              radius: z.enum(["sharp", "soft", "pill"]).optional(),
            })
            .optional(),
          brand_overrides: z.record(z.string(), z.unknown()).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, brand_overrides, ...patch } = data;
    const fullPatch: Record<string, unknown> = { ...patch };
    if (brand_overrides !== undefined) fullPatch.brand_overrides = brand_overrides;
    const { data: updated, error } = await context.supabase
      .from("surveys")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(fullPatch as any)
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
