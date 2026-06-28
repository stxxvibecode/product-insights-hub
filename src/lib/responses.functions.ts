import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const getPublicSurvey = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: survey, error } = await supabase
      .from("surveys")
      .select("id, slug, title, description, status, welcome_screen, thank_you_screen, theme")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!survey || survey.status !== "live") return { survey: null, questions: [] };
    const { data: questions } = await supabase
      .from("questions")
      .select("id, type, title, description, required, config, position")
      .eq("survey_id", survey.id)
      .order("position", { ascending: true });
    return { survey, questions: questions ?? [] };
  });

export const startResponse = createServerFn({ method: "POST" })
  .inputValidator((d: { survey_id: string; respondent_token: string }) =>
    z.object({ survey_id: z.string().uuid(), respondent_token: z.string().min(8).max(80) }).parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: inserted, error } = await supabase
      .from("responses")
      .insert({ survey_id: data.survey_id, respondent_token: data.respondent_token })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const submitAnswer = createServerFn({ method: "POST" })
  .inputValidator((d: { response_id: string; question_id: string; value: unknown }) =>
    z
      .object({
        response_id: z.string().uuid(),
        question_id: z.string().uuid(),
        value: z.unknown(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { error } = await supabase
      .from("answers")
      .upsert(
        {
          response_id: data.response_id,
          question_id: data.question_id,
          value: (data.value ?? null) as Json,
        },
        { onConflict: "response_id,question_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeResponse = createServerFn({ method: "POST" })
  .inputValidator((d: { response_id: string }) =>
    z.object({ response_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { error } = await supabase
      .from("responses")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", data.response_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });