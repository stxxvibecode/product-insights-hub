import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ComingSoon } from "@/components/ComingSoon";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Insightform" }] }),
  component: () => (
    <AppShell>
      <ComingSoon
        icon={FileText}
        title="Reports"
        description="Curated read-outs of survey themes, scored by recency and tag weight. Shareable with your team."
      />
    </AppShell>
  ),
});