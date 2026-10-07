import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, ShieldCheck, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitle, Panel } from "@/components/AppShell";
import { FORM_CATALOG } from "@/lib/broker";
import { installTemplate, listTemplates } from "@/lib/cert.functions";
import { uploadFile } from "@/lib/upload";

export const Route = createFileRoute("/forms")({
  head: () => ({
    meta: [
      { title: "ACORD forms — Certify" },
      { name: "description", content: "Install the blank fillable ACORD forms used for certificates." },
      { property: "og:title", content: "ACORD forms — Certify" },
      { property: "og:description", content: "Install the blank fillable ACORD forms used for certificates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormsPage,
});

function FormsPage() {
  const tpls = useQuery({ queryKey: ["templates"], queryFn: useServerFn(listTemplates) });
  const install = useServerFn(installTemplate);
  const [busy, setBusy] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function onFile(code: string, file: File | undefined) {
    if (!file) return;
    setBusy(code);
    try {
      const path = await uploadFile(`templates/acord-${code}.pdf`, file);
      const r = await install({ data: { form_code: code, path } });
      toast.success(`ACORD ${code} installed · ${r.field_count} fillable fields found`);
      tpls.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageTitle
        title="ACORD forms"
        sub="Install blank, fillable ACORD PDFs once. ACORD 25 and 28 are primary; application sections and other forms remain available below."
      />
      <div className="space-y-8">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-base">Primary certificates</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {FORM_CATALOG.filter((f) => ["25", "28"].includes(f.code)).map((f) => {
              const t = tpls.data?.find((x) => x.form_code === f.code);
              return <FormRow key={f.code} form={f} template={t} busy={busy} inputs={inputs} onFile={onFile} featured />;
            })}
          </div>
        </section>
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Files className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base">Other forms</h2>
          </div>
          <Panel className="divide-y divide-border p-0">
            {FORM_CATALOG.filter((f) => !["25", "28"].includes(f.code)).map((f) => {
          const t = tpls.data?.find((x) => x.form_code === f.code);
              return <FormRow key={f.code} form={f} template={t} busy={busy} inputs={inputs} onFile={onFile} />;
            })}
          </Panel>
        </section>
      </div>
    </div>
  );
}

type FormMeta = (typeof FORM_CATALOG)[number];
type Template = { form_code: string; field_count: number; uploaded_at: string };

function FormRow({ form, template, busy, inputs, onFile, featured = false }: {
  form: FormMeta;
  template: Template | undefined;
  busy: string | null;
  inputs: React.RefObject<Record<string, HTMLInputElement | null>>;
  onFile: (code: string, file: File | undefined) => void;
  featured?: boolean;
}) {
  return (
    <div className={featured ? "rounded-lg border border-border bg-card p-5 shadow-soft" : "flex flex-wrap items-center gap-4 px-6 py-5"}>
      <div className={featured ? "mb-5" : "min-w-0 flex-1"}>
        <p className={featured ? "text-lg font-semibold text-foreground" : "font-semibold text-foreground"}>{form.title}</p>
        <p className="text-sm text-muted-foreground">{form.use}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        {template ? (
          <span className="flex items-center gap-1.5 rounded-md bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
            <Check className="h-3.5 w-3.5" /> Installed · {template.field_count} fields
          </span>
        ) : <span className="text-xs text-muted-foreground">Not installed</span>}
        <input ref={(el) => { inputs.current[form.code] = el; }} type="file" accept="application/pdf" className="hidden"
          onChange={(e) => { onFile(form.code, e.target.files?.[0]); e.target.value = ""; }} />
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => inputs.current[form.code]?.click()}>
          {busy === form.code && <Loader2 className="h-4 w-4 animate-spin" />}{template ? "Replace" : "Upload"}
        </Button>
      </div>
    </div>
  );
}
