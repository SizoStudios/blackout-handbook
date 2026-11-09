"""Build the focused medical encyclopedia pack (Photos-style .bhmap container, pack 'ency') from the Kiwix Wikipedia medicine file.
Keeps: lead + medically useful sections of articles about conditions, symptoms, injuries, poisoning, infections, pregnancy, nutrition, anatomy,
tests/procedures, hygiene and medicines. Leaves out: taxonomy stubs, experimental compound codes, lists, institutions, news/outbreak-by-year pages,
history/culture/research/epidemiology sections, references, links, tables, pictures.
Usage: python ency_build.py [limit_entries]  -> ..\\Encyclopedia-Medical.bhmap + ency_report.json"""
import sys, re, json, gzip, struct, time, os, collections, io
sys.path.insert(0, r'C:\Users\sizo1\Documents\blackout-tools\medical\venv-libs')
from libzim.reader import Archive
HERE = r'C:\Users\sizo1\Documents\blackout-tools\medical'
OUT = r'C:\Users\sizo1\Documents\blackout-build\packs\Encyclopedia-Medical.bhmap'
a = Archive(HERE + r'\dl\wikipedia_en_medicine_nopic_2026-10.zim'); N = a.entry_count
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else N

STRIP = re.compile(r'<(script|style|table|sup|figure|math)[\s\S]*?</\1>', re.I)
EDIT = re.compile(r'<span[^>]*mw-editsection[\s\S]*?</span>\s*</span>|<span[^>]*mw-editsection[\s\S]*?</span>', re.I)
def to_text(h):
    h = STRIP.sub(' ', EDIT.sub(' ', h))
    h = re.sub(r'<li[^>]*>', '\n\u2022 ', h); h = re.sub(r'</(p|div|ul|ol|dd|dl)>|<br\s*/?>', '\n', h)
    h = re.sub(r'<[^>]+>', '', h); h = html_unescape(h)
    h = re.sub(r'\[\s*(?:\d+|citation needed|edit|[a-z])\s*\]', '', h, flags=re.I)
    h = re.sub(r'\s*\(\s*(?:listen\)?\s*)?/[^/()]{2,60}/[^()]{0,40}\)', '', h)
    h = re.sub(r'[ \t\u00a0]+', ' ', h); h = re.sub(r'\s*\n\s*', '\n', h)
    return h.strip()
import html as _html
html_unescape = _html.unescape

BLOCK = re.compile(r'<(p|li)\b[^>]*>([\s\S]*?)</\1>', re.I)
def part_text(h, only_p=False):
    out = []
    for m in BLOCK.finditer(h):
        kind = m.group(1).lower()
        if only_p and kind != 'p': continue
        t = to_text(m.group(2))
        if t: out.append(('• ' + t) if kind == 'li' else t)
    return chr(10).join(out)

def sections(raw):
    raw = STRIP.sub(' ', raw)
    parts = re.split(r'(<h[23][^>]*>[\s\S]*?</h[23]>)', raw)
    out = []; cur = ['', []]
    for p in parts:
        if re.match(r'<h[23]', p):
            out.append(cur); cur = [re.sub(r'\s+', ' ', _html.unescape(re.sub(r'<[^>]+>', '', EDIT.sub('', p)))).replace('[edit]', '').strip(), []]
        else: cur[1].append(p)
    out.append(cur)
    return [(h, part_text(''.join(b), only_p=(i == 0))) for i, (h, b) in enumerate(out)]

KEEP_SEC = re.compile(r'(sign|symptom|cause|pathophys|pathogen|mechanism|diagnos|classif|prevent|treat|manage|medic|therap|^uses?$|\buses\b|adverse|side effect|contraind|interaction|pharmac|dos[ae]|overdose|complication|prognos|structure|function|clinical|first aid|risk|screen|procedure|technique|indication|recover|presentation|transmission|anatomy|physiology|definition|overview|detection|safety|pregnan|children|elderly|storage|administration|effects|description|characteristics|types|signs|testing|test|measurement|interpretation|preparation|prophylaxis|vaccin|immun|nutrition|diet|hygiene)', re.I)
DROP_SEC = re.compile(r'(history|society|culture|research|epidemiolog|etymolog|terminology|notable|econom|legal|regulation|brand|popular|see also|reference|external|further reading|notes|bibliograph|sources|citation|gallery|awards|controvers|names|in fiction|other animals|veterinary|criticism|public opinion|statistics|by country|geograph|incidence|prevalence)', re.I)
MEDHEAD = re.compile(r'(signs and symptoms|symptoms|^causes?$|diagnos|treatment|management|prevention|medical uses|adverse effects|side effects|pharmacology|mechanism of action|pathophysiology|complications|prognosis|clinical significance|first aid|risk factors|indications|contraindications|dosage|presentation|transmission|screening|structure|function)', re.I)
MEDLEAD = re.compile(r'\b(disease|disorder|syndrome|infection|injur|poison|symptom|medication|drug|antibiotic|vaccine|therapy|surgery|surgical|procedure|medical test|anatom|muscle|nerve|artery|vein|bone|gland|hormone|pregnan|childbirth|nutrition|vitamin|wound|burn|hygiene|sanitation|toxic|virus|bacteri|parasit|cancer|tumou?r|diabet|fever|pain|bleed|fracture|dehydrat|malnutrition|first aid|emergency|resuscitation|antidote|overdose|allerg|asthma|tubercul|malaria|hiv|aids)\b', re.I)
TAXON = re.compile(r'(is|are) (a|an|one of the) [^.]{0,40}(genus|species|subspecies|strain)|species of (bacteri|fung|archae|virus|plant|insect|mite|tick|flea)|(is|are) (a|an) (family|order|class|clade) of (bacteria|fungi|viruses|archaea|plants|insects|mites|ticks|fleas|flies|beetles)', re.I)
CODE = re.compile(r'^([A-Z]{1,5}[- ]?\d{2,}[A-Za-z0-9\-]*|\d[\w\-]*)$')
JUNKT = re.compile(r'^(List of|Lists of|Wikipedia:|Glossary|Index of|Outline of|Timeline of|Template:|Category:|Portal:|Book:)')
EXP = re.compile(r'\b(experimental|investigational|research chemical|designer drug|has not been (approved|marketed)|never marketed|was a drug candidate|drug candidate)\b', re.I)
INST = re.compile(r'\b(University|Institute|Hospitals?|Society|Association|Foundation|Journal|College|Academy|Council|Organi[sz]ation|Agency|Ministry|Department of|Programme|Program|Centre|Center|Clinic|Trust|Commission|Federation|Network|Alliance|Fund|Awards?|Prize|Conference|Congress|Medal|School of|Faculty)\b')
NEWS = re.compile(r'^(1[5-9]|20)\d\d\b|\b(19|20)\d\d\b[^.]{0,30}\b(outbreak|pandemic|epidemic)\b|\b(outbreak|epidemic|pandemic)s? in\b| by (country|year|region)\b|\bin (fiction|popular culture|film|literature|the media)\b|\bin (the )?(United States|United Kingdom|India|China|Canada|Australia|Germany|France|Italy|Japan|Brazil|Russia|Spain|Iran|Pakistan|Nigeria|England|Scotland|Wales|Ireland|Europe|Asia|Taiwan|Korea|Israel|Mexico)\b', re.I)

alias = collections.defaultdict(list); tmap = {}
t0 = time.time(); blob = open(HERE + r'\ency_blob.bin', 'wb'); recs = []  # (key, offset, length)
titles = []; idx = {'t': collections.defaultdict(list), 'l': collections.defaultdict(list), 'b': collections.defaultdict(list)}
STOP = set('the and for are was were with from that this have has had not but its their they them his her she him who whom which what when where while also may can could would should will shall been being into than then there these those such more most other some any each both many much very only over under between about after before during within without through including include includes used using use such as per one two three often usually commonly typically generally however although because therefore'.split())
def toks(s): return [w[:-1] if len(w) > 4 and w.endswith('s') and not w.endswith('ss') else w for w in re.findall(r'[a-z][a-z\-]{2,}', s.lower()) if w not in STOP]
off = 0; kept = 0; seen_red = 0; stats = collections.Counter(); size_text = 0
for i in range(min(N, LIMIT)):
    if i % 20000 == 0: print(f'[{int(time.time() - t0)}s] {i}/{N} entries, kept {kept}', flush=True)
    try:
        e = a.get_entry_by_id(i)
        if e.is_redirect:
            seen_red += 1
            try:
                tg = e.get_redirect_entry().title
                if tg and tg.lower() != e.title.lower(): alias[tg.lower()].append(e.title)
            except Exception: pass
            continue
        it = e.get_item()
        if 'html' not in it.mimetype: stats['nonhtml'] += 1; continue
        title = e.title; raw = bytes(it.content).decode('utf8', 'replace')
        mm = re.search(r"URL='\./([^'#]+)", raw[:600]) if len(raw) < 700 else None
        if mm:
            import urllib.parse as _u
            tg = _u.unquote(mm.group(1)).replace('_', ' ')
            if tg.lower() != title.lower(): alias[tg.lower()].append(title)
            stats['html_redirect'] += 1; continue
    except Exception: stats['error'] += 1; continue
    if JUNKT.match(title) or CODE.match(title): stats['junk_title'] += 1; continue
    S = sections(raw)
    lead = S[0][1]
    if len(lead) < 60: stats['no_lead'] += 1; continue
    if TAXON.search(lead[:400]): stats['taxonomy'] += 1; continue
    if EXP.search(lead[:400]): stats['experimental'] += 1; continue
    heads = [h for h, _ in S[1:]]
    med = any(MEDHEAD.search(h) for h in heads)
    if not (med or MEDLEAD.search(lead[:500])): stats['not_medical'] += 1; continue
    if not med and INST.search(title): stats['institution'] += 1; continue
    if NEWS.search(title): stats['news_or_country'] += 1; continue
    kept_secs = [['', lead]]
    for h, t in S[1:]:
        if not t or len(t) < 40: continue
        if DROP_SEC.search(h) or not KEEP_SEC.search(h): continue
        kept_secs.append([h, t])
    total = 0; capped = []
    for h, t in kept_secs:
        if total >= 14000: break
        t = t[:max(0, 14000 - total)]; total += len(t); capped.append([h, t])
    if total < 350: stats['too_short'] += 1; continue
    aid = kept; kept += 1; size_text += total
    data = gzip.compress(json.dumps({'t': title, 's': capped, 'u': 'https://en.wikipedia.org/wiki/' + title.replace(' ', '_')}, ensure_ascii=False, separators=(',', ':')).encode('utf8'), 9)
    blob.write(data); recs.append((f'e/a/{aid}', off, len(data))); off += len(data)
    titles.append([aid, title, re.sub(r'\s+', ' ', lead)[:120]])
    tmap[title.lower()] = aid
    tt = set(toks(title)); ll = set(toks(lead[:400])) - tt
    freq = collections.Counter(w for _, t in capped[1:] for w in toks(t)); bb = [w for w, c in freq.most_common(45) if w not in tt and w not in ll]
    for w in tt: idx['t'][w].append(aid)
    for w in ll: idx['l'][w].append(aid)
    for w in bb: idx['b'][w].append(aid)
blob.close()
# alternative names (redirects) become extra title words of the article they point to, so "hands free cpr" finds CPR
added = 0
for tg, names in alias.items():
    aid = tmap.get(tg)
    if aid is None: continue
    have = set(w for w, ids in idx['t'].items() if ids and ids[-1] == aid)
    for nm in names[:8]:
        for w in set(toks(nm)):
            if w not in have: idx['t'][w].append(aid); have.add(w); added += 1
for k in idx:
    for w in idx[k]: idx[k][w] = sorted(set(idx[k][w]))
print('alias words added', added)
def delta(d): return {w: [ids[0]] + [b - a for a, b in zip(ids, ids[1:])] for w, ids in d.items() if ids}
# terms found in more than 40% of articles are dropped (they carry no information)
big = kept * 0.4
for k in idx: idx[k] = {w: v for w, v in idx[k].items() if len(v) <= big}
extra = {'e/t': gzip.compress(json.dumps(titles, ensure_ascii=False, separators=(',', ':')).encode('utf8'), 9),
         'e/s': gzip.compress(json.dumps({k: delta(v) for k, v in idx.items()}, separators=(',', ':')).encode('utf8'), 9)}
bf = open(HERE + r'\ency_blob.bin', 'ab')
for k, d in extra.items(): bf.write(d); recs.append((k, off, len(d))); off += len(d)
bf.close()
hd = json.dumps({'pack': 'ency', 'region': 'med', 'name': 'Medical encyclopedia (focused): conditions, injuries, poisoning, first aid, infections, anatomy, tests and medicines. Wikipedia extracts, October 2026', 'version': 1, 'created': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                 'info': {'articles': kept, 'source': 'Wikipedia English medicine collection (Kiwix nopic 2026-10)', 'note': 'Lead and medically useful sections only; no references, tables or pictures.'},
                 'licence': 'Text from Wikipedia, licensed CC BY-SA. Each article names its title and address. Short extracts only; edited for length.',
                 'entries': [{'k': k, 'o': o, 'l': l} for k, o, l in recs]}, ensure_ascii=False).encode('utf8')
with open(OUT, 'wb') as f:
    f.write(b'BHMAP1\n' + struct.pack('<I', len(hd)) + hd)
    with open(HERE + r'\ency_blob.bin', 'rb') as b:
        while True:
            c = b.read(1 << 22)
            if not c: break
            f.write(c)
os.remove(HERE + r'\ency_blob.bin')
rep = dict(kept=kept, redirects=seen_red, dropped=dict(stats), text_mb=round(size_text / 1048576, 1), pack_mb=round(os.path.getsize(OUT) / 1048576, 1), index_kb={k: len(v) // 1024 for k, v in extra.items()}, seconds=int(time.time() - t0))
json.dump(rep, open(HERE + r'\ency_report.json', 'w'), indent=1); print(json.dumps(rep, indent=1))
