import {
  PDFDocument,
  PDFName,
  PDFString,
  PDFHexString,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFOptionList,
  StandardFonts,
  degrees,
  rgb,
} from "pdf-lib";
import { BROKER } from "./broker";

export const BUCKET = "acord";

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function downloadBytes(path: string): Promise<Uint8Array> {
  const sb = await admin();
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Could not read file ${path}: ${error?.message ?? "missing"}`);
  return new Uint8Array(await data.arrayBuffer());
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

export type FieldInfo = { name: string; type: string; tip?: string | undefined; options?: string[] | undefined };

export async function readFormFields(bytes: Uint8Array): Promise<FieldInfo[]> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();
  return form.getFields().map((f) => {
    let type = "text";
    let options: string[] | undefined;
    if (f instanceof PDFCheckBox) type = "checkbox";
    else if (f instanceof PDFDropdown) {
      type = "dropdown";
      options = f.getOptions();
    } else if (f instanceof PDFRadioGroup) {
      type = "radio";
      options = f.getOptions();
    } else if (f instanceof PDFOptionList) type = "list";
    else if (!(f instanceof PDFTextField)) type = "other";
    const tu = f.acroField.dict.get(PDFName.of("TU"));
    let tip: string | undefined;
    if (tu instanceof PDFString || tu instanceof PDFHexString) tip = tu.decodeText();
    // Strip control chars (e.g. \u0000) that the database cannot store.
    const strip = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    return { name: f.getName(), type, tip: tip ? strip(tip) : tip, options: options?.map(strip) };
  });
}

// WinAnsi-safe text for standard fonts.
function clean(v: string) {
  return v
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

function brokerOverride(name: string): string | null {
  const n = name.toLowerCase();
  if (!n.includes("producer")) return null;
  if (n.includes("signature")) return null;
  if (n.includes("contactperson") && (n.includes("fullname") || n.includes("name"))) return BROKER.contactName;
  if (n.includes("mailingaddress") && (n.includes("lineone") || n.includes("line1"))) return BROKER.addressLine1;
  if (n.includes("mailingaddress") && (n.includes("linetwo") || n.includes("line2"))) return "";
  if (n.includes("mailingaddress") && n.includes("city")) return BROKER.city;
  if (n.includes("mailingaddress") && (n.includes("state") || n.includes("province"))) return BROKER.state;
  if (n.includes("mailingaddress") && (n.includes("postal") || n.includes("zip"))) return BROKER.postalCode;
  if (n.includes("fullname") || n.endsWith("producer_name_a") || n.includes("agencyname")) return BROKER.name;
  if (n.includes("phone") && !n.includes("fax")) return BROKER.phone;
  if (n.includes("email")) return BROKER.email;
  return null;
}

export async function fillPdf(
  templateBytes: Uint8Array,
  values: { name: string; value: string }[],
  signature: { bytes: Uint8Array; mime: string } | null,
  options?: { sample?: boolean },
): Promise<{ bytes: Uint8Array; issues: string[] }> {
  const issues: string[] = [];
  const pdf = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const form = pdf.getForm();
  const valueMap = new Map(values.map((v) => [v.name, v.value]));

  // Force broker block regardless of AI output.
  for (const f of form.getFields()) {
    const o = brokerOverride(f.getName());
    if (o && f instanceof PDFTextField) valueMap.set(f.getName(), o);
    if (options?.sample && f instanceof PDFTextField && /policy.*(?:number|no)|(?:number|no).*policy/i.test(f.getName()) && (valueMap.get(f.getName()) ?? "").trim()) {
      valueMap.set(f.getName(), "TBD");
    }
  }

  for (const [name, raw] of valueMap) {
    if (raw == null || raw === "") continue;
    let field;
    try {
      field = form.getField(name);
    } catch {
      issues.push(`Field "${name}" does not exist on the form; value "${raw}" was not placed.`);
      continue;
    }
    const value = clean(String(raw));
    try {
      if (field instanceof PDFTextField) {
        const max = field.getMaxLength();
        field.setText(max && value.length > max ? value.slice(0, max) : value);
        if (max && value.length > max) issues.push(`Text for "${name}" was cut to fit the form.`);
      } else if (field instanceof PDFCheckBox) {
        if (/^(true|yes|y|x|1|checked|on)$/i.test(value)) field.check();
        else field.uncheck();
      } else if (field instanceof PDFDropdown) {
        field.select(value);
      } else if (field instanceof PDFRadioGroup) {
        field.select(value);
      }
    } catch (e) {
      issues.push(`Could not write "${name}": ${(e as Error).message}`);
    }
  }

  let signed = false;
  if (signature) {
    try {
      const img =
        signature.mime.includes("png") ? await pdf.embedPng(signature.bytes) : await pdf.embedJpg(signature.bytes);
      const pages = pdf.getPages();
      for (const f of form.getFields()) {
        if (!/signature/i.test(f.getName())) continue;
        for (const w of f.acroField.getWidgets()) {
          const rect = w.getRectangle();
          const pRef = w.P();
          const page = pages.find((p) => p.ref === pRef) ?? pages[0];
          if (!page) continue;
          const scale = Math.min(rect.width / img.width, rect.height / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          page.drawImage(img, { x: rect.x + 2, y: rect.y + (rect.height - dh) / 2, width: dw, height: dh });
          signed = true;
        }
      }
    } catch (e) {
      issues.push(`Signature could not be placed: ${(e as Error).message}`);
    }
    if (!signed) issues.push("No signature box was found on this form; signature was not applied.");
  } else {
    issues.push("No broker signature is on file — upload one in Settings.");
  }

  if (options?.sample) {
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize();
      const size = Math.min(width, height) * 0.14;
      const labelWidth = font.widthOfTextAtSize("SAMPLE", size);
      page.drawText("SAMPLE", {
        x: (width - labelWidth * 0.82) / 2,
        y: height * 0.42,
        size,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.2,
        rotate: degrees(35),
      });
    }
  }

  try {
    form.flatten();
  } catch {
    issues.push("Form could not be flattened; fields remain editable in the PDF.");
  }
  return { bytes: await pdf.save(), issues };
}

export async function mergePdfs(documents: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const bytes of documents) {
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await merged.copyPages(source, source.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return merged.save();
}
