import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft, ArrowRight, Send, Sparkles, Loader2, Settings2, Share2, Copy, ExternalLink, Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { QuestionPreview } from "@/components/QuestionPreview";
import { getSurvey, updateSurvey } from "@/lib/surveys.functions";
import { generateSurvey, listSurveyChat } from "@/lib/ai-survey.functions";
import { QUESTION_TYPE_META, type QuestionType } from "@/lib/question-types";

export const Route = createFileRoute("/_authenticated/surveys/$id")({
  head: () => ({ meta: [{ title: "Compose — Insightform" }] }),
  component: SurveyComposer,
});

const EXAMPLES = [
  "Post-onboarding NPS with 1 open follow-up",
  "Pricing page feedback — why did you not upgrade?",
  "Churn exit interview, 5 questions max",
  "Feature request triage for power users",
];

function SurveyComposer() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchSurvey = useServerFn(getSurvey);
  const fetchChat = useServerFn(listSurveyChat);
  const generate = useServerFn(generateSurvey);
  const updateSurveyFn = useServerFn(updateSurvey);

  const { data: survey } = useQuery({ queryKey: ["survey", id], queryFn: () => fetchSurvey({ data: { id } }) });
  const { data: chat } = useQuery({ queryKey: ["survey-chat", id], queryFn: () => fetchChat({ data: { survey_id: id } }) });

  const [prompt, setPrompt] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const gen = useMutation({
    mutationFn: (p: string) => generate({ data: { survey_id: id, prompt: p } }),
    onMutate: (p) => setPendingUser(p),
    onSettled: () => setPendingUser(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey-chat", id] });
      qc.invalidateQueries({ queryKey: ["survey", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "AI failed"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat?.length, pendingUser, gen.isPending]);

  const submit = () => {
    const p = prompt.trim();
    if (!p || gen.isPending) return;
    setPrompt("");
    gen.mutate(p);
  };

  const questions = survey?.questions ?? [];
  const hasMessages = (chat?.length ?? 0) > 0 || gen.isPending || !!pendingUser;
  const isLive = survey?.survey.status === "live";

  return (
    <AppShell>
      <div className="grid h-[calc(100vh-0px)] grid-cols-1 lg:grid-cols-[minmax(380px,42%)_1fr]">
        {/* Chat pane */}
        <div className="flex h-screen flex-col border-r border-border">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <Link to="/surveys" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Surveys
            </Link>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-signal" /> AI composer
            </div>
          </div>

          {!hasMessages ? (
            <EmptyComposer prompt={prompt} setPrompt={setPrompt} submit={submit} pending={gen.isPending} />
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
                <div className="mx-auto max-w-xl space-y-5">
                  {chat?.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} tool={m.tool_payload as ToolPayload | null} />)}
                  {pendingUser && <ChatMessage role="user" content={pendingUser} tool={null} />}
                  {gen.isPending && <ThinkingBubble />}
                </div>
              </div>
              <Composer prompt={prompt} setPrompt={setPrompt} submit={submit} pending={gen.isPending} />
            </>
          )}
        </div>

        {/* Preview pane */}
        <div className="flex h-screen flex-col bg-card/30">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{survey?.survey.title ?? "New survey"}</div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {questions.length} {questions.length === 1 ? "question" : "questions"}
                {survey?.survey.description ? ` · ${survey.survey.description}` : ""}
              </div>
            </div>
            <button
              onClick={() => {
                if (!survey) return;
                updateSurveyFn({ data: { id, status: isLive ? "draft" : "live" } }).then(() => {
                  qc.invalidateQueries({ queryKey: ["survey", id] });
                  toast.success(isLive ? "Set to draft" : "Survey is live");
                });
              }}
              disabled={!questions.length}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${isLive ? "border border-border text-foreground" : "bg-signal text-signal-foreground"}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-signal-foreground/60"}`} />
              {isLive ? "Live" : "Publish"}
            </button>
            <Link
              to="/surveys/$id/edit"
              params={{ id }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" /> Builder
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-10">
            <PreviewStage questions={questions} slug={survey?.survey.slug} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

type ToolPayload = {
  title?: string;
  question_count?: number;
  types?: string[];
  tags?: string[];
} | null;

function ChatMessage({ role, content, tool }: { role: string; content: string; tool: ToolPayload }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {content}
        </div>
      </div>
    );
  }
  if (role === "system") return null;
  return (
    <div className="flex gap-3">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-signal/15 ring-1 ring-signal/30">
        <Sparkles className="h-3.5 w-3.5 text-signal" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{content}</div>
        {tool && (
          <details className="group rounded-xl border border-border bg-card/60">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Wand2 className="h-3.5 w-3.5 text-signal" />
              <span>
                Generated {tool.question_count} {tool.question_count === 1 ? "question" : "questions"}
                {tool.tags?.length ? ` · ${tool.tags.length} ${tool.tags.length === 1 ? "tag" : "tags"}` : ""}
              </span>
              <span className="ml-auto text-muted-foreground/60 group-open:rotate-90 transition-transform">›</span>
            </summary>
            <div className="space-y-1.5 border-t border-border px-3 py-2.5 text-xs">
              {tool.types?.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-mono text-[10px] text-muted-foreground/70">{String(i + 1).padStart(2, "0")}</span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-foreground/80">
                    {QUESTION_TYPE_META[t as QuestionType]?.label ?? t}
                  </span>
                </div>
              ))}
              {tool.tags?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5 pt-2 border-t border-border">
                  {tool.tags.map((t) => (
                    <span key={t} className="rounded-full bg-signal/10 px-2 py-0.5 text-[10px] text-signal">#{t}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-3">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-signal/15 ring-1 ring-signal/30">
        <Sparkles className="h-3.5 w-3.5 animate-pulse text-signal" />
      </div>
      <div className="flex items-center gap-1 pt-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:200ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:400ms]" />
        <span className="ml-2 text-xs text-muted-foreground">Drafting your survey…</span>
      </div>
    </div>
  );
}

function EmptyComposer({ prompt, setPrompt, submit, pending }: { prompt: string; setPrompt: (s: string) => void; submit: () => void; pending: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-signal/15 ring-1 ring-signal/30">
            <Sparkles className="h-5 w-5 text-signal" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-semibold leading-tight tracking-tight text-balance">
            Describe the survey<br />you want to run.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground text-pretty">
            One sentence is enough. The AI drafts a Typeform-style survey and tags each question for your source-of-truth dashboard.
          </p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="mt-7 rounded-2xl border border-border bg-card p-3 shadow-2xl shadow-black/30 focus-within:border-signal/60"
        >
          <textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={3}
            placeholder="e.g. NPS for users 30 days after onboarding, with one open follow-up tagged 'nps'."
            className="w-full resize-none bg-transparent px-2 pt-1 text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Enter to send · Shift+Enter newline
            </span>
            <button
              type="submit"
              disabled={!prompt.trim() || pending}
              className="inline-flex items-center gap-1.5 rounded-full bg-signal px-3 py-1.5 text-xs font-medium text-signal-foreground disabled:opacity-40"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Generate
            </button>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap justify-center gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-signal/40 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Composer({ prompt, setPrompt, submit, pending }: { prompt: string; setPrompt: (s: string) => void; submit: () => void; pending: boolean }) {
  return (
    <div className="border-t border-border bg-background/80 px-5 py-3 backdrop-blur">
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="mx-auto flex max-w-xl items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-signal/60"
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          rows={1}
          placeholder="Ask the AI to edit the survey…"
          className="min-h-[36px] max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/60"
        />
        <button
          type="submit"
          disabled={!prompt.trim() || pending}
          aria-label="Send"
          className="grid h-8 w-8 place-items-center rounded-full bg-signal text-signal-foreground disabled:opacity-40"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </form>
    </div>
  );
}

function PreviewStage({ questions, slug }: { questions: Awaited<ReturnType<typeof getSurvey>>["questions"]; slug?: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => { if (index >= questions.length) setIndex(Math.max(0, questions.length - 1)); }, [questions.length, index]);

  const current = questions[index];
  const total = questions.length;

  if (!total) {
    return (
      <div className="mx-auto grid h-full max-w-xl place-items-center">
        <div className="rounded-3xl border border-dashed border-border p-12 text-center">
          <div className="mx-auto h-10 w-10 rounded-xl bg-signal/15 ring-1 ring-signal/30" />
          <h2 className="mt-4 font-display text-xl font-semibold">Your survey appears here</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Send a prompt on the left. Each question renders one at a time, exactly like respondents will see it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col">
      <div className="flex items-center gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Question {index + 1} of {total}
        </div>
        <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-secondary">
          <motion.div
            initial={false}
            animate={{ width: `${((index + 1) / total) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="h-full bg-signal"
          />
        </div>
        {slug && (
          <Link
            to="/s/$slug" params={{ slug }} target="_blank"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" /> Open
          </Link>
        )}
      </div>

      <div className="mt-8 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <QuestionPreview
              type={current.type as QuestionType}
              title={current.title}
              description={current.description}
              required={current.required}
              config={(current.config ?? {}) as never}
              value={undefined}
              onChange={() => {}}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-40 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <ShareLink slug={slug} />
        <button
          onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
          disabled={index >= total - 1}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-40 hover:text-foreground"
        >
          Next <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ShareLink({ slug }: { slug?: string }) {
  const url = useMemo(() => (slug && typeof window !== "undefined" ? `${window.location.origin}/s/${slug}` : ""), [slug]);
  if (!slug) return <span />;
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}
      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs text-foreground/80 hover:text-foreground"
    >
      <Share2 className="h-3.5 w-3.5" /> Share
      <Copy className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}