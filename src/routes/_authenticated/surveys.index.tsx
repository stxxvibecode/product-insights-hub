import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listSurveys, createSurvey } from "@/lib/surveys.functions";
import { Plus, ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/surveys/")({
  head: () => ({ meta: [{ title: "Surveys — Insightform" }] }),
  component: SurveysIndex,
});

function SurveysIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchList = useServerFn(listSurveys);
  const createFn = useServerFn(createSurvey);
  const { data, isLoading } = useQuery({ queryKey: ["surveys"], queryFn: () => fetchList() });
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  const create = useMutation({
    mutationFn: (t: string) => createFn({ data: { title: t } }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      navigate({ to: "/surveys/$id", params: { id: s.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't create"),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Library</div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Surveys</h1>
            <p className="mt-1 text-sm text-muted-foreground">All your surveys feed the source of truth.</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2 text-sm font-medium text-signal-foreground transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> New survey
          </button>
        </div>

        {creating && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) create.mutate(title.trim());
            }}
            className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4"
          >
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled survey — name it"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal/60 focus:ring-2 focus:ring-signal/20"
            />
            <button
              disabled={create.isPending || !title.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-signal px-3 py-2 text-sm font-medium text-signal-foreground disabled:opacity-50"
            >
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create
            </button>
            <button type="button" onClick={() => { setCreating(false); setTitle(""); }} className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </form>
        )}

        <div className="mt-6">
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl border border-border bg-card/50" />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <EmptyState onCreate={() => setCreating(true)} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {data.map((s) => (
                <Link key={s.id} to="/surveys/$id" params={{ id: s.id }} className="group">
                  <div className="rounded-2xl border border-border bg-card p-5 transition-colors group-hover:border-signal/40">
                    <div className="flex items-center justify-between">
                      <StatusPill status={s.status} />
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>
                    <h3 className="mt-3 font-display text-lg font-medium leading-snug">{s.title}</h3>
                    {s.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                    )}
                    <div className="mt-5 flex items-center justify-between font-mono text-xs text-muted-foreground">
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
      <div className="mx-auto h-10 w-10 rounded-xl bg-signal/15 ring-1 ring-signal/30" />
      <h2 className="mt-4 font-display text-xl font-semibold">No surveys yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">Create your first survey to start building the source of truth.</p>
      <button onClick={onCreate} className="mt-5 inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2 text-sm font-medium text-signal-foreground">
        <Plus className="h-4 w-4" /> New survey
      </button>
    </div>
  );
}