import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitle, Panel } from "@/components/AppShell";
import { ReportView } from "@/components/ReportView";
import { deleteCertificate, listCertificates, type CertReport } from "@/lib/cert.functions";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Issued certificates — Certify" },
      { name: "description", content: "Certificates generated recently, with their review notes." },
      { property: "og:title", content: "Issued certificates — Certify" },
      { property: "og:description", content: "Certificates generated recently, with their review notes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const certs = useQuery({ queryKey: ["certs"], queryFn: useServerFn(listCertificates) });
  const remove = useServerFn(deleteCertificate);
  const [open, setOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function removeCertificate(id: string) {
    if (!window.confirm("Delete this completed document? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await remove({ data: { id } });
      if (open === id) setOpen(null);
      await certs.refetch();
      toast.success("Completed document deleted");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setDeleting(null);
    }
  }
  return (
    <div>
      <PageTitle title="Completed documents" sub="Your most recent certificates and commercial applications." />
      <Panel className="p-0">
        {certs.data?.length ? (
          <ul className="divide-y divide-border">
            {certs.data.map((c) => {
              const report = c.report as unknown as CertReport;
              const flags = (report.unfulfilled?.length ?? 0) + (report.missing?.length ?? 0);
              return (
                <li key={c.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                      {report.workflow === "application" ? "Application" : "ACORD"} {c.form_code}
                    </span>
                    <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start px-0 text-left hover:bg-transparent" onClick={() => setOpen(open === c.id ? null : c.id)}>
                      <p className="truncate font-medium">{c.insured || "Unknown insured"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Holder: {c.holder || "—"} · {new Date(c.created_at).toLocaleString()}
                      </p>
                    </Button>
                    {flags > 0 && (
                      <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs text-warning-foreground">
                        {flags} notes
                      </span>
                    )}
                    {c.url && (
                      <Button asChild variant="ghost" size="icon" aria-label="Download PDF">
                        <a href={c.url} target="_blank" rel="noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="icon" aria-label="Edit">
                      <Link to="/" search={{ edit: c.id }}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${c.insured || "completed document"}`}
                      disabled={deleting === c.id}
                      onClick={() => removeCertificate(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {open === c.id && (
                    <div className="mt-4">
                      <ReportView report={report} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">No certificates yet.</p>
        )}
      </Panel>
    </div>
  );
}
