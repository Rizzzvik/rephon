# Phone Commerce Platform — Implementation Plan

## Product and architecture

Build a mobile-first commerce platform around one Supabase PostgreSQL database. The Next.js site, admin console, and WhatsApp integration will call shared domain services and read/write the same records. Pricing and quote decisions live in one server-side service; a missing or expired price creates a quote request instead of an estimate. External webhook handling will verify Meta signatures, persist an idempotency key before processing, and enqueue durable work.

## Delivery sequence

1. **Foundation and phone catalogue (current assignment):** Next.js/TypeScript/Tailwind scaffold; Supabase schema, local config, sample catalogue; public catalogue API; setup documentation and API tests.
2. **Shared commerce domain:** customers, enquiries, repair bookings, quote requests, orders, and inventory with explicit status transitions and audit history.
3. **Central pricing and valuation:** effective-dated pricing rules, condition inputs, server-only quote service, quote acceptance/expiry, and no-price quote path.
4. **Customer journeys:** repair booking, used-phone sell flow, refurbished listings and checkout/payment integration boundary; responsive screens and accessible forms.
5. **Admin CRM and inventory:** Supabase Auth roles, row-level security, staff workflows, stock movements, bulk CSV/XLSX imports with preview, validation, and error reports.
6. **WhatsApp:** secure Cloud API webhook verification, event deduplication, shared customer/enquiry/booking services, conversation inbox, message templates, retries, and delivery state.
7. **Hardening and release:** migration review, authorization and webhook security, observability, operational runbooks, backup/recovery, and deployment configuration.

## Current module boundaries

- `src/app/api/catalogue`: read-only HTTP boundary.
- `src/lib/catalogue`: filter validation, API handler, and shared read service.
- `src/lib/supabase`: server-side database client; service-role key stays server-only.
- `supabase/migrations`: versioned PostgreSQL schema and row-level security.
- `supabase/seed.sql`: fictional catalogue records only; no customer data or prices.

## Current acceptance criteria

- Browse active brands/models/variants with validated search and bounded pagination.
- Keep pricing data private and independent from catalogue attributes.
- Do not seed or invent prices; later quote workflows must handle missing prices explicitly.
- Catalogue API errors return a generic response and do not leak backend details.
- Automated API tests cover filters, successful response, and unavailable database behavior.

## Decisions and follow-ups

- Prices use integer minor units plus ISO currency to avoid floating-point money errors.
- Catalogue visibility is public for active records; writes and all pricing reads remain server-side until roles and policies are implemented.
- Before production, define supported markets/currencies, tax and warranty rules, image storage conventions, import limits, and the admin role matrix.
