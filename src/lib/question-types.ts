export type QuestionType =
  | "short_text"
  | "long_text"
  | "email"
  | "number"
  | "single_choice"
  | "multi_choice"
  | "rating"
  | "nps"
  | "scale"
  | "yes_no";

export const QUESTION_TYPE_META: Record<
  QuestionType,
  { label: string; icon: string; description: string; numeric: boolean; textual: boolean }
> = {
  short_text: { label: "Short text", icon: "Type", description: "One-line answer", numeric: false, textual: true },
  long_text: { label: "Long text", icon: "AlignLeft", description: "Paragraph answer", numeric: false, textual: true },
  email: { label: "Email", icon: "Mail", description: "Validated email address", numeric: false, textual: true },
  number: { label: "Number", icon: "Hash", description: "Numeric answer", numeric: true, textual: false },
  single_choice: { label: "Single choice", icon: "CircleDot", description: "Pick one option", numeric: false, textual: true },
  multi_choice: { label: "Multiple choice", icon: "ListChecks", description: "Pick many options", numeric: false, textual: false },
  rating: { label: "Rating", icon: "Star", description: "1–5 stars", numeric: true, textual: false },
  nps: { label: "NPS", icon: "Gauge", description: "0–10 likelihood to recommend", numeric: true, textual: false },
  scale: { label: "Scale", icon: "BarChart3", description: "1–7 agreement", numeric: true, textual: false },
  yes_no: { label: "Yes / No", icon: "CheckCircle2", description: "Binary choice", numeric: false, textual: true },
};

export function defaultConfigFor(type: QuestionType): Record<string, unknown> {
  switch (type) {
    case "single_choice":
    case "multi_choice":
      return { options: ["Option 1", "Option 2", "Option 3"] };
    case "rating":
      return { max: 5 };
    case "nps":
      return { min: 0, max: 10 };
    case "scale":
      return { min: 1, max: 7, minLabel: "Strongly disagree", maxLabel: "Strongly agree" };
    case "number":
      return { min: null, max: null };
    default:
      return {};
  }
}

export function defaultTitleFor(type: QuestionType): string {
  switch (type) {
    case "nps":
      return "How likely are you to recommend us to a friend?";
    case "rating":
      return "How would you rate this?";
    case "scale":
      return "How much do you agree?";
    case "email":
      return "What's your email?";
    case "yes_no":
      return "Yes or no?";
    default:
      return "Untitled question";
  }
}