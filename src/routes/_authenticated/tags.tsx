import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ComingSoon } from "@/components/ComingSoon";
import { Tag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tags")({
  head: () => ({ meta: [{ title: "Tags — Insightform" }] }),
  component: () => (
    <AppShell>
      <ComingSoon
        icon={Tag}
        title="Tags"
        description="A shared vocabulary for your research. Manage tags that connect responses across every survey."
      />
    </AppShell>
  ),
});