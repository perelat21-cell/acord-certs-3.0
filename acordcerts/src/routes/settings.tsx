import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitle, Panel } from "@/components/AppShell";
import { BROKER } from "@/lib/broker";
import { getSettings, setSignature } from "@/lib/cert.functions";
import { uploadFile } from "@/lib/upload";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Certify" },
      { name: "description", content: "Broker details and signature used on every certificate." },
      { property: "og:title", content: "Settings — Certify" },
      { property: "og:description", content: "Broker details and signature used on every certificate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useQuery({ queryKey: ["settings"], queryFn: useServerFn(getSettings) });
  const save = useServerFn(setSignature);
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file?: File) {
    if (!file) return;
    if (!/image\/(png|jpe?g)/.test(file.type)) {
      toast.error("Please use a PNG or JPG image.");
      return;
    }
    setBusy(true);
    try {
      const ext = file.type.includes("png") ? "png" : "jpg";
      const path = await uploadFile(`signature/signature-${Date.now()}.${ext}`, file);
      await save({ data: { path } });
      toast.success("Signature saved — it will be used on every certificate.");
      settings.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageTitle title="Settings" sub="These details appear on completed ACORD documents." />
      <div className="grid gap-6 md:grid-cols-2">
        <Panel>
           <h2 className="mb-4 text-lg">Producer</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Agency</dt>
              <dd className="font-medium">{BROKER.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Address</dt>
              <dd className="font-medium">{BROKER.addressLine1}<br />{BROKER.city} {BROKER.state} {BROKER.postalCode}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contact</dt>
              <dd className="font-medium">{BROKER.contactName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium">{BROKER.phone}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{BROKER.email}</dd>
            </div>
          </dl>
          <p className="mt-5 text-xs text-muted-foreground">Always placed in the producer block, regardless of the request.</p>
        </Panel>
        <Panel>
           <h2 className="mb-4 text-lg">Authorized signature</h2>
          <div className="mb-4 flex h-32 items-center justify-center rounded-xl border border-dashed border-input bg-background">
            {settings.data?.signatureUrl ? (
              <img src={settings.data.signatureUrl} alt="Broker signature" className="max-h-24 object-contain" />
            ) : (
              <span className="text-sm text-muted-foreground">No signature yet</span>
            )}
          </div>
          <input
            ref={ref}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => ref.current?.click()} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {settings.data?.signatureUrl ? "Replace signature" : "Upload signature"}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">A PNG with a transparent background looks best.</p>
        </Panel>
      </div>
    </div>
  );
}
