import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import {
  ArrowLeft,
  GripVertical,
  Plus,
  Trash2,
  Eye,
  Tag as TagIcon,
  Loader2,
  Copy,
  ExternalLink,
  Sparkles,
  GitBranch,
  ShieldCheck,
  BarChart3,
  Clock,
  MousePointerClick,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { QuestionPreview } from "@/components/QuestionPreview";
import { getSurvey, updateSurvey, deleteSurvey } from "@/lib/surveys.functions";
import {
  addQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
} from "@/lib/questions.functions";
import { listTags, createTag, assignTag, unassignTag, getQuestionTags } from "@/lib/tags.functions";
import { getSurveyInsights } from "@/lib/insights.functions";
import { QUESTION_TYPE_META, type QuestionType } from "@/lib/question-types";
import { ThemePanel } from "@/components/ThemePanel";
import { ReviewChangesDialog } from "@/components/edit-draft-modals";
import { CreateEditDraftDialog } from "@/components/edit-draft-modals";
import { themeStyle, backgroundClass, DEFAULT_THEME, type SurveyTheme } from "@/lib/survey-theme";

export const Route = createFileRoute("/_authenticated/surveys/$id/edit")({
  head: () => ({ meta: [{ title: "Edit survey — Insightform" }] }),
  component: SurveyBuilder,
});

type Tab = "build" | "design" | "preview" | "insights" | "share";

function SurveyBuilder() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchSurvey = useServerFn(getSurvey);
  const updateSurveyFn = useServerFn(updateSurvey);
  const deleteSurveyFn = useServerFn(deleteSurvey);
  const addQ = useServerFn(addQuestion);
  const updateQ = useServerFn(updateQuestion);
  const deleteQ = useServerFn(deleteQuestion);
  const reorderQ = useServerFn(reorderQuestions);

  const { data, isLoading } = useQuery({
    queryKey: ["survey", id],
    queryFn: () => fetchSurvey({ data: { id } }),
  });

  const [tab, setTab] = useState<Tab>("build");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; description: string }>({
    title: "",
    description: "",
  });

  useEffect(() => {
    if (data?.survey)
      setDraft({ title: data.survey.title, description: data.survey.description ?? "" });
  }, [data?.survey?.id]); // eslint-disable-line

  useEffect(() => {
    if (data?.questions.length && !selectedId) setSelectedId(data.questions[0].id);
  }, [data?.questions, selectedId]);

  // Theme state — mirrors Compose pattern with debounced save.
  const remoteTheme = useMemo<SurveyTheme>(
    () => ({ ...DEFAULT_THEME, ...((data?.survey.theme as SurveyTheme | null) ?? {}) }),
    [data?.survey.theme],
  );
  const [theme, setTheme] = useState<SurveyTheme>(remoteTheme);
  useEffect(() => {
    setTheme(remoteTheme);
  }, [remoteTheme]);
  const themeSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleThemeChange(next: SurveyTheme) {
    setTheme(next);
    if (themeSaveRef.current) clearTimeout(themeSaveRef.current);
    themeSaveRef.current = setTimeout(() => {
      updateSurveyFn({ data: { id, theme: next as Record<string, unknown> } })
        .then(() => qc.invalidateQueries({ queryKey: ["survey", id] }))
        .catch((e: Error) => toast.error(e.message));
    }, 400);
  }

  const selected = useMemo(
    () => data?.questions.find((q) => q.id === selectedId) ?? null,
    [data?.questions, selectedId],
  );

  const mAdd = useMutation({
    mutationFn: (type: QuestionType) => addQ({ data: { survey_id: id, type } }),
    onSuccess: (q) => {
      qc.invalidateQueries({ queryKey: ["survey", id] });
      setSelectedId(q.id);
    },
  });
  const mDelQ = useMutation({
    mutationFn: (qid: string) => deleteQ({ data: { id: qid } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey", id] });
      setSelectedId(null);
    },
  });
  const mReorder = useMutation({
    mutationFn: (ids: string[]) => reorderQ({ data: { survey_id: id, ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["survey", id] }),
  });
  const mUpdateQ = useMutation({
    mutationFn: (patch: {
      id: string;
      title?: string;
      description?: string | null;
      required?: boolean;
      config?: unknown;
    }) => updateQ({ data: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["survey", id] }),
  });
  const mUpdateSurvey = useMutation({
    mutationFn: (patch: Parameters<typeof updateSurveyFn>[0]["data"]) =>
      updateSurveyFn({ data: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["survey", id] }),
  });
  const mDelSurvey = useMutation({
    mutationFn: () => deleteSurveyFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      window.location.href = "/surveys";
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  function onDragEnd(e: DragEndEvent) {
    if (!data) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = data.questions.map((q) => q.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    qc.setQueryData(
      ["survey", id],
      (prev: typeof data | undefined) =>
        prev && {
          ...prev,
          questions: arrayMove(prev.questions, oldIndex, newIndex).map((q, i) => ({
            ...q,
            position: i,
          })),
        },
    );
    mReorder.mutate(next);
  }

  if (isLoading || !data) {
    return (
      <AppShell>
        <div className="grid h-screen place-items-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </AppShell>
    );
  }

  const isLive = data.survey.status === "live";
  const isEditDraft = Boolean(data.survey.is_edit_draft);
  const parentSurveyId = data.survey.parent_survey_id as string | null;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editDraftOpen, setEditDraftOpen] = useState(false);

  return (
    <AppShell>
      <div className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-6 py-4">
          <Link
            to="/surveys"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Surveys
          </Link>
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            onBlur={() => {
              if (draft.title.trim() && draft.title !== data.survey.title) {
                mUpdateSurvey.mutate({ id, title: draft.title.trim() });
              }
            }}
            className="flex-1 min-w-[200px] rounded-lg bg-transparent px-2 py-1 text-lg font-medium outline-none transition-colors hover:bg-secondary/60 focus:bg-secondary"
          />
          {isEditDraft ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-200">
              <GitBranch className="h-3 w-3" />
              Editing draft · v{(data.survey.version ?? 1) + 1}
            </span>
          ) : isLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live survey · v{data.survey.version ?? 1}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <TabsBar tab={tab} setTab={setTab} />
            {isEditDraft ? (
              <button
                onClick={() => setReviewOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-signal px-3.5 py-1.5 text-sm font-medium text-signal-foreground"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Review changes
              </button>
            ) : isLive ? (
              <button
                onClick={() => setEditDraftOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-signal px-3.5 py-1.5 text-sm font-medium text-signal-foreground"
              >
                <GitBranch className="h-3.5 w-3.5" />
                Edit survey
              </button>
            ) : (
              <button
                onClick={() => mUpdateSurvey.mutate({ id, status: isLive ? "draft" : "live" })}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${isLive ? "border border-border text-foreground" : "bg-signal text-signal-foreground"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-signal-foreground/60"}`}
                />
                {isLive ? "Live" : "Publish"}
              </button>
            )}
          </div>
        </div>
        {isEditDraft && (
          <div className="border-t border-amber-400/20 bg-amber-400/5 px-6 py-2 text-xs text-amber-200/90">
            You’re editing a safe draft of a live survey. Changes won’t affect the live version or
            existing responses until you publish the update.
            {parentSurveyId ? (
              <Link
                to="/surveys/$id/edit"
                params={{ id: parentSurveyId }}
                className="ml-2 underline"
              >
                View live version
              </Link>
            ) : null}
          </div>
        )}
      </div>
      {isEditDraft && (
        <ReviewChangesDialog open={reviewOpen} onOpenChange={setReviewOpen} draftId={id} />
      )}
      {isLive && !isEditDraft && (
        <CreateEditDraftDialog
          open={editDraftOpen}
          onOpenChange={setEditDraftOpen}
          liveSurveyId={id}
          liveTitle={data.survey.title}
        />
      )}

      {tab === "build" && (
        <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-0">
          {/* Question list */}
          <aside className="col-span-12 border-r border-border lg:col-span-3">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Questions
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {data.questions.length}
                </span>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={data.questions.map((q) => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="mt-3 space-y-1">
                    {data.questions.map((q, i) => (
                      <SortableRow
                        key={q.id}
                        id={q.id}
                        index={i}
                        title={q.title}
                        type={q.type as QuestionType}
                        active={q.id === selectedId}
                        onSelect={() => setSelectedId(q.id)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
              <AddQuestion onAdd={(t) => mAdd.mutate(t)} />
            </div>
          </aside>

          {/* Live preview */}
          <section
            className={`col-span-12 min-h-[calc(100vh-130px)] border-r border-border bg-card/30 px-6 py-10 lg:col-span-6 ${backgroundClass(theme)}`}
            style={themeStyle(theme)}
          >
            <div className="mx-auto max-w-xl">
              <div className="mb-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Live preview
              </div>
              {selected ? (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <QuestionPreview
                    type={selected.type as QuestionType}
                    title={selected.title}
                    description={selected.description}
                    required={selected.required}
                    config={(selected.config ?? {}) as never}
                    value={undefined}
                    onChange={() => {}}
                  />
                </motion.div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  Add a question to begin.
                </div>
              )}
            </div>
          </section>

          {/* Inspector */}
          <aside className="col-span-12 px-4 py-6 lg:col-span-3">
            {selected ? (
              <Inspector
                key={selected.id}
                question={selected}
                onChange={(patch) => mUpdateQ.mutate({ id: selected.id, ...patch })}
                onDelete={() => mDelQ.mutate(selected.id)}
              />
            ) : (
              <div className="text-sm text-muted-foreground">Select a question to edit.</div>
            )}
          </aside>
        </div>
      )}

      {tab === "design" && (
        <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-0">
          <aside className="col-span-12 border-r border-border lg:col-span-4">
            <ThemePanel theme={theme} onChange={handleThemeChange} />
          </aside>
          <section
            className={`col-span-12 min-h-[calc(100vh-130px)] px-6 py-10 lg:col-span-8 ${backgroundClass(theme)}`}
            style={themeStyle(theme)}
          >
            <div className="mx-auto max-w-xl">
              <div className="mb-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Themed preview
              </div>
              {data.questions[0] ? (
                <QuestionPreview
                  type={data.questions[0].type as QuestionType}
                  title={data.questions[0].title}
                  description={data.questions[0].description}
                  required={data.questions[0].required}
                  config={(data.questions[0].config ?? {}) as never}
                  value={undefined}
                  onChange={() => {}}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  Add a question to see it themed.
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "preview" && (
        <PreviewTab questions={data.questions} survey={data.survey} theme={theme} />
      )}

      {tab === "share" && (
        <ShareTab
          slug={data.survey.slug}
          status={data.survey.status}
          onDelete={() => mDelSurvey.mutate()}
        />
      )}

      {tab === "insights" && <InsightsTab surveyId={id} />}
    </AppShell>
  );
}

function TabsBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "build", label: "Build" },
    { id: "design", label: "Design" },
    { id: "preview", label: "Preview" },
    { id: "insights", label: "Insights" },
    { id: "share", label: "Share" },
  ];
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${tab === t.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function SortableRow({
  id,
  index,
  title,
  type,
  active,
  onSelect,
}: {
  id: string;
  index: number;
  title: string;
  type: QuestionType;
  active: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li ref={setNodeRef} style={style}>
      <div
        onClick={onSelect}
        className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition-colors ${active ? "bg-secondary" : "hover:bg-secondary/60"}`}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground"
          aria-label="Drag"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="grid h-6 w-6 place-items-center rounded-md bg-background font-mono text-[10px] text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{title || "Untitled"}</div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {QUESTION_TYPE_META[type].label}
          </div>
        </div>
      </div>
    </li>
  );
}

function AddQuestion({ onAdd }: { onAdd: (t: QuestionType) => void }) {
  const [open, setOpen] = useState(false);
  const types = Object.keys(QUESTION_TYPE_META) as QuestionType[];
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-signal/60 hover:text-foreground"
      >
        <Plus className="h-4 w-4" /> Add question
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-card p-2">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => {
                onAdd(t);
                setOpen(false);
              }}
              className="rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {QUESTION_TYPE_META[t].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type QuestionRow = NonNullable<Awaited<ReturnType<typeof getSurvey>>>["questions"][number];

function Inspector({
  question,
  onChange,
  onDelete,
}: {
  question: QuestionRow;
  onChange: (p: {
    title?: string;
    description?: string | null;
    required?: boolean;
    config?: unknown;
  }) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(question.title);
  const [description, setDescription] = useState(question.description ?? "");
  const cfg = (question.config ?? {}) as {
    options?: string[];
    max?: number;
    min?: number;
    minLabel?: string;
    maxLabel?: string;
  };

  useEffect(() => {
    setTitle(question.title);
    setDescription(question.description ?? "");
  }, [question.id]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Inspector</div>
        <button
          onClick={onDelete}
          className="text-muted-foreground transition-colors hover:text-rose-400"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <Field label="Question">
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== question.title && onChange({ title })}
          rows={2}
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal/60 focus:ring-2 focus:ring-signal/20"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() =>
            (description || "") !== (question.description || "") &&
            onChange({ description: description || null })
          }
          rows={2}
          placeholder="Optional helper text"
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal/60 focus:ring-2 focus:ring-signal/20"
        />
      </Field>

      <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
        <span>Required</span>
        <input
          type="checkbox"
          checked={!!question.required}
          onChange={(e) => onChange({ required: e.target.checked })}
          className="h-4 w-4 accent-[color:var(--signal)]"
        />
      </label>

      {(question.type === "single_choice" || question.type === "multi_choice") && (
        <OptionEditor
          options={cfg.options ?? []}
          onChange={(options) => onChange({ config: { ...cfg, options } })}
        />
      )}
      {question.type === "rating" && (
        <Field label="Max stars">
          <input
            type="number"
            min={3}
            max={10}
            value={cfg.max ?? 5}
            onChange={(e) =>
              onChange({
                config: { ...cfg, max: Math.max(2, Math.min(10, Number(e.target.value))) },
              })
            }
            className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal/60"
          />
        </Field>
      )}
      {question.type === "scale" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min label">
            <input
              value={cfg.minLabel ?? ""}
              onChange={(e) => onChange({ config: { ...cfg, minLabel: e.target.value } })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal/60"
            />
          </Field>
          <Field label="Max label">
            <input
              value={cfg.maxLabel ?? ""}
              onChange={(e) => onChange({ config: { ...cfg, maxLabel: e.target.value } })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal/60"
            />
          </Field>
        </div>
      )}

      <TagsPanel questionId={question.id} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function OptionEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (o: string[]) => void;
}) {
  return (
    <Field label="Options">
      <div className="space-y-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={opt}
              onChange={(e) => {
                const next = options.slice();
                next[i] = e.target.value;
                onChange(next);
              }}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-signal/60"
            />
            <button
              onClick={() => onChange(options.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-rose-400"
              aria-label="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...options, `Option ${options.length + 1}`])}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add option
        </button>
      </div>
    </Field>
  );
}

function TagsPanel({ questionId }: { questionId: string }) {
  const qc = useQueryClient();
  const allTagsFn = useServerFn(listTags);
  const qTagsFn = useServerFn(getQuestionTags);
  const createTagFn = useServerFn(createTag);
  const assignFn = useServerFn(assignTag);
  const unassignFn = useServerFn(unassignTag);
  const { data: allTags } = useQuery({ queryKey: ["tags"], queryFn: () => allTagsFn() });
  const { data: qTags } = useQuery({
    queryKey: ["q-tags", questionId],
    queryFn: () => qTagsFn({ data: { question_id: questionId } }),
  });
  const [newName, setNewName] = useState("");

  const assigned = new Set((qTags ?? []).map((t) => t.tag_id));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <TagIcon className="h-3 w-3" /> Themes
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(allTags ?? []).map((t) => {
          const on = assigned.has(t.id);
          return (
            <button
              key={t.id}
              onClick={async () => {
                if (on) await unassignFn({ data: { question_id: questionId, tag_id: t.id } });
                else await assignFn({ data: { question_id: questionId, tag_id: t.id } });
                qc.invalidateQueries({ queryKey: ["q-tags", questionId] });
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? "border-signal/60 bg-signal/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
              {t.name}
            </button>
          );
        })}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          try {
            const t = await createTagFn({ data: { name: newName.trim() } });
            await assignFn({ data: { question_id: questionId, tag_id: t.id } });
            setNewName("");
            qc.invalidateQueries({ queryKey: ["tags"] });
            qc.invalidateQueries({ queryKey: ["q-tags", questionId] });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't add tag");
          }
        }}
        className="mt-2 flex items-center gap-2"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New theme (e.g. pricing)"
          className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1 text-xs outline-none focus:border-signal/60"
        />
        <button className="rounded-md bg-secondary px-2 py-1 text-xs hover:bg-secondary/80">
          Add
        </button>
      </form>
    </div>
  );
}

function PreviewTab({
  questions,
  survey,
  theme,
}: {
  questions: QuestionRow[];
  survey: { title: string; description: string | null };
  theme: SurveyTheme;
}) {
  const [i, setI] = useState(0);
  const q = questions[i];
  return (
    <div
      className={`mx-auto max-w-2xl px-6 py-16 ${backgroundClass(theme)}`}
      style={themeStyle(theme)}
    >
      <div className="mb-6 flex items-center justify-between text-xs text-muted-foreground">
        <span>Preview · respondent view</span>
        <span className="font-mono">
          {questions.length ? `${i + 1} / ${questions.length}` : "empty"}
        </span>
      </div>
      {!q ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Add a question first.
        </div>
      ) : (
        <div>
          <div className="mb-4 font-mono text-xs text-signal">
            {String(i + 1).padStart(2, "0")} →
          </div>
          <QuestionPreview
            type={q.type as QuestionType}
            title={q.title}
            description={q.description}
            required={q.required}
            config={(q.config ?? {}) as never}
            value={undefined}
            onChange={() => {}}
          />
          <div className="mt-10 flex items-center justify-between">
            <button
              disabled={i === 0}
              onClick={() => setI((n) => n - 1)}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              ← Back
            </button>
            <button
              disabled={i >= questions.length - 1}
              onClick={() => setI((n) => n + 1)}
              className="rounded-full bg-signal px-4 py-2 text-sm font-medium text-signal-foreground disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}
      <div className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
        <div className="font-mono uppercase tracking-[0.14em]">{survey.title}</div>
        {survey.description && <div className="mt-1">{survey.description}</div>}
      </div>
    </div>
  );
}

function ShareTab({
  slug,
  status,
  onDelete,
}: {
  slug: string;
  status: "draft" | "live" | "closed";
  onDelete: () => void;
}) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/s/${slug}` : `/s/${slug}`;
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h2 className="font-display text-2xl font-semibold tracking-tight">Share</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {status === "live"
          ? "Your survey is live. Anyone with the link can respond."
          : "Publish your survey to start collecting responses."}
      </p>

      <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <input
          readOnly
          value={url}
          className="flex-1 rounded-lg bg-transparent px-2 text-sm font-mono outline-none"
        />
        <button
          onClick={() => {
            navigator.clipboard.writeText(url);
            toast.success("Link copied");
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary"
        >
          <Copy className="h-3.5 w-3.5" /> Copy
        </button>
        <a
          href={`/s/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-signal px-3 py-1.5 text-xs font-medium text-signal-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open
        </a>
      </div>

      <div className="mt-10 rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5">
        <h3 className="text-sm font-medium text-rose-300">Danger zone</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Deleting removes the survey, all questions, and all responses.
        </p>
        <button
          onClick={() => {
            if (confirm("Delete this survey and all its data?")) onDelete();
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete survey
        </button>
      </div>
    </div>
  );
}

function InsightsTab({ surveyId }: { surveyId: string }) {
  const fn = useServerFn(getSurveyInsights);
  const { data, isLoading } = useQuery({
    queryKey: ["insights", surveyId],
    queryFn: () => fn({ data: { survey_id: surveyId } }),
  });
  if (isLoading || !data) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  const mostDropped = data.questionStats.reduce<(typeof data.questionStats)[number] | null>(
    (best, current) => (!best || current.dropOffCount > best.dropOffCount ? current : best),
    null,
  );
  const mostDroppedQuestion = data.questions.find((q) => q.id === mostDropped?.question_id);
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-signal" /> Survey insights
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
            {data.survey.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Completion health, question drop-off, and answer summaries for this survey.
          </p>
        </div>
        <div className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          Last 7 days · {data.stats.recentStarts} starts
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Stat icon={Users} label="Responses" value={data.stats.total} />
        <Stat icon={Sparkles} label="Completed" value={data.stats.completed} />
        <Stat
          icon={BarChart3}
          label="Completion"
          value={`${Math.round(data.stats.completionRate * 100)}%`}
        />
        <Stat icon={MousePointerClick} label="Abandoned" value={data.stats.abandoned} />
        <Stat
          icon={Clock}
          label="Avg time"
          value={data.stats.avgSeconds ? `${data.stats.avgSeconds}s` : "—"}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Question funnel</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Reached, answered, and dropped off by step.
              </p>
            </div>
            {mostDroppedQuestion && mostDropped?.dropOffCount ? (
              <span className="max-w-[260px] truncate rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200">
                Highest drop-off: {mostDroppedQuestion.title}
              </span>
            ) : null}
          </div>
          <div className="mt-5 space-y-4">
            {data.questions.map((q, index) => {
              const stat = data.questionStats.find((s) => s.question_id === q.id);
              const reached = stat?.reachedCount ?? 0;
              const answerRate = Math.round((stat?.answerRate ?? 0) * 100);
              const dropRate = Math.round((stat?.dropOffRate ?? 0) * 100);
              return (
                <div
                  key={q.id}
                  className="grid gap-2 md:grid-cols-[42px_minmax(0,1fr)_160px] md:items-center"
                >
                  <div className="font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{q.title}</div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-signal" style={{ width: `${answerRate}%` }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {stat?.answerCount ?? 0} answered of {reached} reached
                      </span>
                      <span>{answerRate}% answer rate</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background/35 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Drop-off</span>
                      <span className="font-mono">{stat?.dropOffCount ?? 0}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-rose-400/70" style={{ width: `${dropRate}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-medium">Top sources</h3>
          <p className="mt-1 text-xs text-muted-foreground">Captured from response referrers.</p>
          {data.referrers.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-border bg-background/30 p-4 text-sm text-muted-foreground">
              No response sources yet.
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {data.referrers.map((source) => {
                const width = data.stats.total
                  ? Math.round((source.count / data.stats.total) * 100)
                  : 0;
                return (
                  <li key={source.label}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate">{source.label}</span>
                      <span className="font-mono text-muted-foreground">{source.count}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-signal/75" style={{ width: `${width}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {data.questions.map((q) => {
          const ans = data.answers.filter((a) => a.question_id === q.id);
          return (
            <div key={q.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {QUESTION_TYPE_META[q.type as QuestionType].label}
                  </div>
                  <div className="mt-1 text-base font-medium">{q.title}</div>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {ans.length} answers
                </span>
              </div>
              <AnswerSummary
                type={q.type as QuestionType}
                answers={ans}
                config={(q.config ?? {}) as never}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function AnswerSummary({
  type,
  answers,
  config,
}: {
  type: QuestionType;
  answers: { value_text: string | null; value_number: number | null }[];
  config: { options?: string[]; max?: number; min?: number };
}) {
  if (answers.length === 0) {
    return <div className="mt-3 text-xs text-muted-foreground">No answers yet.</div>;
  }
  if (QUESTION_TYPE_META[type].numeric) {
    const nums = answers.map((a) => a.value_number).filter((n): n is number => n !== null);
    if (!nums.length) return null;
    const avg = nums.reduce((s, v) => s + v, 0) / nums.length;
    const max = config.max ?? Math.max(...nums);
    const min = config.min ?? 0;
    const buckets: { v: number; count: number }[] = [];
    for (let i = min; i <= max; i++)
      buckets.push({ v: i, count: nums.filter((n) => n === i).length });
    const peak = Math.max(...buckets.map((b) => b.count), 1);
    return (
      <div className="mt-4">
        <div className="font-mono text-2xl tabular-nums">
          {avg.toFixed(2)} <span className="text-xs text-muted-foreground">avg</span>
        </div>
        <div className="mt-3 flex items-end gap-1" style={{ height: 80 }}>
          {buckets.map((b) => (
            <div key={b.v} className="flex-1">
              <div
                className="rounded-sm bg-signal/70"
                style={{ height: `${(b.count / peak) * 100}%` }}
              />
              <div className="mt-1 text-center font-mono text-[10px] text-muted-foreground">
                {b.v}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (type === "single_choice" || type === "yes_no") {
    const counts = new Map<string, number>();
    for (const a of answers)
      if (a.value_text) counts.set(a.value_text, (counts.get(a.value_text) ?? 0) + 1);
    const items = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const total = items.reduce((s, [, v]) => s + v, 0) || 1;
    return (
      <ul className="mt-4 space-y-2">
        {items.map(([opt, n]) => (
          <li key={opt}>
            <div className="flex items-center justify-between text-xs">
              <span className="truncate">{opt}</span>
              <span className="font-mono text-muted-foreground">
                {n} · {Math.round((n / total) * 100)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-signal" style={{ width: `${(n / total) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  // textual fallback
  return (
    <ul className="mt-4 space-y-2">
      {answers.slice(0, 5).map((a, i) => (
        <li
          key={i}
          className="rounded-lg border border-border bg-background/40 px-3 py-2 text-sm text-foreground/90"
        >
          {a.value_text ?? "—"}
        </li>
      ))}
      {answers.length > 5 && (
        <li className="text-xs text-muted-foreground">+{answers.length - 5} more</li>
      )}
    </ul>
  );
}
