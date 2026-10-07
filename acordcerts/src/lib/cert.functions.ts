import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const safePath = z
  .string()
  .min(3)
  .max(300)
  .regex(/^(templates|signature|jobs|saved|sov)\/[A-Za-z0-9._\-/ ()]+$/)
  .refine((p) => !p.includes(".."));

export const createUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ path: safePath }).parse(d))
  .handler(async ({ data }) => {
    const { admin, BUCKET } = await import("./cert.server");
    const sb = await admin();
    const { data: signed, error } = await sb.storage
      .from(BUCKET)
      .createSignedUploadUrl(data.path, { upsert: true });
    if (error || !signed) throw new Error(error?.message ?? "Could not create upload link");
    return { path: signed.path, token: signed.token };
  });

// ---------- Templates ----------
export const listTemplates = createServerFn({ method: "GET" }).handler(async () => {
  const { admin } = await import("./cert.server");
  const sb = await admin();
  const { data, error } = await sb.from("acord_templates").select("form_code, uploaded_at, field_names");
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({
    form_code: t.form_code,
    uploaded_at: t.uploaded_at,
    field_count: Array.isArray(t.field_names) ? t.field_names.length : 0,
  }));
});

export const installTemplate = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ form_code: z.string().regex(/^\d{2,4}$/), path: safePath }).parse(d))
  .handler(async ({ data }) => {
    const { admin, downloadBytes, readFormFields } = await import("./cert.server");
    const bytes = await downloadBytes(data.path);
    const fields = await readFormFields(bytes);
    if (fields.length === 0)
      throw new Error("This PDF has no fillable fields. Please upload the fillable (AcroForm) version of the ACORD form.");
    const sb = await admin();
    const { error } = await sb
      .from("acord_templates")
      .upsert({ form_code: data.form_code, file_path: data.path, field_names: fields, uploaded_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { field_count: fields.length };
  });

// ---------- Settings / signature ----------
export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { admin, BUCKET } = await import("./cert.server");
  const sb = await admin();
  const { data } = await sb.from("app_settings").select("signature_path").eq("id", 1).maybeSingle();
  let signatureUrl: string | null = null;
  if (data?.signature_path) {
    const { data: s } = await sb.storage.from(BUCKET).createSignedUrl(data.signature_path, 3600);
    signatureUrl = s?.signedUrl ?? null;
  }
  return { signatureUrl };
});

export const setSignature = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ path: safePath }).parse(d))
  .handler(async ({ data }) => {
    const { admin } = await import("./cert.server");
    const sb = await admin();
    const { error } = await sb
      .from("app_settings")
      .update({ signature_path: data.path, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Library ----------
export const listSavedDocs = createServerFn({ method: "GET" }).handler(async () => {
  const { admin } = await import("./cert.server");
  const sb = await admin();
  const { data, error } = await sb
    .from("saved_documents")
    .select("id, name, mime_type, label, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const fileRef = z.object({ path: safePath, name: z.string().max(300), mime: z.string().max(120) });

export const saveDocuments = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ files: z.array(fileRef).max(30), label: z.string().max(200).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { admin, BUCKET } = await import("./cert.server");
    const sb = await admin();
    for (const f of data.files) {
      const dest = `saved/${crypto.randomUUID()}-${f.name.replace(/[^A-Za-z0-9._\-]/g, "_")}`;
      const { error: cErr } = await sb.storage.from(BUCKET).copy(f.path, dest);
      if (cErr) throw new Error(cErr.message);
      const { error } = await sb
        .from("saved_documents")
        .insert({ name: f.name, file_path: dest, mime_type: f.mime, label: data.label ?? null });
      if (error) throw new Error(error.message);
    }
    return { saved: data.files.length };
  });

export const deleteSavedDoc = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { admin, BUCKET } = await import("./cert.server");
    const sb = await admin();
    const { data: row } = await sb.from("saved_documents").select("file_path").eq("id", data.id).maybeSingle();
    if (row) await sb.storage.from(BUCKET).remove([row.file_path]);
    await sb.from("saved_documents").delete().eq("id", data.id);
    return { ok: true };
  });

// ---------- History ----------
export const listCertificates = createServerFn({ method: "GET" }).handler(async () => {
  const { admin, BUCKET } = await import("./cert.server");
  const sb = await admin();
  const { data, error } = await sb
    .from("certificates")
    .select("id, form_code, insured, holder, pdf_path, report, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return Promise.all(
    (data ?? []).map(async (c) => {
      let url: string | null = null;
      if (c.pdf_path) {
        const { data: s } = await sb.storage.from(BUCKET).createSignedUrl(c.pdf_path, 3600);
        url = s?.signedUrl ?? null;
      }
      return { ...c, url };
    }),
  );
});

export const deleteCertificate = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { admin, BUCKET } = await import("./cert.server");
    const sb = await admin();
    const { data: row, error } = await sb.from("certificates").select("pdf_path").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (row?.pdf_path) {
      const samplePath = row.pdf_path.replace(/\.pdf$/, "-sample.pdf");
      await sb.storage.from(BUCKET).remove([row.pdf_path, samplePath]);
    }
    const { error: deleteError } = await sb.from("certificates").delete().eq("id", data.id);
    if (deleteError) throw new Error(deleteError.message);
    return { ok: true };
  });

// ---------- Generate ----------
export type CertReport = {
  form_code: string;
  form_codes?: string[];
  forms?: {
    form_code: string;
    fields: { name: string; value: string }[];
  }[];
  workflow?: "certificate" | "application";
  certificate_type: string;
  summary: string;
  unfulfilled: string[];
  missing: string[];
  double_check: string[];
  sample_requested?: boolean;
  source?: {
    requestText: string;
    files: { path: string; name: string; mime: string; role: "request" | "insurance" }[];
    savedIds: string[];
    preferredForm: "25" | "28" | "25,28" | "auto";
    edits: string[];
  };
};

export const generateCertificate = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        requestText: z.string().max(50000),
        files: z.array(fileRef.extend({ role: z.enum(["request", "insurance"]) })).max(30),
        savedIds: z.array(z.string().uuid()).max(30),
        workflow: z.enum(["certificate", "application"]).default("certificate"),
        preferredForm: z.enum(["25", "28", "25,28", "auto"]).default("25"),
        edits: z.array(z.string().max(5000)).max(50).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { runGeneration } = await import("./generate.server");
    return runGeneration(data);
  });

export const getCertificate = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { admin, BUCKET } = await import("./cert.server");
    const sb = await admin();
    const { data: row, error } = await sb.from("certificates").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("Certificate not found.");
    const sign = async (p: string | null) =>
      p ? (await sb.storage.from(BUCKET).createSignedUrl(p, 3600)).data?.signedUrl ?? null : null;
    const report = row.report as unknown as CertReport;
    return {
      id: row.id,
      url: await sign(row.pdf_path),
      sampleUrl: report.workflow === "application" ? null : await sign(`certificates/${row.id}-sample.pdf`),
      insured: row.insured ?? "",
      holder: row.holder ?? "",
      report,
    };
  });
// ---------- Manual certificate editing ----------
export const updateCertificateFields = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        forms: z.array(
          z.object({
            form_code: z.string(),
            fields: z.array(
              z.object({
                name: z.string(),
                value: z.string(),
              }),
            ),
          }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { admin, BUCKET, downloadBytes, fillPdf, mergePdfs } = await import("./cert.server");
    const sb = await admin();

    const { data: row, error: rowError } = await sb
      .from("certificates")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

if (rowError) {
  throw new Error(
    `Could not load certificate: ${rowError.message}`,
  );
}

if (!row) {
  throw new Error(
    `Certificate not found for id: ${data.id}`,
  );
}

    const report = row.report as unknown as CertReport;

    const { data: templates, error: templateError } = await sb
      .from("acord_templates")
      .select("form_code, file_path");

    if (templateError) throw new Error(templateError.message);

    const { data: settings } = await sb
      .from("app_settings")
      .select("signature_path")
      .eq("id", 1)
      .maybeSingle();

    let signature: { bytes: Uint8Array; mime: string } | null = null;

    if (settings?.signature_path) {
      const path = settings.signature_path;
      signature = {
        bytes: await downloadBytes(path),
        mime: path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
      };
    }

    const completed: Uint8Array[] = [];

    for (const form of data.forms) {
      const template = templates?.find((t) => t.form_code === form.form_code);

      if (!template) {
        throw new Error(`ACORD ${form.form_code} template is not installed.`);
      }

      const templateBytes = await downloadBytes(template.file_path);

      const formSignature = form.form_code === "101" ? null : signature;

      const filled = await fillPdf(
        templateBytes,
        form.fields,
        formSignature,
      );

      completed.push(filled.bytes);
    }

    if (!completed.length) {
      throw new Error("No forms were supplied.");
    }

const firstCompleted = completed[0];

if (!firstCompleted) {
  throw new Error("No completed forms were produced.");
}

const bytes =
  completed.length === 1
    ? firstCompleted
    : await mergePdfs(completed);

    const pdfPath = `certificates/${data.id}.pdf`;

    const { error: uploadError } = await sb.storage
      .from(BUCKET)
      .upload(pdfPath, bytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw new Error(uploadError.message);

    const updatedReport = {
      ...report,
      forms: data.forms,
    };

    const { error: updateError } = await sb
      .from("certificates")
      .update({
        report: updatedReport,
        insured: data.forms
          .flatMap((f) => f.fields)
          .find((f) => /insured.*name/i.test(f.name))?.value ?? row.insured,
        holder: data.forms
          .flatMap((f) => f.fields)
          .find((f) => /holder.*name/i.test(f.name))?.value ?? row.holder,
      })
      .eq("id", data.id);

    if (updateError) throw new Error(updateError.message);

    const { data: signed } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(pdfPath, 3600);

    return {
      id: data.id,
      url: signed?.signedUrl ?? null,
      report: updatedReport,
    };
  });