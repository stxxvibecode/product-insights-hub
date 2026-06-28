import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { UIMessage } from "ai";

export const listSurveyChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { survey_id: string }) => z.object({ survey_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("survey_chat_messages")
      .select("id, role, content, parts, tool_payload, created_at")
      .eq("survey_id", data.survey_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const messages: UIMessage[] = (rows ?? []).map((row) => {
      // Prefer the rich `parts` blob; fall back to legacy text content.
      if (row.parts && Array.isArray(row.parts)) {
        return {
          id: row.id,
          role: (row.role === "user" ? "user" : "assistant") as "user" | "assistant",
          parts: row.parts as UIMessage["parts"],
        };
      }
      return {
        id: row.id,
        role: (row.role === "user" ? "user" : "assistant") as "user" | "assistant",
        parts: [{ type: "text", text: row.content ?? "" }],
      };
    });
    return messages;
  });