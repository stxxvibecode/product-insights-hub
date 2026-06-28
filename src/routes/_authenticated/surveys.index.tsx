import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { listSurveys, createSurvey } from "@/lib/surveys.functions";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import agentMark from "@/assets/agent-mark.png";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";

export const Route = createFileRoute("/_authenticated/surveys/")({
  head: () => ({ meta: [{ title: "Surveys — Insightform" }] }),
  component: SurveysIndex,
});

const STARTERS = [
  "Post-purchase NPS for our SaaS",
  "Onboarding pulse for new signups",
  "Win/loss interview for churned trials",
  "Feature prioritization for top 50 customers",
  "Dashboard redesign feedback",
];

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
  const { data, isLoading } = useQuery({ queryKey: ["surveys"], queryFn: () => fetchList() });

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
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[640px] bg-[radial-gradient(circle_at_50%_18%,rgba(255,122,69,0.16),transparent_60%)]"
        />
        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col px-6 pt-24 pb-16">
          <div className="flex flex-col items-center text-center">
            <img src={agentMark} alt="" className="h-10 w-10 rounded-xl shadow-sm" />
            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight tracking-tight text-balance md:text-5xl">
              What do you want to learn<br />from your users?
            </h1>
            <p className="mt-3 max-w-md text-sm text-muted-foreground text-pretty">
              Describe the survey and Insightform composes the questions, tags themes, and feeds every answer into your source of truth.
            </p>
          </div>

          <div className="mt-10">
            <PromptInput
              className="rounded-2xl border-border bg-card/80 shadow-[0_30px_80px_-40px_rgba(255,122,69,0.35)] backdrop-blur"
              onSubmit={async (msg) => {
                const text = msg.text?.trim();
                if (!text) return;
                create.mutate(text);
              }}
            >
              <PromptInputTextarea
                placeholder="e.g. Post-purchase NPS for our SaaS, with two follow-ups on pricing and onboarding."
                className="min-h-[140px] text-base"
              />
              <PromptInputFooter className="justify-between">
                <span className="px-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Press <kbd className="rounded border border-border px-1 py-0.5">⏎</kbd> to compose
                </span>
                <PromptInputSubmit
                  status={create.isPending ? "submitted" : undefined}
                  disabled={create.isPending}
                />
              </PromptInputFooter>
            </PromptInput>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
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

          {/* Library */}
          <div className="mt-20">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Library · Your surveys
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every response feeds the source of truth.
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

            <div className="mt-5">
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
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {data.map((s) => (
                    <Link key={s.id} to="/surveys/$id" params={{ id: s.id }} className="group">
                      <div className="rounded-2xl border border-border bg-card p-5 transition-colors group-hover:border-signal/40">
                        <div className="flex items-center justify-between">
                          <StatusPill status={s.status} />
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                        </div>
                        <h3 className="mt-3 font-display text-base font-medium leading-snug">{s.title}</h3>
                        {s.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                        )}
                        <div className="mt-4 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                          <span>{s.response_count} responses</span>
                          <span>{new Date(s.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
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