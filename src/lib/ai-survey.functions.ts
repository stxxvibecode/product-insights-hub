import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { defaultConfigFor, type QuestionType } from "./question-types";
import type { Json } from "@/integrations/supabase/types";

const QTYPES = [
  "short_text","long_text","email","number","single_choice","multi_choice","rating","nps","scale","yes_no",
] as const;

const SYSTEM_PROMPT = `You are Insightform, an AI that designs Typeform-style product surveys for product teams.

You work iteratively. Each turn, the user describes a survey or asks for an edit, and you respond with:
1. A short, friendly assistant message (1-2 sentences) explaining what you did.
2. A complete, updated survey definition (title, optional description, and the full ordered list of questions).

Always return the FULL question list after each edit (not a diff). Keep surveys focused: 4-10 questions is ideal unless the user asks otherwise.

Question types you may use:
- short_text: one-line free text
- long_text: paragraph free text
- email: email address
- number: numeric input
- single_choice: pick one from options (requires 2-6 options)
- multi_choice: pick many from options (requires 2-8 options)
- rating: 1-5 stars
- nps: 0-10 likelihood to recommend
- scale: 1-7 agreement (set minLabel and maxLabel)
- yes_no: binary

For each question, also assign 1-2 short lowercase theme tags (e.g. "pricing", "onboarding", "nps", "feature-x"). These roll up across surveys on the team's source-of-truth dashboard, so reuse common tag names where possible.

Lead with the highest-signal question. End with an open-ended "anything else?" only when it adds value.`;

const QuestionSchema = z.object({
  type: z.enum(QTYPES),
  title: z.string().min(1).max(280),
  description: z.string().max(500).optional().nullable(),
  required: z.boolean().optional(),
  options: z.array(z.string().min(1).max(80)).max(8).optional(),
  minLabel: z.string().max(40).optional(),
  maxLabel: z.string().max(40).optional(),
  max: z.number().int().min(2).max(10).optional(),
  tags: z.array(z.string().min(1).max(40)).max(3).optional(),
});

const SurveyDraftSchema = z.object({
  message: z.string().min(1).max(600),
  title: z.string().min(1).max(120),
  description: z.string().max(300).optional().nullable(),
  questions: z.array(QuestionSchema).min(1).max(20),
});

type SurveyDraft = z.infer<typeof SurveyDraftSchema>;

function buildConfig(q: z.infer<typeof QuestionSchema>): Record<string, unknown> {
  const base = defaultConfigFor(q.type);
  if ((q.type === "single_choice" || q.type === "multi_choice") && q.options?.length) {
    return { ...base, options: q.options };
  }
  if (q.type === "rating" && q.max) return { ...base, max: q.max };
  if (q.type === "scale") {
    return {
      ...base,
      minLabel: q.minLabel ?? (base as { minLabel?: string }).minLabel,
      maxLabel: q.maxLabel ?? (base as { maxLabel?: string }).maxLabel,
    };
  }
  return base;
}

async function ensureOwnership(
  supabase: { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { owner_id: string } | null }> } } } },
  surveyId: string,
  userId: string,
) {
  const { data } = await supabase.from("surveys").select("owner_id").eq("id", surveyId).maybeSingle();
  if (!data || data.owner_id !== userId) throw new Error("Survey not found");
}

export const listSurveyChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { survey_id: string }) => z.object({ survey_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("survey_chat_messages")
      .select("*")
      .eq("survey_id", data.survey_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const generateSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { survey_id: string; prompt: string }) =>
    z.object({
      survey_id: z.string().uuid(),
      prompt: z.string().min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured.");

    // Ownership check (RLS double-guard)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ensureOwnership(context.supabase as any, data.survey_id, context.userId);

    // Fetch existing chat history + current survey state for context
    const [{ data: history }, { data: survey }, { data: questions }] = await Promise.all([
      context.supabase
        .from("survey_chat_messages")
        .select("role, content")
        .eq("survey_id", data.survey_id)
        .order("created_at", { ascending: true })
        .limit(20),
      context.supabase.from("surveys").select("title, description").eq("id", data.survey_id).single(),
      context.supabase
        .from("questions")
        .select("type, title, description, required, config")
        .eq("survey_id", data.survey_id)
        .order("position", { ascending: true }),
    ]);

    // Persist the user message first
    await context.supabase.from("survey_chat_messages").insert({
      survey_id: data.survey_id,
      role: "user",
      content: data.prompt,
    });

    const currentState = {
      title: survey?.title ?? "",
      description: survey?.description ?? "",
      questions: (questions ?? []).map((q) => ({
        type: q.type,
        title: q.title,
        description: q.description,
        required: q.required,
        config: q.config,
      })),
    };

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `Current survey state:\n${JSON.stringify(currentState, null, 2)}`,
      },
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.prompt },
    ];

    const jsonSchema = {
      name: "survey_update",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          message: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          questions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                type: { type: "string", enum: [...QTYPES] },
                title: { type: "string" },
                description: { type: "string" },
                required: { type: "boolean" },
                options: { type: "array", items: { type: "string" } },
                minLabel: { type: "string" },
                maxLabel: { type: "string" },
                max: { type: "number" },
                tags: { type: "array", items: { type: "string" } },
              },
              required: ["type", "title"],
            },
          },
        },
        required: ["message", "title", "questions"],
      },
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        response_format: { type: "json_schema", json_schema: jsonSchema },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      if (aiRes.status === 429) throw new Error("Rate limit reached — try again in a moment.");
      if (aiRes.status === 402) throw new Error("AI credits exhausted. Top up in workspace settings.");
      throw new Error(`AI error (${aiRes.status}): ${text.slice(0, 200)}`);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") throw new Error("AI returned an empty response.");

    let parsed: SurveyDraft;
    try {
      parsed = SurveyDraftSchema.parse(JSON.parse(raw));
    } catch {
      throw new Error("AI returned an invalid survey shape. Try rephrasing.");
    }

    // Apply the draft: update survey + replace questions + retag.
    await context.supabase
      .from("surveys")
      .update({ title: parsed.title, description: parsed.description ?? null })
      .eq("id", data.survey_id);

    await context.supabase.from("questions").delete().eq("survey_id", data.survey_id);

    const insertRows = parsed.questions.map((q, i) => ({
      survey_id: data.survey_id,
      type: q.type as QuestionType,
      position: i,
      title: q.title,
      description: q.description ?? null,
      required: !!q.required,
      config: buildConfig(q) as unknown as Json,
    }));
    const { data: insertedQs, error: insErr } = await context.supabase
      .from("questions")
      .insert(insertRows)
      .select("id, position");
    if (insErr) throw new Error(insErr.message);

    // Tags: upsert by (owner_id, name) and link to questions
    const wantedTagNames = new Set<string>();
    parsed.questions.forEach((q) => (q.tags ?? []).forEach((t) => wantedTagNames.add(t.toLowerCase().trim())));
    let tagIdByName = new Map<string, string>();
    if (wantedTagNames.size) {
      const names = Array.from(wantedTagNames);
      const { data: existing } = await context.supabase
        .from("tags")
        .select("id, name")
        .in("name", names);
      (existing ?? []).forEach((t) => tagIdByName.set(t.name, t.id));
      const missing = names.filter((n) => !tagIdByName.has(n));
      if (missing.length) {
        const palette = ["#FF7A45","#FFD166","#6FC2B0","#7AA2F7","#C792EA","#F78C6C"];
        const { data: created } = await context.supabase
          .from("tags")
          .insert(missing.map((n, i) => ({ owner_id: context.userId, name: n, color: palette[i % palette.length] })))
          .select("id, name");
        (created ?? []).forEach((t) => tagIdByName.set(t.name, t.id));
      }
      const links: { question_id: string; tag_id: string }[] = [];
      (insertedQs ?? [])
        .sort((a, b) => a.position - b.position)
        .forEach((row, idx) => {
          const qDraft = parsed.questions[idx];
          (qDraft.tags ?? []).forEach((t) => {
            const tagId = tagIdByName.get(t.toLowerCase().trim());
            if (tagId) links.push({ question_id: row.id, tag_id: tagId });
          });
        });
      if (links.length) await context.supabase.from("question_tags").insert(links);
    }

    const toolPayload = {
      title: parsed.title,
      question_count: parsed.questions.length,
      types: parsed.questions.map((q) => q.type),
      tags: Array.from(wantedTagNames),
    };

    const { data: assistantRow } = await context.supabase
      .from("survey_chat_messages")
      .insert({
        survey_id: data.survey_id,
        role: "assistant",
        content: parsed.message,
        tool_payload: toolPayload as unknown as Json,
      })
      .select()
      .single();

    return { assistant: assistantRow, draft: parsed };
  });