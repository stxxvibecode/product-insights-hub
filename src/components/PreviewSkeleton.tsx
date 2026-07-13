import { themeStyle, backgroundClass, type SurveyTheme } from "@/lib/survey-theme";

export function PreviewSkeleton({ theme }: { theme: SurveyTheme }) {
  return (
    <div className="flex min-h-0 flex-col overflow-y-auto">
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-6">
        <div className="h-9 w-56 animate-pulse rounded-xl border border-border/70 bg-card/50" />
        <div className="h-8 w-64 animate-pulse rounded-lg border border-border bg-card/50" />
        <div className="flex min-h-[640px] flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card/70 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] backdrop-blur">
          <div className="flex items-center gap-1.5 border-b border-border bg-background/40 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
            <div className="ml-3 h-4 w-56 animate-pulse rounded bg-muted-foreground/15" />
          </div>
          <div
            style={themeStyle(theme)}
            className={`flex-1 ${backgroundClass(theme)} flex flex-col items-center justify-center gap-6 px-10 py-16`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="h-6 w-16 animate-pulse rounded-md bg-foreground/10" />
              <div className="h-9 w-80 animate-pulse rounded-lg bg-foreground/15" />
              <div className="h-4 w-64 animate-pulse rounded bg-foreground/10" />
            </div>
            <div className="mt-4 flex w-full max-w-lg flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 w-full animate-pulse rounded-xl border border-border/60 bg-card/40"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
            <div className="mt-3 h-10 w-32 animate-pulse rounded-full bg-foreground/20" />
          </div>
        </div>
      </div>
    </div>
  );
}