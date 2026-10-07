# Add verified NAIC lookup and update producer details

## What will change

- Update the producer block on every completed ACORD document to show:
  - P&G Brokerage Inc.
  - 1648 61st Street
  - Brooklyn NY 11204
- Always place **Perela Terkelatub** in the producer contact-name field while retaining the existing phone and email.
- Before filling a document, identify each insurance carrier from the uploaded insurance documents and look up its NAIC company code from a reliable public source.
- Insert a code only when the carrier identity and code can be verified. If a carrier is ambiguous or no reliable match is found, leave the NAIC field blank and list it under missing or double-check items rather than guessing.

## Technical details

- Expand the fixed producer-field safeguards so the agency name, street, city/state/ZIP, contact name, phone, and email override generated values across installed ACORD forms.
- Add a server-side NAIC lookup step during generation, using carrier names extracted from the source documents and a maintained authoritative data source or lookup service compatible with the hosted app.
- Feed verified carrier-name/code pairs back into the ACORD field-mapping step and record unresolved lookups in the result report.
- Verify ACORD 25 and ACORD 28 output against the installed templates, including producer fields, contact name, and NAIC placement.
- Republish after verification so the live app receives the changes.