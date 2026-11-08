"""Pull a short 'what it is' and 'side effects' extract for each medicine card from the Kiwix Wikipedia medicine collection.
Usage: python med_enc.py   (needs libzim in .\\venv-libs and the .zim in .\\dl)   -> enc.json"""
import sys, os, re, json, html
HERE = r'C:\Users\sizo1\Documents\blackout-tools\medical'
sys.path.insert(0, HERE + r'\venv-libs')
from libzim.reader import Archive
from html.parser import HTMLParser
ZIM = HERE + r'\dl\wikipedia_en_medicine_nopic_2026-10.zim'
a = Archive(ZIM)
print('entries', a.entry_count, 'articles', a.article_count)

class P(HTMLParser):
    """collects paragraphs and the heading each belongs to"""
    def __init__(self): super().__init__(); self.out = []; self.head = ''; self.cur = None; self.mode = None; self.skip = 0
    def handle_starttag(self, t, at):
        if t in ('table', 'style', 'script', 'sup'): self.skip += 1
        if t == 'p' and not self.skip: self.cur = []; self.mode = 'p'
        elif t in ('h2', 'h3'): self.cur = []; self.mode = 'h'
    def handle_endtag(self, t):
        if t in ('table', 'style', 'script', 'sup'): self.skip = max(0, self.skip - 1)
        if t == 'p' and self.mode == 'p' and self.cur is not None:
            s = re.sub(r'\s+', ' ', ''.join(self.cur)).strip()
            if s: self.out.append((self.head, s))
            self.cur = None; self.mode = None
        elif t in ('h2', 'h3') and self.mode == 'h':
            self.head = re.sub(r'\s+', ' ', ''.join(self.cur)).strip().lower(); self.cur = None; self.mode = None
    def handle_data(self, d):
        if self.cur is not None and not self.skip: self.cur.append(d)

def article(title):
    for path in (title, 'A/' + title, title.replace(' ', '_')):
        try:
            e = a.get_entry_by_path(path)
            for _ in range(4):
                if e.is_redirect: e = e.get_redirect_entry()
                else: break
            if e.is_redirect: continue
            it = e.get_item()
            if 'html' not in it.mimetype: continue
            return e.title, bytes(it.content).decode('utf8', 'replace')
        except KeyError:
            continue
        except Exception as ex:
            continue
    return None, None

def variants(name):
    n = name.strip()
    base = re.sub(r'\s+', ' ', n)
    first = re.split(r'\s\d|%|,|\(', base)[0].strip()
    cands = [base.capitalize(), base.title(), base.upper(), first.capitalize(), re.sub(r' (bp|soluble|oral|depot|bolus)$', '', first, flags=re.I).capitalize()]
    if ' with ' in first.lower(): cands.append(re.split(r' with ', first, flags=re.I)[0].capitalize())
    if '/' in base:
        cands += [x.strip().capitalize() for x in base.split('/')]  # combination products: try the first part
    if base.endswith(' acid'): cands.append(base.capitalize())
    out = []
    for c in cands:
        if c not in out: out.append(c)
    return out

NOT_DRUG = re.compile(r'(may refer to|disambiguation|is a (?:city|town|village|surname|given name))', re.I)
def extract(title, htmlsrc):
    p = P(); p.feed(htmlsrc)
    paras = [(h, re.sub(r'\[\s*\w*\s*\d*\s*\]', '', s)) for h, s in p.out]
    lead = next(((h, s) for h, s in paras if h == '' and len(s) > 80), None)
    if not lead or NOT_DRUG.search(lead[1][:200]): return None
    lead_txt = lead[1]
    if len(lead_txt) > 640: lead_txt = lead_txt[:640].rsplit('. ', 1)[0] + '.'
    eff = None
    for h, s in paras:
        if re.search(r'(adverse effects|side effects|adverse reactions|contraindications|safety)', h) and len(s) > 60:
            eff = s if len(s) <= 560 else s[:560].rsplit('. ', 1)[0] + '.'; break
    return dict(title=title, lead=lead_txt, effects=eff, url='https://en.wikipedia.org/wiki/' + title.replace(' ', '_'))

cards = json.load(open(HERE + r'\medicines.json', encoding='utf8'))
enc = {}; miss = []
for c in cards:
    if c.get('class_'): continue
    key = c['name'].lower()
    got = None
    for v in variants(c['name']) + [x.capitalize() for x in (c.get('aka') or []) if len(x) > 3]:
        t, h = article(v)
        if h:
            r = extract(t, h)
            if r: got = r; break
    if got:
        # medicine cards are keyed by the same canonical key used in med_build.py (the lowercase card name)
        enc[re.sub(r'\s+', ' ', c['name']).lower()] = got
    else: miss.append(c['name'])
json.dump(enc, open(HERE + r'\enc.json', 'w', encoding='utf8'), ensure_ascii=False)
print('with extract', len(enc), 'of', sum(1 for c in cards if not c.get('class_')), '; not found', len(miss))
print('NOT FOUND sample', miss[:60])
