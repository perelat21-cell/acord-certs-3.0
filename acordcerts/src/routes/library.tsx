import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitle, Panel } from "@/components/AppShell";
import { deleteSavedDoc, listSavedDocs } from "@/lib/cert.functions";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Library — Certify" },
      { name: "description", content: "Saved policies and insurance documents for reuse." },
      { property: "og:title", content: "Library — Certify" },
      { property: "og:description", content: "Saved policies and insurance documents for reuse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const docs = useQuery({ queryKey: ["saved"], queryFn: useServerFn(listSavedDocs) });
  const del = useServerFn(deleteSavedDoc);
  return (
    <div>
      <PageTitle
        title="Library"
        sub="Policies you chose to keep. Tick them on a new certificate to reuse them."
      />
      <Panel className="p-0">
        {docs.data?.length ? (
          <ul className="divide-y divide-border">
            {docs.data.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-6 py-4 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.label ? `${d.label} · ` : ""}
                    {new Date(d.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${d.name}`}
                  onClick={async () => {
                    await del({ data: { id: d.id } });
                    toast.success("Removed");
                    docs.refetch();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Nothing saved yet. After generating a certificate, choose “Save these policies”.
          </p>
        )}
      </Panel>
    </div>
  );
}
