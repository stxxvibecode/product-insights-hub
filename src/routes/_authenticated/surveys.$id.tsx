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
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
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
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  ExternalLink,
  Pencil,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/surveys/$id")({
  head: () => ({ meta: [{ title: "Compose — Insightform" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    prompt: typeof s.prompt === "string" ? s.prompt : undefined,
  }),
  component: SurveyComposer,
});

const STARTERS = [
  { title: "Post-purchase NPS", body: "Measure satisfaction right after checkout, with follow-ups on pricing & onboarding." },
  { title: "Dashboard redesign pulse", body: "Gauge clarity, speed, and usefulness of the new dashboard." },
  { title: "Win/loss interview", body: "Why prospects didn't convert in the last 30 days." },
  { title: "Feature prioritization", body: "Five questions for our top 50 customers about what to ship next." },
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
  const { prompt: seedPrompt } = Route.useSearch();
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
        headers: (): Record<string, string> =>
          authToken ? { Authorization: `Bearer ${authToken}` } : {},
      }),
    [id, authToken],
  );

  const { messages, sendMessage, status, setMessages, error } = useChat({
    id: `survey:${id}`,
    transport,
    onError: (e) => toast.error(e.message || "Something went wrong"),
  });

  // Auto-send a seed prompt coming from the surveys index.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!seedPrompt || !authToken) return;
    if (!chatQ.isFetched) return; // wait for history check
    if (initialMessages.length > 0) {
      // chat already exists; just clear the param
      seededRef.current = true;
      navigate({ to: "/surveys/$id", params: { id }, search: {}, replace: true });
      return;
    }
    seededRef.current = true;
    void sendMessage({ text: seedPrompt });
    navigate({ to: "/surveys/$id", params: { id }, search: {}, replace: true });
  }, [seedPrompt, authToken, chatQ.isFetched, initialMessages.length, sendMessage, navigate, id]);

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
      .map((p) => {
        const anyP = p as unknown as { type?: string; toolCallId?: string; state?: string };
        if (typeof anyP.type === "string" && anyP.type.startsWith("tool-")) {
          return `${anyP.toolCallId}:${anyP.state}`;
        }
        return "";
      })
      .filter(Boolean)
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

  // Composer focus management.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    textareaRef.current?.focus();
  }, [id]);
  useEffect(() => {
    if (status === "ready") textareaRef.current?.focus();
  }, [status]);

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-1px)] flex-col">
        {/* Slim header */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-background/70 px-5 py-2.5 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => navigate({ to: "/surveys" })}
              aria-label="Back to surveys"
              className="group relative"
              title="Back to surveys"
            >
              <img src={agentMark} alt="" className="h-7 w-7 rounded-md ring-1 ring-border transition-opacity group-hover:opacity-80" />
            </button>
            <div className="flex min-w-0 items-center gap-2">
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
                  className="w-[32ch] max-w-full rounded-md border border-input bg-background px-2 py-1 font-display text-sm outline-none focus:border-signal/60"
                />
              ) : (
                <button
                  onClick={() => setEditingTitle(true)}
                  className="group flex min-w-0 items-center gap-1.5 font-display text-sm font-medium tracking-tight"
                >
                  <span className="truncate">{survey?.title ?? "Untitled survey"}</span>
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )}
              <span
                className={`ml-1 inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground`}
              >
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
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              to="/surveys/$id/edit"
              params={{ id }}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-card hover:text-foreground"
            >
              <Wand2 className="h-3.5 w-3.5" /> Advanced
            </Link>
            {survey?.slug && (
              <a
                href={`/s/${survey.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-card hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </a>
            )}
            {survey?.status !== "live" ? (
              <button
                onClick={publish}
                className="inline-flex items-center gap-1.5 rounded-full bg-signal px-3 py-1.5 text-xs font-medium text-signal-foreground transition-transform hover:-translate-y-0.5"
              >
                <Sparkles className="h-3.5 w-3.5" /> Publish
              </button>
            ) : null}
          </div>
        </div>

        {/* Split */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
          {/* Chat pane */}
          <div className="relative flex min-h-0 flex-col border-r border-border">
            <Conversation className="flex-1">
              <ConversationContent className="mx-auto w-full max-w-[640px] px-6 pb-40 pt-8">
                {messages.length === 0 ? (
                  <EmptyChat onPick={(t) => sendMessage({ text: t })} />
                ) : (
                  <div className="space-y-6">
                    {messages.map((m, i) => (
                      <ChatMessage
                        key={m.id}
                        message={m}
                        showAvatar={
                          m.role === "assistant" &&
                          (i === 0 || messages[i - 1]?.role !== "assistant")
                        }
                      />
                    ))}
                    {status === "submitted" && (
                      <div className="flex items-center gap-2.5 pl-0.5 text-sm text-muted-foreground">
                        <img src={agentMark} alt="" className="h-6 w-6 rounded-md" />
                        <Shimmer>Composing…</Shimmer>
                      </div>
                    )}
                    {error && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {error.message}
                      </div>
                    )}
                  </div>
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            {/* Sticky composer with fade overlay */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
              <div className="h-16 bg-gradient-to-t from-background via-background/85 to-transparent" />
              <div className="bg-background pb-5 pt-1">
                <div className="pointer-events-auto mx-auto w-full max-w-[640px] px-6">
                  <PromptInput
                    className="rounded-2xl border-border bg-card/70 shadow-[0_24px_60px_-30px_rgba(255,122,69,0.35)] backdrop-blur"
                    onSubmit={async (msg) => {
                      const text = msg.text?.trim();
                      if (!text) return;
                      await sendMessage({ text });
                    }}
                  >
                    <PromptInputTextarea
                      ref={textareaRef}
                      placeholder="Ask the agent to add, rewrite, or tag questions…"
                      className="min-h-[64px] text-sm"
                    />
                    <PromptInputFooter className="justify-between">
                      <span className="px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        <kbd className="rounded border border-border px-1 py-0.5">⏎</kbd> send · <kbd className="rounded border border-border px-1 py-0.5">⇧⏎</kbd> newline
                      </span>
                      <PromptInputSubmit
                        status={status}
                        disabled={status === "submitted" || status === "streaming"}
                      />
                    </PromptInputFooter>
                  </PromptInput>
                </div>
              </div>
            </div>
          </div>

          {/* Preview pane */}
          <PreviewPane
            title={survey?.title ?? ""}
            slug={survey?.slug ?? null}
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

function ChatMessage({ message, showAvatar }: { message: UIMessage; showAvatar: boolean }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <Message from="user">
        <MessageContent className="ml-auto max-w-[85%] rounded-2xl bg-card text-foreground">
          {message.parts.map((part, i) =>
            part.type === "text" ? (
              <MessageResponse key={i} isAnimating={false}>
                {part.text}
              </MessageResponse>
            ) : null,
          )}
        </MessageContent>
      </Message>
    );
  }
  return (
    <Message from="assistant">
      <div className="flex w-full items-start gap-3">
        <div className="w-7 shrink-0">
          {showAvatar && (
            <img src={agentMark} alt="" className="mt-0.5 h-7 w-7 rounded-md" />
          )}
        </div>
        <MessageContent className="min-w-0 flex-1 bg-transparent p-0 text-foreground">
          <div className="space-y-2.5">
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                if (!part.text?.trim()) return null;
                return (
                  <MessageResponse key={i} isAnimating={false}>
                    {part.text}
                  </MessageResponse>
                );
              }
              if (typeof part.type === "string" && part.type.startsWith("tool-")) {
                const p = part as unknown as ToolPart;
                return (
                  <Tool key={p.toolCallId} defaultOpen={false}>
                    <ToolHeader
                      type={p.type as `tool-${string}`}
                      state={p.state}
                      title={prettyToolTitle(p.type, p.input)}
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
          </div>
        </MessageContent>
      </div>
    </Message>
  );
}

function prettyToolTitle(type: string, input: unknown): string {
  const name = type.replace(/^tool-/, "");
  const base = prettyToolName(type);
  const obj = (input ?? {}) as Record<string, unknown>;
  const get = (k: string) => (typeof obj[k] === "string" ? (obj[k] as string) : undefined);
  let detail: string | undefined;
  if (name === "add_question" || name === "update_question") {
    detail = [get("type"), get("title")].filter(Boolean).join(" · ");
  } else if (name === "set_survey_meta") {
    detail = get("title");
  } else if (name === "tag_question") {
    detail = get("tag");
  }
  return detail ? `${base} · ${detail}` : base;
}

function EmptyChat({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center pt-10 text-center">
      <img src={agentMark} alt="" className="h-12 w-12 rounded-xl shadow-sm" />
      <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-balance">
        What should we learn?
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground text-pretty">
        Describe the survey. The agent drafts Typeform-style questions and tags themes so insights roll up across every survey.
      </p>
      <div className="mt-8 grid w-full grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
        {STARTERS.map((s) => (
          <button
            key={s.title}
            onClick={() => onPick(`${s.title}: ${s.body}`)}
            className="group rounded-xl border border-border bg-card/50 p-3.5 transition-colors hover:border-signal/40 hover:bg-card"
          >
            <div className="text-sm font-medium text-foreground">{s.title}</div>
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.body}</div>
          </button>
        ))}
      </div>
    </div>
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

function PreviewPane({
  title,
  slug,
  questions,
}: {
  title: string;
  slug: string | null;
  questions: PreviewQ[];
}) {
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (idx > questions.length - 1) setIdx(Math.max(0, questions.length - 1));
  }, [questions.length, idx]);

  useEffect(() => {
    setValue(null);
  }, [questions[idx]?.id]);

  const q = questions[idx];
  const publicPath = slug ? `/s/${slug}` : "/s/preview";
  const publicUrl =
    slug && typeof window !== "undefined" ? `${window.location.origin}${publicPath}` : publicPath;

  async function copyUrl() {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  return (
    <div className="flex min-h-0 flex-col bg-[radial-gradient(circle_at_80%_-10%,rgba(255,122,69,0.10),transparent_55%)]">
      <div className="flex min-h-0 flex-1 flex-col p-6">
        {/* Browser frame */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card/70 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] backdrop-blur">
          {/* Frame chrome */}
          <div className="flex items-center gap-3 border-b border-border bg-background/40 px-3 py-2">
            <div className="flex items-center gap-1.5 pl-1">
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            </div>
            <button
              onClick={copyUrl}
              disabled={!slug}
              className="group flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-border/60 bg-background/50 px-2.5 py-1 text-left text-[11px] font-mono text-muted-foreground hover:text-foreground disabled:cursor-default"
              title={slug ? "Copy public link" : "Publish to get a public link"}
            >
              <span className="truncate">{publicUrl}</span>
              {slug && (copied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              ))}
            </button>
            {slug && (
              <a
                href={publicPath}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Frame body */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {questions.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <img src={agentMark} alt="" className="h-10 w-10 rounded-xl opacity-90" />
                <h3 className="mt-4 font-display text-lg font-semibold">Your survey will appear here</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  As the agent builds it, questions render live in this preview.
                </p>
              </div>
            ) : (
              <div className="mx-auto flex h-full max-w-xl flex-col px-8 py-10">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {title || "Untitled survey"}
                </div>
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
              </div>
            )}
          </div>

          {/* Frame footer */}
          {questions.length > 0 && (
            <div className="flex items-center justify-between border-t border-border bg-background/40 px-3 py-2">
              <button
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground disabled:opacity-40 hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Question {idx + 1} of {questions.length}
              </div>
              <button
                onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
                disabled={idx >= questions.length - 1}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground disabled:opacity-40 hover:text-foreground"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}