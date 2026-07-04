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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = crypto.randomUUID();
    // Look up the current live version so we can stamp it on the response.
    // Service role bypasses RLS; we enforce the live check in app code.
    const { data: survey } = await supabaseAdmin
      .from("surveys")
      .select("version, status, is_edit_draft")
      .eq("id", data.survey_id)
      .maybeSingle();
    if (!survey || survey.status !== "live" || survey.is_edit_draft) {
      throw new Error("Survey is not live");
    }
    const { error } = await supabaseAdmin
      .from("responses")
      .insert({
        id,
        survey_id: data.survey_id,
        respondent_token: data.respondent_token,
        survey_version: survey.version,
      });
    if (error) throw new Error(error.message);
    return { id };
  });

export const submitAnswer = createServerFn({ method: "POST" })
  .inputValidator((d: { response_id: string; question_id: string; respondent_token: string; value: unknown }) =>
    z
      .object({
        response_id: z.string().uuid(),
        question_id: z.string().uuid(),
        respondent_token: z.string().min(8).max(80),
        value: z.unknown(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: response, error: responseError } = await supabaseAdmin
      .from("responses")
      .select("survey_id, respondent_token, surveys!inner(status)")
      .eq("id", data.response_id)
      .maybeSingle();
    if (responseError) throw new Error(responseError.message);
    if (!response || response.respondent_token !== data.respondent_token || response.surveys.status !== "live") {
      throw new Error("Response not found or survey is not live.");
    }

    const { data: question, error: questionError } = await supabaseAdmin
      .from("questions")
      .select("survey_id")
      .eq("id", data.question_id)
      .maybeSingle();
    if (questionError) throw new Error(questionError.message);
    if (!question || question.survey_id !== response.survey_id) {
      throw new Error("Question does not belong to this survey.");
    }

    const { error } = await supabaseAdmin
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
  .inputValidator((d: { response_id: string; respondent_token: string }) =>
    z.object({ response_id: z.string().uuid(), respondent_token: z.string().min(8).max(80) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Verify ownership via respondent_token and that the parent survey is
    // still live before stamping completed_at. Mirrors submitAnswer's guard.
    const { data: response, error: lookupError } = await supabaseAdmin
      .from("responses")
      .select("respondent_token, surveys!inner(status, is_edit_draft)")
      .eq("id", data.response_id)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (
      !response ||
      response.respondent_token !== data.respondent_token ||
      response.surveys.status !== "live" ||
      response.surveys.is_edit_draft
    ) {
      throw new Error("Response not found or survey is not live.");
    }
    const { error } = await supabaseAdmin
      .from("responses")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", data.response_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });