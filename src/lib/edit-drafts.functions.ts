import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { RiskLevel } from "./copy";

// ---------- Types ----------

export type QuestionSnapshot = {
  id: string;
  position: number;
  type: string;
  title: string;
  description: string | null;
  required: boolean;
  config: Json;
  origin_question_id: string | null;
  tags: string[];
};

export type SurveyDiffChange = {
  kind:
    | "meta"
    | "theme"
    | "welcome"
    | "thank_you"
    | "question_added"
    | "question_removed"
    | "question_updated"
    | "question_reordered"
    | "tags_changed";
  risk: RiskLevel;
  summary: string;
  detail?: string;
  position?: number;
  question_id?: string;
  before?: unknown;
  after?: unknown;
};

export type SurveyDiff = {
  changes: SurveyDiffChange[];
  hasResponses: boolean;
  responsesCount: number;
};

// ---------- Helpers ----------

async function loadSurveyWithQuestions(
  supabase: ReturnType<
    typeof import("@supabase/supabase-js").createClient
  > extends unknown
    ? never
    : never,
) {
  return supabase;
}

function questionsEqualShape(
  a: { type: string; title: string; description: string | null; required: boolean; config: Json },
  b: { type: string; title: string; description: string | null; required: boolean; config: Json },
): boolean {
  return (
    a.type === b.type &&
    a.title === b.title &&
    (a.description ?? "") === (b.description ?? "") &&
    a.required === b.required &&
    JSON.stringify(a.config ?? {}) === JSON.stringify(b.config ?? {})
  );
}

// ---------- Server functions ----------

export const createEditDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { survey_id: string }) =>
    z.object({ survey_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load the live parent (must be owned by user, must be live).
    const { data: live, error: liveErr } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", data.survey_id)
      .maybeSingle();
    if (liveErr) throw new Error(liveErr.message);
    if (!live || live.owner_id !== userId) throw new Error("Survey not found");
    if (live.is_edit_draft) throw new Error("Already an edit draft");

    // If a draft already exists for this parent, return it.
    const { data: existingDraft } = await supabase
      .from("surveys")
      .select("id")
      .eq("parent_survey_id", live.id)
      .eq("is_edit_draft", true)
      .maybeSingle();
    if (existingDraft) return { id: existingDraft.id, reused: true };

    // Clone the survey row into a draft.
    const draftSlug = `${live.slug}-draft-${Math.random().toString(36).slice(2, 7)}`;
    const { data: draft, error: draftErr } = await supabase
      .from("surveys")
      .insert({
        owner_id: userId,
        slug: draftSlug,
        title: live.title,
        description: live.description,
        status: "draft",
        theme: live.theme,
        welcome_screen: live.welcome_screen,
        thank_you_screen: live.thank_you_screen,
        parent_survey_id: live.id,
        is_edit_draft: true,
        version: live.version,
      })
      .select("id")
      .single();
    if (draftErr) throw new Error(draftErr.message);

    // Clone questions.
    const { data: liveQs } = await supabase
      .from("questions")
      .select("id, position, type, title, description, required, config")
      .eq("survey_id", live.id)
      .order("position", { ascending: true });
    if (liveQs && liveQs.length) {
      const rows = liveQs.map((q) => ({
        survey_id: draft.id,
        position: q.position,
        type: q.type,
        title: q.title,
        description: q.description,
        required: q.required,
        config: q.config,
        origin_question_id: q.id,
      }));
      const { data: insertedQs, error: qErr } = await supabase
        .from("questions")
        .insert(rows)
        .select("id, origin_question_id");
      if (qErr) throw new Error(qErr.message);

      // Clone question_tags for each pair.
      const originToDraft = new Map(
        (insertedQs ?? []).map((q) => [q.origin_question_id, q.id] as const),
      );
      const originIds = liveQs.map((q) => q.id);
      const { data: tagLinks } = await supabase
        .from("question_tags")
        .select("question_id, tag_id")
        .in("question_id", originIds);
      if (tagLinks && tagLinks.length) {
        const links = tagLinks
          .map((t) => ({
            question_id: originToDraft.get(t.question_id),
            tag_id: t.tag_id,
          }))
          .filter((l): l is { question_id: string; tag_id: string } => !!l.question_id);
        if (links.length) {
          await supabase.from("question_tags").insert(links);
        }
      }
    }

    return { id: draft.id, reused: false };
  });

export const discardEditDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { draft_id: string }) =>
    z.object({ draft_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: draft } = await supabase
      .from("surveys")
      .select("id, owner_id, is_edit_draft, parent_survey_id")
      .eq("id", data.draft_id)
      .maybeSingle();
    if (!draft || draft.owner_id !== userId || !draft.is_edit_draft) {
      throw new Error("Draft not found");
    }
    const { error } = await supabase.from("surveys").delete().eq("id", data.draft_id);
    if (error) throw new Error(error.message);
    return { ok: true, parent_survey_id: draft.parent_survey_id };
  });

export const diffSurvey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { draft_id: string }) =>
    z.object({ draft_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<SurveyDiff> => {
    const { supabase, userId } = context;
    const { data: draft } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", data.draft_id)
      .maybeSingle();
    if (!draft || draft.owner_id !== userId || !draft.is_edit_draft || !draft.parent_survey_id) {
      throw new Error("Draft not found");
    }
    const { data: live } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", draft.parent_survey_id)
      .maybeSingle();
    if (!live) throw new Error("Live parent missing");

    const [{ data: draftQs }, { data: liveQs }] = await Promise.all([
      supabase
        .from("questions")
        .select("id, position, type, title, description, required, config, origin_question_id")
        .eq("survey_id", draft.id)
        .order("position", { ascending: true }),
      supabase
        .from("questions")
        .select("id, position, type, title, description, required, config")
        .eq("survey_id", live.id)
        .order("position", { ascending: true }),
    ]);

    const changes: SurveyDiffChange[] = [];

    // Meta.
    if ((draft.title ?? "") !== (live.title ?? "")) {
      changes.push({
        kind: "meta",
        risk: "low",
        summary: "Survey title updated",
        before: live.title,
        after: draft.title,
      });
    }
    if ((draft.description ?? "") !== (live.description ?? "")) {
      changes.push({
        kind: "meta",
        risk: "low",
        summary: "Survey description updated",
        before: live.description,
        after: draft.description,
      });
    }
    if (JSON.stringify(draft.theme) !== JSON.stringify(live.theme)) {
      changes.push({
        kind: "theme",
        risk: "low",
        summary: "Design theme updated",
      });
    }
    if (JSON.stringify(draft.welcome_screen) !== JSON.stringify(live.welcome_screen)) {
      changes.push({
        kind: "welcome",
        risk: "low",
        summary: "Welcome screen updated",
      });
    }
    if (JSON.stringify(draft.thank_you_screen) !== JSON.stringify(live.thank_you_screen)) {
      changes.push({
        kind: "thank_you",
        risk: "low",
        summary: "Thank-you screen updated",
      });
    }

    const liveById = new Map((liveQs ?? []).map((q) => [q.id, q] as const));
    const draftOriginIds = new Set(
      (draftQs ?? []).map((q) => q.origin_question_id).filter((x): x is string => !!x),
    );

    // Removed questions (live has one, draft doesn't reference it).
    for (const lq of liveQs ?? []) {
      if (!draftOriginIds.has(lq.id)) {
        changes.push({
          kind: "question_removed",
          risk: "high",
          summary: `Removed question: "${lq.title}"`,
          position: lq.position,
          question_id: lq.id,
          before: lq,
        });
      }
    }

    // Added / updated / reordered.
    for (const dq of draftQs ?? []) {
      const lq = dq.origin_question_id ? liveById.get(dq.origin_question_id) : undefined;
      if (!lq) {
        changes.push({
          kind: "question_added",
          risk: "medium",
          summary: `Added question: "${dq.title}"`,
          position: dq.position,
          question_id: dq.id,
          after: dq,
        });
        continue;
      }
      if (!questionsEqualShape(dq, lq)) {
        const typeChanged = dq.type !== lq.type;
        changes.push({
          kind: "question_updated",
          risk: typeChanged ? "high" : "medium",
          summary: typeChanged
            ? `Changed question type: "${lq.title}"`
            : `Rewrote question: "${lq.title}" → "${dq.title}"`,
          position: dq.position,
          question_id: dq.id,
          before: lq,
          after: dq,
        });
      }
      if (dq.position !== lq.position) {
        changes.push({
          kind: "question_reordered",
          risk: "medium",
          summary: `Moved "${dq.title}" to position ${dq.position + 1}`,
          position: dq.position,
          question_id: dq.id,
        });
      }
    }

    // Responses on the live survey — for the impact copy.
    const { count } = await supabase
      .from("responses")
      .select("id", { count: "exact", head: true })
      .eq("survey_id", live.id);

    return {
      changes,
      hasResponses: (count ?? 0) > 0,
      responsesCount: count ?? 0,
    };
  });

export const publishEditDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { draft_id: string }) =>
    z.object({ draft_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: draft } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", data.draft_id)
      .maybeSingle();
    if (!draft || draft.owner_id !== userId || !draft.is_edit_draft || !draft.parent_survey_id) {
      throw new Error("Draft not found");
    }
    const { data: live } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", draft.parent_survey_id)
      .maybeSingle();
    if (!live) throw new Error("Live parent missing");

    // Snapshot current live version.
    const { data: currentLiveQs } = await supabase
      .from("questions")
      .select("id, position, type, title, description, required, config")
      .eq("survey_id", live.id)
      .order("position", { ascending: true });
    const { data: currentTagLinks } = await supabase
      .from("question_tags")
      .select("question_id, tag_id, tags(name)")
      .in("question_id", (currentLiveQs ?? []).map((q) => q.id));
    const tagsByQ = new Map<string, string[]>();
    for (const row of currentTagLinks ?? []) {
      const arr = tagsByQ.get(row.question_id) ?? [];
      const name = (row as unknown as { tags: { name: string } | null }).tags?.name;
      if (name) arr.push(name);
      tagsByQ.set(row.question_id, arr);
    }
    const snapshotQuestions = (currentLiveQs ?? []).map((q) => ({
      id: q.id,
      position: q.position,
      type: q.type,
      title: q.title,
      description: q.description,
      required: q.required,
      config: q.config,
      tags: tagsByQ.get(q.id) ?? [],
    }));

    await supabase.from("survey_versions").insert({
      survey_id: live.id,
      version: live.version,
      title: live.title,
      description: live.description,
      theme: live.theme,
      welcome_screen: live.welcome_screen,
      thank_you_screen: live.thank_you_screen,
      questions: snapshotQuestions as unknown as Json,
      published_at: live.published_at ?? live.updated_at,
    });

    // Copy meta fields from draft onto live.
    const { error: updErr } = await supabase
      .from("surveys")
      .update({
        title: draft.title,
        description: draft.description,
        theme: draft.theme,
        welcome_screen: draft.welcome_screen,
        thank_you_screen: draft.thank_you_screen,
        version: live.version + 1,
        published_at: new Date().toISOString(),
      })
      .eq("id", live.id);
    if (updErr) throw new Error(updErr.message);

    // Replace live questions with draft questions.
    // 1. Load draft questions + their tag links.
    const { data: draftQs } = await supabase
      .from("questions")
      .select("id, position, type, title, description, required, config")
      .eq("survey_id", draft.id)
      .order("position", { ascending: true });
    const { data: draftTagLinks } = await supabase
      .from("question_tags")
      .select("question_id, tag_id")
      .in("question_id", (draftQs ?? []).map((q) => q.id));

    // 2. Delete existing live questions (this cascades question_tags for them).
    const liveQIds = (currentLiveQs ?? []).map((q) => q.id);
    if (liveQIds.length) {
      await supabase.from("questions").delete().in("id", liveQIds);
    }

    // 3. Insert new live questions cloned from the draft, remembering mapping.
    const draftIdToNewLiveId = new Map<string, string>();
    if (draftQs && draftQs.length) {
      const rows = draftQs.map((q) => ({
        survey_id: live.id,
        position: q.position,
        type: q.type,
        title: q.title,
        description: q.description,
        required: q.required,
        config: q.config,
      }));
      const { data: inserted } = await supabase
        .from("questions")
        .insert(rows)
        .select("id, position");
      const sortedDraft = [...draftQs].sort((a, b) => a.position - b.position);
      const sortedNew = (inserted ?? []).sort((a, b) => a.position - b.position);
      for (let i = 0; i < sortedDraft.length; i++) {
        if (sortedNew[i]) draftIdToNewLiveId.set(sortedDraft[i].id, sortedNew[i].id);
      }

      // 4. Rewrite question_tags to point at the new live question ids.
      if (draftTagLinks && draftTagLinks.length) {
        const rows2 = draftTagLinks
          .map((t) => ({
            question_id: draftIdToNewLiveId.get(t.question_id),
            tag_id: t.tag_id,
          }))
          .filter((r): r is { question_id: string; tag_id: string } => !!r.question_id);
        if (rows2.length) {
          await supabase
            .from("question_tags")
            .upsert(rows2, { onConflict: "question_id,tag_id", ignoreDuplicates: true });
        }
      }
    }

    // 5. Delete the draft survey (cascades draft questions + tag links).
    await supabase.from("surveys").delete().eq("id", draft.id);

    return { ok: true, live_id: live.id, version: live.version + 1 };
  });

export const listSurveyVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { survey_id: string }) =>
    z.object({ survey_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("survey_versions")
      .select("id, version, title, published_at")
      .eq("survey_id", data.survey_id)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Simple helper used by client code to know what mode the editor is in.
export type SurveyMode = "compose" | "draft-editor" | "live-view" | "edit-draft";

export function surveyMode(s: {
  status: string;
  is_edit_draft: boolean;
  parent_survey_id: string | null;
}): SurveyMode {
  if (s.is_edit_draft) return "edit-draft";
  if (s.status === "live") return "live-view";
  // A fresh draft (no parent link) is the compose target.
  if (!s.parent_survey_id) return "compose";
  return "draft-editor";
}

// silence unused loader helper — placeholder for potential future joins
void loadSurveyWithQuestions;
