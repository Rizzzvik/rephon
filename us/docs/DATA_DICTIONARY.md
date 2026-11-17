# Original Workbook Field Dictionary and Database Mapping

This document is transcribed from the supplied `DATA_DICTIONARY.xlsx`; workbook headers and order remain authoritative. Import preview preserves all cell values and blocks commit for unmapped columns. `START_HERE` and `CODE_RULES` are retained as documentation in the import report, not inserted as business records.

## Field definitions

| Workbook | Sheet | Field | Type | Required | Format / values | Definition | Example |
|---|---|---|---|---|---|---|---|
| DEVICE_MASTER.xlsx | BRAND_REGISTRY | brand_code | Text(2) | Yes | 00-99 | Permanent two-digit brand code. | 14 |
| DEVICE_MASTER.xlsx | BRAND_REGISTRY | brand_name | Text | Yes | Unique | Official display brand name. | Apple |
| DEVICE_MASTER.xlsx | BRAND_REGISTRY | brand_slug | Text | Yes | lowercase-hyphen | Stable URL/API slug. | apple |
| DEVICE_MASTER.xlsx | BRAND_REGISTRY | product_category | Text | Yes | Controlled list | Top-level product family. | Smartphones |
| DEVICE_MASTER.xlsx | BRAND_REGISTRY | status | Integer | Yes | 0 or 1 | 0 inactive; 1 active. | 1 |
| DEVICE_MASTER.xlsx | PHONE_MODELS | brand_code | Text(2) | Yes | Existing BRAND_REGISTRY code | Brand foreign key. | 14 |
| DEVICE_MASTER.xlsx | PHONE_MODELS | model_code | Text(3) | Yes | 001-999 within brand | Permanent model code within brand. | 013 |
| DEVICE_MASTER.xlsx | PHONE_MODELS | model_name | Text | Yes | Unique within brand | Canonical marketing model name. | iPhone 13 |
| DEVICE_MASTER.xlsx | PHONE_MODELS | model_slug | Text | Yes | Unique within brand | Stable URL slug. | iphone-13 |
| DEVICE_MASTER.xlsx | PHONE_MODELS | launch_year | Integer | No | YYYY | Official release year if known. | 2021 |
| DEVICE_MASTER.xlsx | PHONE_MODELS | device_type | Text | Yes | smartphone/feature_phone/tablet/other | Device family. | smartphone |
| DEVICE_MASTER.xlsx | PHONE_MODELS | specifications_json | JSON text | No | Valid JSON | Optional structured specs; blank if unknown. | {} |
| DEVICE_MASTER.xlsx | PHONE_MODELS | status | Integer | Yes | 0 or 1 | Model-level visibility. | 0 |
| DEVICE_MASTER.xlsx | PHONE_MODELS | verification_status | Text | Yes | draft/needs_review/verified/rejected | Data validation state. | draft |
| DEVICE_MASTER.xlsx | DEVICE_VARIANTS | device_code | Text(7) | Formula | BBMMM VV | Concatenation of brand_code + model_code + variant_code. | 1401301 |
| DEVICE_MASTER.xlsx | DEVICE_VARIANTS | brand_code | Text(2) | Yes | Existing brand code | Foreign key to BRAND_REGISTRY. | 14 |
| DEVICE_MASTER.xlsx | DEVICE_VARIANTS | model_code | Text(3) | Yes | Existing model code for brand | Foreign key to PHONE_MODELS. | 013 |
| DEVICE_MASTER.xlsx | DEVICE_VARIANTS | variant_code | Text(2) | Yes | 00-99 | 00 unspecified; 01+ actual variant allocation. | 01 |
| DEVICE_MASTER.xlsx | DEVICE_VARIANTS | ram_gb | Integer | No | Positive integer | RAM capacity in GB. | 4 |
| DEVICE_MASTER.xlsx | DEVICE_VARIANTS | storage_gb | Integer | No | Positive integer | Storage capacity in GB. | 128 |
| DEVICE_MASTER.xlsx | DEVICE_VARIANTS | colour | Text | No | Canonical colour | Colour/finish name. | Midnight |
| DEVICE_MASTER.xlsx | DEVICE_VARIANTS | status | Integer | Yes | 0 or 1 | 0 inactive; 1 active. | 0 |
| DEVICE_MASTER.xlsx | DEVICE_VARIANTS | repair_enabled | Integer | Yes | 0 or 1 | Whether repair workflow is enabled. | 1 |
| DEVICE_MASTER.xlsx | DEVICE_VARIANTS | buyback_enabled | Integer | Yes | 0 or 1 | Whether buyback workflow is enabled. | 1 |
| DEVICE_MASTER.xlsx | DEVICE_VARIANTS | resale_enabled | Integer | Yes | 0 or 1 | Whether resale workflow is enabled. | 0 |
| REPAIR_MASTER.xlsx | REPAIR | REPAIR_PRICES | Text/Number/Date | See workbook headers | See START_HERE | Field name; refer to workbook START_HERE and header row for operational meaning. |  |
| BUYBACK_MASTER.xlsx | BUYBACK | BUYBACK_RULES | Text/Number/Date | See workbook headers | See START_HERE | Field name; refer to workbook START_HERE and header row for operational meaning. |  |
| RESALE_MASTER.xlsx | RESALE | RESALE_INVENTORY | Text/Number/Date | See workbook headers | See START_HERE | Field name; refer to workbook START_HERE and header row for operational meaning. |  |
| ACCESSORIES_MASTER.xlsx | ACCESSORIES | ACCESSORIES | Text/Number/Date | See workbook headers | See START_HERE | Field name; refer to workbook START_HERE and header row for operational meaning. |  |
| SERVICE_PROVIDER_MASTER.xlsx | SERVICE | PROVIDERS | Text/Number/Date | See workbook headers | See START_HERE | Field name; refer to workbook START_HERE and header row for operational meaning. |  |

## Sheet to table mappings

### DEVICE_MASTER.xlsx / BRAND_REGISTRY

Database target: `phone_brands`. brand_code is a permanent two-digit natural identifier; status maps to both status and public is_active.

Original ordered headers:

`brand_code`, `brand_name`, `brand_slug`, `product_category`, `status`, `notes`

### DEVICE_MASTER.xlsx / PHONE_MODELS

Database target: `phone_models`, with brand_code resolved to brand_id. model_code remains a three-digit string; verification_status gates public catalogue visibility.

Original ordered headers:

`brand_code`, `model_code`, `brand_name`, `model_name`, `model_slug`, `launch_year`, `device_type`, `specifications_json`, `status`, `source_reference`, `verification_status`, `notes`

### DEVICE_MASTER.xlsx / DEVICE_VARIANTS

Database target: `phone_variants`, with brand/model code pairs resolved to model_id. device_code is checked/derived as BB + MMM + VV; status and three eligibility flags remain separate.

Original ordered headers:

`device_code`, `brand_code`, `model_code`, `variant_code`, `brand_name`, `model_name`, `ram_gb`, `storage_gb`, `colour`, `region`, `sku`, `status`, `repair_enabled`, `buyback_enabled`, `resale_enabled`, `notes`

### REPAIR_MASTER.xlsx / REPAIR_ISSUES

Database target: `repair_issues`. issue_code is the durable business key.

Original ordered headers:

`issue_code`, `issue_name`, `issue_category`, `description`, `status`

### REPAIR_MASTER.xlsx / REPAIR_PRICES

Database target: `repair_price_rules`. Customer price is public only if verified, active, and within its validity dates; provider and device references are checked.

Original ordered headers:

`device_code`, `issue_code`, `part_type`, `part_grade`, `part_cost_inr`, `labour_cost_inr`, `logistics_cost_inr`, `margin_inr`, `customer_price_inr`, `warranty_days`, `city`, `provider_code`, `valid_from`, `valid_to`, `verified`, `status`, `notes`

### BUYBACK_MASTER.xlsx / CONDITION_GRADES

Database target: `condition_grades` (shared by buyback and resale); condition_grade maps to grade_code.

Original ordered headers:

`condition_grade`, `grade_name`, `criteria`, `status`

### BUYBACK_MASTER.xlsx / BUYBACK_RULES

Database target: `buyback_rules`. Customer-reported condition is never converted to a final grade; public indicative rules require verified, active and current.

Original ordered headers:

`device_code`, `condition_grade`, `screen_condition`, `body_condition`, `battery_health_min_pct`, `battery_health_max_pct`, `functional_status`, `base_value_inr`, `deduction_inr`, `estimated_offer_inr`, `city`, `valid_from`, `valid_to`, `verified`, `status`, `notes`

### RESALE_MASTER.xlsx / RESALE_INVENTORY

Database target: `resale_inventory`. Only available stock with positive quantity is listed. Purchase/refurbishment cost fields remain server/admin-only.

Original ordered headers:

`inventory_sku`, `device_code`, `condition_grade`, `battery_health_pct`, `stock_quantity`, `purchase_cost_inr`, `refurbishment_cost_inr`, `selling_price_inr`, `warranty_days`, `city`, `listing_status`, `date_added`, `notes`

### RESALE_MASTER.xlsx / CONDITION_GRADES

Database target: `condition_grades` (shared by buyback and resale); condition_grade maps to grade_code.

Original ordered headers:

`condition_grade`, `grade_name`, `criteria`, `status`

### ACCESSORIES_MASTER.xlsx / ACCESSORIES

Database target: `accessories`; compatibility_key is derived from compatible_device_code or explicitly supplied compatible_model. Unverified compatibility is rejected.

Original ordered headers:

`accessory_code`, `accessory_category`, `brand`, `accessory_name`, `compatible_device_code`, `compatible_model`, `cost_inr`, `selling_price_inr`, `stock_quantity`, `warranty_days`, `status`, `notes`

### SERVICE_PROVIDER_MASTER.xlsx / PROVIDERS

Database target: `service_providers`; contact person, phone, email, and address stay behind server-side admin access.

Original ordered headers:

`provider_code`, `business_name`, `provider_type`, `contact_person`, `phone_e164`, `email`, `city`, `area`, `full_address`, `services_offered`, `working_hours`, `status`, `notes`

## Workbook code rules retained from source

- **REPAIR_MASTER.xlsx · Exact match:** Prefer exact device_code + issue_code + city + provider.
- **REPAIR_MASTER.xlsx · Fallback:** If no exact price, do not invent one; route to manual quote.
- **REPAIR_MASTER.xlsx · Publication:** Require verified=1 and status=1.
- **BUYBACK_MASTER.xlsx · Estimate:** Estimated offer = base value - applicable deductions.
- **BUYBACK_MASTER.xlsx · Final inspection:** Final offer is subject to device inspection and business policy.
- **BUYBACK_MASTER.xlsx · No data:** No rule means request manual valuation; do not fabricate price.
- **RESALE_MASTER.xlsx · Unit SKU:** Each individual handset should have a unique SKU/serial reference.
- **RESALE_MASTER.xlsx · Public listing:** Only available stock with a positive quantity can be listed.
- **RESALE_MASTER.xlsx · No inventory:** A model in DEVICE_MASTER does not imply stock exists.
- **ACCESSORIES_MASTER.xlsx · Compatibility:** Use a separate row for each supported device code.
- **ACCESSORIES_MASTER.xlsx · No assumption:** Do not claim compatibility without checking supplier/manufacturer information.
- **SERVICE_PROVIDER_MASTER.xlsx · Provider code:** Use PRV000001-style sequential IDs.
- **SERVICE_PROVIDER_MASTER.xlsx · Access:** Restrict provider contact details to authorized staff.

## Import and publication semantics

- The import screen shows sheet names, ordered headers, recognised and unknown fields, populated row counts, formula-derived device codes, and row-level validation output. Unknown fields block commit until an explicit mapping is added; they are retained in the preview payload.
- Preview batches do not mutate business tables. Commit requires an authenticated administrator and zero blocking validation errors or duplicate keys.
- Stable workbook identifiers are used for idempotent upserts. Existing customer requests and customer records are not overwritten by master workbook imports.
- Missing prices, inventory, model details, provider locations, and product photographs remain missing; the API returns empty listings or a manual quote path.
- A service-role database connection and applied Supabase migrations are required before preview or commit can run.
