import { z } from "zod";
import { admin, BUCKET, downloadBytes, fillPdf, mergePdfs, toBase64, type FieldInfo } from "./cert.server";
import { BROKER, FORM_CATALOG } from "./broker";

type FileIn = { path: string; name: string; mime: string; role: "request" | "insurance" };

const FormResultSchema = z.object({
  form_code: z.string().describe("Digits only, e.g. 25"),
  fields: z.array(z.object({ name: z.string(), value: z.string() })),
});

const ResultSchema = z.object({
  certificate_type: z.string(),
  insured_name: z.string(),
  holder_name: z.string(),
  summary: z.string(),
  forms: z.array(FormResultSchema).min(1),
  unfulfilled: z.array(z.string()),
  missing: z.array(z.string()),
  double_check: z.array(z.string()),
  sample_requested: z.boolean().describe("True when the typed request or an attached request file asks for a sample or SAMPLE watermark"),
  naic_research: z.array(z.object({
    insurer_name: z.string(),
    naic_code: z.string().nullable(),
    source_url: z.string().nullable(),
    status: z.enum(["verified", "unresolved"]),
  })),
});
type Result = z.infer<typeof ResultSchema>;

const SYSTEM = `You are an expert commercial insurance certificate specialist at a New York brokerage. You read a certificate request and the insured's insurance documents (policies, binders, proposals, quotes, endorsements, dec pages) and complete the correct ACORD form by mapping values onto the form's exact fillable field names.

Hard rules:
1. The insurance documents are the source of truth. If the request asks for coverage, limits, endorsements, additional insured status, waiver of subrogation, primary & non-contributory wording, dates or anything else that the documents do not support, DO NOT put it on the certificate. List it under "unfulfilled" with a short reason citing what the documents actually show.
2. Never invent coverage, policy numbers, insurers, dates or limits. If a value is not found in the documents, leave the field out and list it under "missing". NAIC numbers are the only exception to the document-only rule: research and verify them as required by rule 14.
3. Do not ask questions. Complete the certificate fully with what is supported.
4. Follow the WORKFLOW MODE and FORM PRIORITY in the user message. For certificate mode, return the requested certificate form or forms, plus ACORD 101 only when supporting details need extra space. When both ACORD 25 and 28 are requested, complete both from the same source documents. For application mode, return ACORD 125 plus only the relevant line sections: 126 for General Liability, 140 for Commercial Property, and 131 for Umbrella / Excess. Never use certificate forms in an application package.
5. The producer / broker block is ALWAYS: ${BROKER.name}, ${BROKER.addressLine1}, ${BROKER.city} ${BROKER.state} ${BROKER.postalCode}; contact ${BROKER.contactName}; phone ${BROKER.phone}; email ${BROKER.email}. Put every value in its matching producer field.
6. Certificate holder / mortgagee / loss payee / lender name and address come from the request. If the request does not name a certificate holder (or there is no request), the certificate is for the MORTGAGEE: find the mortgagee / lender / loss payee name and address in the insurance documents (mortgagee schedule, additional interests, dec pages) and use it as the holder with interest type Mortgagee. If no mortgagee is found either, list the holder under "missing". Additional interest type (mortgagee, loss payee, lender's loss payable, additional insured) must match what the documents actually endorse; if the request asks for a status the policy doesn't grant, list it in "unfulfilled".
7. Additional insured and waiver-of-subrogation checkboxes/indicators (ADDL INSD / SUBR WVD) may only be marked when a blanket or scheduled endorsement in the documents supports it. Note in "double_check" when relying on a blanket endorsement.
8. Description of Operations / Remarks / Additional Remarks must contain ONLY the wording specified in the BROKER WORKFLOW below — short, clean certificate wording. NEVER put explanations, analysis, sources, disclaimers, 'sample only', 'not bound', proposal references, reasoning about fields, or notes to the broker in any form field. All such commentary belongs only in 'double_check', 'missing' or 'unfulfilled'.
9. Dates: use MM/DD/YYYY. Certificate date = today's date provided. Money: whole dollars with commas, e.g. 1,000,000.
10. For checkbox fields, value "true" to check. For dropdown/radio fields, use one of the listed options exactly.
11. Use ONLY field names that appear in each form's own field list. Do not include signature fields. Never map a value to a field on a different form.
12. "double_check" should flag: expired or soon-to-expire policies, quotes/proposals used as a source (not bound coverage), name mismatches between request and policy, inferred values, blanket endorsement reliance, anything ambiguous.
13. "summary": one or two plain sentences describing the certificate issued. Keep every "double_check" item concise: one short sentence with no background explanation.
14. For every insurer, research the exact legal company name using the enabled Google Search tool. Prefer the NAIC Consumer Insurance Search, U.S. state insurance departments, and the insurer's official website. Never transfer a group company's NAIC code to a subsidiary. Put a five-digit code into an Insurer_NAICCode field only when a reliable source explicitly associates it with that exact legal insurer. For every insurer, add one naic_research entry with status "verified", the code, and the source URL, or status "unresolved" with null code/source. If an insurer's mailing address is not shown in the insurance documents, use the same reliable sources to find the official home-office/mailing address; never guess it.
18. BROKER EDIT INSTRUCTIONS override rules 1, 2, 6 and 7. When the user message includes BROKER EDIT INSTRUCTIONS, apply each one as intended even if the documents do not support it (e.g. adding a coverage, limit, additional insured, waiver, or wording not yet endorsed). Keep everything else the same as before. For each such override add one short "double_check" item like "Added per broker instruction: ..." and do NOT list it as unfulfilled. The broker may type casually without proper capitalization: interpret the intent and write values in correct professional form — proper nouns and company names in Title Case (e.g. "cert holder is midland loan" → "Midland Loan"), abbreviations and placeholders in caps (e.g. "policy numbers are tbd" → "TBD"; LLC, NY, ISAOA/ATIMA), and state abbreviations uppercase. Never copy the broker's lowercase literally into a field.
15. General liability on ACORD 25: ALWAYS check exactly one "GEN'L AGGREGATE LIMIT APPLIES PER" box (Policy, Project, or Location) based on the documents. If the documents do not specify, check Policy (GeneralLiability_GeneralAggregate_LimitAppliesPerPolicyIndicator_A = "true").
16. General liability deductible on ACORD 25: ALWAYS check GeneralLiability_OtherCoverageIndicator_A and set GeneralLiability_OtherCoverageDescription_A to "Ded: $X" (e.g. "Ded: $10,000"). If the documents show no GL deductible, use "Ded: $0" — do not list it as missing.
19. CERTIFICATE-HOLDER EXCEPTION: certificate holder name/address and requested interest/status (Additional Insured, Mortgagee, Loss Payee, Lender's Loss Payable, etc.) may come from the request even when not shown in the policy documents. For mortgagee or vendor holders, the broker may instruct that ADDL INSD be marked Y; when that occurs, follow the broker instruction and note the override in double_check.
20. FIXED FACTS: ACORD 101 has no signature field — never mention a missing signature on it. ACORD 28 has no certificate number — never mention one missing. General aggregate is always Per Policy unless the documents indicate otherwise. 30 days notice of cancellation / 10 days for nonpayment is always provided on all standard policies — never flag it as unsupported or needing verification.
17. When FORM PRIORITY says to choose from coverages, review which coverages the documents provide: liability coverage (GL, auto, umbrella, workers comp) → ACORD 25; commercial property → ACORD 28; both → return both ACORD 25 and ACORD 28.
19. If the typed request or any REQUEST FILE asks for a sample, sample certificate, or SAMPLE watermark, set sample_requested to true. Otherwise set it to false. A sample request changes which finished copy the app presents first; NEVER add sample disclaimers or watermark wording to form fields.

BROKER WORKFLOW (the broker's exact procedure — follow it; it overrides the document-only rules where it prescribes a default):

ACORD 25:
- Include every policy on the certificate that applies (GL, auto, umbrella, workers comp, other).
- Description of Operations — LENDER certificates, one item per line, only these lines:
  Loan # (if provided)
  Insured location, ALWAYS written with a clear label on the same line: "Location address: [full address]" or "Location insured: [full address]". NEVER put a bare street address in Description of Operations.
  "Certificate holder is included as additional insured as required per written contract."
  "30 days notice of cancellation with 10 days notice of cancellation for nonpayment."
  If applicable: "Terrorism is included on the General Liability and Umbrella policies."
  "Umbrella is follow-form to the underlying." (only if an umbrella is on the certificate)
  plus any additional wording requested by the lender that complies with the policy.
- Description of Operations — certificates for the INSURED'S CUSTOMER:
  Job site (if provided), ALWAYS written with a clear label on the same line, such as "Job site: [full address]". NEVER put a bare street address in Description of Operations.
  "Certificate holder is included as additional insured as required per written contract."
  "Umbrella is follow-form to the underlying." (only if an umbrella is on the certificate)
  If the customer provides specific verbiage that complies with the policy, insert it exactly without changes or additions.
- If the description needs more space, continue it on ACORD 101 (Additional Remarks).
- Holder: name and address. Per policy, ADDL INSD "Y" if the holder is an additional insured; SUBR WVD "Y" if required and the policy includes waiver of subrogation.
- Insurers: NAIC code for each carrier (research).
- General Liability: enter the GL deductible as "Ded: $X" in the other-coverage line with its box checked. Aggregate applies per: single location and not a contractor → Policy; multiple locations with a designated location/premises aggregate form → Location; contractor with a designated project aggregate form → Project; if those forms are not present → Policy. Fill limits; leave out unnecessary ones.
- Auto: check covered auto symbols; enter either a Combined Single Limit OR split limits (BI/PD), never both.
- Umbrella: check Occur; check Retention and enter the retention amount (search for "retention", "retain", "deductible"); if none is listed, enter 0. Enter limits.
- Workers Comp: enter limits.
- Additional policies: enter the type of policy, limits and deductible.

ACORD 28 (Commercial Property):
- Holder interest type: mortgagee, loss payee, lender's loss payable, additional insured, etc., per the request. Holder name and address.
- Remarks/notes only for: longer mortgagee clauses, 30 days notice requirements, Extended Period of Indemnity, Business Income waiting period, other special wording requested. Use ACORD 101 if more space is needed.
- Property location address; check Building; check Special (cause of loss); building limit; deductible.
- The ACORD 28 location/address field is for the concise property location only: street, city, state and ZIP, with a short location number only when needed. Do NOT put construction, occupancy, building-story, square-footage, protection, or other property-detail narrative there unless the request specifically requires that information in the location field. Put requested special wording in Remarks/ACORD 101, not in the location address.
- Check Business Income and enter its limit (unless the building is vacant).
- Blanket: No (unless blanket premises applies).
- Terrorism included → Terrorism Coverage = Yes; IS THERE A TERRORISM-SPECIFIC EXCLUSION? = No; IS DOMESTIC TERRORISM EXCLUDED? = No. Terrorism excluded → Terrorism Coverage = No; IS THERE A TERRORISM-SPECIFIC EXCLUSION? = Yes; IS DOMESTIC TERRORISM EXCLUDED? = Yes.
- Fungus: if coverage is not indicated on the policy documents, Limited Coverage = No and Excluded = Yes.
- Valuation generally Replacement Cost. Agreed Amount → Agreed Amount Yes, Coinsurance No. Coinsurance → Coinsurance Yes with percentage, Agreed Amount No.
- Equipment Breakdown and Ordinance or Law Coverage A: if coverage is not indicated on the policy documents, check Yes with limit equal to the building limit.
- Ordinance or Law Coverages B & C: if coverage is not indicated on the policy documents, check Yes with limits equal to 10% of the building limit.
- Earthquake and Flood: if coverage is not indicated on the policy documents, check No.
- Wind/Hail & Named Storm: if coverage is not indicated on the policy documents, check Yes for included and No for subject to different provisions.
- EVERY Yes/No coverage row on ACORD 28 MUST have exactly one box checked (Y or N) — never leave any row with neither box checked. Apply the defaults above; for any other row not addressed by the documents, check No. ONE EXCEPTION: the "permission to waive subrogation" box may be left UNCHECKED when neither the request nor the documents provide any information about waiving subrogation.
- "Is domestic terrorism excluded?" must ALWAYS be answered the same as "Is there a terrorism-specific exclusion?" (both Yes or both No). Do NOT write anything on Remarks/ACORD 101 about terrorism exclusions not applying to fire losses.
- Every coverage row where a LIMIT is entered MUST also have its DED field filled. Use the coverage's specific deductible if the documents show one (e.g. wind/hail, named storm, flood, earthquake, equipment breakdown); otherwise use the All Other Perils (AOP) property deductible. Money format, e.g. 5,000. EXCEPTION: Business Income — do NOT apply the AOP deductible. Only note a Business Income deductible/waiting period (usually 72 hours, not a dollar amount) on Remarks/ACORD 101 when the documents actually state it; otherwise leave it off.
`;

function describeFields(fields: FieldInfo[]) {
  return fields
    .filter((f) => !/signature/i.test(f.name))
    .map((f) => {
      const parts = [f.name, f.type];
      if (f.tip) parts.push(f.tip.replace(/\s+/g, " ").slice(0, 160));
      if (f.options?.length) parts.push(`options: ${f.options.join(" / ")}`);
      return parts.join(" | ");
    })
    .join("\n");
}

function normalizedCompanyName(value: string) {
  return value.toLowerCase().replace(/\b(insurance|ins|company|co|corporation|corp|incorporated|inc|llc)\b/g, "").replace(/[^a-z0-9]/g, "");
}

function naicSlot(fieldName: string) {
  const match = fieldName.match(/(?:_|\b)([A-E])$/i);
  return match?.[1]?.toUpperCase() ?? "";
}

function applyVerifiedNaicCodes(result: Result) {
  const verified = result.naic_research.filter((item) =>
    item.status === "verified" && /^\d{5}$/.test(item.naic_code ?? "") && /^https:\/\//.test(item.source_url ?? ""));
  return result.forms.map((form) => {
    const fields = form.fields.filter((field) => !/naic/i.test(field.name));
    for (const original of form.fields.filter((field) => /naic/i.test(field.name))) {
      const slot = naicSlot(original.name);
      const insurerField = form.fields.find((field) => {
        if (!/insurer/i.test(field.name) || !/(full.?name|name)/i.test(field.name) || /naic/i.test(field.name)) return false;
        return !slot || naicSlot(field.name) === slot;
      });
      if (!insurerField?.value) continue;
      const insurer = normalizedCompanyName(insurerField.value);
      const match = verified.find((item) => normalizedCompanyName(item.insurer_name) === insurer);
      if (match?.naic_code) fields.push({ name: original.name, value: match.naic_code });
    }
    return { ...form, fields };
  });
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export async function runGeneration(input: {
  requestText: string;
  files: FileIn[];
  savedIds: string[];
  workflow: "certificate" | "application";
  preferredForm: "25" | "28" | "25,28" | "auto";
  edits?: string[];
}) {
  const sb = await admin();

  const { data: templates, error: tErr } = await sb.from("acord_templates").select("form_code, file_path, field_names");
  if (tErr) throw new Error(tErr.message);
  if (!templates?.length)
    throw new Error("No blank ACORD forms are installed yet. Upload them on the Forms page first.");

  // Include saved library docs as insurance documents.
  const files: FileIn[] = [...input.files];
  if (input.savedIds.length) {
    const { data: saved } = await sb.from("saved_documents").select("name, file_path, mime_type").in("id", input.savedIds);
    for (const s of saved ?? []) files.push({ path: s.file_path, name: s.name, mime: s.mime_type, role: "insurance" });
  }
  if (!files.length && !input.requestText.trim()) throw new Error("Add a certificate request and insurance documents.");

  const preNotes: string[] = [];
  const parts: GeminiPart[] = [];
  const certificateNumber = `PG-${new Date().getFullYear()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const today = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", month: "2-digit", day: "2-digit", year: "numeric" });

  const catalog = templates
    .map((t) => {
      const meta = FORM_CATALOG.find((f) => f.code === t.form_code);
      return `### ACORD ${t.form_code}${meta ? ` — ${meta.use}` : ""}\nFields (name | type | tooltip | options):\n${describeFields(t.field_names as FieldInfo[])}`;
    })
    .join("\n\n");

  const workflowInstruction = input.workflow === "application"
    ? "WORKFLOW MODE: COMMERCIAL APPLICATION. Return ACORD 125 and add ACORD 126, 140, and/or 131 only for lines clearly relevant to the submitted documents and request."
    : input.preferredForm === "25,28"
      ? "WORKFLOW MODE: CERTIFICATE PACKAGE. Return ACORD 25 and ACORD 28. Complete both from the same submitted request and insurance documents. Also return ACORD 101 only when supported details do not fit the main forms. Leave unsupported fields blank and report missing or unfulfilled items; do not omit either requested main form."
      : `WORKFLOW MODE: CERTIFICATE. Return the requested main form. FORM PRIORITY: ${input.preferredForm === "auto" ? "choose from coverages — return ACORD 25 for liability coverage, ACORD 28 for commercial property, and BOTH when the documents provide both" : `use ACORD ${input.preferredForm} unless the request clearly requires another certificate form`}. Also return ACORD 101 only when ACORD 28 needs supporting details or ACORD 25's Description of Operations lacks room.`;

  parts.push({
    text: `Today's date: ${today}\nProducer-assigned certificate number: ${certificateNumber}\n${workflowInstruction}${input.edits?.length ? `\n\nBROKER EDIT INSTRUCTIONS (authoritative — apply exactly, in order; later ones override earlier ones):\n${input.edits.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : ""}\n\nINSTALLED ACORD FORMS:\n\n${catalog}\n\n---\nREQUEST (typed/pasted):\n${input.requestText.trim() || "(none typed — see attached request files)"}\n\nAttached files follow. Each is preceded by a label saying whether it is part of the REQUEST or an INSURANCE DOCUMENT.`,
  });

  for (const f of files) {
    const label = f.role === "request" ? "REQUEST FILE" : "INSURANCE DOCUMENT";
    const bytes = await downloadBytes(f.path);
    const lower = f.name.toLowerCase();
    if (f.mime === "application/pdf" || lower.endsWith(".pdf")) {
      parts.push({ text: `[${label}: ${f.name}]` });
      parts.push({ inlineData: { mimeType: "application/pdf", data: toBase64(bytes) } });
    } else if (f.mime.startsWith("image/")) {
      parts.push({ text: `[${label}: ${f.name}]` });
      parts.push({ inlineData: { mimeType: f.mime, data: toBase64(bytes) } });
    } else if (f.mime.startsWith("text/") || /\.(txt|eml|md|csv|html?)$/.test(lower)) {
      const text = new TextDecoder().decode(bytes).slice(0, 60000);
      parts.push({ text: `[${label}: ${f.name}]\n${text}` });
    } else if (lower.endsWith(".msg") || f.mime === "application/vnd.ms-outlook") {
      try {
        const { default: MsgReader } = await import("@kenjiuno/msgreader");
        const message = new MsgReader(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer).getFileData();
        const sender = message.senderName || message.senderEmail
          ? `${message.senderName ?? ""}${message.senderEmail ? ` <${message.senderEmail}>` : ""}`.trim()
          : "Unknown sender";
        const recipients = (message.recipients ?? [])
          .map((recipient) => recipient.name || recipient.email)
          .filter(Boolean)
          .join(", ");
        parts.push({ text: `[${label}: ${f.name}]\nFrom: ${sender}\nTo: ${recipients || "Unknown recipient"}\nSubject: ${message.subject ?? ""}\n\n${(message.body ?? message.bodyHtml ?? "").slice(0, 60000)}` });
      } catch {
        preNotes.push(`"${f.name}" could not be read as an Outlook message.`);
      }
    } else {
      preNotes.push(`"${f.name}" could not be read (unsupported file type). Convert it to PDF and re-run if it matters.`);
    }
  }

  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("AI is not configured (missing GEMINI_API_KEY).");

  const responseSchema = {
    type: "OBJECT",
    properties: {
      certificate_type: { type: "STRING" },
      insured_name: { type: "STRING" },
      holder_name: { type: "STRING" },
      summary: { type: "STRING" },
      forms: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            form_code: { type: "STRING" },
            fields: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  value: { type: "STRING" },
                },
                required: ["name", "value"],
              },
            },
          },
          required: ["form_code", "fields"],
        },
      },
      unfulfilled: { type: "ARRAY", items: { type: "STRING" } },
      missing: { type: "ARRAY", items: { type: "STRING" } },
      double_check: { type: "ARRAY", items: { type: "STRING" } },
      sample_requested: { type: "BOOLEAN" },
      naic_research: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            insurer_name: { type: "STRING" },
            naic_code: { type: "STRING", nullable: true },
            source_url: { type: "STRING", nullable: true },
            status: { type: "STRING", enum: ["verified", "unresolved"] },
          },
          required: ["insurer_name", "naic_code", "source_url", "status"],
        },
      },
    },
    required: ["certificate_type", "insured_name", "holder_name", "summary", "forms", "unfulfilled", "missing", "double_check", "sample_requested", "naic_research"],
  };

  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";

  console.log("GEMINI DEBUG — parts:", parts.length);
console.log("GEMINI DEBUG — system chars:", SYSTEM.length);
console.log("GEMINI DEBUG — text chars:", parts.filter(p => "text" in p).reduce((n, p) => n + (p.text?.length ?? 0), 0));
console.log("GEMINI DEBUG — inline data parts:", parts.filter(p => "inlineData" in p).length);

  const aiResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
  });

  if (!aiResponse.ok) {
    let detail = "";
    try {
      const errorBody = await aiResponse.json() as { error?: { message?: string } };
      detail = errorBody.error?.message ?? "";
    } catch { /* ignore malformed error bodies */ }
    if (aiResponse.status === 429) throw new Error("Gemini is busy or the API limit was reached. Please wait a moment and try again.");
    if (aiResponse.status === 401 || aiResponse.status === 403) throw new Error("Gemini rejected the API key. Check GEMINI_API_KEY in your server environment.");
    throw new Error(`Gemini request failed (${aiResponse.status})${detail ? `: ${detail}` : ""}`);
  }

  const body = await aiResponse.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!rawText.trim()) throw new Error("Gemini returned an empty answer. Please try again.");

  let result: Result;
  try {
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    result = ResultSchema.parse(JSON.parse(cleaned));
  } catch {
    throw new Error("Gemini returned an unreadable certificate response. Please try again.");
  }

  const normalizedForms = applyVerifiedNaicCodes(result).map((form) => ({
    ...form,
    form_code: (form.form_code.match(/\d{2,4}/) ?? [""])[0],
  }));
  const requestedForms = input.workflow === "application"
    ? normalizedForms.filter((form, index, all) =>
        ["125", "126", "140", "131"].includes(form.form_code) && all.findIndex((item) => item.form_code === form.form_code) === index)
    : input.preferredForm === "25,28"
      ? ["25", "28"].map((code) => normalizedForms.find((form) => form.form_code === code) ?? { form_code: code, fields: [] })
          .concat(normalizedForms.filter((form) => form.form_code === "101").slice(0, 1))
      : input.preferredForm === "auto" && normalizedForms.some((f) => f.form_code === "25") && normalizedForms.some((f) => f.form_code === "28")
        ? ["25", "28"].map((code) => normalizedForms.find((form) => form.form_code === code)!)
            .concat(normalizedForms.filter((form) => form.form_code === "101").slice(0, 1))
      : [normalizedForms[0], ...normalizedForms.filter((form) => form.form_code === "101").slice(0, 1)].filter((form): form is NonNullable<typeof form> => Boolean(form));
  for (const form of requestedForms) {
    if (form.form_code !== "25") continue;
    const hasGl = form.fields.some((f) => /^(Policy_)?GeneralLiability_/.test(f.name) && f.value);
    const aggSet = form.fields.some((f) => /GeneralAggregate_LimitAppliesPer(Policy|Project|Location)Indicator/.test(f.name) && /^(true|yes|x|1)$/i.test(f.value));
    if (hasGl && !aggSet) {
      form.fields = form.fields.filter((f) => !/GeneralAggregate_LimitAppliesPer/.test(f.name));
      form.fields.push({ name: "GeneralLiability_GeneralAggregate_LimitAppliesPerPolicyIndicator_A", value: "true" });
    }
  }
  if (input.workflow === "application" && !requestedForms.some((form) => form.form_code === "125")) {
    requestedForms.unshift({ form_code: "125", fields: [] });
  }

  const availableForms = requestedForms.flatMap((form) => {
    const template = templates.find((item) => item.form_code === form.form_code);
    if (!template) {
      preNotes.push(`ACORD ${form.form_code} belongs in this package but its blank form is not installed, so it was not included.`);
      return [];
    }
    return [{ form, template }];
  });
  if (!availableForms.length) {
    const needed = requestedForms.map((form) => `ACORD ${form.form_code}`).join(", ");
    throw new Error(`Install ${needed} on the Forms page before generating this document.`);
  }

  const { data: settings } = await sb.from("app_settings").select("signature_path").eq("id", 1).maybeSingle();
  let signature: { bytes: Uint8Array; mime: string } | null = null;
  if (settings?.signature_path) {
    const sp = settings.signature_path;
    signature = { bytes: await downloadBytes(sp), mime: sp.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg" };
  }

  const completed: Uint8Array[] = [];
  const generatedForms: {
  form_code: string;
  fields: { name: string; value: string }[];
}[] = [];
  const samples: Uint8Array[] = [];
  const issues: string[] = [];
  for (const { form, template } of availableForms) {
    const templateBytes = await downloadBytes(template.file_path);
    const noCertNumber = form.form_code === "28";
    const certificateFields = [
      ...form.fields.filter((field) => !/producer.*(?:customer|certificate).*identifier/i.test(field.name)),
      ...(noCertNumber ? [] : (template.field_names as FieldInfo[])
        .filter((field) => /producer.*(?:customer|certificate).*identifier/i.test(field.name))
        .map((field) => ({ name: field.name, value: certificateNumber }))),
    ];
    generatedForms.push({
  form_code: form.form_code,
  fields: certificateFields,
});
    const formSignature = form.form_code === "101" ? null : signature;
    const filled = await fillPdf(templateBytes, certificateFields, formSignature);
    completed.push(filled.bytes);
    issues.push(...filled.issues.filter((issue) => !(form.form_code === "101" && /signature/i.test(issue))).map((issue) => `ACORD ${form.form_code}: ${issue}`));
    if (input.workflow === "certificate") {
      const sample = await fillPdf(templateBytes, certificateFields, formSignature, { sample: true });
      samples.push(sample.bytes);
    }
  }
  const firstCompleted = completed[0];
  if (!firstCompleted) throw new Error("No completed forms were produced.");
  const bytes = completed.length === 1 ? firstCompleted : await mergePdfs(completed);
  const formCodes = availableForms.map(({ form }) => form.form_code);
  const storedFormCode = formCodes.join(",");

  const id = crypto.randomUUID();
  const pdfPath = `certificates/${id}.pdf`;
  const { error: upErr } = await sb.storage.from(BUCKET).upload(pdfPath, bytes, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(upErr.message);

  let samplePath: string | null = null;
  if (input.workflow === "certificate" && samples.length) {
    const firstSample = samples[0];
    if (!firstSample) throw new Error("No sample forms were produced.");
    const sampleBytes = samples.length === 1 ? firstSample : await mergePdfs(samples);
    samplePath = `certificates/${id}-sample.pdf`;
    const { error: sampleUpErr } = await sb.storage.from(BUCKET).upload(samplePath, sampleBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (sampleUpErr) throw new Error(sampleUpErr.message);
  }

  const report = {
    form_code: storedFormCode,
    form_codes: formCodes,
    workflow: input.workflow,
    certificate_type: result.certificate_type,
forms: generatedForms,
    source: {
      requestText: input.requestText,
      files: input.files,
      savedIds: input.savedIds,
      preferredForm: input.preferredForm,
      edits: input.edits ?? [],
    },
    summary: result.summary,
    sample_requested: result.sample_requested,
    unfulfilled: result.unfulfilled,
    missing: [
      ...result.missing,
      ...result.naic_research
        .filter((item) => item.status === "unresolved")
        .map((item) => `NAIC code could not be reliably verified for ${item.insurer_name}.`),
    ],
    double_check: [
      ...preNotes,
      ...result.double_check,
      ...result.naic_research
        .filter((item) => item.status === "verified")
        .map((item) => `${item.insurer_name}: NAIC ${item.naic_code} verified.`),
      ...issues,
    ],
  };
const { error: insertError } = await sb.from("certificates").insert({
  id,
  form_code: storedFormCode,
  insured: result.insured_name,
  holder: result.holder_name,
  pdf_path: pdfPath,
  report,
  created_at: new Date().toISOString(),
});

if (insertError) {
  throw new Error(`Could not save certificate: ${insertError.message}`);
}

  const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(pdfPath, 3600);
  const { data: sampleSigned } = samplePath
    ? await sb.storage.from(BUCKET).createSignedUrl(samplePath, 3600)
    : { data: null };
  return {
    id,
    url: signed?.signedUrl ?? null,
    sampleUrl: sampleSigned?.signedUrl ?? null,
    insured: result.insured_name,
    holder: result.holder_name,
    report,
  };
}
