from pathlib import Path
from openpyxl import load_workbook
root=Path(r'C:\Users\ritpi\Documents\Codex\2026-11-07\us\work\master-workbooks-audit')
for path in sorted(root.glob('*.xlsx')):
    wb=load_workbook(path, data_only=False, read_only=False)
    print(f'\n### {path.name} sheets={wb.sheetnames}')
    for ws in wb.worksheets:
        print(f'-- {ws.title} dims={ws.max_row}x{ws.max_column} merged={list(ws.merged_cells.ranges)}')
        for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row,12), values_only=True):
            vals=[v.isoformat() if hasattr(v,'isoformat') else v for v in row]
            print(repr(vals))
        print('validations:', [(str(x.sqref), x.type, x.formula1) for x in ws.data_validations.dataValidation])
        formula_cells=[(c.coordinate,c.value) for row in ws.iter_rows() for c in row if isinstance(c.value,str) and c.value.startswith('=')]
        if formula_cells: print('formulas:',formula_cells[:30])
    wb.close()
