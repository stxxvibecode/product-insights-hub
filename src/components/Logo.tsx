import { Link } from "@tanstack/react-router";

export function Logo({ to = "/" as const, className = "" }: { to?: "/" | "/dashboard"; className?: string }) {
  return (
    <Link to={to} className={`group inline-flex items-center gap-2 ${className}`}>
      <span className="relative inline-block h-6 w-6">
        <span className="absolute inset-0 rounded-md bg-signal" />
        <span className="absolute inset-[3px] rounded-[5px] bg-background" />
        <span className="absolute inset-[6px] rounded-[3px] bg-signal" />
      </span>
      <span className="font-semibold tracking-tight text-foreground">
        Insightform<span className="text-signal">.</span>
      </span>
    </Link>
  );
}