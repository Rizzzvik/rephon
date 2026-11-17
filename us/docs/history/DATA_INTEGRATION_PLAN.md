# Phase 2 Data Integration Plan

## Workbook audit (ORIGINAL_PHONE_DATASETS.zip)

The ZIP contains the seven requested workbooks and `PACKAGE_INDEX.txt`. All source workbook names, sheets, headers, Excel validations, and formula columns were inspected.

| Workbook | Sheets | Populated business rows | Notes |
|---|---|---:|---|
| DEVICE_MASTER.xlsx | START_HERE, BRAND_REGISTRY, PHONE_MODELS, DEVICE_VARIANTS | 23 brand registry rows; 0 models; 0 device variants | Device code formula is prefilled for 2,000 template rows. Brand codes are marked proposed and require business confirmation. |
| REPAIR_MASTER.xlsx | START_HERE, REPAIR_ISSUES, REPAIR_PRICES, CODE_RULES | 0 issues; 0 prices | Only verified, active prices may be published. |
| BUYBACK_MASTER.xlsx | START_HERE, CONDITION_GRADES, BUYBACK_RULES, CODE_RULES | 4 grade rows; 0 valuation rules | Final offers require inspection. |
| RESALE_MASTER.xlsx | START_HERE, RESALE_INVENTORY, CONDITION_GRADES, CODE_RULES | 4 grade rows; 0 inventory | No sellable stock or prices are supplied. |
| ACCESSORIES_MASTER.xlsx | START_HERE, ACCESSORIES, CODE_RULES | 0 accessories | No accessory products or prices are supplied. |
| SERVICE_PROVIDER_MASTER.xlsx | START_HERE, PROVIDERS, CODE_RULES | 0 providers | No real service-centre details are supplied. |
| DATA_DICTIONARY.xlsx | DATA_DICTIONARY, CODE_RULES, IMPLEMENTATION_ORDER | 30 dictionary field definitions; 10 code rules; 10 implementation steps | Used as the field and validation reference. |

No customer data, credentials, verified prices, inventory, provider details, or licensed product photographs were present. The workbook data has not been imported into a live database.

## Integration sequence

1. Additive PostgreSQL migrations for device identifiers, service rules, inventory, providers, images, customer submissions, audit records, and import history.
2. Role-gated import preview, validation, explicit commit, error report, and export API using the original workbook sheets and headers.
3. Versioned public APIs for catalogue, inventory, repair issues/prices, and customer enquiries/requests.
4. Connect the existing questionnaire to live catalogue data and submission endpoints; remove implicit mock fallback from production paths.
5. Provide neutral image fallbacks and model/variant image metadata; only show real photographs after approved licensed assets are added.
6. Verify migration SQL, API validation, auth boundaries, imports, frontend type/lint/build, and report unavailable external setup such as Supabase credentials.

## Implemented in this pass

- Additive catalogue/business migrations and private storage bucket definitions.
- ExcelJS parser, explicit per-workbook mappings, preview validation, duplicate checks, foreign-reference checks, CSV error reports, admin-only export and staged commit.
- Catalogue, inventory detail/list, buy order/enquiry, sell/repair submission, request status, verified price, staff inspection/offer/quote, review, and staff request queue APIs.
- Existing questionnaire journeys connected to database-driven brand/model/variant options and secure private uploads; live inventory and verified approved reviews replace home page sample rows.
- Admin image source and rights metadata workflow. No photographs were included in the supplied package.

## External setup and operational limits

- `supabase` CLI and `.env.local` are not present in this workspace, so the migrations could not be applied, staff account bootstrapped, or workbook records imported. No customer or credential data was supplied or created.
- The workbook import commit is staged and keyed for repeatable upserts, but writes across a workbook's multiple tables are not one database transaction. A failure leaves the batch in preview for a retry; verify database changes before retrying in production.
- The staff request page currently provides a read queue; inspection and quote operations are exposed through role-gated APIs and need dedicated staff forms before day-to-day operations.
- WhatsApp webhook verification, duplicate-event handling, chatbot messaging, and conversation inbox are outside this pass and remain unimplemented.
- End-to-end flows requiring Supabase, real operational records, and licensed product photos still need environment-backed verification.

## Safety decisions

- Preserve original worksheet names and field names in mappings.
- Validate all rows and require a separate explicit commit after preview.
- Never fabricate missing prices, inventory, locations, customer reviews, or photographs.
- Keep provider personal details and internal costs server-side/admin-only.
- Keep customer-reported condition separate from staff inspection and final quality grade.
- The live schema accepts `laptop` as an additional `device_type` so the existing Phone / Tablet / Laptop picker does not misclassify `other` records. The original workbook dictionary is preserved; rows marked `other` are never treated as laptops.
- Use Supabase as the runtime source of truth; do not read Excel at runtime on public pages.
