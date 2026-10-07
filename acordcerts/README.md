# Certify Complete

Build me an insurance certificate assistant. The user uploads a certificate request and insurance documents such as policies, binders, proposals, quotes, and endorsements. The AI should extract the information, determine what belongs on the certificate, fill the applicable ACORD form, and provide a completed PDF. Insurance documents are the source of truth when requirements conflict with coverage. The assistant should never invent coverage information. It should complete the certificate automatically rather than asking for confirmation, and then provide a list of requirements it could not fulfill, missing information, and anything that should be double-checked. It should support both liability/project certificates and property certificates involving mortgagees, loss payees, and lenders. The broker section should always contain P&G Insurance Brokers, Inc., 718-854-2818, perelat@pandginsurance.com. I will upload a broker signature once and the system should reuse it.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://acordcerts.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/400c00df-d1a1-4c09-b83d-92e9fda90153).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## AI configuration

The certificate generator uses Google Gemini directly from the server. Set `GEMINI_API_KEY` in the server environment. Do not put the Gemini key in any `VITE_` variable.

The app also requires the Supabase server variables `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, plus the browser-safe Supabase variables already used by this project.

Before generating certificates, install the actual fillable ACORD 25, ACORD 28, and ACORD 101 PDFs from the Forms page. The app reads their real AcroForm field names and populates those templates; it does not fabricate a replacement form.
