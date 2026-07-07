import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useServerFn } from "@tanstack/react-start";
import {
  getPublicSurvey,
  startResponse,
  submitAnswer,
  completeResponse,
} from "@/lib/responses.functions";
import type { QuestionType } from "@/lib/question-types";
import { QuestionPreview } from "@/components/QuestionPreview";
import { Logo } from "@/components/Logo";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { themeStyle, backgroundClass, type SurveyTheme } from "@/lib/survey-theme";

export const Route = createFileRoute("/s/$slug")({
  head: () => ({ meta: [{ title: "Survey — Insightform" }] }),
  loader: async ({ params }) => {
    const data = await getPublicSurvey({ data: { slug: params.slug } });
    if (!data.survey) throw notFound();
    return data;
  },
  component: PublicSurvey,
});

type Q = Awaited<ReturnType<typeof getPublicSurvey>>["questions"][number];

function PublicSurvey() {
  const { survey, questions, resolved_brand } = Route.useLoaderData();
  const start = useServerFn(startResponse);
  const submit = useServerFn(submitAnswer);
  const complete = useServerFn(completeResponse);

  const [responseId, setResponseId] = useState<string | null>(null);
  const [stage, setStage] = useState<"welcome" | "question" | "done">(
    survey!.welcome_screen ? "welcome" : "question",
  );
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => {
    if (typeof window === "undefined") return "ssr";
    const key = `insightform:t:${survey!.id}`;
    let t = localStorage.getItem(key);
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem(key, t);
    }
    return t;
  }, [survey]);

  async function ensureResponse() {
    if (responseId) return responseId;
    const r = await start({ data: { survey_id: survey!.id, respondent_token: token } });
    setResponseId(r.id);
    return r.id;
  }

  async function handleSubmit(overrideValue?: unknown) {
    if (submittingRef.current) return;
    const q = questions[index];
    if (!q) return;
    const value = overrideValue !== undefined ? overrideValue : answers[q.id];
    if (
      q.required &&
      (value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0))
    )
      return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    if (overrideValue !== undefined) {
      setAnswers((a) => ({ ...a, [q.id]: overrideValue }));
    }
    try {
      const rid = await ensureResponse();
      if (value !== undefined && value !== null && value !== "") {
        await submit({
          data: { response_id: rid, question_id: q.id, respondent_token: token, value },
        });
      }
      if (index === questions.length - 1) {
        await complete({ data: { response_id: rid, respondent_token: token } });
        setStage("done");
      } else {
        setIndex((i) => i + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const progress =
    stage === "done" ? 1 : stage === "welcome" ? 0 : (index + 1) / (questions.length || 1);
  const theme = ((resolved_brand?.theme ?? survey!.theme) as SurveyTheme | null) ?? {};
  const brandName = resolved_brand?.brand_name || null;
  const logoUrl = !theme.hide_logo ? (resolved_brand?.logo_url ?? null) : null;
  const brandThankYou =
    resolved_brand?.default_thank_you_message ||
    "Your response was recorded. It now feeds the team's source of truth.";

  return (
    <div
      className={`relative min-h-screen overflow-hidden bg-background text-foreground ${backgroundClass(theme)}`}
      style={themeStyle(theme)}
    >
      <div className="pointer-events-none absolute inset-0 grain opacity-40" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-signal/10 blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        {logoUrl ? (
          <div className="flex items-center gap-2.5">
            <img
              src={logoUrl}
              alt={brandName ?? ""}
              className="h-7 w-7 rounded-md object-contain"
            />
            {brandName && <span className="text-sm font-medium">{brandName}</span>}
          </div>
        ) : brandName ? (
          <span className="text-sm font-medium">{brandName}</span>
        ) : (
          <Logo />
        )}
        <div className="font-mono text-xs text-muted-foreground">{Math.round(progress * 100)}%</div>
      </header>
      <div className="relative z-10 mx-auto h-[2px] max-w-3xl overflow-hidden bg-secondary">
        <motion.div
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.4 }}
          className="h-full bg-signal"
        />
      </div>

      <main className="relative z-10 mx-auto flex max-w-3xl flex-col px-6 pt-16 pb-24 md:pt-24">
        <AnimatePresence mode="wait">
          {stage === "welcome" && (
            <Slide key="welcome">
              <div className="text-xs uppercase tracking-[0.18em] text-signal">{survey!.title}</div>
              <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl text-balance">
                {(survey!.welcome_screen as WelcomeShape | null)?.title ?? "We'd love your input."}
              </h1>
              <p className="mt-4 max-w-xl text-base text-muted-foreground text-pretty">
                {(survey!.welcome_screen as WelcomeShape | null)?.description ??
                  survey!.description ??
                  "It takes about a minute."}
              </p>
              <button
                onClick={() => setStage("question")}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-medium text-signal-foreground transition-transform hover:-translate-y-0.5"
              >
                {(survey!.welcome_screen as WelcomeShape | null)?.button ?? "Start"}{" "}
                <ArrowRight className="h-4 w-4" />
              </button>
            </Slide>
          )}

          {stage === "question" && questions[index] && (
            <Slide key={`q-${questions[index].id}`}>
              <div className="flex items-center gap-2 font-mono text-xs text-signal">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>→</span>
              </div>
              <div className="mt-3">
                <QuestionPreview
                  type={questions[index].type as QuestionType}
                  title={questions[index].title}
                  description={questions[index].description}
                  required={questions[index].required}
                  config={(questions[index].config ?? {}) as never}
                  value={answers[questions[index].id]}
                  onChange={(v) => setAnswers((a) => ({ ...a, [questions[index].id]: v }))}
                  onSubmit={(v) => handleSubmit(v)}
                />
              </div>
              {error && (
                <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="mt-10 flex items-center justify-between">
                <button
                  disabled={index === 0}
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  ← Back
                </button>
                <button
                  onClick={() => handleSubmit()}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-medium text-signal-foreground disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : index === questions.length - 1 ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {index === questions.length - 1 ? "Submit" : "OK"}
                </button>
              </div>
            </Slide>
          )}

          {stage === "done" && (
            <Slide key="done">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-signal/15 text-signal ring-1 ring-signal/40">
                <Check className="h-6 w-6" />
              </div>
              <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight">
                {(survey!.thank_you_screen as ThanksShape | null)?.title ?? "Thank you."}
              </h1>
              <p className="mt-3 max-w-xl text-base text-muted-foreground">
                {(survey!.thank_you_screen as ThanksShape | null)?.description ?? brandThankYou}
              </p>
            </Slide>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 pb-6 text-center text-xs text-muted-foreground">
        Powered by <span className="text-foreground">Insightform</span>
      </footer>
    </div>
  );
}

type WelcomeShape = { title?: string; description?: string; button?: string };
type ThanksShape = { title?: string; description?: string };

function Slide({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
