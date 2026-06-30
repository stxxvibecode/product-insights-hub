import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listSurveys, createSurvey } from "@/lib/surveys.functions";
import { ArrowUpRight, Copy, Radio } from "lucide-react";
import { toast } from "sonner";
import agentMark from "@/assets/agent-mark.png";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
} from "@/components/ai-elements/prompt-input";

export const Route = createFileRoute("/_authenticated/surveys/")({
  head: () => ({ meta: [{ title: "Surveys — Insightform" }] }),
  component: SurveysIndex,
});

const STARTERS = [
  "Post-purchase NPS",
  "New user onboarding pulse",
  "Win/loss interview",
  "Feature prioritization",
  "Dashboard redesign feedback",
];

type Filter = "all" | "draft" | "live" | "closed";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "live", label: "Live" },
  { id: "closed", label: "Completed" },
];

function formatRelative(date: string | Date) {
  const t = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(t).toLocaleDateString();
}

function titleFromPrompt(prompt: string) {
  const t = prompt.trim().replace(/\s+/g, " ");
  if (!t) return "Untitled survey";
  const firstLine = t.split(/[.\n!?]/)[0] ?? t;
  return firstLine.length > 60 ? firstLine.slice(0, 57).trimEnd() + "…" : firstLine;
}

function SurveysIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchList = useServerFn(listSurveys);
  const createFn = useServerFn(createSurvey);
  const PAGE = 24;
  const [page, setPage] = useState(0);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["surveys", { page, size: PAGE }],
    queryFn: () => fetchList({ data: { limit: PAGE, offset: page * PAGE } }),
    staleTime: 30_000,
  });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const [filter, setFilter] = useState<Filter>("all");
  const counts = useMemo(() => {
    const c = { all: 0, draft: 0, live: 0, closed: 0 } as Record<Filter, number>;
    rows.forEach((s) => {
      c.all++;
      c[s.status]++;
    });
    return c;
  }, [rows]);
  const liveSurveys = useMemo(
    () => rows.filter((s) => s.status === "live"),
    [rows],
  );
  const filtered = useMemo(
    () => rows.filter((s) => (filter === "all" ? true : s.status === filter)),
    [rows, filter],
  );

  const create = useMutation({
    mutationFn: (prompt: string) =>
      createFn({ data: { title: titleFromPrompt(prompt) } }).then((s) => ({ s, prompt })),
    onSuccess: ({ s, prompt }) => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      navigate({
        to: "/surveys/$id",
        params: { id: s.id },
        search: prompt.trim() ? { prompt: prompt.trim() } : {},
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't create"),
  });

  return (
    <AppShell>
      <div className="relative min-h-[calc(100vh-1px)]">
        {/* Soft signal glow behind the hero */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px] bg-[radial-gradient(circle_at_50%_12%,rgba(255,122,69,0.12),transparent_60%)]"
        />
        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col px-6 pt-12 pb-16">
          <div className="flex flex-col items-center text-center">
            <img src={agentMark} alt="" className="h-8 w-8 rounded-xl shadow-sm" />
            <h1 className="mt-5 font-display text-3xl font-semibold leading-tight tracking-tight text-balance md:text-4xl">
              What do you want to learn today?
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground text-pretty">
              Describe the feedback you need. Insightform will draft the survey, apply tags, and organize responses into your source of truth.
            </p>
          </div>

          <div className="mx-auto mt-8 w-full max-w-3xl">
            <PromptInput
              className="rounded-2xl border-border bg-card/80 shadow-[0_40px_100px_-40px_rgba(255,122,69,0.45)] backdrop-blur focus-within:border-signal/40 focus-within:ring-1 focus-within:ring-signal/30"
              onSubmit={async (msg) => {
                const text = msg.text?.trim();
                if (!text) return;
                create.mutate(text);
              }}
            >
              <PromptInputTextarea
                placeholder="Example: Create a post-purchase NPS survey with follow-up questions about pricing, onboarding, and product value."
                className="min-h-[160px] text-base"
              />
              <PromptInputFooter className="justify-between">
                <span className="px-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Press <kbd className="rounded border border-border px-1 py-0.5">⏎</kbd> to compose
                </span>
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full bg-signal px-4 py-2 text-sm font-medium text-signal-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {create.isPending ? "Composing…" : "Compose"}
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </PromptInputFooter>
            </PromptInput>

            <div className="mt-5">
              <div className="text-center text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Start with a template
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => create.mutate(s)}
                    disabled={create.isPending}
                    className="rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-signal/40 hover:bg-card hover:text-foreground disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live now */}
          {liveSurveys.length > 0 && (
            <div className="mt-12">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="relative grid h-6 w-6 place-items-center rounded-md bg-emerald-400/10">
                      <span className="absolute inset-0 animate-ping rounded-md bg-emerald-400/30" />
                      <Radio className="relative h-3 w-3 text-emerald-400" strokeWidth={2.25} />
                    </span>
                    <h2 className="font-display text-xl font-semibold tracking-tight">Live now</h2>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                      {liveSurveys.length}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Surveys currently collecting responses from your audience.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {liveSurveys.map((s) => (
                  <LiveSurveyCard key={s.id} survey={s} />
                ))}
              </div>
            </div>
          )}

          {/* Library */}
          <div className="mt-12 border-t border-border/60 pt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">Your surveys</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Drafts, launched surveys, and feedback flows live here.
                </p>
              </div>
              {data && data.length > 0 && (
                <Link
                  to="/dashboard"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  View insights →
                </Link>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-1.5">
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={
                      "rounded-full border px-3 py-1.5 text-xs transition-colors " +
                      (active
                        ? "border-signal/50 bg-card text-foreground"
                        : "border-border bg-card/30 text-muted-foreground hover:text-foreground")
                    }
                  >
                    {f.label}
                    <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                      {counts[f.id]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              {isLoading ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-card/40" />
                  ))}
                </div>
              ) : !data || data.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/30 px-6 py-8 text-center text-sm text-muted-foreground">
                  Your composed surveys will appear here.
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/30 px-6 py-8 text-center text-sm text-muted-foreground">
                  No surveys in this view yet.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((s) => {
                    const action = s.status === "draft" ? "Open" : "View insights";
                    return (
                      <Link key={s.id} to="/surveys/$id" params={{ id: s.id }} className="group">
                        <div className="flex h-full flex-col rounded-2xl border border-border bg-card/80 p-5 transition-colors group-hover:border-signal/40 group-hover:bg-card">
                          <div className="flex items-center justify-between">
                            <StatusPill status={s.status} />
                            <span className="font-mono text-[11px] text-muted-foreground">
                              Updated {formatRelative(s.updated_at)}
                            </span>
                          </div>
                          <h3 className="mt-3 truncate font-display text-base font-medium leading-snug">
                            {s.title}
                          </h3>
                          {s.description ? (
                            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                              {s.description}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground/60">No description</p>
                          )}
                          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                            <span className="text-muted-foreground">
                              {s.response_count === 0
                                ? "No responses yet"
                                : `${s.response_count} response${s.response_count === 1 ? "" : "s"}`}
                            </span>
                            <span className="inline-flex items-center gap-1 text-foreground/80 transition-colors group-hover:text-signal">
                              {action}
                              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatusPill({ status }: { status: "draft" | "live" | "closed" }) {
  const map = {
    draft: { dot: "bg-muted-foreground", label: "Draft" },
    live: { dot: "bg-emerald-400", label: "Live" },
    closed: { dot: "bg-rose-400", label: "Closed" },
  } as const;
  const m = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  );
}

type SurveyRow = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "live" | "closed";
  updated_at: string;
  response_count: number;
};

function LiveSurveyCard({ survey }: { survey: SurveyRow }) {
  const url =
    typeof window === "undefined"
      ? `/s/${survey.slug}`
      : `${window.location.origin}/s/${survey.slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Public link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  return (
    <div className="group flex h-full flex-col rounded-2xl border border-emerald-400/20 bg-card/80 p-5 transition-colors hover:border-emerald-400/40">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {survey.response_count === 0
            ? "No responses"
            : `${survey.response_count} response${survey.response_count === 1 ? "" : "s"}`}
        </span>
      </div>
      <h3 className="mt-3 truncate font-display text-base font-medium leading-snug">{survey.title}</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Live since {formatRelative(survey.updated_at)}
      </p>

      <button
        type="button"
        onClick={copy}
        className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-emerald-400/40 hover:text-foreground"
        title="Copy public link"
      >
        <Copy className="h-3 w-3 shrink-0" />
        <span className="truncate font-mono">/s/{survey.slug}</span>
      </button>

      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
        <Link
          to="/surveys/$id"
          params={{ id: survey.id }}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          View insights
        </Link>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-emerald-300 transition-colors hover:text-emerald-200"
        >
          Open survey <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}