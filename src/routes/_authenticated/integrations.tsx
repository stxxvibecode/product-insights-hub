import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ComingSoon } from "@/components/ComingSoon";
import { Plug } from "lucide-react";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Insightform" }] }),
  component: () => (
    <AppShell>
      <ComingSoon
        icon={Plug}
        title="Integrations"
        description="Pipe responses into Linear, Notion, Slack, and your data warehouse. Coming soon."
      />
    </AppShell>
  ),
});