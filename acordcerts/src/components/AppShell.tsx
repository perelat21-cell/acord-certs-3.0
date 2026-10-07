import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "New certificate" },
  { to: "/sov", label: "SOV" },
  { to: "/history", label: "Issued" },
  { to: "/library", label: "Library" },
  { to: "/forms", label: "Forms" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <FileCheck2 className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-bold text-foreground">Certify</span>
              <span className="block text-[10px] font-medium text-muted-foreground">P&amp;G Insurance Brokers</span>
            </span>
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: true }}
                className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{ className: "bg-secondary font-medium text-secondary-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8 lg:py-12">{children}</main>
    </div>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl text-foreground">{title}</h1>
      {sub && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border border-border bg-card p-6 shadow-soft", className)}>{children}</section>;
}
