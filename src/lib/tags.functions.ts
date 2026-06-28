import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listTags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("tags").select("*").order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; color?: string }) =>
    z.object({ name: z.string().min(1).max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase
      .from("tags")
      .insert({ owner_id: context.userId, name: data.name, color: data.color ?? "#6b7280" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const assignTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { question_id: string; tag_id: string }) =>
    z.object({ question_id: z.string().uuid(), tag_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("question_tags")
      .insert({ question_id: data.question_id, tag_id: data.tag_id });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const unassignTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { question_id: string; tag_id: string }) =>
    z.object({ question_id: z.string().uuid(), tag_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("question_tags")
      .delete()
      .eq("question_id", data.question_id)
      .eq("tag_id", data.tag_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getQuestionTags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { question_id: string }) =>
    z.object({ question_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("question_tags")
      .select("tag_id, tags(id, name, color)")
      .eq("question_id", data.question_id);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });