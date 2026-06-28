import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { getSourceOfTruth } from "@/lib/insights.functions";
import { listDecisions } from "@/lib/decisions.functions";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";
import { Activity, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { motion } from "motion/react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Source of truth — Insightform" }] }),
  component: DashboardPage,
});

type Range = "7d" | "30d" | "90d";

function DashboardPage() {
  const fetchSoT = useServerFn(getSourceOfTruth);
  const fetchDecisions = useServerFn(listDecisions);
  const { data, isLoading } = useQuery({ queryKey: ["source-of-truth"], queryFn: () => fetchSoT() });
  const { data: decisions } = useQuery({ queryKey: ["decisions"], queryFn: () => fetchDecisions() });

  const computed = useMemo(() => compute(data, "30d"), [data]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <span className="text-signal">●</span> Live signal
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-balance">
              Source of truth
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every response across every survey, rolled up into one product view.
            </p>
          </div>
          <div className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            Last 30 days · {computed.surveyCount} surveys · {computed.totalResponses} responses
          </div>
        </header>

        {/* Pulse strip */}
        <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Responses" value={computed.totalResponses} delta={computed.deltaResponses} />
          <MetricCard label="Completion rate" value={`${Math.round(computed.completionRate * 100)}%`} delta={computed.deltaCompletion} />
          <MetricCard label="Avg NPS" value={computed.avgNps !== null ? computed.avgNps.toFixed(1) : "—"} delta={computed.deltaNps} accent />
          <MetricCard label="Avg rating" value={computed.avgRating !== null ? computed.avgRating.toFixed(2) : "—"} delta={computed.deltaRating} />
        </div>

        {/* Trend + Themes */}
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium tracking-tight">Response volume</h2>
              <div className="font-mono text-xs text-muted-foreground">30d · daily</div>
            </div>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={computed.trend}>
                  <XAxis dataKey="d" stroke="currentColor" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="currentColor" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="v" stroke="var(--signal)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium tracking-tight">NPS distribution</h2>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={computed.npsBuckets}>
                  <XAxis dataKey="b" stroke="currentColor" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="v" fill="var(--signal)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Detractors {computed.nps.detractors}</span>
              <span>Passives {computed.nps.passives}</span>
              <span>Promoters {computed.nps.promoters}</span>
            </div>
          </motion.div>
        </div>

        {/* Themes by tag */}
        <section className="mt-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium tracking-tight">Themes by tag</h2>
            <span className="text-xs text-muted-foreground">Aggregated across surveys</span>
          </div>
          {computed.themes.length === 0 ? (
            <EmptyState label="No tags yet. Tag questions in the builder to see cross-survey rollups." />
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {computed.themes.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-background/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                      {t.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{t.answerCount}</span>
                  </div>
                  <div className="mt-2 font-mono text-2xl tabular-nums">
                    {t.avg !== null ? t.avg.toFixed(2) : "—"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{t.questionCount} questions, {t.surveyCount} surveys</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Decision feed */}
        <section className="mt-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium tracking-tight">Decision feed</h2>
            <span className="text-xs text-muted-foreground">Audit trail of product decisions</span>
          </div>
          {(decisions ?? []).length === 0 ? (
            <EmptyState label="No decisions yet. Notable signal shifts will appear here." />
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {(decisions ?? []).map((d) => (
                <li key={d.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{d.title}</div>
                    <div className="font-mono text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</div>
                  </div>
                  {d.body && <p className="mt-1 text-sm text-muted-foreground">{d.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {isLoading && <div className="mt-6 text-center text-sm text-muted-foreground">Loading signal…</div>}
      </div>
    </AppShell>
  );
}

function MetricCard({ label, value, delta, accent }: { label: string; value: string | number; delta: number | null; accent?: boolean }) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className={`rounded-2xl border border-border p-5 ${accent ? "bg-card ring-1 ring-signal/30" : "bg-card"}`}>
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-end justify-between">
        <div className={`font-display text-3xl font-semibold tabular-nums ${accent ? "text-signal" : ""}`}>{value}</div>
        {delta !== null && (
          <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${up ? "text-emerald-400" : "text-rose-400"}`}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta)}%
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-border bg-background/30 p-5 text-sm text-muted-foreground">
      <Activity className="h-4 w-4" /> {label}
    </div>
  );
}

type SoT = Awaited<ReturnType<typeof getSourceOfTruth>>;

function compute(data: SoT | undefined, _range: Range) {
  if (!data) {
    return {
      surveyCount: 0, totalResponses: 0, completionRate: 0,
      avgNps: null as number | null, avgRating: null as number | null,
      deltaResponses: null, deltaCompletion: null, deltaNps: null, deltaRating: null,
      trend: [] as { d: string; v: number }[],
      npsBuckets: [] as { b: number; v: number }[],
      nps: { detractors: 0, passives: 0, promoters: 0 },
      themes: [] as { id: string; name: string; color: string; avg: number | null; answerCount: number; questionCount: number; surveyCount: number }[],
    };
  }
  const now = Date.now();
  const days = 30;
  const cutoff = now - days * 86400_000;
  const prevCutoff = now - 2 * days * 86400_000;

  const recentResponses = data.responses.filter((r) => new Date(r.started_at).getTime() >= cutoff);
  const prevResponses = data.responses.filter((r) => {
    const t = new Date(r.started_at).getTime();
    return t >= prevCutoff && t < cutoff;
  });
  const completed = recentResponses.filter((r) => r.completed_at).length;
  const completionRate = recentResponses.length ? completed / recentResponses.length : 0;
  const prevCompletion = prevResponses.length
    ? prevResponses.filter((r) => r.completed_at).length / prevResponses.length
    : 0;

  const npsQids = new Set(data.questions.filter((q) => q.type === "nps").map((q) => q.id));
  const ratingQids = new Set(data.questions.filter((q) => q.type === "rating").map((q) => q.id));
  const recentResponseIds = new Set(recentResponses.map((r) => r.id));
  const recentAns = data.answers.filter((a) => recentResponseIds.has(a.response_id));

  const npsVals = recentAns.filter((a) => npsQids.has(a.question_id) && a.value_number !== null).map((a) => Number(a.value_number));
  const ratingVals = recentAns.filter((a) => ratingQids.has(a.question_id) && a.value_number !== null).map((a) => Number(a.value_number));
  const avgNps = npsVals.length ? npsVals.reduce((s, v) => s + v, 0) / npsVals.length : null;
  const avgRating = ratingVals.length ? ratingVals.reduce((s, v) => s + v, 0) / ratingVals.length : null;

  // Trend (responses per day, last 30d)
  const trend: { d: string; v: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now - i * 86400_000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = dayStart.getTime() + 86400_000;
    const v = data.responses.filter((r) => {
      const t = new Date(r.started_at).getTime();
      return t >= dayStart.getTime() && t < dayEnd;
    }).length;
    trend.push({ d: `${dayStart.getMonth() + 1}/${dayStart.getDate()}`, v });
  }

  // NPS buckets 0..10
  const npsBuckets = Array.from({ length: 11 }, (_, i) => ({ b: i, v: npsVals.filter((v) => v === i).length }));
  const detractors = npsVals.filter((v) => v <= 6).length;
  const passives = npsVals.filter((v) => v >= 7 && v <= 8).length;
  const promoters = npsVals.filter((v) => v >= 9).length;

  // Themes by tag
  const tagToQuestions = new Map<string, Set<string>>();
  for (const qt of data.questionTags) {
    if (!tagToQuestions.has(qt.tag_id)) tagToQuestions.set(qt.tag_id, new Set());
    tagToQuestions.get(qt.tag_id)!.add(qt.question_id);
  }
  const qToSurvey = new Map(data.questions.map((q) => [q.id, q.survey_id]));
  const themes = data.tags.map((t) => {
    const qs = tagToQuestions.get(t.id) ?? new Set();
    const tagAns = recentAns.filter((a) => qs.has(a.question_id));
    const nums = tagAns.map((a) => a.value_number).filter((n): n is number => n !== null);
    const surveys = new Set<string>();
    qs.forEach((qid) => {
      const sid = qToSurvey.get(qid);
      if (sid) surveys.add(sid);
    });
    return {
      id: t.id,
      name: t.name,
      color: t.color,
      avg: nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null,
      answerCount: tagAns.length,
      questionCount: qs.size,
      surveyCount: surveys.size,
    };
  }).sort((a, b) => b.answerCount - a.answerCount);

  return {
    surveyCount: data.surveys.length,
    totalResponses: recentResponses.length,
    completionRate,
    avgNps,
    avgRating,
    deltaResponses: prevResponses.length ? Math.round(((recentResponses.length - prevResponses.length) / prevResponses.length) * 100) : null,
    deltaCompletion: prevCompletion ? Math.round((completionRate - prevCompletion) * 100) : null,
    deltaNps: null,
    deltaRating: null,
    trend,
    npsBuckets,
    nps: { detractors, passives, promoters },
    themes,
  };
}