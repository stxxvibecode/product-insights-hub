import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ComingSoon } from "@/components/ComingSoon";
import { LayoutGrid } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({ meta: [{ title: "Templates — Insightform" }] }),
  component: () => (
    <AppShell>
      <ComingSoon
        icon={LayoutGrid}
        title="Templates"
        description="Battle-tested research templates — NPS, onboarding pulse, win/loss, pricing sensitivity — ready to compose."
      />
    </AppShell>
  ),
});