# Insurance Certificate Assistant

A tool where you drop in a certificate request plus the supporting insurance documents, and get back a completed, signed ACORD certificate PDF — along with an honest list of what it couldn't do.

## How it will work for you

1. **Blank forms (one-time setup).** You upload the blank ACORD 25, 24, 27, 28, 75, 125 and 175 PDFs on a Forms page. They're stored and reused forever.
2. **Signature (one-time setup).** You upload your signature image once on a Settings page. It's stamped on every certificate automatically.
3. **New certificate.** Drop in the certificate request (email, PDF, or pasted text) and the insurance documents — policies, binders, proposals, quotes, endorsements. Hit Generate.
4. **The assistant reads everything**, decides whether this is a liability/project certificate or a property certificate (mortgagee, loss payee, lender), picks the right ACORD form, and fills it.
5. **You get the finished PDF** to preview and download, plus a report card underneath:
   - Requirements it could not fulfill (e.g. "request demands waiver of subrogation on auto; no such endorsement found")
   - Missing information (blank fields and why)
   - Items to double-check (ambiguous or inferred entries)
6. **Saving is on request.** Nothing is kept from a job unless you press "Save these documents" — then the policies go in a library you can reuse on later certificates.

## Core rules baked in

- Insurance documents win over the request whenever they conflict. The certificate reflects actual coverage, never what was asked for.
- No invented coverage. A field with no source in the documents stays blank and appears in the missing-info list.
- Never asks for confirmation mid-run — it completes, then reports.
- The broker block is always pre-filled and locked: P&G Insurance Brokers, Inc. · 718-854-2818 · perelat@pandginsurance.com

## Pages

- **Home / New certificate** — upload zone, document list with type labels, Generate button, result view with PDF preview + download + the three-part report.
- **Library** — saved policy documents, reusable on any new certificate.
- **Forms** — upload/replace the blank ACORD templates; shows which are installed.
- **Settings** — broker details (fixed) and the signature image.

## Technical approach

- **Backend:** Lovable Cloud. Storage buckets for blank ACORD templates, the signature, uploaded source documents and generated certificates. Tables for templates, saved documents, and certificate jobs (open access, no sign-in, per your choice).
- **Reading documents:** uploaded PDFs and images are sent directly to the AI as file inputs (handles scanned and native PDFs alike) — no fragile text-scraping step. Pasted text is passed through as-is.
- **Extraction:** one server call with a strict schema returning: certificate type, named insured, holder, description of operations, per-policy rows (insurer, policy number, effective/expiration dates, limits, additional-insured / waiver / primary-noncontributory status), and property/mortgagee data. Every field carries a source note and a confidence flag; anything unsupported is returned null with a reason — this is what powers the three-part report.
- **Form filling:** blank ACORD PDFs are AcroForm PDFs. On template upload the app reads the real field names out of the PDF and stores them. At generation time the AI maps extracted values onto those exact field names, and `pdf-lib` writes the values and stamps the signature image, then flattens the result. This keeps fidelity to the official forms instead of a redrawn lookalike.
- **Design:** calm, airy, uncluttered feel with generous spacing — ivory paper surfaces, deep navy ink, a single amber accent for flagged items. No generic SaaS gradient.

## What I need from you

Upload the blank ACORD PDFs (25, 24, 27, 28) and your signature image — either now or through the Forms/Settings pages once the app is up. Everything else gets built regardless; the generator just can't produce a filled form until the matching blank template is installed.
