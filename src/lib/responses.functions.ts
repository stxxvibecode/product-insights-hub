import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  DEFAULT_WORKSPACE_BRAND_PROFILE,
  resolveWorkspaceBrand,
  themeFromBrand,
  type WorkspaceBrandFormPatch,
  type WorkspaceBrandProfile,
} from "./brand.functions";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
  referrer: string | null;
};

async function requestMeta(): Promise<RequestMeta> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const headers = getRequest()?.headers;
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = headers?.get("cf-connecting-ip") ?? headers?.get("x-real-ip") ?? forwarded ?? null;
  return {
    ipAddress: normalizeIp(ip),
    userAgent: headers?.get("user-agent")?.slice(0, 500) ?? null,
    referrer: headers?.get("referer")?.slice(0, 1000) ?? null,
  };
}

function normalizeIp(value: string | null | undefined) {
  if (!value || value.length > 45) return null;
  return /^[0-9a-fA-F:.]+$/.test(value) ? value : null;
}

async function consumeResponseWrite(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  surveyId: string,
  respondentToken: string,
  meta: RequestMeta,
) {
  // Rate-limit RPC not yet provisioned; no-op guard until it is.
  void supabaseAdmin;
  void surveyId;
  void respondentToken;
  void meta;
}

export const getPublicSurvey = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: survey, error } = await supabase
      .from("surveys")
      .select(
        "id, slug, title, description, status, welcome_screen, thank_you_screen, theme, brand_overrides",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!survey || survey.status !== "live") {
      return { survey: null, questions: [], resolved_brand: null };
    }
    const { data: questions } = await supabase
      .from("questions")
      .select("id, type, title, description, required, config, position")
      .eq("survey_id", survey.id)
      .order("position", { ascending: true });

    // Resolve workspace brand + form overrides server-side (the brand table
    // is not anon-readable), so the public form matches the editor preview.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ownerRow } = await supabaseAdmin
      .from("surveys")
      .select("owner_id")
      .eq("id", survey.id)
      .maybeSingle();
    let workspaceBrand: WorkspaceBrandProfile | null = null;
    if (ownerRow?.owner_id) {
      const { data: brand } = await supabaseAdmin
        .from("workspace_brand_profiles")
        .select("*")
        .eq("workspace_id", ownerRow.owner_id)
        .maybeSingle();
      workspaceBrand = (brand as WorkspaceBrandProfile | null) ?? null;
    }
    const overrides = (survey.brand_overrides as WorkspaceBrandFormPatch | null) ?? {};
    const resolved = resolveWorkspaceBrand(
      workspaceBrand ?? DEFAULT_WORKSPACE_BRAND_PROFILE,
      overrides,
    );
    const brandTheme = themeFromBrand(resolved);
    const formTheme = (survey.theme as Record<string, unknown> | null) ?? {};
    const resolved_brand = {
      ...resolved,
      theme: { ...brandTheme, ...formTheme },
    };
    return { survey, questions: questions ?? [], resolved_brand };
  });

export const startResponse = createServerFn({ method: "POST" })
  .inputValidator((d: { survey_id: string; respondent_token: string }) =>
    z
      .object({ survey_id: z.string().uuid(), respondent_token: z.string().min(8).max(80) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = await requestMeta();
    const id = crypto.randomUUID();
    const { data: survey } = await supabaseAdmin
      .from("surveys")
      .select("version, status, is_edit_draft")
      .eq("id", data.survey_id)
      .maybeSingle();
    if (!survey || survey.status !== "live" || survey.is_edit_draft) {
      throw new Error("Survey is not live");
    }
    await consumeResponseWrite(supabaseAdmin, data.survey_id, data.respondent_token, meta);
    const { error } = await supabaseAdmin.from("responses").insert({
      id,
      survey_id: data.survey_id,
      respondent_token: data.respondent_token,
      survey_version: survey.version,
      user_agent: meta.userAgent,
      referrer: meta.referrer,
    });
    if (error) throw new Error(error.message);
    return { id };
  });

export const submitAnswer = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { response_id: string; question_id: string; respondent_token: string; value: unknown }) =>
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
    if (
      !response ||
      response.respondent_token !== data.respondent_token ||
      response.surveys.status !== "live"
    ) {
      throw new Error("Response not found or survey is not live.");
    }
    const meta = await requestMeta();
    await consumeResponseWrite(supabaseAdmin, response.survey_id, data.respondent_token, meta);

    const { data: question, error: questionError } = await supabaseAdmin
      .from("questions")
      .select("survey_id")
      .eq("id", data.question_id)
      .maybeSingle();
    if (questionError) throw new Error(questionError.message);
    if (!question || question.survey_id !== response.survey_id) {
      throw new Error("Question does not belong to this survey.");
    }

    const { error } = await supabaseAdmin.from("answers").upsert(
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
    z
      .object({ response_id: z.string().uuid(), respondent_token: z.string().min(8).max(80) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: response, error: lookupError } = await supabaseAdmin
      .from("responses")
      .select("survey_id, respondent_token, surveys!inner(status, is_edit_draft)")
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
    const meta = await requestMeta();
    await consumeResponseWrite(supabaseAdmin, response.survey_id, data.respondent_token, meta);
    const { error } = await supabaseAdmin
      .from("responses")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", data.response_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
