import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  parts: Array<Record<string, unknown>>;
};

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

    const messages: StoredMessage[] = (rows ?? []).map((row) => {
      if (row.parts && Array.isArray(row.parts)) {
        return {
          id: row.id,
          role: row.role === "user" ? "user" : "assistant",
          parts: row.parts as Array<Record<string, unknown>>,
        };
      }
      return {
        id: row.id,
        role: row.role === "user" ? "user" : "assistant",
        parts: [{ type: "text", text: row.content ?? "" } as Record<string, unknown>],
      };
    });
    return messages;
  });