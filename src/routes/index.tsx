import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Activity,
  TrendingUp,
  Sparkles,
  Tag,
  Send,
  BarChart3,
  Layers,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Insightform — AI feedback & product insights" },
      {
        name: "description",
        content:
          "Insightform helps product teams collect focused feedback, detect important themes, and know what to fix, build, or prioritize next.",
      },
      { property: "og:title", content: "Insightform — AI feedback & product insights" },
      {
        property: "og:description",
        content:
          "Beautiful feedback in. Clear product decisions out. Built for product teams that need decisions, not spreadsheets.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Ambient grid */}
      <div className="pointer-events-none absolute inset-0 grain opacity-60" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-signal/[0.08] blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#product" className="hover:text-foreground">
            Product
          </a>
          <a href="#truth" className="hover:text-foreground">
            Source of truth
          </a>
          <a href="#how" className="hover:text-foreground">
            How it works
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            to="/app/dashboard"
            className="group inline-flex items-center gap-1.5 rounded-full bg-signal px-3.5 py-1.5 text-sm font-medium text-signal-foreground transition-transform hover:-translate-y-0.5"
          >
            Start free <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-24 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-signal" /> AI feedback & product insights
            </div>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-balance md:text-6xl lg:text-7xl">
              Beautiful feedback in.{" "}
              <span className="text-signal">Clear product decisions out.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
              Insightform helps product teams collect focused feedback, detect the themes that
              matter, and know what to fix, build, or prioritize next.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/app/dashboard"
                className="group inline-flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-medium text-signal-foreground transition-transform hover:-translate-y-0.5"
              >
                Get started — it’s free{" "}
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <a
                href="#product"
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground"
              >
                See product
              </a>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              No credit card required · Free for up to 3 surveys
            </p>
          </div>

          {/* Hero respondent card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-3xl bg-signal/10 blur-2xl" aria-hidden />
            <div className="relative rounded-2xl border border-border bg-card p-7 shadow-2xl shadow-black/40">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-signal" /> Product signal
              </div>
              <div className="mt-3 rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm text-foreground/90">
                Find out where users get stuck during onboarding, then prioritize the next fix.
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <motion.span
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                  className="h-1.5 w-1.5 rounded-full bg-signal"
                />
                Themes detected · next actions ready
              </div>
              <div className="mt-5 border-t border-border pt-5 text-xs font-mono text-signal">
                01 →
              </div>
              <h3 className="mt-2 font-display text-2xl font-medium leading-snug text-foreground">
                Where did you get stuck during setup?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose the option that best matches your experience.
              </p>
              <div className="mt-6 grid gap-2">
                {[
                  "I did not know what to do next",
                  "The copy was unclear",
                  "I expected something else",
                  "Other",
                ].map((option, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.025 }}
                    className={`rounded-md border px-3 py-2.5 text-left text-xs font-medium ${i === 0 ? "border-signal bg-signal text-signal-foreground" : "border-border bg-background/40 text-muted-foreground"}`}
                  >
                    {option}
                  </motion.div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Send className="h-3 w-3" /> Built for product teams
                </span>
                <span className="font-mono">42% mention setup friction</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Product cards */}
      <section id="product" className="relative z-10 mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card/60 p-6">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                AI Survey Builder
              </div>
              <Sparkles className="h-4 w-4 text-signal" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Build one-question-at-a-time surveys designed around real product decisions, not
              generic forms.
            </p>
            <div className="mt-5 rounded-xl border border-border bg-background/60 p-4">
              <p className="font-display text-xl leading-snug">
                “What felt useful, confusing, or missing about this feature?”
              </p>
              <div className="mt-4 rounded-lg border border-signal/40 bg-signal/10 p-3 text-xs text-muted-foreground">
                <span className="text-signal">AI suggestion:</span> Add a follow-up asking what the
                user was trying to accomplish.
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-6">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                In-App Survey
              </div>
              <Layers className="h-4 w-4 text-signal" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Capture feedback in the moment while users are actually experiencing your product.
            </p>
            <div className="mt-5 rounded-xl border border-border bg-background/60 p-4">
              <p className="font-display text-xl leading-snug">
                “Where did you get stuck during setup?”
              </p>
              <div className="mt-4 grid gap-2">
                {[
                  "I did not know what to do next",
                  "The copy was unclear",
                  "I expected something else",
                  "Other",
                ].map((option) => (
                  <div
                    key={option}
                    className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
                  >
                    {option}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-6">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Insights Dashboard
              </div>
              <BarChart3 className="h-4 w-4 text-signal" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Turn every response into themes, sentiment, urgency, and recommended next steps.
            </p>
            <div className="mt-5 rounded-xl border border-border bg-background/60 p-4">
              <p className="font-display text-xl leading-snug">
                “Users are not asking for more features. They are confused during onboarding.”
              </p>
              <div className="mt-4 font-mono text-sm text-signal">
                42% of negative responses mention setup friction.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Onboarding friction", "Negative sentiment", "High priority"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem section */}
      <section id="truth" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.18em] text-signal">
              Built for product clarity
            </div>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl text-balance">
              Product feedback is everywhere. Product clarity is not.
            </h2>
            <p className="mt-3 text-muted-foreground text-pretty">
              Teams collect feedback through forms, calls, support tickets, Slack messages, and
              spreadsheets. Insightform helps product teams turn that scattered feedback into clear
              themes, risks, and product decisions.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-3 lg:grid-cols-3">
          {[
            {
              title: "Surveys create spreadsheets",
              copy: "Most tools collect answers, then leave your team to manually sort through the mess.",
              icon: BarChart3,
            },
            {
              title: "Customer signal gets buried",
              copy: "Important themes hide inside scattered notes, long responses, support tickets, and Slack threads.",
              icon: Layers,
            },
            {
              title: "Decisions take too long",
              copy: "By the time feedback becomes insight, the roadmap conversation has already moved on.",
              icon: Zap,
            },
          ].map(({ title, copy, icon: Icon }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <Icon className="h-5 w-5 text-signal" />
              <h3 className="mt-4 font-display text-2xl font-medium leading-snug">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Source of truth section */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.18em] text-signal">
              One view, every signal
            </div>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl text-balance">
              See the customer signal behind every product question.
            </h2>
            <p className="mt-3 text-muted-foreground text-pretty">
              Turn responses into themes, sentiment, urgency, and next actions so PMs can decide
              what to fix, build, or prioritize next.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Pulse · 30d
              </div>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { l: "Responses", v: "12,847", d: "+18%" },
                { l: "Completion", v: "84%", d: "+2%" },
                { l: "Setup friction", v: "42%", d: "high priority", accent: true },
                { l: "Positive sentiment", v: "61%", d: "+8%" },
              ].map((m) => (
                <div key={m.l}>
                  <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {m.l}
                  </div>
                  <div
                    className={`mt-1 font-display text-3xl font-semibold tabular-nums ${m.accent ? "text-signal" : ""}`}
                  >
                    {m.v}
                  </div>
                  <div className="text-xs text-emerald-400">{m.d}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex h-32 items-end gap-1">
              {Array.from({ length: 30 }).map((_, i) => {
                const h = 30 + Math.round(40 + 30 * Math.sin(i / 2.5) + (i % 4) * 6);
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-signal/70"
                    style={{ height: `${h}%` }}
                  />
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Themes
              </div>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </div>
            <ul className="mt-4 space-y-3">
              {[
                { name: "onboarding friction", v: "42%", c: "#FF7A45", n: 412 },
                { name: "missing context", v: "28%", c: "#FFD166", n: 284 },
                { name: "feature request", v: "19%", c: "#6FC2B0", n: 192 },
                { name: "pricing concern", v: "11%", c: "#7AA2F7", n: 138 },
              ].map((t) => (
                <li key={t.name} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 rounded-full" style={{ background: t.c }} />
                    {t.name}
                  </span>
                  <span className="font-mono text-sm tabular-nums">
                    {t.v} <span className="text-xs text-muted-foreground">· {t.n}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-3">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Decision feed
              </div>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </div>
            <ul className="mt-4 divide-y divide-border">
              {[
                {
                  t: "Fix onboarding setup copy before adding another onboarding feature",
                  d: "2d ago",
                },
                {
                  t: "Prioritize workspace invite clarity in the next product sprint",
                  d: "5d ago",
                },
                {
                  t: "Watch pricing concerns from new trial users after plan-page update",
                  d: "1w ago",
                },
              ].map((d) => (
                <li key={d.t} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-foreground/90">{d.t}</span>
                  <span className="font-mono text-xs text-muted-foreground">{d.d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Ask",
              d: "Create focused surveys around a product decision, feature launch, onboarding issue, or roadmap question.",
            },
            {
              n: "02",
              t: "Capture",
              d: "Collect one-question-at-a-time responses while the customer context is still fresh.",
            },
            {
              n: "03",
              t: "Decide",
              d: "Turn every response into themes, sentiment, risks, and recommended product actions.",
            },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border border-border bg-card/60 p-6">
              <div className="font-mono text-xs text-signal">{s.n}</div>
              <h3 className="mt-2 font-display text-xl font-medium">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <div className="rounded-3xl border border-border bg-gradient-to-b from-card to-background p-10 text-center">
          <TrendingUp className="mx-auto h-6 w-6 text-signal" />
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight md:text-4xl text-balance">
            Built for PMs who need decisions, not spreadsheets.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Start with focused feedback, then see the themes, risks, and next actions behind every
            product question.
          </p>
          <Link
            to="/app/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-medium text-signal-foreground"
          >
            Get started — it’s free <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <Logo />
          <span>© {new Date().getFullYear()} Insightform</span>
        </div>
      </footer>
    </div>
  );
}
