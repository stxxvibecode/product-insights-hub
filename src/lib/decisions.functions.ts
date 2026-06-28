import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export const listDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("decision_notes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; body?: string; evidence?: Record<string, unknown> }) =>
    z
      .object({
        title: z.string().min(1).max(160),
        body: z.string().max(2000).optional(),
        evidence: z.record(z.unknown()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase
      .from("decision_notes")
      .insert({
        owner_id: context.userId,
        title: data.title,
        body: data.body ?? null,
        evidence: (data.evidence ?? {}) as unknown as Json,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });