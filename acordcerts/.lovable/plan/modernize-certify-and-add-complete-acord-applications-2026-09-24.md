# Modernize Certify and add complete ACORD applications

## What will change

- Replace the warm, soft visual style with a crisp modern workspace: cool white and pale eucalyptus surfaces with cool green undertones, restrained blue accents, sans-serif typography, tighter corner radii, cleaner navigation, and less decorative motion.
- Make **ACORD 25** and **ACORD 28** the prominent primary workflows, with other certificate forms and **Commercial application** available as small secondary options.
- Keep the existing certificate workflow and its source-of-truth safeguards.
- Make application mode produce one downloadable, combined PDF package:
  - ACORD 125 as the common Commercial Insurance Application
  - ACORD 126 when General Liability is needed
  - ACORD 140 when Commercial Property is needed
  - ACORD 131 when Umbrella / Excess is needed
- Let the assistant determine which line sections belong in the package from the uploaded material, without inventing information.
- List missing, unsupported, and review-needed items for the full package.
- Add ACORD 126, 131, and 140 to the Forms screen so blank fillable copies can be installed.
- Update results and history to identify application packages and show every included ACORD form.

## Technical details

- Pass the selected workflow type into generation and use separate certificate/application instructions.
- Return field mappings per selected form, fill each installed template, and merge the completed forms in application order into one PDF.
- Require ACORD 125 for application mode; include 126, 140, and 131 only when supported and relevant. Missing required templates will be reported rather than silently replaced with unrelated forms.
- Keep the existing broker identity, saved-policy behavior, reusable signature, private document storage, and no-sign-in setup unchanged.
- Validate both workflows in the live app at desktop and mobile sizes.
