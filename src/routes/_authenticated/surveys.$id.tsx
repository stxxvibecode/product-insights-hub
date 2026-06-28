import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getSurvey, updateSurvey } from "@/lib/surveys.functions";
import { listSurveyChat } from "@/lib/survey-chat.functions";
import { QuestionPreview } from "@/components/QuestionPreview";
import type { QuestionType } from "@/lib/question-types";
import { supabase } from "@/integrations/supabase/client";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import agentMark from "@/assets/agent-mark.png";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/surveys/$id")({
  head: () => ({ meta: [{ title: "Compose — Insightform" }] }),
  component: SurveyComposer,
});

const STARTERS = [
  "Post-purchase NPS for our SaaS, with two follow-ups on pricing and onboarding.",
  "Pulse on the new dashboard redesign — measure clarity, speed, and usefulness.",
  "Win/loss survey for prospects who didn't convert in the last 30 days.",
  "5-question feature prioritization survey for our top 50 customers.",
];

type ToolPart = {
  type: `tool-${string}`;
  toolCallId: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function SurveyComposer() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchSurvey = useServerFn(getSurvey);
  const fetchChat = useServerFn(listSurveyChat);
  const updateSurveyFn = useServerFn(updateSurvey);

  const surveyQ = useQuery({
    queryKey: ["survey", id],
    queryFn: () => fetchSurvey({ data: { id } }),
  });

  const chatQ = useQuery({
    queryKey: ["survey-chat", id],
    queryFn: () => fetchChat({ data: { survey_id: id } }),
  });

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!chatQ.data) return [];
    return chatQ.data.map((m) => ({
      id: m.id,
      role: m.role,
      parts: (m.parts as unknown as UIMessage["parts"]) ?? [],
    }));
  }, [chatQ.data]);

  const [authToken, setAuthToken] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setAuthToken(data.session?.access_token ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthToken(session?.access_token ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/chat/surveys/${id}`,
        headers: () => (authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      }),
    [id, authToken],
  );

  const { messages, sendMessage, status, setMessages, error } = useChat({
    id: `survey:${id}`,
    transport,
    onError: (e) => toast.error(e.message || "Something went wrong"),
  });

  // Hydrate from server on first chat-load (or refresh).
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current && initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
      hydratedRef.current = true;
    }
    if (chatQ.isFetched) hydratedRef.current = true;
  }, [initialMessages, messages.length, setMessages, chatQ.isFetched]);

  // Re-pull the survey whenever a tool finishes (live preview).
  const lastToolSig = useRef<string>("");
  useEffect(() => {
    const sig = messages
      .flatMap((m) => m.parts)
      .filter((p): p is ToolPart => typeof p.type === "string" && p.type.startsWith("tool-"))
      .map((p) => `${p.toolCallId}:${p.state}`)
      .join("|");
    if (sig !== lastToolSig.current) {
      lastToolSig.current = sig;
      qc.invalidateQueries({ queryKey: ["survey", id] });
    }
  }, [messages, qc, id]);

  // Title editing.
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  useEffect(() => {
    if (surveyQ.data?.survey.title) setTitleDraft(surveyQ.data.survey.title);
  }, [surveyQ.data?.survey.title]);

  async function saveTitle() {
    if (!titleDraft.trim() || titleDraft === surveyQ.data?.survey.title) {
      setEditingTitle(false);
      return;
    }
    await updateSurveyFn({ data: { id, title: titleDraft.trim() } });
    qc.invalidateQueries({ queryKey: ["survey", id] });
    setEditingTitle(false);
  }

  async function publish() {
    await updateSurveyFn({ data: { id, status: "live" } });
    qc.invalidateQueries({ queryKey: ["survey", id] });
    toast.success("Survey is live");
  }

  const survey = surveyQ.data?.survey;
  const questions = surveyQ.data?.questions ?? [];

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-1px)] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => navigate({ to: "/surveys" })}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
              aria-label="Back to surveys"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              {editingTitle ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle();
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                  className="w-[28ch] max-w-full rounded-md border border-input bg-background px-2 py-1 font-display text-base outline-none focus:border-signal/60"
                />
              ) : (
                <button
                  onClick={() => setEditingTitle(true)}
                  className="group flex items-center gap-1.5 font-display text-base font-semibold tracking-tight"
                >
                  <span className="truncate">{survey?.title ?? "Untitled survey"}</span>
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )}
              <div className="mt-0.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      survey?.status === "live"
                        ? "bg-emerald-400"
                        : survey?.status === "closed"
                        ? "bg-rose-400"
                        : "bg-muted-foreground"
                    }`}
                  />
                  {survey?.status ?? "draft"}
                </span>
                <span>·</span>
                <span>{questions.length} questions</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/surveys/$id/edit"
              params={{ id }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Wand2 className="h-3.5 w-3.5" /> Advanced
            </Link>
            {survey?.slug && (
              <a
                href={`/s/${survey.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </a>
            )}
            {survey?.status !== "live" ? (
              <button
                onClick={publish}
                className="inline-flex items-center gap-1.5 rounded-md bg-signal px-3 py-1.5 text-xs font-medium text-signal-foreground"
              >
                <Sparkles className="h-3.5 w-3.5" /> Publish
              </button>
            ) : null}
          </div>
        </div>

        {/* Split */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* Chat pane */}
          <div className="flex min-h-0 flex-col border-r border-border bg-background/60">
            <Conversation className="flex-1">
              <ConversationContent className="mx-auto w-full max-w-2xl">
                {messages.length === 0 ? (
                  <ConversationEmptyState
                    className="h-full"
                    icon={
                      <img
                        src={agentMark}
                        alt="Insightform agent"
                        className="h-12 w-12 rounded-xl"
                      />
                    }
                    title="Describe the survey you need"
                    description="The agent will draft, refine, and tag questions in real time. The preview on the right updates as it works."
                  >
                    <img src={agentMark} alt="" className="h-12 w-12 rounded-xl" />
                    <div className="space-y-1">
                      <h3 className="font-display text-lg font-medium">Compose with AI</h3>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        Describe what you want to learn. The agent drafts Typeform-style questions and tags them so insights roll up across every survey.
                      </p>
                    </div>
                    <div className="mt-4 grid w-full max-w-xl gap-2 text-left">
                      {STARTERS.map((s) => (
                        <button
                          key={s}
                          onClick={() => sendMessage({ text: s })}
                          className="group rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-foreground transition-colors hover:border-signal/40 hover:bg-card"
                        >
                          <span className="text-muted-foreground transition-colors group-hover:text-foreground">
                            {s}
                          </span>
                        </button>
                      ))}
                    </div>
                  </ConversationEmptyState>
                ) : (
                  messages.map((m) => <ChatMessage key={m.id} message={m} />)
                )}
                {status === "submitted" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <img src={agentMark} alt="" className="h-5 w-5 rounded-md" />
                    <Shimmer>Thinking…</Shimmer>
                  </div>
                )}
                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error.message}
                  </div>
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <div className="mx-auto w-full max-w-2xl px-4 pb-4">
              <PromptInput
                onSubmit={async (msg) => {
                  const text = msg.text?.trim();
                  if (!text) return;
                  await sendMessage({ text });
                }}
              >
                <PromptInputBody>
                  <PromptInputTextarea placeholder="Describe the survey, or ask the agent to tweak a question…" />
                  <PromptInputFooter>
                    <PromptInputTools>
                      <span className="px-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Shift + Enter for newline
                      </span>
                    </PromptInputTools>
                    <PromptInputSubmit status={status} />
                  </PromptInputFooter>
                </PromptInputBody>
              </PromptInput>
            </div>
          </div>

          {/* Preview pane */}
          <PreviewPane
            title={survey?.title ?? ""}
            questions={questions.map((q) => ({
              id: q.id,
              type: q.type as QuestionType,
              title: q.title,
              description: q.description,
              required: q.required,
              config: (q.config ?? {}) as Record<string, unknown>,
            }))}
          />
        </div>
      </div>
    </AppShell>
  );
}

function ChatMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  return (
    <Message from={message.role}>
      <div className="flex items-start gap-3">
        {!isUser && (
          <img src={agentMark} alt="" className="mt-1 h-7 w-7 shrink-0 rounded-md" />
        )}
        <MessageContent>
          {message.parts.map((part, i) => {
            if (part.type === "text") {
              return (
                <MessageResponse key={i} isAnimating={false}>
                  {part.text}
                </MessageResponse>
              );
            }
            if (typeof part.type === "string" && part.type.startsWith("tool-")) {
              const p = part as unknown as ToolPart;
              return (
                <Tool key={p.toolCallId} defaultOpen={p.state === "output-error"}>
                  <ToolHeader
                    type={p.type as `tool-${string}`}
                    state={p.state}
                    title={prettyToolName(p.type)}
                  />
                  <ToolContent>
                    <ToolInput input={p.input} />
                    <ToolOutput output={p.output} errorText={p.errorText} />
                  </ToolContent>
                </Tool>
              );
            }
            return null;
          })}
        </MessageContent>
      </div>
    </Message>
  );
}

function prettyToolName(type: string) {
  const raw = type.replace(/^tool-/, "");
  const map: Record<string, string> = {
    add_question: "Adding question",
    update_question: "Updating question",
    remove_question: "Removing question",
    replace_all_questions: "Rebuilding survey",
    tag_question: "Tagging question",
    set_survey_meta: "Setting survey title",
  };
  return map[raw] ?? raw.replaceAll("_", " ");
}

type PreviewQ = {
  id: string;
  type: QuestionType;
  title: string;
  description: string | null;
  required: boolean;
  config: Record<string, unknown>;
};

function PreviewPane({ title, questions }: { title: string; questions: PreviewQ[] }) {
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState<unknown>(null);

  // If questions list shrinks/grows, keep idx in range.
  useEffect(() => {
    if (idx > questions.length - 1) setIdx(Math.max(0, questions.length - 1));
  }, [questions.length, idx]);

  // Reset answer whenever the visible question changes.
  useEffect(() => {
    setValue(null);
  }, [questions[idx]?.id]);

  const q = questions[idx];

  return (
    <div className="flex min-h-0 flex-col bg-[radial-gradient(circle_at_80%_-10%,rgba(255,122,69,0.10),transparent_55%)]">
      <div className="flex items-center justify-between border-b border-border px-6 py-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <span>Live preview</span>
        {questions.length > 0 && (
          <span className="font-mono">
            {idx + 1} / {questions.length}
          </span>
        )}
      </div>
      <div className="relative flex-1 overflow-hidden">
        {questions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="h-12 w-12 rounded-2xl border border-dashed border-border" />
            <h3 className="mt-4 font-display text-xl font-semibold">No questions yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Describe what you want to learn in the chat — questions will appear here as the agent drafts them.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex h-full max-w-2xl flex-col px-8 py-12">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
            <div className="mt-6 flex-1">
              {q && (
                <QuestionPreview
                  key={q.id}
                  type={q.type}
                  title={q.title}
                  description={q.description}
                  required={q.required}
                  config={q.config}
                  value={value}
                  onChange={setValue}
                />
              )}
            </div>
            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-40 hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <div className="font-mono text-[11px] text-muted-foreground">
                press <kbd className="rounded border border-border px-1.5 py-0.5">→</kbd> to continue
              </div>
              <button
                onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
                disabled={idx >= questions.length - 1}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-40 hover:text-foreground"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}