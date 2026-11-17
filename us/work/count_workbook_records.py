from pathlib import Path
from openpyxl import load_workbook
root=Path(r'C:\Users\ritpi\Documents\Codex\2026-11-07\us\work\master-workbooks-audit')
for p in sorted(root.glob('*.xlsx')):
 w=load_workbook(p, data_only=False, read_only=True)
 print(p.name)
 for s in w:
  rows=list(s.iter_rows(values_only=True))
  nonempty=[r for r in rows[1:] if any(v is not None for v in r)]
  print(' ',s.title,'rows',len(nonempty),'first',list(rows[0]) if rows else [])
  if s.title=='BRAND_REGISTRY':
   for r in nonempty: print('    ',r[:5])
 w.close()
