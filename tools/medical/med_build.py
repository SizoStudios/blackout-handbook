"""Build the Blackout Handbook medicine cards and condition chunks from the South African STG/EML text.
Usage: python med_build.py   (reads parsed.json made by stg_parse.py, txt\\*.txt, and enc.json if present)
Writes: medicines.json, conditions.json, coverage.json (+ prints the coverage report)."""
import re, json, collections, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stg_parse as P
HERE = P.HERE
parsed = json.load(open(HERE + r'\parsed.json', encoding='utf8'))
SRCNAME = {k: v['name'] for k, v in P.SRC.items()}
SRCLEVEL = {'phc': 'primary healthcare clinics', 'adult': 'adult hospitals', 'paed': 'children’s hospitals'}
SYN = {'amoxycillin': 'amoxicillin', 'cephalexin': 'cefalexin', 'epinephrine': 'adrenaline', 'acyclovir': 'aciclovir', 'paracetamol': 'paracetamol', 'salbutamol': 'salbutamol', 'albuterol': 'salbutamol', 'frusemide': 'furosemide', 'lignocaine': 'lidocaine', 'cotrimoxazole': 'co-trimoxazole', 'sulfamethoxazole/trimethoprim': 'co-trimoxazole'}
CLASS_WORDS = re.compile(r'(inhibitor|blocker|antagonist|agonist|-?blocker|benzodiazepine|macrolide|antiviral|anticholinergic|antihistamine|antibiotic|diuretic|statin|antiretroviral|corticosteroid|analgesic|vaccine$|laxative|antiemetic|antipsychotic|antidepressant|opioid|nsaid|bronchodilator|insulin$)', re.I)

def canon(n):
    n = re.sub(r'\s+\d{1,2}\.\d{1,3}(?:\s*,\s*\d{1,2}\.\d{1,3})*.*$', '', n.strip())
    n = re.sub(r'^o\s+', '', n.strip().strip('•- ').strip())
    aka = []
    for m in re.finditer(r'\(([^)]{1,40})\)', n):
        t = m.group(1).strip()
        if not re.match(r'(e\.g|see)', t, re.I): aka.append(t)
    n = re.sub(r'\([^)]*\)', ' ', n)
    n = re.sub(r'\b(e\.g\.?|eg)\b.*$', '', n, flags=re.I)
    n = re.sub(r'\s+\d[\d\.,]*\s*(mg|mcg|µg|g|iu|ml|units?|%)\b.*$', '', n, flags=re.I)
    n = re.sub(r',\s*(oral|parenteral|topical|inhal\w*|ophthalmic|rectal|sublingual|nasal|vaginal|ear drops|[a-z ]*)$', '', n, flags=re.I) if ',' in n else n
    n = re.sub(r'\s+', ' ', n).strip(' ,.;:').lower()
    n = SYN.get(n, n)
    return n, aka

ACR = {'hiv','aids','tb','covid-19','arv','art','sti','icd','iv','im','uti','copd','adhd','mdr','xdr','pmtct','ecg','abo','bcg','dtp','ors','vds','mus','bal','bmi','ppe','iucd','hpv','rhd','ards','aki','ckd','cpr','ors','ent','ear','dka','hbv','hcv','tia','dvt','pe','mi','who','gord','nsaid','nsaids','uvb','sle','rsv','mrsa','esbl','uss','crp'}
def nice(t):
    t = re.sub(r'\s+', ' ', t.strip()).lower()
    t = re.sub(r"[a-z0-9\-']+", lambda mm: mm.group(0).upper() if mm.group(0) in ACR else mm.group(0), t)
    return t[:1].upper() + t[1:]

def aud_key(a):
    a = (a or '').lower()
    if 'neonat' in a: return 'neonates'
    if 'infant' in a: return 'infants'
    if 'child' in a: return 'children'
    if 'adolesc' in a: return 'adolescents'
    if 'pregnan' in a or 'breastfeed' in a or 'women' in a: return 'pregnancy and breastfeeding'
    if 'elder' in a: return 'elderly'
    if 'adult' in a: return 'adults'
    return ''

cards = {}
def card(key, name=None):
    if key not in cards: cards[key] = dict(id=re.sub(r'[^a-z0-9]+', '-', key).strip('-'), name=(name or key).strip(), aka=[], routes=[], levels=[], uses=[], doses=[], ages=[], schedule=[], enc=None, class_=False, indexRefs={})
    return cards[key]

for src, d in parsed.items():
    for lname, entries in d['meds'].items():
        k, aka = canon(entries[0]['name'])
        if len(k) < 3 or not re.search(r'[a-z]{3}', k): continue
        c = card(k, entries[0]['name'] if not re.search(r'\d|e\.g', entries[0]['name']) else k.title())
        c['aka'] = sorted(set(c['aka'] + aka))
        if src not in c['levels']: c['levels'].append(src)
        for e in entries:
            r = e['route'].strip().lower()
            if r and r not in c['routes']: c['routes'].append(r)
            u = (nice(e['cond']), e['ref'], src)
            if u not in c['uses']: c['uses'].append(u)
            ak = aud_key(e['aud'])
            if ak and ak not in c['ages']: c['ages'].append(ak)
            row = dict(aud=e['aud'] or '', line=e['line'], cond=nice(e['cond']), ref=e['ref'], src=src)
            if not any(x['line'] == row['line'] and x['aud'] == row['aud'] for x in c['doses']): c['doses'].append(row)
JUNK = re.compile(r"^(and|or|adults?|children|child|infants?|avoid|approximate|all |breastfeeding|art |bubo|pregnan|women|men |neonat|if |for |use |then |maximum|total|first|second|continue|stop|start|repeat|give|note|see |when |plus |with |without |max )|(weeks?|months?|years?|dose|doses|hourly|daily|equivalent|unbooked|exposed|previous|regimen|lines?)", re.I)
for k in [k for k, c in cards.items() if JUNK.search(c['name']) or JUNK.search(k) or len(k.split()) > 5 or len(k) > 60]:
    del cards[k]
for c in cards.values():
    c['class_'] = bool(CLASS_WORDS.search(c['name']))
    c['uses'] = [dict(cond=a, ref=b, src=s) for a, b, s in c['uses']][:60]
    c['doses'] = c['doses'][:80]

# ---- indexes of medicines (coverage denominators) ----
def index_names(fname, kind):
    t = open(HERE + '\\txt\\' + fname, encoding='utf8', errors='replace').read()
    # only the pages that carry the "INDEX OF MEDICINES" header
    seg = '\n'.join(p for p in t.split('\f') if 'INDEX OF MEDICINES' in p)
    if kind == 'dots': names = re.findall(r'^([A-Z][^\n\.]{2,80}?)\s*\.{3,}\s*[\d]', seg, re.M)
    else: names = [m.group(1) for m in re.finditer(r'^([A-Z][A-Za-z0-9 ,\-\(\)/%\.’\']{2,70}?)(?:\s{3,}[\d\.,]+|\s*$)', seg, re.M) if not re.match(r'^(INDEX|Page|ACE|Also)', m.group(1))]
    return [n.strip() for n in names if len(n.strip()) > 2]
idx = {'phc': index_names('phc.txt', 'dots'), 'paed': index_names('paed.txt', 'cols')}

def present(n):
    k, _ = canon(n)
    if k in cards: return k
    for kk, c in cards.items():
        if k and (k == kk.split('/')[0] or k.split('/')[0] == kk or k in c['aka'] or any(k == canon(a)[0] for a in c['aka'])): return kk
    # name only differs by a trailing form word, e.g. "Zinc oxide"
    for kk in cards:
        if k and (kk.startswith(k + ' ') or k.startswith(kk + ' ')): return kk
    return None

# where a medicine is named in the guidelines but not in "name, route, dose" form (e.g. oxygen, oxytocin, emollients), keep the lines that mention it
chunk_lines = [(src, ch['ref'], ch['title'].title(), [l.strip() for l in ch['text'].split('\n') if l.strip()]) for src, d in parsed.items() for ch in d['chunks']]
def mentions(key, aka):
    pats = [re.compile(r'\b' + re.escape(x.lower()) + r'\b', re.I) for x in [key] + [canon(a)[0] for a in aka] if len(x) > 3]
    out = []
    for src, ref, title, lines in chunk_lines:
        for i, l in enumerate(lines):
            if any(p.search(l) for p in pats):
                out.append(dict(src=src, ref=ref, cond=nice(title), line=re.sub(r'\s+', ' ', l)[:240])); break
        if len(out) >= 10: break
    return out
def fill_mentions():
    for k, c in cards.items():
        if not c['doses'] and 'mentions' not in c: c['mentions'] = mentions(k, c['aka'])
cov = {}
for src, names in idx.items():
    names = sorted({canon(n)[0] for n in names if canon(n)[0]})
    cls = [n for n in names if CLASS_WORDS.search(n)]
    meds = [n for n in names if n not in cls]
    hit = [n for n in meds if present(n)]
    miss = [n for n in meds if not present(n)]
    cov[src] = dict(index_entries=len(names), class_entries=len(cls), medicine_entries=len(meds), with_dose_lines=len(hit), pct_with_dose_lines=round(100 * len(hit) / max(1, len(meds)), 1), without_dose_lines=miss)

# index-only medicines still get a card so nothing in the EML index is left out
for src, names in idx.items():
    for n in names:
        k, aka = canon(n)
        if len(k) < 3 or not re.search(r'[a-z]{3}', k) or k in cards or JUNK.search(k) or len(k.split()) > 5: continue
        c = card(k, n.strip()); c['aka'] = sorted(set(c['aka'] + aka)); c['class_'] = bool(CLASS_WORDS.search(k))
        if src not in c['levels']: c['levels'].append(src)
        c['indexOnly'] = True

fill_mentions()
for src in idx:
    meds = [n for n in cov[src]['without_dose_lines']]
    ok = [n for n in meds if (cards.get(canon(n)[0]) or {}).get('mentions') or mentions(canon(n)[0], [])]
    cov[src]['mentioned_in_text'] = len(ok); cov[src]['not_found_in_text'] = [n for n in meds if n not in ok]
    cov[src]['pct_with_source_text'] = round(100 * (cov[src]['with_dose_lines'] + len(ok)) / max(1, cov[src]['medicine_entries']), 1)
    cov[src]['cards_for_all_index_entries'] = all(canon(n)[0] in cards for n in idx[src] if len(canon(n)[0]) > 2)

# ---- schedules (S0-S6) ----
sched = collections.defaultdict(list)
st = open(HERE + r'\txt\sched.txt', encoding='utf8', errors='replace').read().split('\n')
cur = None; entry = None
def flush():
    global entry
    if entry and cur is not None:
        txt = re.sub(r'\s+', ' ', ' '.join(entry)).strip()
        head = re.split(r'[,;:\.\-–(]| except| see ', txt, maxsplit=1)[0].strip().lower()
        if 2 < len(head) < 60: sched[head].append((cur, txt[:600]))
    entry = None
for ln in st:
    m = re.match(r'^\s*SCHEDULE\s+(\d)\b', ln, re.I)
    if m: flush(); cur = int(m.group(1)); continue
    if cur is None or cur > 6: continue
    if re.match(r'^\s*\d{1,3}\s*$', ln) or not ln.strip(): continue
    if re.match(r'^[A-Z][A-Za-z0-9 \-’\'/\(\)]{2,}', ln) and len(ln) - len(ln.lstrip()) <= 2 and not ln.lstrip().lower().startswith(('schedule', 'note', 'this ', 'all ', 'in these', 'the ')):
        flush(); entry = [ln.strip()]
    elif entry is not None: entry.append(ln.strip())
flush()
for k, c in cards.items():
    seen = set()
    for key in [k] + [canon(a)[0] for a in c['aka']]:
        for s, txt in sched.get(key, []):
            if (s, txt) in seen: continue
            seen.add((s, txt)); c['schedule'].append(dict(s=s, text=txt))
    c['schedule'] = c['schedule'][:6]

# ---- encyclopedia extracts (made by med_enc.py) ----
if os.path.exists(HERE + r'\enc.json'):
    enc = json.load(open(HERE + r'\enc.json', encoding='utf8'))
    for k, c in cards.items():
        if k in enc: c['enc'] = enc[k]

out = sorted(cards.values(), key=lambda c: c['name'].lower())
for c in out: c['levels'] = [dict(src=s, level=SRCLEVEL[s], name=SRCNAME[s]) for s in c['levels']]
json.dump(out, open(HERE + r'\medicines.json', 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))

# ---- condition chunks (for the AI and for search) ----
conds = []
for src, d in parsed.items():
    for ch in d['chunks']:
        t = re.sub(r'[ \t]+', ' ', ch['text']); t = re.sub(r'\n{3,}', '\n\n', t).strip()
        conds.append(dict(id=src + ':' + ch['ref'], src=src, ref=ch['ref'], title=nice(ch['title']), page=ch['page'], text=t[:5500]))
json.dump(conds, open(HERE + r'\conditions.json', 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))

# ---- condition index coverage ----
def cond_index(fname):
    t = open(HERE + '\\txt\\' + fname, encoding='utf8', errors='replace').read()
    i = t.find('INDEX OF CONDITIONS'); seg = t[i:]; j = seg.find('INDEX OF MEDICINES'); seg = seg[:j] if j > 0 else seg[:400000]
    return sorted({re.sub(r'\s+', ' ', n).strip(' ,').lower() for n in re.findall(r'^([A-Za-z][^\n\.]{3,80}?)\s*\.{3,}\s*[\d]', seg, re.M)})
words = lambda s: set(re.findall(r'[a-z]{4,}', s.lower()))
for src, f in (('phc', 'phc.txt'),):
    names = cond_index(f); titles = [(c['title'].lower(), words(c['title'])) for c in conds if c['src'] == src]
    alltext = [re.sub(r'\s+', ' ', (c['title'] + ' ' + c['text']).lower()) for c in conds if c['src'] == src]
    hit = [n for n in names if any(n in t or (words(n) and words(n) <= w) for t, w in titles) or any(n in a for a in alltext)]
    hit_title = len(hit)
    wsets = [words(a) for a in alltext]
    hit = [n for n in names if n in hit or (words(n) and any(words(n) <= w for w in wsets))]
    cov['conditions_' + src] = dict(index_entries=len(names), found=len(hit), pct=round(100 * len(hit) / max(1, len(names)), 1), pct_own_section=round(100 * hit_title / max(1, len(names)), 1), missing=[n for n in names if n not in hit][:60])

stats = dict(cards=len(out), with_doses=sum(1 for c in out if c['doses']), index_only=sum(1 for c in out if c.get('indexOnly')), with_schedule=sum(1 for c in out if c['schedule']), with_enc=sum(1 for c in out if c['enc']), classes=sum(1 for c in out if c['class_']), conditions=len(conds))
cov['stats'] = stats
json.dump(cov, open(HERE + r'\coverage.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(json.dumps({k: (v if k == 'stats' else {a: b for a, b in v.items() if not isinstance(b, list)}) for k, v in cov.items()}, indent=1))
for k, v in cov.items():
    for a in ('not_found_in_text', 'missing'):
        if a in v: print(k, a.upper(), v[a][:40])
print('sizes MB:', {f: round(os.path.getsize(HERE + '\\' + f) / 1048576, 2) for f in ('medicines.json', 'conditions.json')})
