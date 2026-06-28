import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export const getSurveyInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { survey_id: string }) =>
    z.object({ survey_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: survey, error: sErr } = await context.supabase
      .from("surveys")
      .select("id, title")
      .eq("id", data.survey_id)
      .single();
    if (sErr) throw new Error(sErr.message);
    const { data: questions } = await context.supabase
      .from("questions")
      .select("id, title, type, position, config")
      .eq("survey_id", data.survey_id)
      .order("position", { ascending: true });
    const { data: responses } = await context.supabase
      .from("responses")
      .select("id, started_at, completed_at")
      .eq("survey_id", data.survey_id);
    const responseIds = (responses ?? []).map((r) => r.id);
    let answers: { question_id: string; value: Json; value_text: string | null; value_number: number | null }[] = [];
    if (responseIds.length) {
      const { data: ans } = await context.supabase
        .from("answers")
        .select("question_id, value, value_text, value_number")
        .in("response_id", responseIds);
      answers = ans ?? [];
    }
    const total = responses?.length ?? 0;
    const completed = (responses ?? []).filter((r) => r.completed_at).length;
    const avgMs =
      (responses ?? [])
        .filter((r) => r.completed_at)
        .reduce((acc, r) => acc + (new Date(r.completed_at!).getTime() - new Date(r.started_at).getTime()), 0) /
      (completed || 1);
    return {
      survey,
      questions: questions ?? [],
      responses: responses ?? [],
      answers,
      stats: {
        total,
        completed,
        completionRate: total ? completed / total : 0,
        avgSeconds: completed ? Math.round(avgMs / 1000) : 0,
      },
    };
  });

export const listResponses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { survey_id: string }) =>
    z.object({ survey_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: responses } = await context.supabase
      .from("responses")
      .select("id, started_at, completed_at, respondent_token")
      .eq("survey_id", data.survey_id)
      .order("started_at", { ascending: false })
      .limit(200);
    const ids = (responses ?? []).map((r) => r.id);
    let answers: { response_id: string; question_id: string; value: Json; value_text: string | null; value_number: number | null }[] = [];
    if (ids.length) {
      const { data: ans } = await context.supabase
        .from("answers")
        .select("response_id, question_id, value, value_text, value_number")
        .in("response_id", ids);
      answers = ans ?? [];
    }
    const { data: questions } = await context.supabase
      .from("questions")
      .select("id, title, type, position")
      .eq("survey_id", data.survey_id)
      .order("position", { ascending: true });
    return { responses: responses ?? [], answers, questions: questions ?? [] };
  });

export const getSourceOfTruth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // All surveys for owner
    const { data: surveys } = await context.supabase
      .from("surveys")
      .select("id, title, status, created_at")
      .eq("owner_id", context.userId);
    const surveyIds = (surveys ?? []).map((s) => s.id);
    if (!surveyIds.length) {
      return {
        surveys: [],
        responses: [],
        questions: [],
        answers: [],
        tags: [],
        questionTags: [],
      };
    }
    const [{ data: responses }, { data: questions }, { data: tags }] = await Promise.all([
      context.supabase
        .from("responses")
        .select("id, survey_id, started_at, completed_at")
        .in("survey_id", surveyIds),
      context.supabase
        .from("questions")
        .select("id, survey_id, title, type")
        .in("survey_id", surveyIds),
      context.supabase.from("tags").select("id, name, color").eq("owner_id", context.userId),
    ]);
    const questionIds = (questions ?? []).map((q) => q.id);
    const responseIds = (responses ?? []).map((r) => r.id);
    let answers: { response_id: string; question_id: string; value: Json; value_text: string | null; value_number: number | null; created_at: string }[] = [];
    if (responseIds.length) {
      const { data: ans } = await context.supabase
        .from("answers")
        .select("response_id, question_id, value, value_text, value_number, created_at")
        .in("response_id", responseIds);
      answers = ans ?? [];
    }
    let questionTags: { question_id: string; tag_id: string }[] = [];
    if (questionIds.length) {
      const { data: qt } = await context.supabase
        .from("question_tags")
        .select("question_id, tag_id")
        .in("question_id", questionIds);
      questionTags = qt ?? [];
    }
    return {
      surveys: surveys ?? [],
      responses: responses ?? [],
      questions: questions ?? [],
      answers,
      tags: tags ?? [],
      questionTags,
    };
  });