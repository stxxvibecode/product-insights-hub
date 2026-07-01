import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, AlertTriangle, Info, ShieldAlert, ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { COPY, type RiskLevel } from "@/lib/copy";
import { createEditDraft, diffSurvey, publishEditDraft, discardEditDraft } from "@/lib/edit-drafts.functions";

function riskIcon(risk: RiskLevel) {
  if (risk === "high") return <ShieldAlert className="h-4 w-4 text-rose-400" />;
  if (risk === "medium") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <Info className="h-4 w-4 text-emerald-400" />;
}

function riskLabel(risk: RiskLevel) {
  return risk === "high" ? "High risk" : risk === "medium" ? "Medium risk" : "Low risk";
}

/**
 * Confirms with the user that editing a live survey should spin up a safe
 * edit draft (rather than mutating the live version). On confirm, we call
 * the server function, then navigate to the new draft's editor.
 */
export function CreateEditDraftDialog({
  open,
  onOpenChange,
  liveSurveyId,
  liveTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  liveSurveyId: string;
  liveTitle: string;
}) {
  const navigate = useNavigate();
  const fn = useServerFn(createEditDraft);
  const m = useMutation({
    mutationFn: () => fn({ data: { survey_id: liveSurveyId } }),
    onSuccess: (r) => {
      onOpenChange(false);
      navigate({ to: "/surveys/$id/edit", params: { id: r.id } });
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{COPY.liveEditModal.title}</DialogTitle>
          <DialogDescription className="pt-1 text-sm text-muted-foreground">
            {COPY.liveEditModal.body}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-sm">
          <div className="text-muted-foreground">Editing draft for</div>
          <div className="truncate font-medium">{liveTitle}</div>
        </div>
        <DialogFooter className="gap-2">
          <button
            className="rounded-full border border-border px-4 py-2 text-sm"
            onClick={() => onOpenChange(false)}
          >
            {COPY.liveEditModal.secondary}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2 text-sm font-medium text-signal-foreground disabled:opacity-60"
            disabled={m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {COPY.liveEditModal.primary}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Review-changes modal shown before publishing an edit draft on top of a
 * live survey. It loads the server-side diff, groups changes by risk, and
 * lets the user publish, save the draft as-is, or discard the draft.
 */
export function ReviewChangesDialog({
  open,
  onOpenChange,
  draftId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draftId: string;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const diffFn = useServerFn(diffSurvey);
  const publishFn = useServerFn(publishEditDraft);
  const discardFn = useServerFn(discardEditDraft);

  const diffQ = useQuery({
    queryKey: ["survey-diff", draftId],
    queryFn: () => diffFn({ data: { draft_id: draftId } }),
    enabled: open,
    staleTime: 0,
  });

  const publish = useMutation({
    mutationFn: () => publishFn({ data: { draft_id: draftId } }),
    onSuccess: (r) => {
      onOpenChange(false);
      qc.invalidateQueries();
      navigate({ to: "/surveys/$id/edit", params: { id: r.live_id } });
    },
  });
  const discard = useMutation({
    mutationFn: () => discardFn({ data: { draft_id: draftId } }),
    onSuccess: (r) => {
      onOpenChange(false);
      qc.invalidateQueries();
      if (r.parent_survey_id) {
        navigate({ to: "/surveys/$id/edit", params: { id: r.parent_survey_id } });
      } else {
        navigate({ to: "/surveys" });
      }
    },
  });

  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const changes = diffQ.data?.changes ?? [];
  const hasHigh = changes.some((c) => c.risk === "high");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-[640px]">
        <div className="border-b border-border/60 px-6 py-4">
          <DialogHeader>
            <DialogTitle>{COPY.publishUpdate.title}</DialogTitle>
            <DialogDescription className="pt-1 text-sm text-muted-foreground">
              {COPY.publishUpdate.reportingImpact}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[52vh] overflow-y-auto px-6 py-4">
          {diffQ.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Comparing versions…
            </div>
          ) : changes.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-secondary/30 px-4 py-6 text-center text-sm text-muted-foreground">
              No changes yet. Edit the draft and come back.
            </div>
          ) : (
            <ul className="space-y-2">
              {changes.map((c, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-border/60 bg-card/40 px-4 py-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">{riskIcon(c.risk)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {c.summary}
                        </span>
                        <span className="rounded-full border border-border/60 bg-secondary/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {riskLabel(c.risk)}
                        </span>
                      </div>
                      {c.risk === "high" && (
                        <div className="mt-1 text-xs text-rose-300/80">
                          {COPY.risk.high}
                        </div>
                      )}
                      {c.risk === "medium" && (
                        <div className="mt-1 text-xs text-amber-300/70">
                          {COPY.risk.medium}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {diffQ.data && diffQ.data.hasResponses && (
            <div className="mt-4 rounded-lg border border-border/60 bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {diffQ.data.responsesCount}
              </span>{" "}
              response{diffQ.data.responsesCount === 1 ? "" : "s"} already
              collected on the live version.
            </div>
          )}
          {hasHigh && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                High-risk changes detected. Reporting on affected questions
                will split cleanly by version.
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border/60 px-6 py-4">
          {confirmDiscard ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Discard this edit draft? Your changes will be lost.
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-full border border-border px-3 py-1.5 text-sm"
                  onClick={() => setConfirmDiscard(false)}
                >
                  Keep draft
                </button>
                <button
                  className="rounded-full bg-rose-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                  disabled={discard.isPending}
                  onClick={() => discard.mutate()}
                >
                  {discard.isPending ? "Discarding…" : "Discard draft"}
                </button>
              </div>
            </div>
          ) : (
            <DialogFooter className="gap-2 sm:justify-between">
              <button
                className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setConfirmDiscard(true)}
              >
                {COPY.publishUpdate.discard}
              </button>
              <div className="flex gap-2">
                <button
                  className="rounded-full border border-border px-4 py-2 text-sm"
                  onClick={() => onOpenChange(false)}
                >
                  {COPY.publishUpdate.secondary}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2 text-sm font-medium text-signal-foreground disabled:opacity-60"
                  disabled={publish.isPending || changes.length === 0}
                  onClick={() => publish.mutate()}
                >
                  {publish.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {COPY.publishUpdate.primary}
                </button>
              </div>
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
