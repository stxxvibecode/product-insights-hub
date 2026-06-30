import { Link, useRouter, useRouterState, getRouteApi } from "@tanstack/react-router";
import { type ReactNode, type ComponentType } from "react";
import {
  Activity,
  ChevronDown,
  FileText,
  LayoutGrid,
  List,
  LogOut,
  Plug,
  Sparkles,
  Tag,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Logo } from "./Logo";
import { listSurveys } from "@/lib/surveys.functions";

const authRouteApi = getRouteApi("/_authenticated");

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;
type NavItem = {
  to:
    | "/dashboard"
    | "/surveys"
    | "/reports"
    | "/integrations"
    | "/templates"
    | "/audience"
    | "/tags"
    | "/settings";
  label: string;
  icon: IconType;
  exact?: boolean;
};

const MAIN: NavItem[] = [
  { to: "/surveys", label: "Compose", icon: Sparkles },
  { to: "/dashboard", label: "Dashboard", icon: Activity, exact: true },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/integrations", label: "Integrations", icon: Plug },
];

const RESEARCH: NavItem[] = [
  { to: "/surveys", label: "Surveys", icon: List },
  { to: "/templates", label: "Templates", icon: LayoutGrid },
  { to: "/audience", label: "Audience", icon: Users },
  { to: "/tags", label: "Tags", icon: Tag },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ctx = authRouteApi.useRouteContext();
  const email = ctx.user?.email ?? null;
  const fetchList = useServerFn(listSurveys);
  const { data: surveys } = useQuery({
    queryKey: ["surveys"],
    queryFn: () => fetchList(),
    staleTime: 30_000,
  });
  const recents = (surveys ?? []).slice(0, 5);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  function isActive(item: NavItem, index: number, group: NavItem[]) {
    if (item.label === "Compose") return pathname === "/surveys";
    if (item.label === "Surveys") return pathname.startsWith("/surveys");
    if (item.exact) return pathname === item.to;
    return pathname === item.to || pathname.startsWith(item.to + "/");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        email={email}
        pathname={pathname}
        recents={recents}
        isActive={isActive}
        onSignOut={signOut}
      />
      <div className="lg:pl-[272px]">
        <div className="border-b border-border bg-background/80 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Logo to="/dashboard" />
            <button onClick={signOut} className="text-xs text-muted-foreground">
              Sign out
            </button>
          </div>
        </div>
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({
  email,
  pathname,
  recents,
  isActive,
  onSignOut,
}: {
  email: string | null;
  pathname: string;
  recents: Array<{ id: string; title: string }>;
  isActive: (item: NavItem, index: number, group: NavItem[]) => boolean;
  onSignOut: () => void;
}) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col border-r px-3 py-4 lg:flex"
      style={
        {
          // Light workspace surface, scoped to the sidebar only.
          background: "oklch(0.985 0.006 85)",
          color: "oklch(0.22 0.012 250)",
          borderColor: "oklch(0.22 0.012 250 / 10%)",
          ["--sb-fg" as string]: "oklch(0.22 0.012 250)",
          ["--sb-muted" as string]: "oklch(0.48 0.014 250)",
          ["--sb-hover" as string]: "oklch(0.22 0.012 250 / 5%)",
          ["--sb-active" as string]: "oklch(0.22 0.012 250 / 8%)",
          ["--sb-border" as string]: "oklch(0.22 0.012 250 / 10%)",
          ["--sb-signal" as string]: "oklch(0.66 0.20 35)",
        } as React.CSSProperties
      }
    >
      <WorkspaceSelector />

      <nav className="mt-4 flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
        <NavGroup label="Main">
          {MAIN.map((item, i) => (
            <NavLink key={`m-${item.label}`} item={item} active={isActive(item, i, MAIN)} />
          ))}
        </NavGroup>

        <NavGroup label="Research">
          {RESEARCH.map((item, i) => (
            <NavLink key={`r-${item.label}`} item={item} active={isActive(item, i, RESEARCH)} />
          ))}
        </NavGroup>

        {recents.length > 0 && (
          <NavGroup label="Recents">
            {recents.map((s) => {
              const active = pathname === `/surveys/${s.id}`;
              return (
                <Link
                  key={s.id}
                  to="/surveys/$id"
                  params={{ id: s.id }}
                  className="group flex items-center gap-2.5 truncate rounded-lg px-2.5 py-1.5 text-[13px] transition-colors"
                  style={{
                    background: active ? "var(--sb-active)" : "transparent",
                    color: active ? "var(--sb-fg)" : "var(--sb-muted)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "var(--sb-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: active ? "var(--sb-signal)" : "var(--sb-muted)", opacity: active ? 1 : 0.4 }}
                  />
                  <span className="truncate">{s.title}</span>
                </Link>
              );
            })}
          </NavGroup>
        )}
      </nav>

      <div className="mt-4 flex flex-col gap-2">
        <ActionCard
          icon={UserPlus}
          title="Invite team"
          subcopy="Bring PMs, design, and CX into the loop"
          onClick={() => toast.message("Invites coming soon")}
        />
        <ActionCard
          icon={Zap}
          title="Upgrade plan"
          subcopy="Unlock more responses, reports, and integrations"
          accent
          onClick={() => toast.message("Plans coming soon")}
        />

        <div
          className="mt-2 flex items-center justify-between border-t pt-3"
          style={{ borderColor: "var(--sb-border)" }}
        >
          <div
            className="truncate px-2 text-[11px]"
            style={{ color: "var(--sb-muted)" }}
            title={email ?? ""}
          >
            {email ?? "—"}
          </div>
          <button
            onClick={onSignOut}
            className="grid h-8 w-8 place-items-center rounded-lg transition-colors"
            style={{ color: "var(--sb-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sb-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.16em]"
        style={{ color: "var(--sb-muted)" }}
      >
        {label}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors"
      style={{
        background: active ? "var(--sb-active)" : "transparent",
        color: active ? "var(--sb-fg)" : "var(--sb-muted)",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--sb-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <Icon
        className="h-4 w-4 shrink-0"
        strokeWidth={1.75}
        // @ts-expect-error inline style fallback for icon currentColor tint
        style={{ color: active ? "var(--sb-signal)" : "currentColor" }}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function WorkspaceSelector() {
  return (
    <button
      type="button"
      onClick={() => toast.message("Multi-workspace coming soon")}
      className="flex w-full items-center gap-2.5 rounded-xl border px-2 py-2 text-left transition-colors"
      style={{
        borderColor: "var(--sb-border)",
        background: "oklch(1 0 0 / 60%)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 60%)")}
    >
      <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg" style={{ background: "var(--sb-signal)" }}>
        <span className="absolute inset-[6px] rounded-[5px] bg-white/90" />
        <span className="absolute inset-[10px] rounded-[3px]" style={{ background: "var(--sb-signal)" }} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className="truncate text-[13px] font-semibold leading-tight"
          style={{ color: "var(--sb-fg)" }}
        >
          Product Insights Hub
        </span>
        <span className="truncate text-[11px]" style={{ color: "var(--sb-muted)" }}>
          Insightform workspace
        </span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: "var(--sb-muted)" }} />
    </button>
  );
}

function ActionCard({
  icon: Icon,
  title,
  subcopy,
  accent,
  onClick,
}: {
  icon: IconType;
  title: string;
  subcopy: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors"
      style={{
        borderColor: "var(--sb-border)",
        background: accent ? "oklch(0.66 0.20 35 / 8%)" : "oklch(1 0 0 / 60%)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = accent
          ? "oklch(0.66 0.20 35 / 14%)"
          : "oklch(1 0 0)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = accent
          ? "oklch(0.66 0.20 35 / 8%)"
          : "oklch(1 0 0 / 60%)")
      }
    >
      <span
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
        style={{
          background: accent ? "var(--sb-signal)" : "oklch(0.22 0.012 250 / 6%)",
          color: accent ? "white" : "var(--sb-fg)",
        }}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[12.5px] font-semibold" style={{ color: "var(--sb-fg)" }}>
          {title}
        </span>
        <span className="text-[11.5px] leading-snug" style={{ color: "var(--sb-muted)" }}>
          {subcopy}
        </span>
      </span>
    </button>
  );
}