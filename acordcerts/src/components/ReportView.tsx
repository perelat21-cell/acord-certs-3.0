import { AlertCircle, CircleSlash, Eye } from "lucide-react";
import type { CertReport } from "@/lib/cert.functions";

function Section({
  title,
  items,
  icon,
  tone,
  empty,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
  tone: string;
  empty: string;
}) {
  return (
    <div className={`rounded-lg border border-current/10 p-5 ${tone}`}>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
        <span className="ml-auto text-xs opacity-70">{items.length}</span>
      </div>
      {items.length ? (
        <ul className="space-y-2 text-sm leading-relaxed">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm opacity-70">{empty}</p>
      )}
    </div>
  );
}

export function ReportView({ report }: { report: CertReport }) {
  return (
    <div className="space-y-4">
      <Section
        title="Requirements not fulfilled"
        items={report.unfulfilled}
        icon={<CircleSlash className="h-4 w-4" strokeWidth={1.75} />}
        tone="bg-warning-soft text-warning-foreground"
        empty="Every requirement in the request is supported by the documents."
      />
      <Section
        title="Missing information"
        items={report.missing}
        icon={<AlertCircle className="h-4 w-4" strokeWidth={1.75} />}
        tone="bg-secondary text-secondary-foreground"
        empty="Nothing missing."
      />
      <Section
        title="Please double-check"
        items={report.double_check}
        icon={<Eye className="h-4 w-4" strokeWidth={1.75} />}
        tone="bg-muted text-foreground"
        empty="Nothing flagged."
      />
    </div>
  );
}
