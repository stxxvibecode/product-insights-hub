// Central copy for the Compose vs Editor Assist boundary. Keep all
// user-facing strings from the product brief in one place so buttons,
// dialogs, and placeholders stay consistent.

export const COPY = {
  composePlaceholder: "Describe the survey you want to create...",
  editorAssistPlaceholder:
    "Ask AI to edit, rewrite, reorder, or check this survey...",

  liveEditModal: {
    title: "This survey is live",
    body: "This survey is live. Create an edit draft to make changes safely.",
    primary: "Create edit draft",
    secondary: "Cancel",
  },

  editDraftBanner: {
    live: "Live survey",
    editingDraft: "Editing draft version",
  },

  publishUpdate: {
    title: "Review changes",
    reportingImpact:
      "Existing responses will remain tied to the previous version. New responses will use the updated version.",
    primary: "Publish update",
    secondary: "Save draft",
    discard: "Discard draft",
  },

  risk: {
    low: "Low risk — safe to apply.",
    medium:
      "Medium risk — this change may affect how respondents interpret the question.",
    high:
      "High risk — this may affect reporting. Existing responses will stay attached to the previous version. New responses will use the updated version.",
  },
} as const;

export type RiskLevel = "low" | "medium" | "high";
