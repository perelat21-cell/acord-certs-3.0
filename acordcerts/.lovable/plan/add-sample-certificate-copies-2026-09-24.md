# Add sample certificate copies

## What will change

- Add a **Create sample** action beside the completed certificate download controls.
- Keep the original completed certificate unchanged.
- Create a separate sample PDF where policy-number fields display **TBD**.
- Add a clear diagonal **SAMPLE** watermark to every page, including both pages of an ACORD 25 + 28 package.
- Show the sample in the existing preview and provide its own download action.

## Technical details

- Preserve the editable field locations long enough to replace policy numbers before flattening the sample copy.
- Apply the watermark directly to every PDF page, then save the sample as a separate private document.
- Make the action available for certificate workflows only, not commercial applications.
- Verify single-form and ACORD 25 + 28 sample output, then republish the update.