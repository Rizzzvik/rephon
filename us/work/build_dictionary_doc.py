from pathlib import Path
from openpyxl import load_workbook
base=Path(r'C:\Users\ritpi\Documents\Codex\2026-11-07\us')
root=base/'work'/'master-workbooks-audit'
out=base/'docs'/'DATA_DICTIONARY.md'
out.parent.mkdir(parents=True,exist_ok=True)
wb=load_workbook(root/'DATA_DICTIONARY.xlsx',data_only=True,read_only=True)
def esc(v): return str(v or '').replace('|','\\|').replace('\n',' ')
parts=['# Original Workbook Field Dictionary and Database Mapping','', 'This document is transcribed from the supplied `DATA_DICTIONARY.xlsx`; workbook headers and order remain authoritative. Import preview preserves all cell values and blocks commit for unmapped columns. `START_HERE` and `CODE_RULES` are retained as documentation in the import report, not inserted as business records.','', '## Field definitions','', '| Workbook | Sheet | Field | Type | Required | Format / values | Definition | Example |','|---|---|---|---|---|---|---|---|']
for row in wb['DATA_DICTIONARY'].iter_rows(min_row=2,values_only=True): parts.append('| '+' | '.join(esc(v) for v in row)+' |')
parts += ['', '## Sheet to table mappings','']
maptext={
'BRAND_REGISTRY':'`phone_brands`. brand_code is a permanent two-digit natural identifier; status maps to both status and public is_active.',
'PHONE_MODELS':'`phone_models`, with brand_code resolved to brand_id. model_code remains a three-digit string; verification_status gates public catalogue visibility.',
'DEVICE_VARIANTS':'`phone_variants`, with brand/model code pairs resolved to model_id. device_code is checked/derived as BB + MMM + VV; status and three eligibility flags remain separate.',
'REPAIR_ISSUES':'`repair_issues`. issue_code is the durable business key.',
'REPAIR_PRICES':'`repair_price_rules`. Customer price is public only if verified, active, and within its validity dates; provider and device references are checked.',
'CONDITION_GRADES':'`condition_grades` (shared by buyback and resale); condition_grade maps to grade_code.',
'BUYBACK_RULES':'`buyback_rules`. Customer-reported condition is never converted to a final grade; public indicative rules require verified, active and current.',
'RESALE_INVENTORY':'`resale_inventory`. Only available stock with positive quantity is listed. Purchase/refurbishment cost fields remain server/admin-only.',
'ACCESSORIES':'`accessories`; compatibility_key is derived from compatible_device_code or explicitly supplied compatible_model. Unverified compatibility is rejected.',
'PROVIDERS':'`service_providers`; contact person, phone, email, and address stay behind server-side admin access.',
}
for filename in ['DEVICE_MASTER.xlsx','REPAIR_MASTER.xlsx','BUYBACK_MASTER.xlsx','RESALE_MASTER.xlsx','ACCESSORIES_MASTER.xlsx','SERVICE_PROVIDER_MASTER.xlsx']:
    book=load_workbook(root/filename,data_only=False,read_only=True)
    for sheet in book.worksheets:
        if sheet.title in {'START_HERE','CODE_RULES'}: continue
        headers=[str(v.value) for v in next(sheet.iter_rows(min_row=1,max_row=1)) if v.value is not None]
        parts += [f'### {filename} / {sheet.title}', '', f'Database target: {maptext.get(sheet.title,"No runtime business-table mapping; retained for review.")}', '', 'Original ordered headers:', '', '`'+'`, `'.join(headers)+'`','']
    book.close()
parts += ['## Workbook code rules retained from source','']
for filename in ['DEVICE_MASTER.xlsx','REPAIR_MASTER.xlsx','BUYBACK_MASTER.xlsx','RESALE_MASTER.xlsx','ACCESSORIES_MASTER.xlsx','SERVICE_PROVIDER_MASTER.xlsx']:
    book=load_workbook(root/filename,data_only=True,read_only=True)
    if 'CODE_RULES' in book.sheetnames:
        ws=book['CODE_RULES'];
        for row in ws.iter_rows(min_row=2,values_only=True):
            if any(v is not None for v in row): parts.append(f'- **{filename} · {row[1]}:** {row[2]}')
    book.close()
parts += ['', '## Import and publication semantics','', '- The import screen shows sheet names, ordered headers, recognised and unknown fields, populated row counts, formula-derived device codes, and row-level validation output. Unknown fields block commit until an explicit mapping is added; they are retained in the preview payload.', '- Preview batches do not mutate business tables. Commit requires an authenticated administrator and zero blocking validation errors or duplicate keys.', '- Stable workbook identifiers are used for idempotent upserts. Existing customer requests and customer records are not overwritten by master workbook imports.', '- Missing prices, inventory, model details, provider locations, and product photographs remain missing; the API returns empty listings or a manual quote path.', '- A service-role database connection and applied Supabase migrations are required before preview or commit can run.']
out.write_text('\n'.join(parts)+'\n',encoding='utf-8')
print(out)
