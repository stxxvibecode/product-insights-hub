export type BuildPhase = "optimistic" | "streaming" | "ready";

/**
 * Human labels for the survey-composer tool calls, used to tell the user what
 * the assistant is doing while the preview is still being built.
 */
export const BUILD_STEP_LABELS: Record<string, string> = {
  set_survey_meta: "Setting the title",
  add_question: "Adding a question",
  replace_all_questions: "Drafting questions",
  update_question: "Refining a question",
  remove_question: "Removing a question",
  tag_question: "Applying tags",
  set_theme: "Applying your design",
  set_thank_you: "Writing the thank-you screen",
  set_brand_overrides: "Matching your brand",
  update_workspace_brand: "Updating your brand",
};

export const DEFAULT_STEP_LABEL = "Composing";

export function stepLabelFor(toolName: string | null): string {
  if (!toolName) return DEFAULT_STEP_LABEL;
  return BUILD_STEP_LABELS[toolName] ?? DEFAULT_STEP_LABEL;
}

type LoosePart = { type?: string; state?: string };

/**
 * Walks message parts and returns:
 *  - activeTool: name of the last tool that has not produced output yet
 *  - completed: how many tool calls have finished
 */
export function readToolActivity(parts: LoosePart[]): {
  activeTool: string | null;
  completed: number;
} {
  let activeTool: string | null = null;
  let completed = 0;
  for (const p of parts) {
    if (typeof p.type !== "string" || !p.type.startsWith("tool-")) continue;
    const name = p.type.slice("tool-".length);
    if (p.state === "output-available" || p.state === "output-error") {
      completed += 1;
    } else {
      activeTool = name;
    }
  }
  return { activeTool, completed };
}
