# Phoney Web — Phase 3 Implementation Plan

## Repository audit

- **Customer application:** Next.js 15 App Router, TypeScript, Tailwind CSS; Phoney Web home, catalogue, Buy, Sell, Repair, Doorstep, About, and Nearest Service routes already exist. Preserve the established white/orange visual system and sequential Buy/Sell/Repair questionnaire.
- **Data and auth:** Supabase PostgreSQL, Auth SSR sessions, private Storage. `staff_roles` currently recognizes `admin`, `catalogue_manager`, `support_agent`, and `inspector`, with server-side checks in `requireStaff`.
- **Existing server capabilities:** catalogue APIs; inventory and verified-price reads; Buy/Sell/Repair request APIs; file uploads; Sell inspection/offer and Repair quote endpoints; service-centre read API; admin request queue; Excel preview/commit/export; image approval management.
- **Current operational gaps:** customer submissions use UUID-derived `WP-<JOURNEY>-<8 HEX>` references and are not OTP-gated; no common six-digit request identifier/tracking; request console is a read queue; no persistent Doorstep flow; no WhatsApp webhook/conversation inbox; shop/provider records lack full operational editing/coverage; About content is static; pricing-policy workbook is not importable; current importer does not cover all Phase 3 V2 sheets/columns.
- **Repository logistics:** the workspace has no `.git` repository or configured remote, so changes cannot be committed/pushed until a Git checkout is provided. `.env.local` exists; its values were not inspected or copied.

## Supplied workbook audit

`PHONEY_WEB_MASTER_V2_SELECTED_WORKBOOKS.zip` contains five workbooks. The workbook package is the source for controlled admin imports; PostgreSQL remains the runtime source of truth.

| Workbook | Populated sheets / key findings |
| --- | --- |
| DEVICE_MASTER.xlsx | 26 brand rows, 500 model rows, 577 variant rows, plus catalogue scope, source register, model counts, relationship rules, and 430-row variant research queue. Extended variant fields include original price basis and launch year. |
| REPAIR_MASTER.xlsx | 18 issues, 10,386 repair-price rows, 18 components, and 2,646 component-price rows. Component prices contain formulas that need value/error validation before import. |
| BUYBACK_MASTER.xlsx | 4 condition grades, 2,308 buyback-rule rows, and 9,232 formula cells across valuation calculations. |
| RESALE_MASTER.xlsx | No physical inventory rows; 4 grades, 577 model-price setup rows, and 2,308 formula cells. Must not create stock from catalogue setup rows. |
| PRICING_POLICY_MASTER.xlsx | Depreciation, condition-deduction, margin policies and formula definitions. Policies require explicit approval before customer-facing use. |

The source archive remains untouched. The existing import console allows previews and confirmation, but price/formula validation, policy workbook support, and transactional cross-table imports need work. No live workbook data should be silently overwritten or automatically approved.

## Delivery plan

### Stage 1 — Backend foundation and safe data integration

1. Additive migrations for a common request record, six-digit code reservation, status history, assignments, notes, audit events, shop/provider coordinates and service coverage, request tracking, OTP challenges/consents, WhatsApp contacts/conversations/messages/events, and configurable pricing policies.
2. Use the existing questionnaire submission tables as the Buy/Sell/Repair detail records; link them to the common request record instead of creating a second request database.
3. Generate six-digit public codes inside PostgreSQL with cryptographic randomness, a uniqueness constraint, collision retry, and a permanent reservation ledger. Keep existing UUID IDs and legacy references intact.
4. Extend Excel mappings for V2 columns/sheets, including `PRICING_POLICY_MASTER`, component price sheets and source/research sheets. Validate identifiers, formulas/cached values, status, references and approvals. Never convert catalogue-only rows into stock.
5. Make commits atomic per workbook where feasible; preserve preview/confirm, report row errors, and avoid replacing stored values with blank cells.

### Stage 2 — Customer phone verification

1. Implement challenge/verify endpoints with expiry, cooldown, attempt/rate limits, one-time use and hashed OTP storage.
2. Use Supabase Auth phone OTP where configured, otherwise keep the provider adapter explicit and fail closed. Do not mark a customer verified based only on a posted number.
3. Link verified E.164 mobile numbers to one customer record and retain consent records.
4. Gate request submissions on a server-verifiable customer session or short-lived verified submission token.

### Stage 3 — Customer Buy/Sell/Repair and tracking

1. Keep existing sequential questionnaire UI and bind verified identity at submit.
2. Store every request in the shared request directory with source, status history and a six-digit code.
3. Preserve price-on-request behavior when approved verified prices are unavailable; require approval before publishing new rules.
4. Add tracking that requires code plus verified phone/session, and exposes no private information to code-only lookups.

### Stage 4 — Protected operations console

1. Build on existing `/admin` routes and server-side Supabase staff identity; expand permissions by action/module without frontend-only authorization.
2. Add dashboard, searchable request directory/details, customer directory, status transitions, assignment, notes, quotation actions and audit history.
3. Add catalogue, pricing, inventory, shop/provider and Excel management screens as authorized roles are introduced.
4. Keep customer PII and costs behind protected endpoints and RLS/service-role boundaries.

### Stage 5 — Doorstep and locations

1. Add persistent booking submission, address/location fields, date/time preferences, request code and tracking linkage.
2. Never mark a requested slot confirmed until staff/provider availability is approved.
3. Add shop/provider CRUD and service/brand coverage. Keep demo records visibly marked and replaceable.
4. Add Leaflet/OpenStreetMap with attribution, geolocation permission, distance sorting and directions links. Keep geocoder/routing configuration and provider rate limits explicit.

### Stage 6 — About content and communication

1. Make About copy/timeline admin-editable without inventing company history.
2. Add secure Meta webhook verification, event persistence/idempotency, structured WhatsApp flow, shared request creation and human handoff.
3. Add a protected conversation inbox; keep outbound templates/token configuration server-side.

### Stage 7 — Verification and release readiness

1. Add automated tests for request code collision/uniqueness, OTP limits, role permissions, request privacy, idempotency, workbook formulas/imports, and WhatsApp webhook signatures/retries.
2. Run unit tests, typecheck, lint and production build; exercise responsive journeys where environment credentials permit.
3. Report credentials, business approvals, actual shop/provider records, pricing policies and deployment tasks that remain external.

## Initial acceptance boundaries

- Existing public pages and existing API contracts remain working unless a versioned contract explicitly changes.
- No OTP/WhatsApp secrets, actual customer data, real provider details or unapproved prices are added to source control.
- The supplied ZIP is never modified in place.
- A migration or code change is not represented as applied to the user's live Supabase project unless verified there.
- WhatsApp/SMS, maps/geocoding and live end-to-end tests remain credential-gated; use mock adapters only when clearly labelled.

## First implementation slice

Implement Stage 1’s shared request identity and operational data model, plus import support and tests. Then connect the existing questionnaire and admin queue to that model before proceeding through OTP and the external integrations.

## Progress in this implementation pass

Implemented in source (not applied to hosted Supabase):

- Added the Phase 3 operational migration: shared request records, permanent six-digit code ledger, status history, staff assignments/notes, customer verification metadata, OTP rate limits, doorstep request records, pricing policy/setup records, component prices, WhatsApp events and admin permissions.
- Existing Buy/Sell/Repair questionnaires now send and verify Supabase Auth SMS OTP before submission and display the database-generated six-digit request code. The server links requests to the verified customer identity.
- Added a doorstep visit request flow with phone verification, address, preferred date/time and a pending-request status.
- Added customer request tracking that requires a verified Supabase phone session and only returns the matching customer's public status timeline.
- Extended the staff request queue with status updates, transactional internal notes and a status history/conversation display. Staff request access checks module permissions.
- Added the Meta webhook verification/signature validation, event deduplication, WhatsApp message persistence and creation of a shared request-directory record for inbound conversations.
- Extended workbook parsing/commit/export for V2 component price rows, additional device/buyback fields, resale model-price setup and pricing policies. Unapproved pricing policies are forced inactive; model setup rows do not create inventory; blank formula prices remain quote-required.
- Parsed the supplied five-workbook ZIP in preview only: 0 blocking workbook validation errors, with 430 explicit warnings for unknown variant `00` placeholders. It was not committed to the database.
- Added parser and webhook-signature tests.

## Phase 3 delivery status

The Phase 3 implementation is complete in the local source tree. The delivered code includes the operational request model and six-digit references; OTP-gated customer submissions and tracking; doorstep request flow; protected admin dashboard, request/customer/location/provider/catalogue/pricing/inventory/accessory/content/staff tools; role checks; workbook preview, import and export; WhatsApp webhook, deduplication, guided intake and protected inbox replies; shared verified pricing; and quote-required handling for missing prices. The resale pricing safety migration also makes blank listing prices nullable and makes order reservation use only an approved override or stored selling price.

Local checks completed: `npm test` (17 passing), `npx tsc --noEmit`, `npm run lint`, and `npm run build` all passed. Production builds use `.next-build`; the local preview uses `.next-dev`, so build and dev caches stay isolated. The production build used Next.js's WASM compiler fallback because the installed Windows SWC native module was invalid; the build itself completed successfully.

The following are deployment/setup steps and cannot be completed from this local workspace: apply migrations `202611080005` through `202611080008` to the connected Supabase project; confirm existing project schema compatibility; configure Supabase phone OTP/SMS and Meta WhatsApp credentials/webhook; enter real shop/provider records and reviewed pricing; import the selected workbook data after business review; and run live integration checks. No credentials or real customer data were added, and the workbook ZIP was not modified or imported into the live database.
