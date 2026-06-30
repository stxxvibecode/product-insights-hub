import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ComingSoon } from "@/components/ComingSoon";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audience")({
  head: () => ({ meta: [{ title: "Audience — Insightform" }] }),
  component: () => (
    <AppShell>
      <ComingSoon
        icon={Users}
        title="Audience"
        description="Segment respondents by cohort, plan, and lifecycle stage to target the right people for each survey."
      />
    </AppShell>
  ),
});