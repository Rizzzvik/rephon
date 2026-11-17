# REPHON 24X7 — Phase 4 Implementation Plan

## Repository inspection

- The application is Next.js 15 with TypeScript, Tailwind CSS, Supabase PostgreSQL/Auth/Storage, questionnaire journeys, and a protected admin area.
- `phone_brands` → `phone_models` → `phone_variants` is already the shared identity tree. `brand_code`, `model_code`, `variant_code`, and unique seven-digit `device_code` were added in earlier migrations and are consumed by repair, buyback, resale and imports. Keep this as the single canonical registry; do not add a second `brands` table.
- `phone_images` already stores licensed/owned provenance and approval; extend/reuse it for model-level common images rather than copying files into service modules.
- `model_price_setups` and variant columns already store some launch price/year references. `phone_models.specifications_json` exists, but there is no normalized specification/source store or cache for external imports.
- Buy/Sell/Repair use the `QuestionnaireFlow` and load the shared catalogue API. A separate `DeviceServiceFlow` still has hard-coded demonstration model names and should be removed from active use or converted to the shared selector.
- Admin has catalogue and image review pages but no full brand/model/variant/specification or external-import workflow.
- The workspace has no Git repository. `.env.local` exists but its values were not inspected. The original V2 ZIP is present at `C:\Users\ritpi\Documents\phone web\PHONEY_WEB_MASTER_V2_SELECTED_WORKBOOKS.zip`; extracted audit workbooks are under `work/master-workbooks-audit`.
- The V2 ZIP contains 26 brands, 501 model rows, 577 variant rows, and 430 variant research placeholders; the 10,386 repair rules, 2,646 component rules and 2,308 buyback rules are present. Resale inventory is intentionally empty; the 577 resale model setup rows are not stock. Apple is assigned brand code `14` in the authoritative workbook. Preserve allocations; live database codes still require inspection via an authorized database connection.
- Old “Phoney Web”/“Web Phoney” wording remains in shared UI, WhatsApp copy, admin branding, help links, and exports.
- The requested upstream repository is an unofficial Fastify/TypeScript scraper for GSMArena. Its README warns that scraping may violate the source site's terms. Integration will be a server-side, cached, review-first adapter; use in production remains gated on a legal/commercial permission review.

## Implementation order

1. Rebrand all user-facing and generated copy to REPHON 24X7 through shared brand settings; preserve historical records.
2. Add additive migrations for specification records/categories/sources, shared image metadata and external source mappings/import jobs/errors, indexes, and safe admin access. Extend the existing catalogue instead of duplicating its identity tables.
3. Add normalized, source-attributed specification APIs backed by Supabase; include completeness/verification metadata and graceful no-data responses.
4. Add a server-only external API adapter with timeouts, bounded retries, caching, source normalization, deduplication and pending-review import jobs. Never let external records allocate REPHON codes or activate themselves.
5. Update the unified Buy/Sell/Repair device selection and detail panel to use shared catalogue APIs, selected variant/image/specs, with responsive layouts and explicit unknown/quote states.
6. Expand protected admin catalogue/import review workflows and Excel import/export templates without editing source workbooks in place or changing existing codes/formulas.
7. Add tests for code preservation, normalization, duplicate matching, API downtime/cache behavior, pending-review imports, specification privacy/completeness, and branding; run existing checks.
8. Document pending external steps, API source caveats, image rights, and migration instructions.

## Safety and data boundaries

- Do not modify or overwrite Phase 2 source workbooks or source ZIPs. Updated workbook templates are generated as new deliverables only after verifying formulas and record counts.
- Do not infer or fabricate configurations, specifications, launch prices, colours or photo rights. External data defaults to pending review.
- Do not change/recycle a used brand, model, variant or device code. Historical transactions use restrictive relationships and remain readable if catalogue entries are deactivated.
- Do not store third-party images until commercial use is verified. Use the existing neutral placeholder until an approved image is linked.
- Do not call the external scraper from customer page requests; customer device selection must use cached database records.
- Do not represent migrations as applied to the hosted Supabase project without confirmation.

## Delivery status

Inspection and implementation plan completed. This pass adds the Phase 4 migration, central brand settings and rebrand, permanent code allocation ledgers, normalized specification/source/import tables, server-side source adapter and normalization, public verified-spec and device detail APIs, dynamic shared Buy/Sell/Repair catalogue selection with a specification panel, model/variant image upload support, and a protected external import/review page.

### Completed in this code pass

- Active existing brands are marked verified only when the new status field is first introduced; existing non-default review states are preserved.
- Existing brand/model/variant/device code assignments are seeded into permanent allocation ledgers and immutable code triggers are installed. Migration checks fail on malformed/duplicate code allocations rather than silently rewriting them.
- Customer selectors use server-side catalogue calls, service eligibility and verified records. The request submission resolves an exact selected seven-digit variant code instead of fuzzy-matching displayed names. Variant `00` and null device codes are excluded from transactional choices.
- Device specifications keep original source labels/value strings and stay pending until reviewed. Unknown fields are omitted rather than guessed.
- Model-level and exact-variant image entries use the existing rights/provenance workflow; customer APIs only return rights-cleared active images.
- Rebranding was checked in `src`, `README.md`, and `public`; no prior business name remains in those customer-facing paths.
- Validation completed: TypeScript, ESLint, 21 tests, and a production build pass. Next emits a warning that its installed Windows SWC binary is invalid, then successfully compiles with its fallback compiler.

### Still requires setup or follow-up

- Apply the Phase 4 migration on Supabase after Phase 1–3 migrations; it has not been applied to the hosted project.
- The upstream scraper must be hosted/configured, and commercial/upstream use must be approved before setting the source registry row to approved/enabled and `DEVICE_SPECS_SOURCE_APPROVED=true`.
- Do not import the source image URL automatically. Only independently rights-cleared images can be published.
- The five source workbooks/ZIP were inspected but not rewritten. The original source package remains unchanged; the existing app import/export flows still need dedicated Phase 4 workbook templates/sheets.
- Remaining admin work includes full create/edit workflows for brands, models, variants and specifications, a separate variant research queue/source register/history view, and scheduled/batch refresh, retry and source-health monitoring.
- No live-database integration, migration execution, commercial source access, real inventory creation, or real customer data use has been performed in this pass.
