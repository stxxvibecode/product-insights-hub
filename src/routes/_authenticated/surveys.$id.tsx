import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getSurvey, updateSurvey } from "@/lib/surveys.functions";
import { listSurveyChat } from "@/lib/survey-chat.functions";
import {
  getWorkspaceBrandProfile,
  resolveWorkspaceBrand,
  themeFromBrand,
} from "@/lib/brand.functions";
import { QuestionPreview } from "@/components/QuestionPreview";
import type { QuestionType } from "@/lib/question-types";
import { supabase } from "@/integrations/supabase/client";
import { ThemePanel } from "@/components/ThemePanel";
import { themeStyle, backgroundClass, DEFAULT_THEME, type SurveyTheme } from "@/lib/survey-theme";
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
  GitBranch,
  Minus,
  Palette,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2,
  X,
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
  {
    title: "Post-purchase NPS",
    body: "Measure satisfaction right after checkout, with follow-ups on pricing & onboarding.",
  },
  {
    title: "Dashboard redesign pulse",
    body: "Gauge clarity, speed, and usefulness of the new dashboard.",
  },
  { title: "Win/loss interview", body: "Why prospects didn't convert in the last 30 days." },
  {
    title: "Feature prioritization",
    body: "Five questions for our top 50 customers about what to ship next.",
  },
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
  const fetchBrand = useServerFn(getWorkspaceBrandProfile);
  const updateSurveyFn = useServerFn(updateSurvey);

  const surveyQ = useQuery({
    queryKey: ["survey", id],
    queryFn: () => fetchSurvey({ data: { id } }),
  });

  // Compose Mode is only for brand-new drafts. If the survey is already
  // live (or is an edit draft of a live survey), route the user into the
  // Editor Assist experience — where AI changes require review.
  useEffect(() => {
    const s = surveyQ.data?.survey;
    if (!s) return;
    if (s.status === "live" || s.is_edit_draft) {
      navigate({ to: "/surveys/$id/edit", params: { id }, replace: true });
    }
  }, [surveyQ.data?.survey, id, navigate]);

  const chatQ = useQuery({
    queryKey: ["survey-chat", id],
    queryFn: () => fetchChat({ data: { survey_id: id } }),
  });
  const brandQ = useQuery({
    queryKey: ["workspace-brand"],
    queryFn: () => fetchBrand(),
  });

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!chatQ.data) return [];
    return chatQ.data.map((m) => ({
      id: m.id,
      role: m.role,
      parts: (m.parts as unknown as UIMessage["parts"]) ?? [],
    }));
  }, [chatQ.data]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/chat/surveys/${id}`,
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [id],
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
    if (!seedPrompt) return;
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
  }, [seedPrompt, chatQ.isFetched, initialMessages.length, sendMessage, navigate, id]);

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
    const hasOverrides = Boolean(
      survey?.brand_overrides &&
      Object.keys(survey.brand_overrides as Record<string, unknown>).length > 0,
    );
    toast.success(
      hasOverrides
        ? "Your form is live — using this form's custom branding."
        : `Your form is live — it matches your ${resolvedBrand.brand_name ?? "workspace"} brand and is optimized to capture product feedback.`,
    );
  }

  const survey = surveyQ.data?.survey;
  const questions = surveyQ.data?.questions ?? [];

  // Theme state, debounced save.
  // Inheritance: Insightform defaults → workspace brand profile → this form's
  // saved design (survey.theme) → this form's brand overrides.
  const resolvedBrand = useMemo(() => {
    const workspaceBrand = brandQ.data ?? null;
    const overrides = (survey?.brand_overrides as Record<string, unknown> | null) ?? {};
    return resolveWorkspaceBrand(workspaceBrand, overrides as never);
  }, [brandQ.data, survey?.brand_overrides]);
  const remoteTheme = useMemo<SurveyTheme>(() => {
    const brandTheme = themeFromBrand(resolvedBrand);
    const formTheme = (survey?.theme as SurveyTheme | null) ?? {};
    return { ...DEFAULT_THEME, ...brandTheme, ...formTheme };
  }, [resolvedBrand, survey?.theme]);
  const [theme, setTheme] = useState<SurveyTheme>(remoteTheme);
  useEffect(() => {
    setTheme(remoteTheme);
  }, [remoteTheme]);
  const themeSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleThemeChange(next: SurveyTheme) {
    setTheme(next);
    if (themeSaveRef.current) clearTimeout(themeSaveRef.current);
    themeSaveRef.current = setTimeout(() => {
      const designPatch: Record<string, unknown> = {};
      if (next.preset !== undefined) designPatch.preset = next.preset;
      if (next.accent !== undefined) designPatch.accent = next.accent;
      if (next.background !== undefined) designPatch.background = next.background;
      if (next.font !== undefined) designPatch.font = next.font;
      if (next.radius !== undefined) designPatch.radius = next.radius;
      updateSurveyFn({ data: { id, theme: designPatch } })
        .then(() => qc.invalidateQueries({ queryKey: ["survey", id] }))
        .catch((e: Error) => toast.error(e.message));
    }, 400);
  }

  // Composer focus management.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    textareaRef.current?.focus();
  }, [id]);
  useEffect(() => {
    if (status === "ready") textareaRef.current?.focus();
  }, [status]);

  // Suggested next actions — show once after the first assistant reply completes.
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const lastMsg = messages[messages.length - 1];
  const readyWithReply =
    status === "ready" && messages.length >= 2 && lastMsg?.role === "assistant";

  function scrollToDesign() {
    if (typeof window === "undefined") return;
    const el = document.getElementById("form-design-panel");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const suggestions: {
    id: string;
    label: string;
    icon: typeof Plus;
    onClick: () => void;
  }[] = [
    {
      id: "followups",
      label: "Add follow-up questions",
      icon: Plus,
      onClick: () =>
        sendMessage({
          text: "Add 2–3 follow-up questions to the most important question in this survey.",
        }),
    },
    {
      id: "bias",
      label: "Check for bias",
      icon: ShieldCheck,
      onClick: () =>
        sendMessage({
          text: "Review this survey for biased or leading wording and rewrite any questions that need it.",
        }),
    },
    {
      id: "shorter",
      label: "Make it shorter",
      icon: Minus,
      onClick: () =>
        sendMessage({
          text: "Trim this survey to the fewest questions that still answer the goal.",
        }),
    },
    {
      id: "branching",
      label: "Add branching logic",
      icon: GitBranch,
      onClick: () =>
        sendMessage({
          text: "Add branching logic so respondents only see follow-ups relevant to their earlier answers.",
        }),
    },
    {
      id: "design",
      label: "Customize design",
      icon: Palette,
      onClick: scrollToDesign,
    },
    {
      id: "publish",
      label: "Publish",
      icon: Upload,
      onClick: () => {
        void publish();
      },
    },
  ];

  const canShowSuggestions = readyWithReply && survey?.status !== "live";
  const showSuggestions = canShowSuggestions && !suggestionsDismissed;
  const showSuggestionsToggle = canShowSuggestions && suggestionsDismissed;

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
              <img
                src={agentMark}
                alt=""
                className="h-7 w-7 rounded-md ring-1 ring-border transition-opacity group-hover:opacity-80"
              />
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
                  {showSuggestions && (
                    <div className="mb-2 rounded-2xl border border-border bg-card/70 px-3 py-2 backdrop-blur">
                      <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          <Sparkles className="h-3 w-3 text-signal" />
                          Suggested next actions
                        </div>
                        <button
                          type="button"
                          onClick={() => setSuggestionsDismissed(true)}
                          className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label="Hide suggestions"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((s) => {
                          const Icon = s.icon;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                s.onClick();
                                setSuggestionsDismissed(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-signal/40 hover:text-foreground"
                            >
                              <Icon className="h-3 w-3" />
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {showSuggestionsToggle && (
                    <div className="mb-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setSuggestionsDismissed(false)}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <Sparkles className="h-3 w-3 text-signal" /> Suggestions
                      </button>
                    </div>
                  )}
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
                      placeholder="Describe the survey you want to create..."
                      className="min-h-[64px] text-sm"
                    />
                    <PromptInputFooter className="justify-between">
                      <span className="px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        <kbd className="rounded border border-border px-1 py-0.5">⏎</kbd> send ·{" "}
                        <kbd className="rounded border border-border px-1 py-0.5">⇧⏎</kbd> newline
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
            theme={theme}
            onThemeChange={handleThemeChange}
            welcome={(survey?.welcome_screen ?? null) as WelcomeShape | null}
            thanks={(survey?.thank_you_screen ?? null) as ThanksShape | null}
            description={survey?.description ?? null}
            brand={{
              name: resolvedBrand.brand_name ?? "Insightform",
              logoUrl: resolvedBrand.logo_url ?? null,
              hideLogo: Boolean(
                (survey?.brand_overrides as { hide_logo?: boolean } | null)?.hide_logo,
              ),
              thankYouFallback: resolvedBrand.default_thank_you_message ?? null,
              hasOverrides: Boolean(
                survey?.brand_overrides &&
                Object.keys(survey.brand_overrides as Record<string, unknown>).length > 0,
              ),
            }}
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
          {showAvatar && <img src={agentMark} alt="" className="mt-0.5 h-7 w-7 rounded-md" />}
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
        Describe the survey. The agent drafts Typeform-style questions and tags themes so insights
        roll up across every survey.
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

type WelcomeShape = { title?: string; description?: string; button?: string };
type ThanksShape = { title?: string; description?: string };
type PreviewTab = "question" | "welcome" | "complete";

function PreviewPane({
  title,
  slug,
  questions,
  theme,
  onThemeChange,
  welcome,
  thanks,
  description,
  brand,
}: {
  title: string;
  slug: string | null;
  questions: PreviewQ[];
  theme: SurveyTheme;
  onThemeChange: (next: SurveyTheme) => void;
  welcome: WelcomeShape | null;
  thanks: ThanksShape | null;
  description: string | null;
  brand: {
    name: string;
    logoUrl: string | null;
    hideLogo: boolean;
    thankYouFallback: string | null;
    hasOverrides: boolean;
  };
}) {
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<PreviewTab>("question");

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
    <div className="flex min-h-0 flex-col overflow-y-auto">
      <div id="form-design-panel">
        <ThemePanel theme={theme} onChange={onThemeChange} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-6">
        {/* Design check */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border/70 bg-card/50 px-3.5 py-2.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Design check
          </span>
          {["Contrast looks good", "Buttons are readable", "Mobile spacing is balanced"].map(
            (c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 text-[11px] text-foreground/85"
              >
                <Check className="h-3 w-3 text-emerald-400" />
                {c}
              </span>
            ),
          )}
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
            {brand.hasOverrides ? "Custom branding (this form)" : "Workspace brand"}
          </span>
        </div>

        {/* Preview tabs */}
        <div
          role="tablist"
          aria-label="Preview screen"
          className="inline-flex w-fit rounded-lg border border-border bg-card/50 p-0.5"
        >
          {(
            [
              { id: "question", label: "Question" },
              { id: "welcome", label: "Welcome" },
              { id: "complete", label: "Complete" },
            ] as Array<{ id: PreviewTab; label: string }>
          ).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Browser frame */}
        <div className="flex min-h-[640px] flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card/70 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] backdrop-blur">
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
              {slug &&
                (copied ? (
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

          {/* Frame body — themed surface */}
          <div
            className={`relative min-h-0 flex-1 overflow-hidden ${backgroundClass(theme)}`}
            style={themeStyle(theme)}
          >
            {tab === "welcome" ? (
              <div className="mx-auto flex h-full max-w-xl flex-col justify-center px-8 py-12">
                {!brand.hideLogo && brand.logoUrl ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    className="mb-4 h-8 w-8 rounded-md object-contain"
                  />
                ) : null}
                <div
                  className="text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--t-accent)" }}
                >
                  {title || "Untitled survey"}
                </div>
                <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight text-balance">
                  {welcome?.title ?? "We'd love your input."}
                </h1>
                <p className="mt-4 max-w-lg text-sm text-muted-foreground text-pretty">
                  {welcome?.description ?? description ?? "It takes about a minute."}
                </p>
                <button
                  className="mt-7 inline-flex w-fit items-center gap-2 rounded-[var(--radius)] px-5 py-2.5 text-sm font-medium"
                  style={{ background: "var(--t-accent)", color: "var(--t-accent-foreground)" }}
                >
                  {welcome?.button ?? "Start"}
                </button>
              </div>
            ) : tab === "complete" ? (
              <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center px-8 py-12 text-center">
                <div
                  className="grid h-12 w-12 place-items-center rounded-full ring-1"
                  style={{
                    background: "color-mix(in oklab, var(--t-accent) 15%, transparent)",
                    color: "var(--t-accent)",
                    borderColor: "var(--t-accent)",
                  }}
                >
                  <Check className="h-6 w-6" />
                </div>
                <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight">
                  {thanks?.title ?? "Thank you."}
                </h1>
                <p className="mt-3 max-w-md text-sm text-muted-foreground">
                  {thanks?.description ??
                    brand.thankYouFallback ??
                    "Your response was recorded. It now feeds the team's source of truth."}
                </p>
              </div>
            ) : questions.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <img src={agentMark} alt="" className="h-10 w-10 rounded-xl opacity-90" />
                <h3 className="mt-4 font-display text-lg font-semibold">
                  Your survey will appear here
                </h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  As the agent builds it, questions render live in this preview.
                </p>
              </div>
            ) : (
              <div className="mx-auto flex h-full max-w-xl flex-col px-8 py-10">
                <div className="flex items-center gap-2">
                  {!brand.hideLogo && brand.logoUrl ? (
                    <img
                      src={brand.logoUrl}
                      alt={brand.name}
                      className="h-5 w-5 rounded object-contain"
                    />
                  ) : null}
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {title || "Untitled survey"}
                  </div>
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
          {tab === "question" && questions.length > 0 && (
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
