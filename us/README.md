# REPHON 24X7

A mobile-first device commerce platform for renewed phone discovery, device resale, repairs, service locations, doorstep requests, and staff operations. Supabase is the shared source of truth for the web experience and service workflows.

## Project layout

- `src/app/` contains customer pages and API routes.
- `src/components/` contains shared customer and admin interface components.
- `src/lib/` contains catalogue, pricing, import, authentication, and integration logic.
- `supabase/migrations/` holds the canonical schema history; `supabase/sql-editor-setup/` contains fresh-project SQL bundles.
- `public/devices/` contains the device artwork used in the interactive home section.
- `docs/DATA_DICTIONARY.md` documents the database. Superseded plans are retained under `docs/history/`.

## Start locally

Requirements: Node.js 22+, npm, and a Supabase project.

1. Install dependencies: `npm install`.
2. Copy `.env.example` to `.env.local` and add the project values below. Keep `.env.local` private.
3. Apply database migrations using the workflow that matches your database: `supabase db push` for a linked project, or the SQL Editor bundles below for a fresh project.
4. Start the site: `npm run dev`, then open `http://localhost:3000`.

## Environment

| Variable | Used for | Visibility |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project connection | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser authentication | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side database and private storage access | Secret; server only |
| `DEVICE_SPECS_API_URL` | Reviewed device-spec source API | Server only |
| `DEVICE_SPECS_SOURCE_APPROVED` | Runtime gate for external device-spec requests | Server only; keep `false` until approved |
| `WHATSAPP_ACCESS_TOKEN` | Meta Cloud API replies | Secret; server only |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta sender identity | Server only |
| `WHATSAPP_GRAPH_API_VERSION` | Meta Graph API version | Server only |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification | Secret; server only |
| `META_APP_SECRET` | Webhook signature verification | Secret; server only |

Customer requests require Google sign-in through Supabase Auth. WhatsApp sending requires a configured Meta app and approved credentials.

## Database setup

The numbered files in `supabase/migrations/` are the canonical migration history. Keep them in order for CLI deployments.

For a **new Supabase project using the SQL Editor**, the same SQL is grouped into four longer pages in `supabase/sql-editor-setup/`. Run `01-core.sql`, `02-operations.sql`, `03-device-master.sql`, then `04-model-price-references.sql`.

For an **existing project**, do not run the setup bundles. Apply only migrations that have not already run. The latest allocation fixes are `supabase/migrations/202611160001_fix_brand_code_allocation_trigger.sql` and `supabase/migrations/202611160002_fix_model_device_code_allocation_triggers.sql`.

Create an Auth user, then assign the first administrator using that user’s Auth UUID:

```sql
insert into public.staff_roles(user_id, role)
values ('<auth-user-uuid>', 'admin');
```

## Customer experience

- `/` — interactive home, offered services, verified customer reviews, and available deals.
- `/catalogue` — phone, tablet, and laptop categories with current inventory when available.
- `/buy`, `/sell`, `/repair` — step-by-step device flows with English/Hindi voice prompts and a price preview where an exact approved price exists.
- `/doorstep-service`, `/nearest-service`, `/track-request` — service requests, location search, and customer request tracking.
- `/about` — REPHON 24X7 information.

## Customer sign-in

Customer service requests use Google sign-in through Supabase Auth. Customers provide a mobile number for service follow-up, but it is not verified by SMS OTP. Before enabling customer submissions:

1. In Supabase, open **Authentication → Sign In / Providers → Google**, enable Google, and enter the OAuth client ID and secret from your Google Cloud OAuth client.
2. Add the local and deployed callback URLs to the Supabase Auth redirect allow list: `http://localhost:3000/auth/callback` and `https://YOUR_DOMAIN/auth/callback`.
Customer request APIs validate the Google session server-side before saving. Phone numbers are collected for follow-up and are not SMS-verified.

## Staff workspace

Staff sign in at `/admin/login`. The protected admin workspace includes request management, WhatsApp conversations, customers, locations, providers, device catalogue, pricing, inventory, accessories, imports/exports, images, website content, and staff access controls. Server-side role and permission checks protect admin operations.

## Catalogue and pricing rules

- Brands, models, variants, listings, and service workflows use the shared Supabase database.
- Only active, verified catalogue records are offered in customer device selectors.
- Customer prices come from approved inventory listings or verified, current repair/buyback rules that match the selected device and answers.
- Missing, ambiguous, or unverified prices return a quote request. Model-level references do not imply a specific variant, inventory, or final offer.
- Customer submissions are saved once using idempotency protection. Customer details and attachments stay server-side.

## Workbook imports

Open `/admin/imports`, select the matching workbook, preview it, resolve blocking errors, then explicitly commit. Re-importing an already committed identical workbook is blocked. Exports are admin-only.

`REPHON_24X7_COMPLETE_MODEL_CATALOGUE_2019_2026.xlsx` imports `MODEL_NET_PRICE_TAGS`, `REPAIR_PART_NET_TAGS`, and `COMPONENT_DEDUCTION_MATRIX` as model-level references with confidence and source-row provenance. Imported values stay pending review and inactive. Other formula, summary, and audit tabs remain informational. This workbook contains low-confidence estimates and does not define sellable device variants or live stock; its values must not be shown as guaranteed customer prices.

## WhatsApp integration

The inbound endpoint is `/api/v1/integrations/whatsapp/webhook`. It validates Meta signatures and deduplicates event processing. The protected inbox shares the same requests and customer records as the website. Free-form replies follow Meta’s customer-service window; sending templates requires approval in Meta.

## Device-spec source

External device-spec import is review-first and gated by both the source registry in Supabase and `DEVICE_SPECS_SOURCE_APPROVED=true`. Configure `DEVICE_SPECS_API_URL` only for a reviewed deployment. New models, specifications, and images remain pending until staff review. Confirm upstream data and image rights before enabling commercial use.

## Developer commands

```powershell
npm run dev
npm run build
npm run lint
npm test
```
