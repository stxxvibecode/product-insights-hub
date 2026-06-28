import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Activity, TrendingUp, Sparkles, Tag, Send } from "lucide-react";
import { motion } from "motion/react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Insightform — Survey-driven product truth" },
      { name: "description", content: "Typeform-grade surveys for product teams. One cross-survey dashboard becomes your source of truth." },
      { property: "og:title", content: "Insightform — Survey-driven product truth" },
      { property: "og:description", content: "Beautiful surveys, one cross-survey dashboard. Make product decisions on signal, not vibes." },
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
          <a href="#product" className="hover:text-foreground">Product</a>
          <a href="#truth" className="hover:text-foreground">Source of truth</a>
          <a href="#how" className="hover:text-foreground">How it works</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link to="/auth" className="group inline-flex items-center gap-1.5 rounded-full bg-signal px-3.5 py-1.5 text-sm font-medium text-signal-foreground transition-transform hover:-translate-y-0.5">
            Start free <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-24 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-signal" /> Built for product teams
            </div>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-balance md:text-6xl lg:text-7xl">
              Describe a survey. <span className="text-signal">Ship it</span><br className="hidden md:inline" /> in 30 seconds.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
              Tell the AI what you want to learn. It drafts a Typeform-grade survey, tags every question, and folds responses into one source-of-truth dashboard for your product team.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/auth" className="group inline-flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-medium text-signal-foreground transition-transform hover:-translate-y-0.5">
                Compose with AI <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <a href="#truth" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground">
                See the dashboard
              </a>
            </div>
            <div className="mt-10 flex items-center gap-6 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <span>Prompt → survey</span>
              <span className="text-border">/</span>
              <span>One question at a time</span>
              <span className="text-border">/</span>
              <span>Source of truth</span>
            </div>
          </div>

          {/* Hero respondent card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative">
            <div className="absolute -inset-6 rounded-3xl bg-signal/10 blur-2xl" aria-hidden />
            <div className="relative rounded-2xl border border-border bg-card p-7 shadow-2xl shadow-black/40">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-signal" /> AI composer
              </div>
              <div className="mt-3 rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm text-foreground/90">
                Post-onboarding NPS with one open follow-up, tagged "onboarding".
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <motion.span initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }} className="h-1.5 w-1.5 rounded-full bg-signal" />
                Drafted 4 questions · tagged onboarding
              </div>
              <div className="mt-5 border-t border-border pt-5 text-xs font-mono text-signal">01 →</div>
              <h3 className="mt-2 font-display text-2xl font-medium leading-snug text-foreground">
                How likely are you to recommend us to a friend?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">0 — not at all · 10 — extremely</p>
              <div className="mt-6 grid grid-cols-11 gap-1.5">
                {Array.from({ length: 11 }).map((_, i) => (
                  <motion.button key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.025 }}
                    className={`aspect-square rounded-md border text-xs font-medium tabular-nums transition-colors ${i === 9 ? "border-signal bg-signal text-signal-foreground" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"}`}>
                    {i}
                  </motion.button>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Send className="h-3 w-3" /> Iterate by chatting</span>
                <span className="font-mono">~ 30s to publish</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Source of truth section */}
      <section id="truth" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.18em] text-signal">One view, every signal</div>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl text-balance">
              Every response becomes the team's source of truth.
            </h2>
            <p className="mt-3 text-muted-foreground text-pretty">
              Tag questions across surveys. Insightform rolls them up into one dashboard — NPS trend, theme distribution, decision feed — so the team argues from evidence, not anecdotes.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Pulse · 30d</div>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { l: "Responses", v: "12,847", d: "+18%" },
                { l: "Completion", v: "84%", d: "+2%" },
                { l: "Avg NPS", v: "47", d: "+6" , accent: true },
                { l: "Avg rating", v: "4.32", d: "+0.1" },
              ].map((m) => (
                <div key={m.l}>
                  <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{m.l}</div>
                  <div className={`mt-1 font-display text-3xl font-semibold tabular-nums ${m.accent ? "text-signal" : ""}`}>{m.v}</div>
                  <div className="text-xs text-emerald-400">{m.d}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex h-32 items-end gap-1">
              {Array.from({ length: 30 }).map((_, i) => {
                const h = 30 + Math.round(40 + 30 * Math.sin(i / 2.5) + (i % 4) * 6);
                return <div key={i} className="flex-1 rounded-sm bg-signal/70" style={{ height: `${h}%` }} />;
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Themes</div>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </div>
            <ul className="mt-4 space-y-3">
              {[
                { name: "pricing", v: "3.8", c: "#FF7A45", n: 412 },
                { name: "onboarding", v: "4.5", c: "#FFD166", n: 1284 },
                { name: "feature-ai", v: "4.1", c: "#6FC2B0", n: 902 },
                { name: "support", v: "4.7", c: "#7AA2F7", n: 538 },
              ].map((t) => (
                <li key={t.name} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 rounded-full" style={{ background: t.c }} />
                    {t.name}
                  </span>
                  <span className="font-mono text-sm tabular-nums">{t.v} <span className="text-xs text-muted-foreground">· {t.n}</span></span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-3">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Decision feed</div>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </div>
            <ul className="mt-4 divide-y divide-border">
              {[
                { t: "Pricing satisfaction dipped 0.4 after the Pro plan change", d: "2d ago" },
                { t: "Onboarding NPS hit +52 — highest ever after the new tour", d: "5d ago" },
                { t: "Support theme shows 18% increase in 'fast' mentions", d: "1w ago" },
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
            { n: "01", t: "Compose", d: "Drag-and-drop a Typeform-style survey. Tag each question with a theme like pricing or onboarding." },
            { n: "02", t: "Share", d: "Send the link. Respondents get a one-question-at-a-time experience that feels designed, not assembled." },
            { n: "03", t: "Decide", d: "Watch the bird's-eye dashboard fold every response into a single view of product reality." },
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
            Replace 6 dashboards with 1 source of truth.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Free during beta. No credit card. Bring your team — argue from evidence.
          </p>
          <Link to="/auth" className="mt-6 inline-flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-medium text-signal-foreground">
            Start free <ArrowUpRight className="h-4 w-4" />
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
