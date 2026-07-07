import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Loader2, Sparkles, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { createSurvey } from "@/lib/surveys.functions";
import { getWorkspaceBrandProfile } from "@/lib/brand.functions";
import { SURVEY_TEMPLATES, buildTemplatePrompt, type SurveyTemplate } from "@/lib/templates";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({ meta: [{ title: "Templates — Insightform" }] }),
  component: TemplatesPage,
});

const TONE_OPTIONS = ["friendly", "direct", "playful", "executive"];

function TemplatesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createSurvey);
  const fetchBrand = useServerFn(getWorkspaceBrandProfile);
  const { data: brand } = useQuery({
    queryKey: ["workspace-brand"],
    queryFn: () => fetchBrand(),
  });

  const [active, setActive] = useState<SurveyTemplate | null>(null);
  const [learningGoal, setLearningGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [subject, setSubject] = useState("");
  const [toneChoice, setToneChoice] = useState<"brand" | string>("brand");

  const create = useMutation({
    mutationFn: async (template: SurveyTemplate) => {
      const prompt = buildTemplatePrompt({
        template,
        learningGoal,
        audience,
        subject,
        toneChoice,
      });
      const s = await createFn({ data: { title: template.name } });
      return { s, prompt };
    },
    onSuccess: ({ s, prompt }) => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      navigate({ to: "/surveys/$id", params: { id: s.id }, search: { prompt } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't create"),
  });

  function openTemplate(t: SurveyTemplate) {
    setActive(t);
    setLearningGoal("");
    setAudience("");
    setSubject("");
    setToneChoice("brand");
  }

  const brandLabel = useMemo(() => brand?.brand_name || "your workspace", [brand]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Templates</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Adaptive starting points — every template is generated fresh using {brandLabel}'s brand
          profile, product description, and your goal. Nothing here is a static copy.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SURVEY_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => openTemplate(t)}
              className="group rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-signal/40"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{t.name}</div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-signal" />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{t.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {t.insightGoals.slice(0, 3).map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {active && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-signal">
                  <Sparkles className="h-3.5 w-3.5" /> {active.name}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  A few quick questions, then Insightform generates the form with {brandLabel}'s
                  branding.
                </p>
              </div>
              <button
                onClick={() => setActive(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <SetupField label="1 · What are you trying to learn?">
                <textarea
                  value={learningGoal}
                  onChange={(e) => setLearningGoal(e.target.value)}
                  rows={2}
                  placeholder={active.description}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal/60"
                />
              </SetupField>
              <SetupField label="2 · Who is answering this form?">
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder={active.audienceHint}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal/60"
                />
              </SetupField>
              <SetupField label="3 · What product, feature, or experience is this about?">
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={brand?.product_description || "e.g. the new onboarding flow"}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal/60"
                />
              </SetupField>
              <SetupField label="4 · Tone">
                <div className="flex flex-wrap gap-1.5">
                  <ToneChip
                    active={toneChoice === "brand"}
                    onClick={() => setToneChoice("brand")}
                    label={`Brand default (${brand?.tone ?? "professional"})`}
                  />
                  {TONE_OPTIONS.map((t) => (
                    <ToneChip
                      key={t}
                      active={toneChoice === t}
                      onClick={() => setToneChoice(t)}
                      label={`${t} — this form only`}
                    />
                  ))}
                </div>
              </SetupField>
            </div>

            <button
              onClick={() => create.mutate(active)}
              disabled={create.isPending}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-signal px-4 py-2.5 text-sm font-medium text-signal-foreground disabled:opacity-60"
            >
              {create.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate branded form
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SetupField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function ToneChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] capitalize transition-colors ${active ? "border-signal bg-signal/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </button>
  );
}
