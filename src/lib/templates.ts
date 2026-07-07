// Prebuilt templates are adaptive starting points, not static copies.
// Each template carries a hidden insight goal set. When selected, we ask the
// minimum setup questions, then generate the form through the AI pipeline —
// which applies the workspace brand profile and product description by default.

export type SurveyTemplate = {
  id: string;
  name: string;
  description: string;
  audienceHint: string;
  insightGoals: string[];
  defaultProductAreas: string[];
};

export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    id: "feature-feedback",
    name: "Feature Feedback",
    description: "How a specific feature landed — clarity, usefulness, gaps.",
    audienceHint: "Users who tried the feature",
    insightGoals: [
      "Identify what users understand",
      "Identify what users find confusing",
      "Measure perceived usefulness",
      "Capture missing functionality",
      "Determine likelihood of repeat use",
    ],
    defaultProductAreas: ["feature_adoption"],
  },
  {
    id: "churn-survey",
    name: "Churn Survey",
    description: "Why customers cancel and what could have saved them.",
    audienceHint: "Cancelled or downgraded customers",
    insightGoals: [
      "Identify cancellation reasons",
      "Detect pricing objections",
      "Detect product gaps",
      "Understand competitor switching",
      "Identify save opportunities",
    ],
    defaultProductAreas: ["retention", "pricing"],
  },
  {
    id: "pmf-survey",
    name: "Product-Market Fit Survey",
    description: "The Sean Ellis test plus positioning language.",
    audienceHint: "Active users (2+ weeks of usage)",
    insightGoals: [
      "Measure dependency",
      "Identify strongest user segment",
      "Capture core value",
      "Identify alternatives",
      "Surface positioning language",
    ],
    defaultProductAreas: ["product_market_fit"],
  },
  {
    id: "nps",
    name: "NPS",
    description: "Net promoter score with a diagnostic follow-up.",
    audienceHint: "All active customers",
    insightGoals: [
      "Measure loyalty",
      "Identify promoter motivations",
      "Identify detractor friction",
      "Capture improvement priorities",
    ],
    defaultProductAreas: ["loyalty"],
  },
  {
    id: "csat",
    name: "CSAT",
    description: "Satisfaction after a specific interaction or milestone.",
    audienceHint: "Users after a key touchpoint",
    insightGoals: [
      "Measure satisfaction",
      "Identify satisfaction drivers",
      "Identify dissatisfaction causes",
      "Capture service gaps",
    ],
    defaultProductAreas: ["satisfaction"],
  },
  {
    id: "onboarding-feedback",
    name: "Onboarding Feedback",
    description: "Where new users get stuck and what drives activation.",
    audienceHint: "Users in their first 1–14 days",
    insightGoals: [
      "Identify onboarding friction",
      "Measure time-to-value",
      "Identify confusing steps",
      "Capture activation blockers",
    ],
    defaultProductAreas: ["onboarding"],
  },
  {
    id: "beta-tester-feedback",
    name: "Beta Tester Feedback",
    description: "Structured signal from beta users on a new experience.",
    audienceHint: "Beta cohort",
    insightGoals: [
      "Identify confusion points",
      "Measure perceived value",
      "Determine repeat-use intent",
      "Capture bugs and rough edges",
    ],
    defaultProductAreas: ["beta", "feature_adoption"],
  },
  {
    id: "pricing-feedback",
    name: "Pricing Feedback",
    description: "Willingness to pay, plan fit, and pricing objections.",
    audienceHint: "Trial users or paying customers",
    insightGoals: [
      "Measure willingness to pay",
      "Detect pricing objections",
      "Identify plan mismatches",
      "Surface value perception",
    ],
    defaultProductAreas: ["pricing"],
  },
  {
    id: "interview-screener",
    name: "Customer Interview Screener",
    description: "Qualify and recruit the right users for interviews.",
    audienceHint: "Users matching your research criteria",
    insightGoals: [
      "Qualify by segment",
      "Measure usage depth",
      "Capture availability and consent",
      "Collect contact details",
    ],
    defaultProductAreas: ["research"],
  },
  {
    id: "bug-report",
    name: "Bug Report",
    description: "Structured bug intake with severity and reproduction.",
    audienceHint: "Users who hit an issue",
    insightGoals: [
      "Capture reproduction steps",
      "Measure severity and impact",
      "Identify affected product area",
      "Collect environment details",
    ],
    defaultProductAreas: ["quality"],
  },
  {
    id: "roadmap-prioritization",
    name: "Roadmap Prioritization",
    description: "Which potential features matter most to real users.",
    audienceHint: "Engaged customers",
    insightGoals: [
      "Rank feature demand",
      "Identify underserved needs",
      "Segment demand by user type",
      "Capture willingness to trade off",
    ],
    defaultProductAreas: ["roadmap"],
  },
];

export function buildTemplatePrompt(input: {
  template: SurveyTemplate;
  learningGoal: string;
  audience: string;
  subject: string;
  toneChoice: "brand" | string;
}): string {
  const { template, learningGoal, audience, subject, toneChoice } = input;
  const lines = [
    `Create a ${template.name} form using the workspace brand profile and product description.`,
    "",
    `What we're trying to learn: ${learningGoal || template.description}`,
    `Who is answering: ${audience || template.audienceHint}`,
    `What this is about: ${subject || "our product"}`,
    toneChoice === "brand"
      ? "Tone: use the workspace default tone."
      : `Tone for this form only: ${toneChoice} (save it as a form-level override; do not change the workspace brand).`,
    "",
    "Hidden insight goals — design the questions to capture these, and set insight_kind / product_area / priority_signal metadata on every question accordingly:",
    ...template.insightGoals.map((g) => `- ${g}`),
    "",
    `Suggested product areas for metadata: ${template.defaultProductAreas.join(", ")}.`,
    "Also write a branded thank-you screen.",
  ];
  return lines.join("\n");
}
