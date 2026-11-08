"""Parse the South African STG/EML text (from pdftotext -layout) into condition chunks and per-medicine dose lines.
Usage: python stg_parse.py   -> writes parsed.json and prints statistics."""
import re, json, sys, collections
HERE = r'C:\Users\sizo1\Documents\blackout-tools\medical'
SRC = {
    'phc': dict(file=HERE + r'\txt\phc.txt', name='Primary Healthcare STGs and EML, 7th edition, 2020', level='primary healthcare clinic'),
    'paed': dict(file=HERE + r'\txt\paed.txt', name='Paediatric Hospital Level STGs and EML, 2023 edition (updated July 2024)', level='hospital (children)'),
    'adult': dict(file=HERE + r'\txt\adult.txt', name='Adult Hospital Level STGs and EML, 6th edition, 2024', level='hospital'),
}
HEAD = re.compile(r'^\s{0,6}(\d{1,2}(?:\.\d{1,2}){1,3})\.?\s+([A-Z][A-Z0-9 ,;:()/\'\-\u2013&\.\+%]{3,90})\s*$')
ROUTES = r'(oral|parenteral|topical|inhalation|inhaler|IM|IV|SC|rectal|ophthalmic|ophthalmic drops|ophthalmic ointment|sublingual|intranasal|nasal|vaginal|per vaginam|intradermal|intravenous|intramuscular|subcutaneous|otic|ear drops|buccal|transdermal|nebulised|nebulization|mouthwash|suppository|suppositories|pessary|cream|ointment|lotion|gel|spray|solution|drops|syrup)'
# a dose line: "Paracetamol, oral, 1 g 4-6 hourly when required."  (optionally preceded by a bullet glyph)
DOSE = re.compile(r'^[\s\u2022\uf0b7\ufffd\u25cf\u25aa\-o]*([A-Z][A-Za-z0-9/\-\(\) %\.\+]{2,70}?),\s*(?:' + ROUTES + r'(?:[^,]{0,25})?),?\s*(.+)$')
AUD = re.compile(r'^\s*(Adults?(?: and adolescents)?|Children[^:\n]{0,40}|Child[^:\n]{0,30}|Infants?[^:\n]{0,30}|Neonates?[^:\n]{0,30}|Adolescents?[^:\n]{0,30}|Pregnan[^:\n]{0,40}|Breastfeeding[^:\n]{0,30}|Elderly[^:\n]{0,20}|Women[^:\n]{0,40})\s*:?\s*(?:LoE.*)?$', re.I)
FOOT = re.compile(r'^\s*(?:20\d\d\s+\d{1,2}\.\d{1,3}|\d{1,2}\.\d{1,3}\s+20\d\d|CHAPTER\s+\d+.*|\s*[ivxlc]+\s*)\s*$')

def clean_lines(txt):
    pages = txt.split('\f'); out = []
    for pi, pg in enumerate(pages):
        for ln in pg.split('\n'):
            if FOOT.match(ln): continue
            ln = ln.replace('\ufffd', '\u2022').replace('\uf0b7', '\u2022').rstrip()
            out.append((pi + 1, ln))
    return out

def norm(n):
    n = re.sub(r'\s+', ' ', n.strip().strip('\u2022- ').strip())
    n = re.sub(r'\s*\((?:e\.g\.|see)[^)]*\)', '', n)
    return n

def parse(key):
    meta = SRC[key]; txt = open(meta['file'], encoding='utf8', errors='replace').read()
    lines = clean_lines(txt)
    # skip front matter/index: start at the first chapter heading "1 DENTAL AND ORAL" style
    chunks = []; cur = None
    for pg, ln in lines:
        m = HEAD.match(ln)
        if m and not re.search(r'\.{4,}', ln):
            ref, title = m.group(1), m.group(2).strip()
            if cur: chunks.append(cur)
            cur = dict(src=key, ref=ref, title=title, page=pg, lines=[])
            continue
        if cur is not None and ln.strip(): cur['lines'].append(ln.rstrip())
    if cur: chunks.append(cur)
    # keep real condition chunks: need some text and not a table of contents entry
    STOP = {'DESCRIPTION','CAUTION','WARNING','REFERRAL','NOTE','NOTES','GENERAL MEASURES','MEDICINE TREATMENT','DIAGNOSTIC CRITERIA','PREVENTION','MANAGEMENT','TREATMENT','INVESTIGATIONS','CAUSES','DIAGNOSIS','INTRODUCTION','PROPHYLAXIS','SCREENING','INDICATIONS','SEVERE','MILD','MODERATE','URGENT','EMERGENCY','CONTRAINDICATIONS'}
    for c in chunks:
        c['title'] = re.sub(r'\s+', ' ', c['title']).strip()
        for _ in range(2):
            if not c['lines']: break
            l0 = c['lines'][0].strip()
            if re.match(r"^[A-Z][A-Z0-9 ,;:()/'\-&\.\+%]{2,55}$", l0) and l0 not in STOP and not re.match(r'^[A-Z]\d{2}', l0) and (len(c['title']) >= 30 or re.search(r"((IN|OF|AT|AND|OR|WITH|FOR|THE|POST|TO|ON|NOT)|[(/,-])$", c['title'])):
                c['title'] = (c['title'] + ' ' + l0).strip(); c['lines'] = c['lines'][1:]
            else: break
    chunks = [c for c in chunks if len(c['lines']) >= 3]
    meds = collections.defaultdict(list)
    for c in chunks:
        aud = ''
        for i, ln in enumerate(c['lines']):
            a = AUD.match(ln)
            if a: aud = a.group(1).strip(); continue
            d = DOSE.match(ln)
            if d and 'See dosing' not in d.group(1):
                name = norm(d.group(1))
                if len(name) < 3 or name.lower() in ('see', 'note', 'maximum dose'): continue
                # join wrapped continuation lines (indented, not a bullet)
                rest = d.group(3).strip(); j = i + 1
                while j < len(c['lines']) and len(rest) < 260 and re.match(r'^\s{2,}\S', c['lines'][j]) and not DOSE.match(c['lines'][j]) and not c['lines'][j].lstrip().startswith(('\u2022', 'o ')): rest += ' ' + c['lines'][j].strip(); j += 1
                full = ln.strip(' \u2022-') .strip()
                meds[name.lower()].append(dict(name=name, src=key, ref=c['ref'], cond=c['title'], page=c['page'], aud=aud, route=(d.group(2) or ''), line=re.sub(r'\s+', ' ', (d.group(1) + ', ' + (d.group(2) or '') + ', ' + rest).replace(', ,', ',')).strip(', ')))
    return chunks, meds

if __name__ == '__main__':
    out = {}
    for k in SRC:
        ch, meds = parse(k)
        print(k, 'chunks', len(ch), 'medicine names with dose lines', len(meds), 'dose lines', sum(len(v) for v in meds.values()))
        out[k] = dict(chunks=[{x: c[x] for x in ('src', 'ref', 'title', 'page')} | {'text': '\n'.join(c['lines'])} for c in ch], meds=meds)
    json.dump(out, open(HERE + r'\parsed.json', 'w', encoding='utf8'), ensure_ascii=False)
    for k in out:
        top = sorted(out[k]['meds'].items(), key=lambda kv: -len(kv[1]))[:12]
        print(k, [(n, len(v)) for n, v in top])
        print(k, 'sample', json.dumps(out[k]['meds'].get('paracetamol', [])[:2], ensure_ascii=False)[:600])
