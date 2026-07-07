import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, getLovableAiGatewayRunId } from "@/lib/ai-gateway.server";
import { supabaseFromRequest } from "@/lib/supabase-from-request.server";
import { defaultConfigFor, type QuestionType } from "@/lib/question-types";
import type { Json } from "@/integrations/supabase/types";
import { DEFAULT_WORKSPACE_BRAND_PROFILE, type WorkspaceBrandProfile } from "@/lib/brand.functions";

const QTYPES = [
  "short_text",
  "long_text",
  "email",
  "number",
  "single_choice",
  "multi_choice",
  "rating",
  "nps",
  "scale",
  "yes_no",
] as const;

const INSIGHT_KINDS = [
  "friction",
  "value",
  "intent",
  "sentiment",
  "loyalty",
  "objection",
  "feature_request",
  "comprehension",
  "segmentation",
  "contact",
  "other",
] as const;
const PRIORITY_SIGNALS = ["low", "medium", "high"] as const;

const SYSTEM_PROMPT = `You are Insightform, a conversational AI that helps product teams compose Typeform-style surveys.

You have tools to edit the survey in real time. Use them liberally — call multiple tools per turn when needed (e.g. set a title, then add several questions). After your tool calls, write 1-2 sentences summarising what changed. Never describe questions you didn't actually add via a tool call. Summarise in product-team language (e.g. "I created a beta feedback form designed to surface onboarding confusion, perceived value, and repeat-use intent — using your workspace brand and professional tone.").

Style guidelines for the surveys you build:
- 4-10 questions unless the user asks otherwise.
- Lead with the highest-signal question.
- Pick the right question type. Use NPS only for "recommend to a friend"-style; rating (1-5) for satisfaction; scale (1-7) for agreement; choices when answers are bounded; long_text only when free-form depth matters.
- Tag every question with 1-2 short lowercase theme tags (e.g. "pricing", "onboarding", "nps", "feature-x") so themes roll up across surveys.
- Give every question insight metadata: insight_kind (what kind of signal it captures, e.g. friction/value/intent), product_area (the part of the product it maps to, lowercase snake_case like "onboarding" or "feature_adoption"), and priority_signal (low/medium/high). This powers the insights dashboard.
- Keep titles plain-spoken, one sentence.

BRAND-AWARE BY DEFAULT:
A workspace brand context is provided below. Without being asked, write the survey title, intro, question copy, and thank-you screen in the brand's tone, reference the product naturally using the product description, and assume the workspace's colors/layout. The user should never have to ask you to "make it branded."
- If the user asks for a visual change for THIS FORM ONLY (e.g. "use our campaign colors for this one", "hide the logo on this one", "darker background here"), call set_brand_overrides — this does NOT touch the workspace brand.
- If the user asks to change branding EVERYWHERE / globally / "our brand", call update_workspace_brand.
- You can also re-theme via set_theme — pick a preset (coral, ink, forest, indigo, rose, solar) or a custom 6-digit hex accent; set background to solid/gradient/dots; font to sans/serif/mono/soft; radius to sharp/soft/pill.
- Tone edits ("make this warmer", "more direct", "executive-friendly") mean rewriting the survey copy via update_question / set_survey_meta / set_thank_you — and, if the user wants the tone to stick for this form, saving it with set_brand_overrides({ tone }).

If the user asks an unrelated question, answer briefly without calling tools.`;

const EDIT_ASSIST_PROMPT = `You are Insightform's Editor Assist. You are working inside an EDIT DRAFT of an already-live survey.

Rules:
- All tool calls apply to the DRAFT only. The live survey is not touched.
- Prefer small, targeted edits (rewrites, reorders, added follow-ups, tag updates, design tweaks).
- Flag risk in your written summary when appropriate: rewriting a question is medium risk, deleting a question or changing its type is high risk (existing responses stay on the previous version, new responses use the updated version).
- Never delete or change types unless the user explicitly asked for it.
- After tool calls, write 1-2 sentences summarising what you changed on the draft and what the user should review before publishing the update.`;

const QuestionInput = z.object({
  type: z.enum(QTYPES).describe("Question type"),
  title: z.string().min(1).max(280),
  description: z.string().max(500).optional(),
  required: z.boolean().optional(),
  options: z
    .array(z.string().min(1).max(80))
    .max(8)
    .optional()
    .describe("Options for single_choice / multi_choice"),
  minLabel: z.string().max(40).optional().describe("Left label for scale"),
  maxLabel: z.string().max(40).optional().describe("Right label for scale"),
  max: z.number().int().min(2).max(10).optional().describe("Max for rating (1-10), default 5"),
  tags: z.array(z.string().min(1).max(40)).max(3).optional().describe("Lowercase theme tags"),
  insight_kind: z
    .enum(INSIGHT_KINDS)
    .optional()
    .describe("What kind of signal this question captures"),
  product_area: z
    .string()
    .min(1)
    .max(60)
    .optional()
    .describe("Lowercase snake_case product area, e.g. onboarding, feature_adoption, pricing"),
  priority_signal: z
    .enum(PRIORITY_SIGNALS)
    .optional()
    .describe("How strong a product signal answers to this question are"),
});
type QuestionInputT = z.infer<typeof QuestionInput>;

function buildConfig(q: QuestionInputT): Json {
  const base = defaultConfigFor(q.type) as Record<string, unknown>;
  if ((q.type === "single_choice" || q.type === "multi_choice") && q.options?.length) {
    return { ...base, options: q.options } as Json;
  }
  if (q.type === "rating" && q.max) return { ...base, max: q.max } as Json;
  if (q.type === "scale") {
    return {
      ...base,
      minLabel: q.minLabel ?? (base as { minLabel?: string }).minLabel,
      maxLabel: q.maxLabel ?? (base as { maxLabel?: string }).maxLabel,
    } as Json;
  }
  return base as Json;
}

export const Route = createFileRoute("/api/chat/surveys/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = await supabaseFromRequest(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const { supabase, userId } = auth;
        const surveyId = params.id;

        // Ownership check.
        const { data: owned } = await supabase
          .from("surveys")
          .select("owner_id, title, description, status, is_edit_draft")
          .eq("id", surveyId)
          .maybeSingle();
        if (!owned || owned.owner_id !== userId) {
          return new Response("Survey not found", { status: 404 });
        }
        // Never mutate a live survey directly through chat. The user must
        // create an edit draft first.
        if (owned.status === "live" && !owned.is_edit_draft) {
          return new Response("This survey is live. Create an edit draft to make changes safely.", {
            status: 409,
          });
        }
        const isEditAssist = owned.is_edit_draft === true;

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("AI is not configured", { status: 500 });

        // Workspace brand profile — grounds generation in the user's brand.
        const { data: brandRow } = await supabase
          .from("workspace_brand_profiles")
          .select("*")
          .eq("workspace_id", userId)
          .maybeSingle();
        const brand: WorkspaceBrandProfile = {
          ...DEFAULT_WORKSPACE_BRAND_PROFILE,
          ...((brandRow as Partial<WorkspaceBrandProfile> | null) ?? {}),
          workspace_id: userId,
        };
        const brandContext = {
          brand_name: brand.brand_name,
          product_description: brand.product_description,
          tone: brand.tone,
          form_layout: brand.form_layout,
          default_thank_you_message: brand.default_thank_you_message,
          primary_color: brand.primary_color,
          background_color: brand.background_color,
          accent_color: brand.accent_color,
          font_style: brand.font_style,
          button_style: brand.button_style,
          has_logo: Boolean(brand.logo_url),
        };

        const body = (await request.json()) as { messages?: UIMessage[] };
        const incomingMessages = body.messages ?? [];

        // Snapshot of current survey to ground the model.
        const { data: currentQs } = await supabase
          .from("questions")
          .select("id, position, type, title, description, required, config")
          .eq("survey_id", surveyId)
          .order("position", { ascending: true });

        const snapshot = {
          title: owned.title,
          description: owned.description ?? "",
          questions: (currentQs ?? []).map((q) => ({
            position: q.position,
            type: q.type,
            title: q.title,
            required: q.required,
          })),
        };

        // Persist the latest user message (last entry) so reloads restore history.
        const lastIncoming = incomingMessages[incomingMessages.length - 1];
        if (lastIncoming?.role === "user") {
          const userText = lastIncoming.parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("\n");
          await supabase.from("survey_chat_messages").insert({
            survey_id: surveyId,
            role: "user",
            content: userText,
            parts: lastIncoming.parts as unknown as Json,
          });
        }

        // Helper: append a question at the end.
        async function appendQuestion(q: QuestionInputT) {
          const { data: last } = await supabase
            .from("questions")
            .select("position")
            .eq("survey_id", surveyId)
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextPos = (last?.position ?? -1) + 1;
          const { data: inserted, error } = await supabase
            .from("questions")
            .insert({
              survey_id: surveyId,
              type: q.type as QuestionType,
              position: nextPos,
              title: q.title,
              description: q.description ?? null,
              required: !!q.required,
              config: buildConfig(q),
              insight_kind: q.insight_kind ?? null,
              product_area: q.product_area ?? null,
              priority_signal: q.priority_signal ?? null,
            })
            .select("id, position")
            .single();
          if (error) throw new Error(error.message);
          if (q.tags?.length && inserted) {
            await ensureTagsForQuestion(inserted.id, q.tags);
          }
          return inserted;
        }

        async function ensureTagsForQuestion(questionId: string, names: string[]) {
          const clean = Array.from(
            new Set(names.map((n) => n.toLowerCase().trim()).filter(Boolean)),
          );
          if (!clean.length) return;
          const { data: existing } = await supabase
            .from("tags")
            .select("id, name")
            .eq("owner_id", userId)
            .in("name", clean);
          const byName = new Map<string, string>();
          (existing ?? []).forEach((t) => byName.set(t.name, t.id));
          const missing = clean.filter((n) => !byName.has(n));
          if (missing.length) {
            const palette = ["#FF7A45", "#FFD166", "#6FC2B0", "#7AA2F7", "#C792EA", "#F78C6C"];
            const { data: created } = await supabase
              .from("tags")
              .insert(
                missing.map((n, i) => ({
                  owner_id: userId,
                  name: n,
                  color: palette[i % palette.length],
                })),
              )
              .select("id, name");
            (created ?? []).forEach((t) => byName.set(t.name, t.id));
          }
          const links = clean
            .map((n) => byName.get(n))
            .filter((id): id is string => !!id)
            .map((tag_id) => ({ question_id: questionId, tag_id }));
          if (links.length) {
            // Upsert-ish: ignore duplicates.
            await supabase.from("question_tags").upsert(links, {
              onConflict: "question_id,tag_id",
              ignoreDuplicates: true,
            });
          }
        }

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(apiKey, initialRunId);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          stopWhen: stepCountIs(50),
          system: `${isEditAssist ? EDIT_ASSIST_PROMPT : SYSTEM_PROMPT}\n\nWorkspace brand context (apply by default):\n${JSON.stringify(brandContext, null, 2)}\n\nCurrent survey snapshot:\n${JSON.stringify(snapshot, null, 2)}`,
          messages: await convertToModelMessages(incomingMessages),
          tools: {
            set_survey_meta: tool({
              description: "Update the survey's title and/or description.",
              inputSchema: z.object({
                title: z.string().min(1).max(120).optional(),
                description: z.string().max(300).optional(),
              }),
              execute: async ({ title, description }) => {
                const patch: { title?: string; description?: string | null } = {};
                if (title !== undefined) patch.title = title;
                if (description !== undefined) patch.description = description;
                if (Object.keys(patch).length === 0) return { ok: true, changed: false };
                const { error } = await supabase.from("surveys").update(patch).eq("id", surveyId);
                if (error) throw new Error(error.message);
                return { ok: true, title, description };
              },
            }),
            add_question: tool({
              description: "Append a single question to the end of the survey.",
              inputSchema: QuestionInput,
              execute: async (q) => {
                const inserted = await appendQuestion(q);
                return {
                  ok: true,
                  id: inserted?.id,
                  position: inserted?.position,
                  type: q.type,
                  title: q.title,
                };
              },
            }),
            replace_all_questions: tool({
              description:
                "Wipe the current questions and replace them with this ordered list. Use when starting from scratch or making sweeping changes.",
              inputSchema: z.object({
                questions: z.array(QuestionInput).min(1).max(20),
              }),
              execute: async ({ questions }) => {
                // Delete existing question_tags then questions.
                const { data: existingQs } = await supabase
                  .from("questions")
                  .select("id")
                  .eq("survey_id", surveyId);
                const ids = (existingQs ?? []).map((q) => q.id);
                if (ids.length) {
                  await supabase.from("question_tags").delete().in("question_id", ids);
                  await supabase.from("questions").delete().in("id", ids);
                }
                const rows = questions.map((q, i) => ({
                  survey_id: surveyId,
                  type: q.type as QuestionType,
                  position: i,
                  title: q.title,
                  description: q.description ?? null,
                  required: !!q.required,
                  config: buildConfig(q),
                  insight_kind: q.insight_kind ?? null,
                  product_area: q.product_area ?? null,
                  priority_signal: q.priority_signal ?? null,
                }));
                const { data: inserted, error } = await supabase
                  .from("questions")
                  .insert(rows)
                  .select("id, position");
                if (error) throw new Error(error.message);
                const sorted = (inserted ?? []).sort((a, b) => a.position - b.position);
                for (let i = 0; i < sorted.length; i++) {
                  const q = questions[i];
                  if (q.tags?.length) await ensureTagsForQuestion(sorted[i].id, q.tags);
                }
                return { ok: true, count: questions.length, types: questions.map((q) => q.type) };
              },
            }),
            update_question: tool({
              description: "Update an existing question by 0-based position.",
              inputSchema: z.object({
                position: z.number().int().min(0),
                title: z.string().min(1).max(280).optional(),
                description: z.string().max(500).optional(),
                required: z.boolean().optional(),
                type: z.enum(QTYPES).optional(),
                options: z.array(z.string()).max(8).optional(),
                minLabel: z.string().max(40).optional(),
                maxLabel: z.string().max(40).optional(),
                max: z.number().int().min(2).max(10).optional(),
                insight_kind: z.enum(INSIGHT_KINDS).optional(),
                product_area: z.string().min(1).max(60).optional(),
                priority_signal: z.enum(PRIORITY_SIGNALS).optional(),
              }),
              execute: async (args) => {
                const { data: q } = await supabase
                  .from("questions")
                  .select("id, type, config")
                  .eq("survey_id", surveyId)
                  .eq("position", args.position)
                  .maybeSingle();
                if (!q) throw new Error(`No question at position ${args.position}`);
                const patch: {
                  title?: string;
                  description?: string | null;
                  required?: boolean;
                  type?: QuestionType;
                  config?: Json;
                  insight_kind?: string;
                  product_area?: string;
                  priority_signal?: string;
                } = {};
                if (args.title !== undefined) patch.title = args.title;
                if (args.description !== undefined) patch.description = args.description;
                if (args.required !== undefined) patch.required = args.required;
                if (args.insight_kind !== undefined) patch.insight_kind = args.insight_kind;
                if (args.product_area !== undefined) patch.product_area = args.product_area;
                if (args.priority_signal !== undefined)
                  patch.priority_signal = args.priority_signal;
                const nextType = (args.type ?? q.type) as QuestionType;
                if (args.type) patch.type = args.type as QuestionType;
                if (args.options || args.minLabel || args.maxLabel || args.max || args.type) {
                  patch.config = buildConfig({
                    type: nextType,
                    title: args.title ?? "",
                    options: args.options,
                    minLabel: args.minLabel,
                    maxLabel: args.maxLabel,
                    max: args.max,
                  });
                }
                if (Object.keys(patch).length) {
                  const { error } = await supabase.from("questions").update(patch).eq("id", q.id);
                  if (error) throw new Error(error.message);
                }
                return { ok: true, position: args.position };
              },
            }),
            remove_question: tool({
              description:
                "Remove the question at this 0-based position. Remaining positions are compacted.",
              inputSchema: z.object({ position: z.number().int().min(0) }),
              execute: async ({ position }) => {
                const { data: all } = await supabase
                  .from("questions")
                  .select("id, position")
                  .eq("survey_id", surveyId)
                  .order("position", { ascending: true });
                const list = all ?? [];
                const target = list.find((q) => q.position === position);
                if (!target) throw new Error(`No question at position ${position}`);
                await supabase.from("question_tags").delete().eq("question_id", target.id);
                await supabase.from("questions").delete().eq("id", target.id);
                // Compact positions.
                const remaining = list.filter((q) => q.id !== target.id);
                for (let i = 0; i < remaining.length; i++) {
                  if (remaining[i].position !== i) {
                    await supabase
                      .from("questions")
                      .update({ position: i })
                      .eq("id", remaining[i].id);
                  }
                }
                return { ok: true, removed_position: position };
              },
            }),
            tag_question: tool({
              description: "Add theme tags to a question by 0-based position.",
              inputSchema: z.object({
                position: z.number().int().min(0),
                tags: z.array(z.string().min(1).max(40)).min(1).max(3),
              }),
              execute: async ({ position, tags }) => {
                const { data: q } = await supabase
                  .from("questions")
                  .select("id")
                  .eq("survey_id", surveyId)
                  .eq("position", position)
                  .maybeSingle();
                if (!q) throw new Error(`No question at position ${position}`);
                await ensureTagsForQuestion(q.id, tags);
                return { ok: true, position, tags };
              },
            }),
            set_theme: tool({
              description:
                "Update the survey's visual theme (palette, background, font, corner radius). Use a preset OR a custom hex accent.",
              inputSchema: z.object({
                preset: z.enum(["coral", "ink", "forest", "indigo", "rose", "solar"]).optional(),
                accent: z
                  .string()
                  .regex(/^#?[0-9a-fA-F]{6}$/)
                  .optional()
                  .describe("Custom accent hex like #FF7A45 — overrides preset"),
                background: z.enum(["solid", "gradient", "dots"]).optional(),
                font: z.enum(["sans", "serif", "mono", "soft"]).optional(),
                radius: z.enum(["sharp", "soft", "pill"]).optional(),
              }),
              execute: async (input) => {
                const accent = input.accent
                  ? input.accent.startsWith("#")
                    ? input.accent
                    : `#${input.accent}`
                  : undefined;
                const next: Record<string, unknown> = {};
                if (input.preset) next.preset = input.preset;
                if (accent) next.accent = accent;
                if (input.background) next.background = input.background;
                if (input.font) next.font = input.font;
                if (input.radius) next.radius = input.radius;
                if (Object.keys(next).length === 0) return { ok: true, changed: false };
                // Merge with existing theme.
                const { data: cur } = await supabase
                  .from("surveys")
                  .select("theme")
                  .eq("id", surveyId)
                  .maybeSingle();
                const merged = { ...((cur?.theme as Record<string, unknown>) ?? {}), ...next };
                // If the model set an explicit preset without an accent, drop the previous custom accent.
                if (input.preset && !accent) delete (merged as Record<string, unknown>).accent;
                const { error } = await supabase
                  .from("surveys")
                  .update({ theme: merged as Json })
                  .eq("id", surveyId);
                if (error) throw new Error(error.message);
                return { ok: true, theme: merged };
              },
            }),
            set_thank_you: tool({
              description:
                "Update the thank-you screen shown after the last question (title and/or description). Use for requests like 'make the thank-you message more personal'.",
              inputSchema: z.object({
                title: z.string().max(120).optional(),
                description: z.string().max(500).optional(),
              }),
              execute: async ({ title, description }) => {
                const { data: cur } = await supabase
                  .from("surveys")
                  .select("thank_you_screen")
                  .eq("id", surveyId)
                  .maybeSingle();
                const existing = (cur?.thank_you_screen as Record<string, unknown> | null) ?? {};
                const next = { ...existing };
                if (title !== undefined) next.title = title;
                if (description !== undefined) next.description = description;
                const { error } = await supabase
                  .from("surveys")
                  .update({ thank_you_screen: next as Json })
                  .eq("id", surveyId);
                if (error) throw new Error(error.message);
                return { ok: true, thank_you_screen: next };
              },
            }),
            set_brand_overrides: tool({
              description:
                "Set FORM-LEVEL brand overrides for this survey only. Does NOT change the workspace brand. Use for 'use campaign colors for this form only', 'hide the logo on this one', 'darker background here', or locking a different tone for this form. Pass only the fields to override; pass clear=true to remove all overrides and re-inherit the workspace brand.",
              inputSchema: z.object({
                primary_color: z
                  .string()
                  .regex(/^#?[0-9a-fA-F]{6}$/)
                  .optional(),
                background_color: z
                  .string()
                  .regex(/^#?[0-9a-fA-F]{6}$/)
                  .optional(),
                text_color: z
                  .string()
                  .regex(/^#?[0-9a-fA-F]{6}$/)
                  .optional(),
                accent_color: z
                  .string()
                  .regex(/^#?[0-9a-fA-F]{6}$/)
                  .optional(),
                font_style: z.string().max(40).optional(),
                button_style: z.string().max(40).optional(),
                tone: z.string().max(80).optional(),
                hide_logo: z.boolean().optional(),
                default_thank_you_message: z.string().max(300).optional(),
                clear: z.boolean().optional().describe("Remove all overrides for this form"),
              }),
              execute: async (input) => {
                if (input.clear) {
                  const { error } = await supabase
                    .from("surveys")
                    .update({ brand_overrides: {} as Json })
                    .eq("id", surveyId);
                  if (error) throw new Error(error.message);
                  return { ok: true, cleared: true };
                }
                const withHash = (v?: string) =>
                  v === undefined ? undefined : v.startsWith("#") ? v : `#${v}`;
                const patch: Record<string, unknown> = {};
                if (input.primary_color) patch.primary_color = withHash(input.primary_color);
                if (input.background_color)
                  patch.background_color = withHash(input.background_color);
                if (input.text_color) patch.text_color = withHash(input.text_color);
                if (input.accent_color) patch.accent_color = withHash(input.accent_color);
                if (input.font_style) patch.font_style = input.font_style;
                if (input.button_style) patch.button_style = input.button_style;
                if (input.tone) patch.tone = input.tone;
                if (input.hide_logo !== undefined) patch.hide_logo = input.hide_logo;
                if (input.default_thank_you_message !== undefined) {
                  patch.default_thank_you_message = input.default_thank_you_message;
                }
                if (Object.keys(patch).length === 0) return { ok: true, changed: false };
                const { data: cur } = await supabase
                  .from("surveys")
                  .select("brand_overrides")
                  .eq("id", surveyId)
                  .maybeSingle();
                const merged = {
                  ...((cur?.brand_overrides as Record<string, unknown> | null) ?? {}),
                  ...patch,
                };
                const { error } = await supabase
                  .from("surveys")
                  .update({ brand_overrides: merged as Json })
                  .eq("id", surveyId);
                if (error) throw new Error(error.message);
                return { ok: true, brand_overrides: merged };
              },
            }),
            update_workspace_brand: tool({
              description:
                "Update the WORKSPACE brand profile — affects every form that inherits it (existing and future). Only use when the user clearly wants a global brand change ('change our brand color', 'update our tone everywhere'). For one-form changes use set_brand_overrides instead.",
              inputSchema: z.object({
                brand_name: z.string().min(1).max(120).optional(),
                product_description: z.string().max(500).optional(),
                primary_color: z
                  .string()
                  .regex(/^#?[0-9a-fA-F]{6}$/)
                  .optional(),
                background_color: z
                  .string()
                  .regex(/^#?[0-9a-fA-F]{6}$/)
                  .optional(),
                text_color: z
                  .string()
                  .regex(/^#?[0-9a-fA-F]{6}$/)
                  .optional(),
                accent_color: z
                  .string()
                  .regex(/^#?[0-9a-fA-F]{6}$/)
                  .optional(),
                font_style: z.string().max(40).optional(),
                button_style: z.string().max(40).optional(),
                form_layout: z.string().max(80).optional(),
                tone: z.string().max(80).optional(),
                default_thank_you_message: z.string().max(300).optional(),
              }),
              execute: async (input) => {
                const withHash = (v?: string) =>
                  v === undefined ? undefined : v.startsWith("#") ? v : `#${v}`;
                const patch: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(input)) {
                  if (v === undefined) continue;
                  patch[k] = k.endsWith("_color") ? withHash(v as string) : v;
                }
                if (Object.keys(patch).length === 0) return { ok: true, changed: false };
                const { error } = await supabase
                  .from("workspace_brand_profiles")
                  .upsert(
                    { ...brand, ...patch, workspace_id: userId },
                    { onConflict: "workspace_id" },
                  );
                if (error) throw new Error(error.message);
                return { ok: true, workspace_brand: patch };
              },
            }),
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: incomingMessages,
          onFinish: async ({ messages }) => {
            const assistant = messages[messages.length - 1];
            if (!assistant || assistant.role !== "assistant") return;
            const text = assistant.parts
              .filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("\n");
            await supabase.from("survey_chat_messages").insert({
              survey_id: surveyId,
              role: "assistant",
              content: text,
              parts: assistant.parts as unknown as Json,
            });
          },
        });
      },
    },
  },
});
