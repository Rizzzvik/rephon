from openpyxl import load_workbook
p=r'C:\Users\ritpi\Documents\Codex\2026-11-07\us\work\master-workbooks-audit\DATA_DICTIONARY.xlsx'
w=load_workbook(p,data_only=True,read_only=True)
s=w['DATA_DICTIONARY']
for row in s.iter_rows(values_only=True): print(' | '.join('' if v is None else str(v) for v in row))
