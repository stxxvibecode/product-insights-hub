import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { defaultConfigFor, defaultTitleFor, type QuestionType } from "./question-types";
import type { Json } from "@/integrations/supabase/types";

const QTYPES: [QuestionType, ...QuestionType[]] = [
  "short_text","long_text","email","number","single_choice","multi_choice","rating","nps","scale","yes_no",
];

export const addQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { survey_id: string; type: QuestionType }) =>
    z.object({ survey_id: z.string().uuid(), type: z.enum(QTYPES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Ownership enforced by RLS on questions via parent survey
    const { data: existing } = await context.supabase
      .from("questions")
      .select("position")
      .eq("survey_id", data.survey_id)
      .order("position", { ascending: false })
      .limit(1);
    const position = (existing?.[0]?.position ?? -1) + 1;
    const { data: inserted, error } = await context.supabase
      .from("questions")
      .insert({
        survey_id: data.survey_id,
        type: data.type,
        position,
        title: defaultTitleFor(data.type),
        config: defaultConfigFor(data.type) as unknown as Json,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const updateQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    title?: string;
    description?: string | null;
    required?: boolean;
    config?: unknown;
  }) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().max(280).optional(),
        description: z.string().max(500).nullable().optional(),
        required: z.boolean().optional(),
        config: z.unknown().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: updated, error } = await context.supabase
      .from("questions")
      .update(patch as Record<string, unknown>)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { survey_id: string; ids: string[] }) =>
    z.object({ survey_id: z.string().uuid(), ids: z.array(z.string().uuid()).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Update positions individually. Small N; acceptable.
    await Promise.all(
      data.ids.map((id, idx) =>
        context.supabase.from("questions").update({ position: idx }).eq("id", id).eq("survey_id", data.survey_id),
      ),
    );
    return { ok: true };
  });