"""Turn medicines.json / conditions.json into the script files the app loads (works from file:// as well as the web)."""
import json, os
HERE = r'C:\Users\sizo1\Documents\blackout-tools\medical'
OUT = r'C:\Users\sizo1\Documents\blackout-handbook\medical'
os.makedirs(OUT, exist_ok=True)
terms = lambda y, org='The National Department of Health': f'\u00a9 {y}, {org}. Any part of this material may be reproduced, copied or adapted to meet local needs, without permission, provided that the parts reproduced are distributed free of charge or at no cost, not for profit.'
SRC = {
    'phc': dict(name='Primary Healthcare Standard Treatment Guidelines and Essential Medicines List, 7th edition, 2020 (v3.0)', by='National Department of Health, South Africa. health.gov.za', terms=terms(2020)),
    'adult': dict(name='Hospital Level (Adults) Standard Treatment Guidelines and Essential Medicines List, 6th edition, 2024', by='National Department of Health, South Africa. health.gov.za', terms=terms(2024)),
    'paed': dict(name='Hospital Level (Paediatrics) Standard Treatment Guidelines and Essential Medicines List, 2023 edition, updated July 2024', by='National Department of Health, South Africa. health.gov.za', terms=terms(2023)),
    'sched': dict(name='Consolidated Schedules, 1 August 2025 (Medicines and Related Substances Act 101 of 1965)', by='Department of Health and SAHPRA, South Africa. sahpra.org.za', terms='Official schedules made under the Medicines and Related Substances Act.'),
    'wiki': dict(name='Wikipedia, English medicine collection, October 2026 (Kiwix)', by='Wikipedia contributors. en.wikipedia.org', terms='Text under the Creative Commons Attribution-ShareAlike licence. Short extracts only, with the article named on each card.'),
}
for name, var in (('medicines', 'BH_MEDS'), ('conditions', 'BH_CONDS')):
    d = json.load(open(HERE + f'\\{name}.json', encoding='utf8'))
    open(OUT + f'\\{name}.js', 'w', encoding='utf8', newline='\n').write('window.' + var + '=' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ';\n' + ('window.BH_MEDSRC=' + json.dumps(SRC, ensure_ascii=False) + ';\n' if name == 'conditions' else ''))
    print(name, len(d), round(os.path.getsize(OUT + f'\\{name}.js') / 1048576, 2), 'MB')
