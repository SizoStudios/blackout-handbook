(function () {
'use strict';
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const LIB = window.LIB || { cats: [], items: [] };
const PH = window.PHRASES || { langs: [], rows: [] };
const view = $('#view');

/* ---------- storage (IndexedDB, memory fallback) ---------- */
const DB = {
  db: null, mem: { kv: {}, inv: {}, photos: {}, mapdata: {} },
  async open() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('blackout-handbook', 2);
        r.onupgradeneeded = () => { ['kv', 'inv', 'photos', 'mapdata'].forEach(n => { if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, { keyPath: 'k' }); }); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    } catch (e) { this.db = null; }
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
  },
  req(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode), r = fn(t.objectStore(store));
      t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error);
    });
  },
  async get(s, k) { return this.db ? this.req(s, 'readonly', o => o.get(k)) : this.mem[s][k]; },
  async put(s, v) { if (this.db) return this.req(s, 'readwrite', o => o.put(v)); this.mem[s][v.k] = v; },
  async del(s, k) { if (this.db) return this.req(s, 'readwrite', o => o.delete(k)); delete this.mem[s][k]; },
  async all(s) { return this.db ? this.req(s, 'readonly', o => o.getAll()) : Object.values(this.mem[s]); },
  async clear(s) { if (this.db) return this.req(s, 'readwrite', o => o.clear()); this.mem[s] = {}; }
};
const kvGet = async (k, d) => { const r = await DB.get('kv', k); return r ? r.v : d; };
const kvSet = (k, v) => DB.put('kv', { k, v, u: Date.now() });

/* ---------- tiny markdown ---------- */
function md(src) {
  const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const out = []; let list = null, tbl = null, para = [];
  const fP = () => { if (para.length) { out.push('<p>' + inl(para.join(' ')) + '</p>'); para = []; } };
  const fL = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  const fT = () => { if (tbl) { out.push('<div class="tw"><table>' + tbl.map((r, i) => '<tr>' + r.map(c => (i ? '<td>' : '<th>') + inl(c) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table></div>'); tbl = null; } };
  for (const raw of String(src).replace(/\r/g, '').split('\n')) {
    const l = raw.trim(); let m;
    if (!l) { fP(); fL(); fT(); continue; }
    if (l[0] === '|') { fP(); fL(); (tbl = tbl || []).push(l.replace(/^\||\|$/g, '').split('|').map(s => s.trim())); continue; }
    fT();
    if ((m = l.match(/^## (.+)/))) { fP(); fL(); out.push('<h3>' + inl(m[1]) + '</h3>'); continue; }
    if ((m = l.match(/^! (.+)/))) { fP(); fL(); out.push('<div class="warn">' + inl(m[1]) + '</div>'); continue; }
    if ((m = l.match(/^> (.+)/))) { fP(); fL(); out.push('<div class="note">' + inl(m[1]) + '</div>'); continue; }
    if ((m = l.match(/^- (.+)/))) { fP(); if (list !== 'ul') { fL(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inl(m[1]) + '</li>'); continue; }
    if ((m = l.match(/^\d+\. (.+)/))) { fP(); if (list !== 'ol') { fL(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inl(m[1]) + '</li>'); continue; }
    fL(); para.push(l);
  }
  fP(); fL(); fT();
  return out.join('');
}

/* ---------- search ---------- */
const byId = {}; LIB.items.forEach(i => { byId[i.id] = i; i._t = (i.title + ' ' + (i.tags || '')).toLowerCase(); i._b = i.body.toLowerCase(); });
const catById = {}; LIB.cats.forEach(c => catById[c.id] = c);
const SYN = {
  pipe: ['gas', 'lpg', 'leak'], pipes: ['gas', 'lpg', 'leak'], burst: ['leak', 'gas'], leak: ['gas', 'lpg'], leaking: ['gas', 'lpg'], pollution: ['smoke', 'gases', 'fumes', 'air'],
  fumes: ['gases', 'smoke', 'monoxide'], toxic: ['gases', 'poison'], chemical: ['chem', 'mixing', 'poison'], chemicals: ['chem', 'mixing', 'poison'], spill: ['chem', 'fuel', 'fluids'],
  purify: ['water', 'boil', 'bleach'], rainwater: ['rain', 'water'], clean: ['water', 'wound'], sterilise: ['boil', 'bleach'], kill: ['boil', 'bleach'],
  cut: ['wound', 'bleeding'], blood: ['bleeding', 'tourniquet'], gun: ['firearm', 'calibre'], pistol: ['firearm', '9mm'], rifle: ['firearm', 'calibre'],
  bullet: ['ammunition', 'calibre'], bomb: ['ordnance', 'blast', 'unexploded'], shell: ['ordnance', 'blast'], grenade: ['ordnance'], mine: ['ordnance'],
  hurt: ['wound', 'injury'], broken: ['fracture', 'splint'], bone: ['fracture'], hungry: ['food'], thirsty: ['water', 'dehydration'], drink: ['water'],
  poison: ['poisoning', 'toxic'], snake: ['snakes', 'bite'], bite: ['snakes', 'spiders', 'ticks'], sting: ['scorpions', 'allergic'], spider: ['spiders'],
  cold: ['warmth', 'hypothermia'], hot: ['heat', 'heatstroke'], smoke: ['air', 'fire'], gas: ['lpg', 'gases', 'monoxide'], fuel: ['petrol', 'diesel'],
  car: ['vehicle', 'battery'], battery: ['batteries', 'solar'], wire: ['wiring', 'mains'], plug: ['wiring', 'socket'], mushroom: ['fungi', 'plants'],
  toilet: ['sanitation', 'latrine'], loo: ['sanitation'], pain: ['paracetamol', 'ibuprofen'], tablets: ['medicines', 'dose'], dose: ['medicines'],
  baby: ['infant', 'formula'], pregnant: ['birth', 'pregnancy'], tooth: ['dental'], eye: ['eyes'], light: ['lighting', 'torch'], fridge: ['spoil'],
  nuclear: ['fallout', 'radiation', 'radioactive'], atomic: ['fallout', 'radiation', 'nuclear'], radiation: ['fallout', 'radioactive', 'nuclear'], radioactive: ['fallout', 'radiation', 'nuclear'], fallout: ['radiation', 'radioactive', 'nuclear'], reactor: ['nuclear', 'radiation', 'koeberg'],
  zombie: ['outbreak', 'infected', 'rabies'], zombies: ['outbreak', 'infected', 'rabies'], outbreak: ['infectious', 'disease', 'spread'], infected: ['outbreak', 'infectious', 'sick'], virus: ['outbreak', 'infectious', 'spread'], pandemic: ['outbreak', 'infectious'], epidemic: ['outbreak', 'infectious'], rabid: ['rabies'],
  lost: ['separated', 'navigation'], scared: ['stress', 'panic'], thief: ['security', 'de-escalating'], robbery: ['de-escalating'], zulu: ['phrases'], translate: ['phrases']
};
const toks = q => q.toLowerCase().split(/[^a-z0-9À-ɏ]+/).filter(Boolean);
const STOP = new Set('a an the i me my we our you your is are am be do does did how what when where why which who can could should would will to of for and or in on at it its this that with from if as by about there any some get have has suggestion suggest advice please tell explain give make unknown thing things something need want know use using after before someone somebody without best way ways good okay'.split(' '));
const search = q => searchScored(q).map(r => r.i);
window.BH = { searchScored }; // used for testing
const idfCache = new Map();
function searchScored(q) {
  const all = toks(q);
  const ts = all.filter(t => !STOP.has(t));
  if (!ts.length) return [];
  const score = (i, t) => {
    let h = 0;
    if (i.title.toLowerCase().includes(t)) h += 6;
    if (i._t.includes(t)) h += 3;
    // A whole-word hit in the title or tags beats a hit inside a longer word (fire vs firearm).
    if (h && new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es)?\\b', 'i').test(i.title + ' ' + (i.tags || ''))) h += 8;
    const n = i._b.split(t).length - 1; if (n) h += Math.min(n, 5);
    return h;
  };
  // Guides matching every word come first; guides matching at least half the words follow.
  // Long questions only need a third of their key words to match; short ones need one.
  const NDOC = LIB.items.length, idf = t => { if (!idfCache.has(t)) { let df = 0; for (const i of LIB.items) if (i._t.includes(t) || i._b.includes(t)) df++; idfCache.set(t, 0.4 + 1.2 * (1 - df / NDOC)); } return idfCache.get(t); };
  const need = ts.length <= 2 ? 1 : Math.max(1, Math.ceil(ts.length * 0.34)), res = [];
  for (const i of LIB.items) {
    let s = 0, n = 0;
    for (const t of ts) {
      let h = score(i, t);
      for (const alt of SYN[t] || []) h = Math.max(h, Math.round(score(i, alt) * .8));
      if (h) { n++; s += h * idf(t); }
    }
    if (n >= need) res.push({ i, s, full: n === ts.length, n, t: ts.length });
  }
  return res.sort((a, b) => (b.s - a.s) || (b.n - a.n)).slice(0, 40);
}
function snippet(i, q) {
  // Only real words (3+ letters, not filler); never the letters of HTML entities such as &amp;.
  const NOT_WORDS = new Set(['amp', 'quot', 'lt', 'gt']);
  const ts = [...new Set(toks(q).filter(t => t.length >= 3 && !STOP.has(t)).flatMap(t => [t].concat(SYN[t] || [])).filter(t => t.length >= 3 && !NOT_WORDS.has(t)))];
  const b = i.body.replace(/^[#!>|\-\d. ]+/gm, '').replace(/[|*]/g, ' ').replace(/\s+/g, ' ');
  const low = b.toLowerCase(); let p = -1;
  for (const t of ts) { const x = low.indexOf(t); if (x >= 0 && (p < 0 || x < p)) p = x; }
  const st = Math.max(0, p - 40); let out = esc(b.slice(st, st + 130));
  // One pass over the text, so already-inserted <mark> tags are never matched again.
  if (ts.length) out = out.replace(new RegExp('(' + ts.sort((a, c) => c.length - a.length).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig'), '<mark>$1</mark>');
  return (st ? '…' : '') + out + '…';
}

/* ---------- views ---------- */
let favs = [];
const setTab = t => document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.t === t));
const itemCard = (i, extra) => `<a class="card" href="#/e/${i.id}"><b>${esc(i.title)}${i.verify ? '<span class="badge">check locally</span>' : ''}</b><span>${esc((catById[i.cat] || {}).title || '')}</span>${extra || ''}</a>`;

async function vHome() {
  setTab('home');
  const quick = byId['quick-sheet'];
  const favItems = favs.map(f => byId[f]).filter(Boolean);
  view.innerHTML = `<h1>Blackout Handbook</h1>
  <p class="dim">Everything here works with no signal. Tap a topic or search above.</p>
  ${quick ? `<a class="card" style="border-color:var(--bad)" href="#/e/quick-sheet"><b>Quick sheet: the critical facts</b><span>Read this first if you are short of time.</span></a>` : ''}
  ${favItems.length ? `<h2>Starred</h2><div class="list">${favItems.map(i => itemCard(i)).join('')}</div>` : ''}
  <h2>My tools</h2>
  <div class="grid"><a class="card" href="#/gobag"><b>Go-bag checklist</b><span>Tick what is packed</span></a><a class="card" href="#/people"><b>My people</b><span>Medical needs, contacts</span></a><a class="card" href="#/notes"><b>Notes</b><span>Private, saved on this device</span></a></div>
  <h2>Topics</h2>
  <div class="grid">${LIB.cats.slice().sort((a, b) => a.order - b.order).map(c => `<a class="card" href="#/cat/${c.id}"><b>${esc(c.title)}</b><span>${esc(c.blurb)} (${LIB.items.filter(i => i.cat === c.id).length})</span></a>`).join('')}</div>
  <p class="dim" style="margin-top:1.5rem">Written from general knowledge, not checked online. Items marked “check locally” should be confirmed with a qualified person when you can. This is not a substitute for professional medical, legal or technical help.</p>`;
}
function vCat(id) {
  setTab('home'); const c = catById[id]; if (!c) return vHome();
  view.innerHTML = `<h1>${esc(c.title)}</h1><p class="dim">${esc(c.blurb)}</p><div class="list">${LIB.items.filter(i => i.cat === id).map(i => itemCard(i)).join('')}</div>`;
}
function vEntry(id) {
  setTab('home'); const i = byId[id]; if (!i) return vHome();
  const c = catById[i.cat] || {};
  const back = id === 'quick-sheet' ? ['#/', 'Library'] : ['#/cat/' + i.cat, c.title || 'Back'];
  view.innerHTML = `<p class="dim"><a href="${esc(back[0])}">&larr; ${esc(back[1])}</a></p>
  <div class="row"><h1 class="grow" style="margin:0">${esc(i.title)}</h1><button class="star" id="fav" aria-label="Star">${favs.includes(id) ? '★' : '☆'}</button></div>
  ${i.verify ? '<div class="note">Check locally: details such as doses, laws or species vary. Confirm with a qualified person when you can.</div>' : ''}
  ${md(i.body)}`;
  $('#fav').onclick = async () => { favs = favs.includes(id) ? favs.filter(x => x !== id) : favs.concat(id); await kvSet('favs', favs); $('#fav').textContent = favs.includes(id) ? '★' : '☆'; };
  window.scrollTo(0, 0);
}
function vSearch(q) {
  setTab('home'); const r = search(q);
  view.innerHTML = `<h1>Search</h1><p class="dim">${r.length} result${r.length === 1 ? '' : 's'} for “${esc(q)}”</p><div class="list">${r.map(i => itemCard(i, `<div class="snip">${snippet(i, q)}</div>`)).join('')}</div>${r.length ? '' : '<p>Nothing found. Try a simpler word, e.g. “burn”, “bleach”, “battery”.</p>'}`;
}

/* ---------- inventory ---------- */
const HZ = { food: 'Food', water: 'Water', med: 'Medicine / first aid', fuel: 'Fuel / flammable liquid', gas: 'Gas cylinder (LPG)', ammo: 'Ammunition', oxid: 'Pool chlorine / oxidiser', bleach: 'Bleach', acid: 'Acid / drain cleaner', amm: 'Ammonia cleaner', batt: 'Batteries', tool: 'Tools / hardware', other: 'Other' };
const LOC = ['Living area', 'Bedroom', 'Kitchen', 'Garage', 'Outside store', 'Vehicle', 'Other'];
const PAIRS = [
  ['bleach', 'acid', 'bad', 'Bleach + acid makes chlorine gas. Keep far apart, in different rooms.'],
  ['bleach', 'amm', 'bad', 'Bleach + ammonia makes toxic gas. Never store or mix together.'],
  ['oxid', 'acid', 'bad', 'Pool chlorine + acid makes chlorine gas.'],
  ['oxid', 'fuel', 'bad', 'Pool chlorine + fuel is a fire and explosion risk.'],
  ['oxid', 'amm', 'bad', 'Pool chlorine + ammonia makes toxic gas.'],
  ['fuel', 'ammo', 'bad', 'Fuel next to ammunition: any fire becomes much worse. Separate buildings if you can.'],
  ['fuel', 'gas', 'bad', 'Fuel and gas cylinders together: separate them and keep both outdoors, shaded.'],
  ['gas', 'ammo', 'warn', 'Keep gas cylinders and ammunition apart.'],
  ['fuel', 'batt', 'warn', 'Fuel and batteries: sparks from shorted batteries can ignite vapour.']
];
const CHEM = ['bleach', 'acid', 'amm', 'oxid', 'fuel'], EDIBLE = ['food', 'water', 'med'];
const STARTER = [
  ['Drinking water', 'water', 20, 'litres', 'Kitchen'], ['Tinned food', 'food', 20, 'tins', 'Kitchen'], ['Rice / pap / oats (dry)', 'food', 10, 'kg', 'Kitchen'],
  ['Water purification: unscented bleach', 'bleach', 1, 'bottle', 'Outside store'], ['Plasters and dressings', 'med', 1, 'kit', 'Living area'],
  ['Pain tablets (paracetamol)', 'med', 2, 'boxes', 'Living area'], ['Oral rehydration sachets', 'med', 10, 'sachets', 'Living area'],
  ['Tourniquet', 'med', 2, 'pcs', 'Living area'], ['Torch', 'batt', 2, 'pcs', 'Living area'], ['Spare batteries (AA)', 'batt', 16, 'pcs', 'Living area'],
  ['Hand-crank / battery radio', 'tool', 1, 'pcs', 'Living area'], ['Power bank', 'batt', 2, 'pcs', 'Living area'], ['Matches / lighters', 'tool', 5, 'pcs', 'Kitchen'],
  ['FFP2 / N95 masks', 'med', 10, 'pcs', 'Living area'], ['Gas stove cylinder', 'gas', 1, 'pcs', 'Outside store'], ['Paraffin / fuel (sealed)', 'fuel', 5, 'litres', 'Garage'],
  ['Duct tape and plastic sheeting', 'tool', 1, 'roll', 'Garage'], ['Blankets', 'tool', 4, 'pcs', 'Bedroom'], ['Toilet paper', 'other', 8, 'rolls', 'Bedroom'], ['Rubbish bags', 'other', 1, 'box', 'Kitchen']
];
let inv = [], photos = {};
async function loadInv() { inv = await DB.all('inv'); const ps = await DB.all('photos'); photos = {}; ps.forEach(p => photos[p.k] = p.data); }
function expState(d) { if (!d) return ''; const days = Math.floor((new Date(d) - new Date(new Date().toDateString())) / 864e5); return days < 0 ? 'bad' : days <= 30 ? 'soon' : 'ok'; }
function conflicts() {
  const out = [], by = {};
  inv.forEach(i => { (by[i.loc || 'Other'] = by[i.loc || 'Other'] || []).push(i); });
  for (const loc in by) {
    const g = by[loc], has = h => g.filter(x => x.hz === h);
    PAIRS.forEach(([a, b, sev, msg]) => { if (has(a).length && has(b).length) out.push({ sev, loc, msg: `${msg} (${has(a)[0].name} and ${has(b)[0].name}, in ${loc})` }); });
    CHEM.forEach(c => EDIBLE.forEach(e => { if (has(c).length && has(e).length && !(c === 'bleach' && e === 'water' && false)) out.push({ sev: 'warn', loc, msg: `${has(c)[0].name} stored with ${has(e)[0].name} (${loc}): chemicals and fumes can contaminate food, water and medicine.` }); }));
    if (['Living area', 'Bedroom', 'Kitchen'].includes(loc)) ['fuel', 'gas', 'ammo'].forEach(h => { if (has(h).length) out.push({ sev: 'bad', loc, msg: `${has(h)[0].name} is stored in the ${loc.toLowerCase()}. Move it to a cool, shaded, ventilated outside store.` }); });
    if (['Vehicle', 'Garage'].includes(loc)) ['food', 'med', 'water'].forEach(h => { if (has(h).length) out.push({ sev: 'warn', loc, msg: `${has(h)[0].name} in the ${loc.toLowerCase()}: heat spoils it quickly. Prefer a cool, dark indoor spot.` }); });
    if (loc === 'Vehicle') ['gas', 'ammo'].forEach(h => { if (has(h).length) out.push({ sev: 'bad', loc, msg: `${has(h)[0].name} in a vehicle: heat can build up dangerously.` }); });
  }
  const seen = new Set(); return out.filter(o => !seen.has(o.msg) && seen.add(o.msg));
}
async function vInv() {
  setTab('inventory'); await loadInv();
  const sorted = inv.slice().sort((a, b) => (a.loc || '').localeCompare(b.loc || '') || a.name.localeCompare(b.name));
  const cf = conflicts(), exp = inv.filter(i => expState(i.exp) === 'bad').length, soon = inv.filter(i => expState(i.exp) === 'soon').length;
  view.innerHTML = `<h1>Supplies</h1>
  <div class="row"><button class="pri" id="add">+ Add item</button>${inv.length ? '' : '<button id="starter">Add starter list</button>'}</div>
  <p class="dim">${inv.length} items · <span class="bad">${exp} expired</span> · <span class="soon">${soon} expiring within 30 days</span></p>
  ${cf.length ? `<h2>Storage safety (${cf.length})</h2>${cf.map(c => `<div class="${c.sev === 'bad' ? 'warn' : 'note'}">${esc(c.msg)}</div>`).join('')}` : inv.length ? '<div class="note">No storage clashes found from what you have listed. Keep lists up to date for this to be useful.</div>' : ''}
  <h2>Stock</h2><div class="list">${sorted.map(i => `<a class="card inv" href="#/inventory/${i.k}">${photos[i.k] ? `<img src="${photos[i.k]}" alt="">` : ''}<div class="t"><b>${esc(i.name)}</b> <span class="dim">× ${esc(i.qty)} ${esc(i.unit || '')}</span><br><span class="dim">${esc(i.loc || '')} · ${esc(HZ[i.hz] || '')}</span>${i.exp ? `<br><span class="${expState(i.exp)}">Expiry ${esc(i.exp)}</span>` : ''}</div></a>`).join('') || '<p class="dim">Nothing yet. Add your supplies, with a photo if you like, and the app will check storage and expiry for you.</p>'}</div>`;
  $('#add').onclick = () => invForm();
  const st = $('#starter'); if (st) st.onclick = async () => { for (const s of STARTER) await DB.put('inv', { k: uid(), name: s[0], hz: s[1], qty: s[2], unit: s[3], loc: s[4], exp: '', notes: '', u: Date.now() }); vInv(); };
}
function opts(o, sel) { return Object.entries(o).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(v)}</option>`).join(''); }
async function invForm(id) {
  const it = id ? inv.find(x => x.k === id) : null, v = it || { name: '', hz: 'other', qty: 1, unit: '', loc: 'Living area', exp: '', notes: '' };
  let photo = it ? photos[it.k] : null;
  const m = $('#modal'); m.hidden = false;
  m.innerHTML = `<div><h2 style="margin-top:0">${it ? 'Edit' : 'Add'} item</h2>
  <label>Name</label><input id="f_name" type="text" value="${esc(v.name)}">
  <div class="row"><div class="grow"><label>Quantity</label><input id="f_qty" type="number" step="any" value="${esc(v.qty)}"></div><div class="grow"><label>Unit</label><input id="f_unit" type="text" value="${esc(v.unit)}" placeholder="litres, tins…"></div></div>
  <label>Type (used for safety checks)</label><select id="f_hz">${opts(HZ, v.hz)}</select>
  <label>Where is it kept?</label><select id="f_loc">${LOC.map(l => `<option${l === v.loc ? ' selected' : ''}>${l}</option>`).join('')}</select>
  <label>Expiry date (optional)</label><input id="f_exp" type="date" value="${esc(v.exp)}">
  <label>Notes</label><textarea id="f_notes">${esc(v.notes)}</textarea>
  <label>Photo</label>
  <div class="row">${isNative() || matchMedia('(pointer:coarse)').matches ? '<button type="button" id="ph_cam">Take photo</button>' : ''}<button type="button" id="ph_pick">Choose photo</button></div>
  <input id="f_photo" type="file" accept="image/*" hidden><div id="pv">${photo ? `<img src="${photo}" style="max-width:100%;border-radius:8px;margin-top:6px">` : ''}</div>
  <div class="row"><button class="pri" id="save">Save</button><button id="cancel">Cancel</button>${it ? '<button class="dng" id="del">Delete</button>' : ''}</div></div>`;
  const take = async cam => {
    const d = await getPhoto(cam); if (!d) return;
    photo = d; $('#pv').innerHTML = `<img src="${photo}" style="max-width:100%;border-radius:8px;margin-top:6px">`;
  };
  $('#ph_pick').onclick = () => take(false);
  if ($('#ph_cam')) $('#ph_cam').onclick = () => take(true);
  $('#cancel').onclick = () => { m.hidden = true; };
  if (it) $('#del').onclick = async () => { if (confirm('Delete this item?')) { await DB.del('inv', it.k); await DB.del('photos', it.k); await tomb(it.k); m.hidden = true; location.hash = '#/inventory'; vInv(); } };
  $('#save').onclick = async () => {
    const name = $('#f_name').value.trim(); if (!name) { $('#f_name').focus(); return; }
    const k = it ? it.k : uid();
    await DB.put('inv', { k, name, qty: $('#f_qty').value, unit: $('#f_unit').value.trim(), hz: $('#f_hz').value, loc: $('#f_loc').value, exp: $('#f_exp').value, notes: $('#f_notes').value, u: Date.now() });
    if (photo) await DB.put('photos', { k, data: photo });
    m.hidden = true; location.hash = '#/inventory'; vInv();
  };
}
// Returns a small JPEG data URL, or null if cancelled. Uses the native camera/gallery in the Android app, a file picker elsewhere.
async function getPhoto(useCamera) {
  const C = isNative() && window.Capacitor.Plugins.Camera;
  if (C) {
    try { return (await C.getPhoto({ quality: 70, width: 900, resultType: 'dataUrl', source: useCamera ? 'CAMERA' : 'PHOTOS' })).dataUrl; }
    catch (e) { return null; }
  }
  return new Promise(res => {
    const i = $('#f_photo'); if (useCamera) i.setAttribute('capture', 'environment'); else i.removeAttribute('capture');
    i.value = ''; i.onchange = async () => res(i.files[0] ? await shrink(i.files[0]) : null); i.click();
  });
}
function shrink(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => { const s = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * s; c.height = im.height * s; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .72)); }; im.onerror = () => res(null); im.src = r.result; };
    r.readAsDataURL(file);
  });
}

/* ---------- go-bag, people, notes ---------- */
const GOBAG = [
  ['Water and food', ['Water (at least 2 L per person)', 'Water purification (bleach, tablets)', 'Ready-to-eat food for 3 days', 'Cup, spoon, small pot']],
  ['Health', ['First aid kit with tourniquet', 'Personal medicines (2 weeks)', 'Oral rehydration sachets', 'Masks (FFP2 / N95)', 'Hand sanitiser, soap, toilet paper']],
  ['Light and power', ['Torch or headlamp and spare batteries', 'Power bank, charged', 'Phone cable', 'Hand-crank or battery radio', 'Matches / lighter']],
  ['Warmth and shelter', ['Warm layers and a rain jacket', 'Blanket or space blanket', 'Plastic sheet and tape', 'Spare socks']],
  ['Documents and money', ['IDs and copies (waterproof bag)', 'Medical info and medicine list', 'Some cash in small notes', 'Decoy wallet with a little cash', 'Paper map of the area', 'Contact list on paper']],
  ['Tools', ['Multi-tool or knife', 'Rope or cord', 'Whistle', 'Pen and notebook', 'Spare keys']]
];
async function vGobag() {
  setTab('home'); const done = await kvGet('gobag', {});
  let tot = 0, n = 0; GOBAG.forEach(g => g[1].forEach(x => { tot++; if (gbOn(done[x])) n++; }));
  view.innerHTML = `<p class="dim"><a href="#/">&larr; Library</a></p><h1>Go-bag checklist</h1><p class="dim" id="gcount">${n} of ${tot} packed</p>
  ${GOBAG.map(g => `<h2>${esc(g[0])}</h2>${g[1].map(x => `<label style="display:flex;gap:10px;align-items:center;margin:0;padding:8px 0;color:var(--fg);font-size:1rem"><input type="checkbox" style="width:22px;height:22px" data-k="${esc(x)}"${gbOn(done[x]) ? ' checked' : ''}> ${esc(x)}</label>`).join('')}`).join('')}`;
  view.querySelectorAll('input[type=checkbox]').forEach(c => c.onchange = async () => { done[c.dataset.k] = { v: c.checked, u: Date.now() }; await kvSet('gobag', done); const k = Object.values(done).filter(gbOn).length; $('#gcount').textContent = `${k} of ${tot} packed`; });
}
async function vNotes() {
  setTab('home'); const t = await kvGet('notes', '');
  view.innerHTML = `<p class="dim"><a href="#/">&larr; Library</a></p><h1>Notes</h1><p class="dim">Saved on this device as you type. Included in backups.</p><textarea id="nt" style="min-height:60vh" placeholder="Meeting points, codes, who has what, things to remember…">${esc(t)}</textarea>`;
  let tm; $('#nt').oninput = e => { clearTimeout(tm); const v = e.target.value; tm = setTimeout(() => kvSet('notes', v), 400); };
}
async function vPeople() {
  setTab('home'); const ps = await kvGet('people', []);
  view.innerHTML = `<p class="dim"><a href="#/">&larr; Library</a></p><h1>My people</h1><p class="dim">Names, ages, medical needs and how to reach family. Everything stays on this device.</p>
  <div class="row"><button class="pri" id="padd">+ Add person</button></div>
  <div class="list">${ps.map(p => `<a class="card" href="#/people/${p.id}"><b>${esc(p.name)}${p.age ? ' · ' + esc(p.age) : ''}</b><span>${esc([p.blood && 'Blood ' + p.blood, p.cond, p.meds && 'Meds: ' + p.meds, p.contact].filter(Boolean).join(' · '))}</span></a>`).join('') || '<p class="dim">No one added yet.</p>'}</div>`;
  $('#padd').onclick = () => personForm(ps);
}
async function personForm(ps, id) {
  const p = ps.find(x => x.id === id) || { name: '', age: '', blood: '', cond: '', meds: '', contact: '' };
  const m = $('#modal'); m.hidden = false;
  m.innerHTML = `<div><h2 style="margin-top:0">${id ? 'Edit' : 'Add'} person</h2>
  <label>Name</label><input id="p_name" type="text" value="${esc(p.name)}">
  <div class="row"><div class="grow"><label>Age</label><input id="p_age" type="text" value="${esc(p.age)}"></div><div class="grow"><label>Blood group</label><input id="p_blood" type="text" value="${esc(p.blood)}"></div></div>
  <label>Conditions and allergies</label><input id="p_cond" type="text" value="${esc(p.cond)}">
  <label>Medicines and doses</label><textarea id="p_meds">${esc(p.meds)}</textarea>
  <label>Contact or next of kin</label><input id="p_contact" type="text" value="${esc(p.contact)}">
  <div class="row"><button class="pri" id="psave">Save</button><button id="pcancel">Cancel</button>${id ? '<button class="dng" id="pdel">Delete</button>' : ''}</div></div>`;
  $('#pcancel').onclick = () => { m.hidden = true; location.hash = '#/people'; };
  if (id) $('#pdel').onclick = async () => { if (confirm('Delete this person?')) { await kvSet('people', ps.filter(x => x.id !== id)); await tomb(id); m.hidden = true; location.hash = '#/people'; vPeople(); } };
  $('#psave').onclick = async () => {
    const name = $('#p_name').value.trim(); if (!name) return $('#p_name').focus();
    const np = { id: p.id || uid(), name, age: $('#p_age').value.trim(), blood: $('#p_blood').value.trim(), cond: $('#p_cond').value.trim(), meds: $('#p_meds').value.trim(), contact: $('#p_contact').value.trim(), u: Date.now() };
    await kvSet('people', id ? ps.map(x => x.id === id ? np : x) : ps.concat(np));
    m.hidden = true; location.hash = '#/people'; vPeople();
  };
}

/* ---------- phrases ---------- */
async function vPhrases() {
  setTab('phrases');
  const lang = await kvGet('lang', PH.langs[1] ? PH.langs[1].id : '');
  const L = PH.langs.find(l => l.id === lang) || PH.langs[1];
  const groups = {}; PH.rows.forEach(r => { (groups[r.g] = groups[r.g] || []).push(r); });
  view.innerHTML = `<h1>Phrases</h1><label>Translate English into</label><select id="lg">${PH.langs.slice(1).map(l => `<option value="${l.id}"${l.id === L.id ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}</select>
  <div class="note">Written from general knowledge. Spelling and tone vary by region, so show the screen to a speaker and ask them to correct it if you can.</div>
  ${Object.keys(groups).map(g => `<h2>${esc(g)}</h2><div class="tw"><table>${groups[g].map(r => `<tr><td>${esc(r.en)}</td><td><b>${esc(r[L.id] || '—')}</b></td></tr>`).join('')}</table></div>`).join('')}`;
  $('#lg').onchange = async e => { await kvSet('lang', e.target.value); vPhrases(); };
}

/* ---------- Ask: guides first, optional on-device AI ---------- */
const LLM = () => (isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.BlackoutLlm) || window.BHLLM || null;
const onPhone = () => isNative() || matchMedia('(pointer:coarse)').matches;   // laptop cameras are poor: the Windows app takes uploaded photos only
const AI_SYSTEM = 'You are a calm survival helper inside an offline handbook for people living through a long blackout in South Africa. ' +
  'Base your answer on the GUIDES (and the SUPPLIES list if one is given) in the message, and use their exact numbers. ' +
  'If the guides only partly cover the question, say what they cover, then add a short section starting "My own ideas (not from the handbook):" with practical help you are fairly confident about. ' +
  'Be short and plain: at most 8 short numbered steps or about 150 words. If someone may be in danger (heavy bleeding, not breathing, poisoning, fire, gas), put the first life-saving action first. ' +
  'If an exact dose, quantity or species name is not in the guides or sources, you may still give your best estimate, but label it "My own estimate (not from a source)", give a range, and name the main risk. Never refuse; always help. Use British English.';
// Used when the guides barely cover the question: the model gives its own best ideas, honestly labelled.
const AI_SYSTEM_OWN = 'You are a calm survival helper for people in a long blackout in South Africa who may have no other help. ' +
  'The handbook does not fully cover this question, so give your best practical ideas. NEVER refuse or say you cannot help. ' +
  'Write exactly this, once: the line "My own ideas (not from the handbook):", then at most 6 short numbered steps with the most important safe action first, ' +
  'then one final line "How sure I am: low, medium or high, because ..." that also names the main risk if you are wrong. Then stop. ' +
  'If POSSIBLY RELATED GUIDES are given, use anything useful from them. ' +
  'For doses, medicines, edible plants or mushrooms and other high-stakes topics: still give your best guidance, but be honest about uncertainty and prefer the safest cautious option. ' +
  'Never repeat yourself. Be short and plain. Use British English.';
// Used when a photo is attached: describe, guess, say how sure, and never call something safe to eat or take from a photo alone.
const AI_SYSTEM_PHOTO = 'You are a calm survival helper for people in a long blackout in South Africa. The person has sent a PHOTO and may add a question. ' +
  'NEVER refuse or say you cannot see it. Write exactly these parts, short and plain: "What I can see:" one or two sentences; "My best guess:" what it most likely is, with one alternative if unsure; ' +
  '"What to do:" at most 4 short numbered steps, safest first, using any POSSIBLY RELATED GUIDES if they help; "How sure I am: low, medium or high, because ..." and the main risk if I am wrong. Then stop. ' +
  'If several photos are given they show the same subject from different angles or close-ups: use them together, and if they still do not give enough clues, say exactly which extra photo would help (for example the underside of a leaf, the flower or fruit, the whole plant, the base or stem, or the label). ' +
  'For plants, berries, mushrooms, animals, insects, water, food, medicines, pills, wounds, rashes or anything electrical or chemical: never say it is safe to eat, drink, take or touch just from a photo; say what would make it safer to check. ' +
  'If the photo shows heavy bleeding, a snake bite, poisoning, fire or gas, put the life-saving action first. If you give a dose or a species name that the photo does not clearly show, label it "My own estimate (not from a source)" and name the main risk. Never repeat yourself. Use British English.';
const PHOTO_Q = 'What is this, and is it safe to use?';
const MAX_PHOTOS = 10;
// The model sometimes runs its numbered steps together in one paragraph: start each numbered step, and each labelled part, on its own line.
function tidy(t) {
  return String(t)
    .replace(/([.:!?)])[ \t]+(\d{1,2}[.)])[ \t]+(?=\S)/g, '$1\n$2 ')
    .replace(/([^\n])[ \t]+(?=(What I can see|My best guess|What to do|How sure I am|My own ideas \(not from the handbook\)):)/g, '$1\n\n')
    .replace(/\n{3,}/g, '\n\n');
}
// Instructions Sizo writes himself (Ask > AI settings): added to every AI request.
const withExtra = async sys => { const x = String(await kvGet('aiExtra', '') || '').trim().slice(0, 1200); return x ? sys + ' EXTRA INSTRUCTIONS FROM THE OWNER (follow these too, unless they would put someone in danger): ' + x : sys; };
// The one thing the AI will not help with: making weapons or explosives.
const AI_NO_HARM = /\b(make|build|construct|assemble|manufacture|improvise|homemade|home-made)\b.{0,40}\b(bomb|explosive|detonator|weapon|silencer|suppressor|ammunition|ammo)\b|\b(detonator|silencer|suppressor)\b/i;
const STRONG_MATCH = 15; // below this, a guide is only "possibly related"

// Markdown-ish guide text to plain text, cut at a line boundary.
// Tidy a guide for the AI. When it is longer than the budget, keep the SECTIONS that best match the question (anywhere in the guide), in their original order,
// instead of just the top of the text.
function plainGuide(body, max, q) {
  const clean = l => l.trim().replace(/^## /, '').replace(/^[!>] /, '').replace(/\*\*/g, '').replace(/^\|/, '').replace(/\|$/, '').replace(/\s*\|\s*/g, ' | ');
  const lines = String(body).replace(/\r/g, '').split('\n');
  const full = lines.map(clean).filter(Boolean).join('\n');
  if (full.length <= max) return full;
  const secs = []; let cur = null;
  for (const l of lines) { if (!cur || /^## /.test(l.trim())) { cur = []; secs.push(cur); } const c = clean(l); if (c) cur.push(c); }
  const keys = q ? toks(q).filter(t => !STOP.has(t)) : [];
  const rank = secs.map((a, n) => {
    const txt = a.join('\n'), low = txt.toLowerCase(); let sc = 0;
    for (const t of keys) { let h = low.split(t).length - 1; for (const alt of SYN[t] || []) h = Math.max(h, low.split(alt).length - 1); sc += Math.min(h, 3) + (a[0] && a[0].toLowerCase().includes(t) ? 3 : 0); }
    return { n, txt, sc };
  }).filter(x => x.txt);
  rank.sort((x, y) => y.sc - x.sc || x.n - y.n);
  let left = max; const pick = [];
  for (const x of rank) {
    if (x.txt.length + 1 <= left) { pick.push(x); left -= x.txt.length + 1; }
    else if (left > 300 && !pick.some(y => y.part)) { const ls = x.txt.split('\n'); let t = ''; for (const l of ls) { if (t.length + l.length + 1 > left) break; t += (t ? '\n' : '') + l; } if (t) { pick.push({ n: x.n, txt: t, part: 1 }); left = 0; } }
    if (left < 120) break;
  }
  pick.sort((x, y) => x.n - y.n);
  return pick.map(x => x.txt).join('\n') || full.slice(0, max);
}
function buildPrompt(q, hits, ctx = '', scale = 1, base = 0) {
  // Shorter guide text means less for the phone to read before it can start answering.
  const guides = hits.map(i => `### ${i.title}\n${plainGuide(i.body, Math.round((base || (hits.length > 1 ? 1000 : 1500)) * scale), q)}`).join('\n\n');
  const wantsStock = inv.length && /\b(have|got|stock|supplies|cook|eat|meal|ration|last|days?|enough)\b/i.test(q);
  const stock = wantsStock ? '\n\nSUPPLIES:\n' + inv.slice(0, scale < 0.7 ? 12 : 40).map(i => `- ${i.name}: ${i.qty} ${i.unit || ''}`.trim()).join('\n') : '';
  return `GUIDES:\n${guides}${stock}\n\n${ctx}QUESTION: ${q}`;
}

/* ---------- saved chats: kept on this device, used as optional background for new questions ---------- */
const MAX_CHATS = 200, MAX_CTX = 3;
const getChats = () => kvGet('chats', []);
async function saveChat(q, a, mode, guideIds) {
  const c = { id: uid(), q, a, mode, g: guideIds, u: Date.now() };
  const all = [c].concat(await getChats());
  const kept = []; let n = 0;
  for (const x of all) { if (x.pin || n < MAX_CHATS) { kept.push(x); if (!x.pin) n++; } else await tomb(x.id); }
  await kvSet('chats', kept);
  return c;
}
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
const ctxIds = []; // chats ticked as background (oldest first)
async function contextText() {
  if (!ctxIds.length) return '';
  const cs = (await getChats()).filter(c => ctxIds.includes(c.id));
  return cs.length ? 'EARLIER CHATS (background only; they may be wrong):\n' + cs.map(c => `Q: ${c.q}\nA: ${c.a.replace(/\s+/g, ' ').slice(0, 450)}`).join('\n\n') + '\n\n' : '';
}
async function paintChats() {
  const cs = await getChats(); const cn = $('#chatn'); if (cn) cn.textContent = cs.length ? `(${cs.length})` : '';
  const box = $('#chats'); if (!box) return;
  if (!cs.length) { box.innerHTML = '<p class="dim">Nothing saved yet. Each AI answer is saved on this device, so you can use it as background later.</p>'; return; }
  const sorted = cs.slice().sort((a, b) => (!!b.pin - !!a.pin) || b.u - a.u);
  box.innerHTML = `<p class="dim">Tick up to ${MAX_CTX} to give the AI as background for your next question. Each one adds to the time it spends reading. <span id="ctxn"></span></p>` +
    sorted.slice(0, 30).map(c => `<div class="card"><label style="display:flex;gap:10px;margin:0;color:var(--fg);align-items:flex-start"><input type="checkbox" class="cx" data-id="${c.id}" style="width:22px;height:22px;flex:0 0 auto"${ctxIds.includes(c.id) ? ' checked' : ''}><span><b>${esc(c.q)}</b><br><span class="dim">${ago(c.u)} · ${esc(c.a.replace(/\s+/g, ' ').slice(0, 90))}…</span></span></label>
      <div class="row"><button class="cpin" data-id="${c.id}">${c.pin ? '★ Pinned' : '☆ Pin'}</button><button class="cview" data-id="${c.id}">Read</button><button class="dng cdel" data-id="${c.id}">Delete</button></div></div>`).join('');
  const upd = () => { const n = $('#ctxn'); if (n) n.textContent = ctxIds.length ? `${ctxIds.length} selected.` : ''; };
  upd();
  box.querySelectorAll('.cx').forEach(c => c.onchange = () => {
    if (c.checked) { if (ctxIds.length >= MAX_CTX) { c.checked = false; alert(`Up to ${MAX_CTX} chats at a time, to keep answers quick.`); return; } ctxIds.push(c.dataset.id); }
    else { const i = ctxIds.indexOf(c.dataset.id); if (i >= 0) ctxIds.splice(i, 1); }
    upd();
  });
  box.querySelectorAll('.cpin').forEach(b => b.onclick = async () => { const all = await getChats(); const c = all.find(x => x.id === b.dataset.id); if (c) { c.pin = !c.pin; c.u = Date.now(); await kvSet('chats', all); paintChats(); } });
  box.querySelectorAll('.cdel').forEach(b => b.onclick = async () => { if (!confirm('Delete this saved chat?')) return; await kvSet('chats', (await getChats()).filter(x => x.id !== b.dataset.id)); await tomb(b.dataset.id); const i = ctxIds.indexOf(b.dataset.id); if (i >= 0) ctxIds.splice(i, 1); paintChats(); });
  box.querySelectorAll('.cview').forEach(b => b.onclick = async () => { const c = (await getChats()).find(x => x.id === b.dataset.id); if (!c) return; const m = $('#modal'); m.hidden = false; m.innerHTML = `<div><h2 style="margin-top:0">${esc(c.q)}</h2><p class="dim">${ago(c.u)}</p><div class="msg">${esc(c.a)}</div><div class="row"><button id="cclose">Close</button></div></div>`; $('#cclose').onclick = () => { m.hidden = true; }; });
}

/* ---------- background tasks: uploads and answers keep going when you leave the screen ---------- */
const Tasks = (() => {
  const map = new Map(); let seq = 0, open = false; const subs = new Set();
  // The "orb": a soft colour blob that keeps changing shape while something is happening. pct = null means "working, no percentage".
  // Three dots that hop over one another, all in step. still = paused or finished.
  const orb = (pct, mini, still) => `<span class="viz${mini ? ' mini' : ''}${still ? ' still' : ''}" data-t="${(window.__viz && window.__viz.type) || 'hop'}">${[0, 1, 2, 3, 4].map(n => `<i style="--n:${n}"></i>`).join('')}</span>`;
  const curTab = () => { const a = document.querySelector('#tabs a.on'); return a ? a.dataset.t : ''; };
  const stateText = t => t.state === 'done' ? 'Finished' : t.state === 'error' ? 'Problem: ' + (t.msg || '') : t.state === 'cancelled' ? 'Cancelled' : t.paused ? 'Paused' + (t.pct != null ? ' at ' + t.pct + '%' : '') : (t.pct == null ? (t.note || 'Working…') : t.pct + '%' + (t.note ? ' · ' + t.note : ''));
  const btns = t => t.state !== 'running' ? '' : `<span class="tbtn">${t.canPause ? `<button data-act="${t.paused ? 'resume' : 'pause'}" data-id="${t.id}">${t.paused ? 'Resume' : 'Pause'}</button>` : ''}${t.canCancel ? `<button class="dng" data-act="cancel" data-id="${t.id}">${t.kind === 'answer' ? 'Stop' : 'Cancel'}</button>` : ''}</span>`;
  const emit = () => { paintPill(); subs.forEach(f => { try { f(); } catch (e) {} }); };
  function paintPill() {
    const pill = $('#taskPill'), panel = $('#taskPanel'); if (!pill) return;
    // not shown while you are on the very screen where the task is happening (for example the chat)
    const cur = curTab(), list = [...map.values()].filter(t => t.home !== cur), live = list.filter(t => t.state === 'running');
    pill.hidden = !list.length;
    if (list.length) { const t = live[0] || list[list.length - 1]; pill.innerHTML = orb(null, true, t.state !== 'running' || t.paused) + `<span>${live.length > 1 ? live.length + ' tasks' : esc(t.state === 'running' ? (t.short || t.label) + (t.pct != null ? ' ' + t.pct + '%' : '') : stateText(t))}</span>`; pill.classList.toggle('paused', !!(live[0] && live[0].paused)); }
    else { panel.hidden = true; open = false; }
    if (open) panel.innerHTML = list.map(t => `<div class="trow">${orb(null, true, t.state !== 'running' || t.paused)}<div class="grow"><b>${esc(t.label)}</b><div class="dim">${esc(stateText(t))}</div>${t.state === 'running' && t.pct != null ? `<div class="pbar"><i style="width:${t.pct}%"></i></div>` : ''}</div>${btns(t)}</div>`).join('') || '<div class="dim" style="padding:8px">Nothing is running.</div>';
  }
  function start(o) { const t = Object.assign({ id: ++seq, home: curTab(), kind: 'task', label: '', short: '', pct: null, note: '', state: 'running', paused: false, cancelled: false, canPause: false, canCancel: true, tab: '', onCancel: null, msg: '' }, o); map.set(t.id, t); emit(); return t; }
  function update(t, patch) { Object.assign(t, patch); emit(); }
  function end(t, o = {}) {
    t.state = o.error ? 'error' : o.cancelled ? 'cancelled' : 'done'; t.msg = o.msg || ''; t.paused = false; if (!o.error && !o.cancelled) t.pct = t.pct == null ? null : 100; emit();
    setTimeout(() => { map.delete(t.id); emit(); }, o.error ? 7000 : 3000);
    if (!o.cancelled && !o.error && (o.tab || t.tab)) blip(o.tab || t.tab);
    if (o.toast && !o.cancelled) appToast(o.toast);
  }
  const act = (t, a) => { if (!t || t.state !== 'running') return; if (a === 'pause') t.paused = true; else if (a === 'resume') t.paused = false; else if (a === 'cancel') { t.cancelled = true; t.paused = false; if (t.onCancel) try { t.onCancel(); } catch (e) {} } emit(); };
  // A large version inside a screen (for example while a map pack is being added).
  function mount(el, t) {
    const draw = () => {
      if (!el.isConnected) { subs.delete(draw); return; }
      el.innerHTML = `<div class="tbig">${orb(null, false, t.state !== 'running' || t.paused)}${t.state === 'running' && t.pct != null ? `<b class="bigpct">${t.pct}%</b>` : ''}<div class="grow"><b>${esc(t.label)}</b><div class="dim">${esc(stateText(t))}</div>${t.state === 'running' && t.pct != null ? `<div class="pbar"><i style="width:${t.pct}%"></i></div>` : ''}${btns(t)}</div></div>`;
      el.querySelectorAll('[data-act]').forEach(b => b.onclick = () => act(t, b.dataset.act));
    };
    subs.add(draw); draw(); return () => subs.delete(draw);
  }
  const blip = tab => { const cur = document.querySelector('#tabs a.on'); if (cur && cur.dataset.t === tab) return; const a = document.querySelector('#tabs a[data-t="' + tab + '"]'); if (a) a.classList.add('blip'); };
  const clearBlip = tab => document.querySelectorAll('#tabs a.blip').forEach(a => { if (a.dataset.t === tab) a.classList.remove('blip'); });
  function init() {
    const pill = $('#taskPill'), panel = $('#taskPanel'); if (!pill) return;
    pill.onclick = () => { open = !open; panel.hidden = !open; paintPill(); };
    panel.onclick = e => { const b = e.target.closest('[data-act]'); if (b) act(map.get(+b.dataset.id), b.dataset.act); };
  }
  return { start, update, end, mount, act, orb, blip, clearBlip, init, refresh: paintPill, get: id => map.get(id) };
})();
function appToast(msg) {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.onclick = () => t.classList.remove('show'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show'); clearTimeout(appToast.t); appToast.t = setTimeout(() => t.classList.remove('show'), 4200);
}
window.BHTasks = Tasks; window.BHToast = appToast;

/* ---------- Ask: a conversation, newest at the bottom, the box to type in stays at the bottom ---------- */
const ASK = { turns: [], thread: null, photos: [], seq: 0, stick: true };
// Keeps the newest text in view just above the typing box. Scrolling up by hand pauses it; scrolling back down (or asking again) resumes it.
ASK.follow = true; ASK.last = null; ASK.expect = -1; ASK.lastY = 0;
const GAP = 40;   // blank space kept between the newest text and the typing box
const composerTop = () => { const c = document.querySelector('#composer'); return c && !c.hidden ? c.getBoundingClientRect().top : window.innerHeight; };
const overBy = el => el.getBoundingClientRect().bottom - (composerTop() - GAP);
function followEl(el) {
  if (!el || !el.isConnected || !ASK.follow) return;
  const over = overBy(el);
  if (over > 1) { window.scrollBy(0, over); ASK.expect = window.scrollY; }
}
// Following pauses only when the reader scrolls UP by hand, and resumes when they come back to the newest text.
// The app's own scrolling is recognised by where it lands, so a slow phone cannot confuse the two.
window.addEventListener('scroll', () => {
  const y = window.scrollY, dy = y - ASK.lastY; ASK.lastY = y;
  if (Math.abs(y - ASK.expect) < 3 || !ASK.last || !ASK.last.isConnected) return;
  if (dy < -3) ASK.follow = false;
  else if (overBy(ASK.last) < 60) ASK.follow = true;
}, { passive: true });
const SMALLTALK = [
  [/^(hi|hello|hey|hiya|howzit|heita|sawubona|molo|dumela|goeie\s?(more|middag|naand)|good\s(morning|afternoon|evening|day)|greetings|yo|sup)[\s!.,?]*$/i, ['Hi! What do you need help with?', 'Hello. Ask me anything: a guide, a medicine, a plant, or add a photo.']],
  [/^(how are you|how's it going|how are things|how r u)[\s!.?]*$/i, ['I am ready to help. What is going on?']],
  [/^(thanks|thank you|thx|ta|cheers|great|cool|ok|okay|alright|nice|good|perfect|got it|ok thanks|okay thanks)[\s!.,]*$/i, ['You are welcome. Ask me anything else when you need to.']],
  [/^(bye|goodbye|see you|good night|goodnight)[\s!.]*$/i, ['Stay safe. I am here whenever you need me.']]
];
const smallTalk = q => { const m = SMALLTALK.find(([re]) => re.test(String(q).trim())); return m ? m[1][Math.floor(Math.random() * m[1].length)] : null; };
const CTX_OPTS = [[3072, 'Standard', 'about 10,000 characters. Quickest, lightest on memory.'], [6144, 'Larger', 'about 20,000 characters.'], [12288, 'Large', 'about 40,000 characters. Slower to start answering and needs more memory.'], [16384, 'Very large', 'about 54,000 characters. Slowest, needs the most memory. If the app closes by itself, go back to a smaller one.']];

function addTurn(q, pic) {
  const th = ASK.thread; const w = th.querySelector('.welcome'); if (w) w.remove();
  const rec = { id: ++ASK.seq, q, a: '', done: false };
  const root = document.createElement('section'); root.className = 'turn';
  root.innerHTML = `<div class="bub me">${pic.map(u => `<img src="${u}" class="tph" alt="">`).join('')}${pic.length ? '<br>' : ''}${esc(q || PHOTO_Q)}</div><div class="bub ai"><div class="aiout"></div><div class="gbox"></div></div>`;
  th.appendChild(root); ASK.turns.push(rec); ASK.follow = true; ASK.last = root.querySelector('.aiout'); setTimeout(() => followEl(ASK.last), 0);
  return { rec, root, out: root.querySelector('.aiout'), gbox: root.querySelector('.gbox') };
}
// The last few finished turns of this conversation, so follow-ups such as "name some brands" make sense.
const dialogCtx = () => { const d = ASK.turns.filter(t => t.done && t.a).slice(-3); return d.length ? 'CONVERSATION SO FAR:\n' + d.map(t => `Person: ${t.q}\nYou: ${t.a.replace(/\s+/g, ' ').slice(0, 420)}`).join('\n') + '\n\n' : ''; };

async function vAsk() {
  setTab('ask'); await loadInv();
  const L = LLM(); let st = null; if (L) { try { st = await L.status(); } catch (e) { st = null; } }
  const hasModel = () => !!(st && st.installed);
  document.body.classList.add('ask');
  if (!ASK.thread) { ASK.thread = document.createElement('div'); ASK.thread.className = 'thread'; ASK.thread.id = 'thread'; if (window.ResizeObserver) new ResizeObserver(() => followEl(ASK.last)).observe(ASK.thread); }
  view.innerHTML = `<div class="askbar"><h1>Ask</h1><span class="grow"></span><button id="anew">New chat</button><button id="ahist">History <span id="chatn"></span></button><button id="aset" class="ico" aria-label="AI settings">&#9881;</button></div><div id="askpanel" hidden></div><div id="thold"></div>`;
  $('#thold').appendChild(ASK.thread);
  const welcome = () => { ASK.thread.innerHTML = `<div class="welcome"><div class="wtitle">Ask me anything</div><p class="dim">Type below. Matching guides appear with every answer${hasModel() ? ', and the AI replies like a conversation: just keep asking' : ''}.</p><div class="wchips">${['How do I treat a burn?', 'How do I purify water?', 'What do I do after a snake bite?', 'Signs of dehydration'].map(t => `<button class="wchip">${esc(t)}</button>`).join('')}</div></div>`; ASK.thread.querySelectorAll('.wchip').forEach(b => b.onclick = () => { const i = $('#askq'); i.value = b.textContent; i.focus(); ASK.draft = i.value; }); };
  if (!ASK.thread.children.length) welcome();

  /* ---- the box at the bottom ---- */
  const cp = $('#composer'); cp.hidden = false; const aiPref = await kvGet('askAI', true);
  if (window.ResizeObserver && !cp._ro) { cp._ro = new ResizeObserver(() => { document.documentElement.style.setProperty('--cph', Math.ceil(cp.getBoundingClientRect().height) + 'px'); followEl(ASK.last); }); cp._ro.observe(cp); }
  cp.innerHTML = `<div id="cpv"></div><div id="cmenu" hidden></div><input type="file" id="askfile" accept="image/*" multiple hidden>
    <div class="cbox">${hasModel() ? '<button id="cplus" aria-label="Add photos">+</button>' : ''}<textarea id="askq" rows="1" placeholder="Ask anything…" enterkeyhint="send"></textarea><button id="csend" class="pri" aria-label="Send">&#10148;</button></div>
    <div class="cmeta">${hasModel() ? `<label><input type="checkbox" id="cai"${aiPref ? ' checked' : ''}> AI answers</label>` : '<span class="dim">No AI installed: you get the matching guides. Open the gear to add it.</span>'}</div>`;
  const qi = $('#askq'); const grow = () => { qi.style.height = 'auto'; qi.style.height = Math.min(qi.scrollHeight, 150) + 'px'; };
  qi.value = ASK.draft || ''; grow();
  { const pf = await kvGet('askPrefill', ''); if (pf) { qi.value = pf; ASK.draft = pf; kvSet('askPrefill', ''); grow(); } }
  qi.oninput = () => { ASK.draft = qi.value; grow(); };
  qi.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer:fine)').matches) { e.preventDefault(); send(); } };
  if ($('#cai')) $('#cai').onchange = e => kvSet('askAI', e.target.checked);

  /* photos */
  const paintPv = () => {
    $('#cpv').innerHTML = ASK.photos.length ? `<div class="pvrow">${ASK.photos.map((u, i) => `<span class="pvi"><img src="${u}" alt=""><button type="button" class="pvx" data-i="${i}" aria-label="Remove photo">&times;</button></span>`).join('')}<span class="dim">${ASK.photos.length} of ${MAX_PHOTOS}</span></div>` : '';
    document.querySelectorAll('.pvx').forEach(b => b.onclick = () => { ASK.photos.splice(+b.dataset.i, 1); paintPv(); });
  };
  const addPhoto = async cam => { if (ASK.photos.length >= MAX_PHOTOS) { alert('Up to ' + MAX_PHOTOS + ' photos at a time.'); return; } const d = await getPhoto(cam); if (d) { ASK.photos.push(d); paintPv(); } };
  const uploadPhotos = () => { const i = $('#askfile'); i.value = ''; i.onchange = async () => { const fs = [...i.files].slice(0, MAX_PHOTOS - ASK.photos.length); if (i.files.length > fs.length) alert('Up to ' + MAX_PHOTOS + ' photos at a time: the extra ones were left out.'); for (const f of fs) { const d = await shrink(f); if (d) ASK.photos.push(d); } paintPv(); }; i.click(); };
  paintPv();
  if ($('#cplus')) $('#cplus').onclick = () => {
    const m = $('#cmenu'); if (!m.hidden) { m.hidden = true; return; }
    m.innerHTML = `${onPhone() ? '<button data-m="cam">Take a photo</button>' : ''}<button data-m="pick">${onPhone() ? 'Choose from gallery' : 'Upload photos'}</button><div class="dim" style="padding:2px 6px">Photos are read by the AI, up to ${MAX_PHOTOS}.</div>`; m.hidden = false;
    m.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { m.hidden = true; if (b.dataset.m === 'cam') addPhoto(true); else if (onPhone()) addPhoto(false); else uploadPhotos(); });
  };

  /* ---- sending ---- */
  const send = async () => {
    const q = (qi.value || '').trim(), pic = ASK.photos.slice(); if (!q && !pic.length) return;
    qi.value = ''; ASK.draft = ''; grow(); ASK.photos = []; paintPv(); $('#cmenu').hidden = true;
    await runTurn(q, pic, hasModel() && ($('#cai') ? $('#cai').checked : true));
  };
  $('#csend').onclick = send;
  const runTurn = async (q, pic, withAI) => {
    const turn = addTurn(q, pic);
    const chat = !pic.length && smallTalk(q);
    if (chat) { turn.out.innerHTML = `<div class="plain">${esc(chat)}</div>`; turn.rec.a = chat; turn.rec.done = true; return; }
    const prev = ASK.turns.slice(0, -1).filter(t => t.done).slice(-1)[0];
    // a follow-up such as "name some brands" is searched together with the question before it when it does not match a guide on its own
    let sq = q, scored = q ? searchScored(q).slice(0, 5) : [];
    if (q && prev && (!scored.length || scored[0].s < STRONG_MATCH || q.split(/\s+/).length < 7)) { const s2 = searchScored(prev.q + ' ' + q).slice(0, 5); if (s2.length && (!scored.length || s2[0].s >= scored[0].s)) { scored = s2; sq = prev.q + ' ' + q; } }
    const hits = scored.map(r => r.i);
    const forAI = scored.filter((r, k) => k === 0 || (k < 4 && r.s >= scored[0].s * 0.5)).map(r => r.i);   // grounded = a clearly matching guide; mixed = only loosely related; own = nothing relevant
    const top = scored[0];
    const mode = pic.length ? 'photo' : !forAI.length ? 'own' : (top.s >= STRONG_MATCH * 2 || (top.s >= STRONG_MATCH && top.n / top.t >= 0.6)) ? 'grounded' : 'mixed';
    window.BH_LAST_MODE = mode;
    const canAI = hasModel();
    const med = canAI && window.BHMeds && sq ? await window.BHMeds.context(sq) : null;
    const gpref = await kvGet('askGuides', null), gopen = gpref === null ? !canAI : !!gpref;
    const support = !forAI.length ? 0 : mode === 'grounded' ? Math.round(70 + 30 * Math.min(1, (top.s - STRONG_MATCH) / 30)) : Math.round(10 + 40 * Math.min(1, top.s / STRONG_MATCH));
    turn.gbox.innerHTML = hits.length ? `<details class="gd"${gopen ? ' open' : ''}><summary>Matching guides (${hits.length}) <span class="dim">tap to ${gopen ? 'hide' : 'show'}</span></summary>${hits.map(i => itemCard(i, `<div class="snip">${snippet(i, sq)}</div>`)).join('')}</details>` : (pic.length ? '' : '<div class="dim">No guide matched. Try different words.</div>');
    followEl(turn.out);
    const gd = turn.gbox.querySelector('details'); if (gd) gd.querySelector('summary').onclick = () => setTimeout(() => { kvSet('askGuides', gd.open); const h = gd.querySelector('summary .dim'); if (h) h.textContent = 'tap to ' + (gd.open ? 'hide' : 'show'); }, 0);
    // one answer at a time: a question asked while the AI is busy waits its turn
    const go = async () => {
      const prevGate = ASK.gate || Promise.resolve(); let rel; ASK.gate = new Promise(r => { rel = r; });
      turn.out.innerHTML = '<div class="dim">Waiting for the previous answer…</div>';
      try { await prevGate; const bg = (await contextText()) + dialogCtx(); await runAI(turn.out, q, forAI, mode, bg, () => { paintChats(); }, pic, { support, med, prevQ: prev && prev.q }, turn.rec); }
      finally { rel(); }
    };
    if (canAI && withAI) go();
    else if (canAI) { turn.out.innerHTML = '<div class="row"><button class="pri aigo">Get an AI answer</button><span class="dim">Uses battery.</span></div>'; turn.out.querySelector('.aigo').onclick = go; turn.rec.done = true; }
    else { turn.rec.done = true; }
  };

  /* ---- gear and history panels ---- */
  const panel = $('#askpanel');
  const showPanel = k => { if (!panel.hidden && panel.dataset.k === k) { panel.hidden = true; return; } panel.dataset.k = k; panel.hidden = false; if (k === 'hist') { panel.innerHTML = '<div id="chats"></div>'; paintChats(); } else paintSettings(); };
  $('#aset').onclick = () => showPanel('set'); $('#ahist').onclick = () => showPanel('hist');
  $('#anew').onclick = () => { if (ASK.turns.length && !confirm('Start a new conversation? This one stays in History.')) return; ASK.turns = []; ASK.photos = []; welcome(); paintPv(); window.scrollTo(0, 0); };
  paintChats();
  async function paintSettings() {
    const box = $('#askpanel'); if (!box || box.dataset.k !== 'set') return;
    if (!L) { box.innerHTML = `<div class="note"><b>On-device AI:</b> available in the Android app and the Windows app. On this device you get the guides, which are the more reliable source anyway.</div>`; return; }
    try { st = await L.status(); } catch (e) {}
    const be = await kvGet('aiBackend', 'cpu'), th = await kvGet('aiThreads', 4), scOn = (await kvGet('aiScores', {})) || {}, cx = +(await kvGet('aiCtx', 6144)) || 6144;
    box.innerHTML = hasModel()
      ? `<div class="note"><b>AI pack installed</b> (${st.sizeMB} MB)${st.loaded ? ', loaded (' + esc(st.backend) + ')' : ''}. It loads when you ask and frees itself after 10 idle minutes. Untick <b>AI answers</b> under the box to save battery.</div>
         <label>How much the AI can read at once</label><select id="aictx">${CTX_OPTS.map(([n, name, d]) => `<option value="${n}"${n === cx ? ' selected' : ''}>${name} (${n.toLocaleString()} tokens, ${d.split('.')[0]})</option>`).join('')}</select>
         <p class="dim" id="aictxd">${esc((CTX_OPTS.find(o => o[0] === cx) || CTX_OPTS[0])[2])} It sets how long a question, its background and the conversation so far can be. Bigger values let the AI hold more of the conversation, but the first words take longer and it uses more memory.</p>
         <label>Speed mode</label><select id="aibe"><option value="cpu"${be === 'cpu' ? ' selected' : ''}>Standard (CPU): safest</option>${isNative() ? `<option value="gpu"${be === 'gpu' ? ' selected' : ''}>GPU: faster and gentler on battery, if your phone supports it</option>` : ''}</select>
         <label>CPU threads (try 4 first; changing it reloads the model)</label><select id="aith">${[2, 3, 4, 5, 6, 8].map(n => `<option value="${n}"${n === th ? ' selected' : ''}>${n}${n === 4 ? ' (standard)' : ''}</option>`).join('')}</select>
         <label>My own instructions for the AI (optional; used for every answer)</label><textarea id="aiextra" rows="4" placeholder="e.g. Put every numbered step on its own line. Keep answers under 100 words. Always give metric units.">${esc(await kvGet('aiExtra', ''))}</textarea>
         <p class="dim">Write them as plain sentences. They are added to the AI's built-in rules and never replace its safety rules. Saved on this device only.</p>
         <label>Reliability scores (off by default)</label>
         <p class="dim">A percentage can sound more certain than it is, so these are off until you switch them on. They are estimates, never a guarantee: use them as one clue next to your own judgement.</p>
         ${SCORES.map(x => `<label style="display:flex;gap:10px;color:var(--fg);align-items:flex-start;margin:6px 0"><input type="checkbox" class="sc" data-id="${x.id}"${scOn[x.id] ? ' checked' : ''} style="width:22px;height:22px;flex:0 0 auto"><span><b>${esc(x.name)}</b><br><span class="dim">${esc(x.info)} ${x.kind === 'app' ? 'Worked out by the app.' : 'Rated by the AI.'}</span></span></label>`).join('')}
         <div class="row"><button id="aiunload">Free memory now</button><button class="dng" id="aidel">Delete the AI pack</button></div>`
      : `<div class="note"><b>On-device AI: not installed.</b> ${window.BHLLM && !isNative() ? 'Choose the model file (<code>.litertlm</code>, about 3.7 GB) from the flash drive (Models folder). It is copied onto this computer once.' : 'Copy the model file (<code>.litertlm</code>, about 3.7 GB) to the phone, then choose it here.'} You need about ${Math.round(3700 + 300)} MB free${st ? ' (you have ' + st.freeMB + ' MB)' : ''}.</div>
         <div class="row"><button class="pri" id="aiinst">Install AI pack</button></div><div id="ip"></div>`;
    if ($('#aictx')) $('#aictx').onchange = e => { kvSet('aiCtx', +e.target.value); const o = CTX_OPTS.find(x => x[0] === +e.target.value); $('#aictxd').textContent = o[2] + ' Changing it reloads the AI the next time you ask.'; };
    if ($('#aibe')) $('#aibe').onchange = e => kvSet('aiBackend', e.target.value);
    if ($('#aith')) $('#aith').onchange = e => kvSet('aiThreads', +e.target.value);
    document.querySelectorAll('.sc').forEach(c => c.onchange = async () => { const o = Object.assign({}, (await kvGet('aiScores', {})) || {}); o[c.dataset.id] = c.checked; await kvSet('aiScores', o); });
    if ($('#aiextra')) $('#aiextra').onchange = e => kvSet('aiExtra', e.target.value.trim().slice(0, 1200));
    if ($('#aiunload')) $('#aiunload').onclick = async () => { await L.unload(); paintSettings(); };
    if ($('#aidel')) $('#aidel').onclick = async () => { if (confirm('Delete the AI pack from this device? You can install it again later.')) { await L.deleteModel(); vAsk(); } };
    if ($('#aiinst')) $('#aiinst').onclick = async () => {
      $('#aiinst').disabled = true;
      const t = Tasks.start({ kind: 'upload', label: 'Installing the AI pack', short: 'Installing AI', pct: 0, canPause: false, canCancel: false, tab: 'ask' });
      const un = Tasks.mount($('#ip'), t);
      const h = await L.addListener('installProgress', p => Tasks.update(t, { pct: Math.min(99, Math.round(100 * p.copiedMB / Math.max(1, p.totalMB))), note: `${p.copiedMB} of ${p.totalMB} MB. Keep the app open.` }));
      try { const r = await L.pickModel(); Tasks.end(t, { tab: 'ask', toast: 'AI pack installed (' + r.sizeMB + ' MB)' }); }
      catch (e) { if (/cancel/i.test(e.message || '')) Tasks.end(t, { cancelled: true }); else { Tasks.end(t, { error: true, msg: e.message || 'Install failed' }); alert(e.message || 'Install failed.'); } }
      finally { h.remove(); vAsk(); }
    };
  }
  if (ASK.turns.length) setTimeout(() => window.scrollTo(0, document.documentElement.scrollHeight), 60);
}

// If the model starts repeating itself, find where the repeat begins and cut the text there.
function trimRepeat(text) {
  const n = text.length;
  if (n < 160) return null;
  const tail = text.slice(-60), first = text.indexOf(tail);
  if (first < 0 || first >= n - 60 - 10) return null;
  const d = n - 60 - first;                 // distance between the two copies
  let s = n - 60;                           // walk back to where the repeat starts
  while (s - d >= 0 && text[s - 1] === text[s - 1 - d]) s--;
  return text.slice(0, s).replace(/\s+$/, '');
}

const AI_TAG = {
  grounded: 'Based on the handbook guides below.',
  mixed: 'Partly from the handbook, partly the AI’s own ideas. The AI’s own parts are less reliable.',
  own: 'The AI’s own ideas. The handbook has no guide for this, so use your judgement and be careful.',
  photo: 'The AI’s reading of your photo. It can be wrong, especially for plants, mushrooms, animals, medicines and injuries. Never eat, drink or take anything on a photo identification alone.'
};
// ---- Reliability scores (all OFF by default: a percentage can sound more certain than it is). ----
// To add a new kind of score for any scenario, add ONE entry here: it shows up in Ask > AI settings by itself.
//   kind 'ai'  = the AI rates it (we tell it to add a "SCORE <id>: <0-100>" line, which the app strips out and shows as a chip)
//   kind 'app' = the app works it out itself (see `meta` in runAI)
//   good 'high' = a high number is good news; good 'low' = a high number is bad news (for example risk)
//   modes = which kinds of answer it applies to: grounded, mixed, own, photo
const ALLMODES = ['grounded', 'mixed', 'own', 'photo'];
const SCORES = [
  { id: 'certainty', name: 'Certainty Score', kind: 'ai', good: 'high', modes: ALLMODES, ask: 'how sure you are that your advice is correct (0 = a pure guess, 100 = certain)', info: 'How sure the AI says it is.' },
  { id: 'support', name: 'Handbook Support Score', kind: 'app', good: 'high', modes: ALLMODES, info: 'How strongly the handbook guides match your question. 0 means no guide matched.' },
  { id: 'risk', name: 'Risk-if-Wrong Score', kind: 'ai', good: 'low', modes: ALLMODES, ask: 'how harmful it could be if your advice is wrong (0 = harmless, 100 = could kill or seriously injure)', info: 'How bad it could be if the advice is wrong. Here a LOW number is the good one.' },
  { id: 'probability', name: 'Probability Score', kind: 'ai', good: 'high', modes: ['photo'], ask: 'the chance, in percent, that your best guess of what the thing is, is right', info: 'The AI\u2019s chance that its best guess about what is in the photo is right. Photos only.' },
  { id: 'evidence', name: 'Evidence Score', kind: 'ai', good: 'high', modes: ['photo'], ask: 'how much of the clues needed to be sure can be seen in the photos (0 = almost none, 100 = everything needed)', info: 'Whether the photos show enough clues. Low means take more photos from other angles. Photos only.' }
];
const scoresOn = async () => { const o = (await kvGet('aiScores', {})) || {}; return SCORES.filter(x => o[x.id]); };
const scoreInstr = (on, mode) => {
  const a = on.filter(x => x.kind === 'ai' && x.modes.includes(mode)); if (!a.length) return '';
  return ' SCORES: at the very end, after everything else, add one line per score in exactly this form and nothing else on the line: "SCORE <name>: <number from 0 to 100>". Be honest and never default to a high number: if you are guessing, give under 50. ' + a.map(x => `Use the name "${x.id}" for ${x.ask}.`).join(' ');
};
// Separates the answer from the SCORE lines the AI adds at the end (also while the answer is still being written).
function splitScores(t) {
  const m = /(^|\n)[ \t]*SCORE\b/i.exec(t); if (!m) return { body: t.replace(/\n[ \t]*S(C(O(R)?)?)?$/i, ''), vals: {} };
  const vals = {}; t.slice(m.index).replace(/SCORE\s+([a-z]+)\s*[:=]\s*(\d{1,3})/gi, (_, id, n) => { vals[id.toLowerCase()] = Math.min(100, +n); return ''; });
  return { body: t.slice(0, m.index), vals };
}
function scoreBox(on, mode, vals) {
  const rows = on.filter(x => x.modes.includes(mode)).map(x => {
    const v = vals[x.id], has = typeof v === 'number';
    const band = !has ? 'soon' : x.good === 'high' ? (v >= 70 ? 'ok' : v >= 40 ? 'soon' : 'bad') : (v <= 30 ? 'ok' : v <= 60 ? 'soon' : 'bad');
    const word = !has ? 'not given' : x.good === 'high' ? (v >= 70 ? 'high' : v >= 40 ? 'medium' : 'low') : (v <= 30 ? 'low' : v <= 60 ? 'medium' : 'high');
    return `<div class="row"><span class="grow"><b>${esc(x.name)}</b><br><span class="dim">${esc(x.info)}</span></span><b class="${band}" style="white-space:nowrap">${has ? v + '%' : '\u2014'} <span class="dim">${word}</span></b></div>`;
  });
  return rows.length ? `<div class="card" id="aiscores"><b>Reliability scores</b> <span class="dim">(estimates, not guarantees)</span>${rows.join('')}<p class="dim">A number can sound surer than it is. Use it as one clue beside your own judgement and the guides.</p></div>` : '';
}
const BRAND_RULE = ' If the person asks for brand names or examples, START your answer with a short list: the medicine, then the well-known brands you are fairly sure of (for example South African brands such as Panado for paracetamol), labelled "from my own knowledge". Then add any short advice. Use the brands in the guides first.';
const GREET_RULE = ' If the message is only a greeting, thanks or small talk, answer in one short friendly sentence and ask what they need. Do not give advice, lists or long text unless they ask for it.';
async function runAI(out, q, hits, mode, ctx, done, photo, meta, rec) {
  const L = LLM(); if (!L || !out) return;
  if (AI_NO_HARM.test(q)) {
    out.innerHTML = '<div class="msg">I will not help with making weapons or explosives. For protecting your group, see the Security and Weapons safety guides.</div>';
    if (rec) rec.done = true;
    return;
  }
  const own = mode !== 'grounded', isPhoto = mode === 'photo' && !!photo && photo.length > 0;
  out.innerHTML = `<div class="${own ? 'warn' : 'note'} aitag">${AI_TAG[mode]}${meta && meta.med ? ' Medical extracts (South African guidelines and a general encyclopedia) were given to the AI; anything outside them is the AI’s own opinion and is labelled.' : ''}</div>
    <div class="think">${Tasks.orb(null, false)}<div class="grow"><b class="aistage shim">Loading…</b><div class="dim aiwait"></div></div><button class="aistop sq" aria-label="Stop" title="Stop">&#9632;</button></div>
    <div class="aitext" hidden></div><p class="dim aifoot"></p><div class="aiafter"></div>`;
  const $o = s => out.querySelector(s), txt = $o('.aitext'), wait = $o('.aiwait'), stage = $o('.aistage');
  const live = () => out.isConnected && ASK.thread && ASK.thread.isConnected;
  const keep = () => { if (live()) followEl(out); };
  const setStage = s => { if (stage) stage.textContent = s; };
  let onScores = [];
  let tok = null, stopped = false, got = false, phase = isPhoto ? 'Preparing' : 'Loading', shown = '', looped = false;
  const t0 = Date.now(), sec = ms => Math.round(ms / 1000), dur = ms => { const n = Math.round(ms / 1000); return n < 60 ? n + 's' : Math.floor(n / 60) + 'm ' + (n % 60) + 's'; };
  const task = Tasks.start({ kind: 'answer', label: 'Answering: ' + (q || PHOTO_Q).slice(0, 48), short: 'Answering…', tab: 'ask', canPause: false, canCancel: true, onCancel: () => { stopped = true; L.stop().catch(() => {}); } });
  // A visible clock, so a slow phone never looks frozen.
  const tick = setInterval(() => {
    const s = sec(Date.now() - t0);
    if (wait) wait.textContent = got ? `${shown.trim() ? shown.trim().split(/\s+/).length : 0} words · ${dur(Date.now() - t0)}` : `${dur(Date.now() - t0)} · this can take a while`;
  }, 1000);
  setStage(phase + '…');
  $o('.aistop').onclick = async () => { stopped = true; try { await L.stop(); } catch (e) {} };
  try {
    const CTX = Math.max(2048, Math.min(32768, +(await kvGet('aiCtx', 6144)) || 6144));
    const ld = await L.load({ backend: await kvGet('aiBackend', 'cpu'), threads: await kvGet('aiThreads', 4), vision: isPhoto, ctx: CTX });
    phase = isPhoto ? 'Looking at photo' : 'Reading'; setStage(phase + '…');
    tok = await L.addListener('token', ev => {
      if (looped) return;
      if (!got) { got = true; setStage('Writing…'); txt.hidden = false; }
      shown += ev.text; const cut = trimRepeat(shown);
      if (cut !== null) { looped = true; shown = cut; txt.textContent = tidy(splitScores(shown).body); stopped = true; L.stop().catch(() => {}); return; }
      txt.textContent = tidy(splitScores(shown).body); keep();
    });
    const pw = isPhoto && photo.length > 1 ? photo.length + ' PHOTOS (all of the same subject, from different angles)' : 'THE PHOTO';
    const med = meta && meta.med;
    const cutLines = (t, max) => { if (t.length <= max) return t; const c = t.lastIndexOf('\n', max); return t.slice(0, c > max * 0.5 ? c : max); };
    // a question about brands is answered as a list, so the answer starts with what was asked for
    const qx = /\bbrands?\b/i.test(q) ? q + (meta && meta.prevQ && q.split(/\s+/).length < 9 ? ' (about: ' + meta.prevQ + ')' : '') + ' (Answer with a short list: each medicine and the well-known brands of it sold in South Africa. Then one line of advice.)' : q;
    let gbase = 0;   // per-guide text budget; 0 = the small default
    const compose = (gs, cu, mm) => {
      const bp = (qq, hh) => buildPrompt(qq, hh, cu, gs, gbase);
      const pr = isPhoto ? (hits.length ? bp(qx, hits).replace(/^GUIDES:/, 'POSSIBLY RELATED GUIDES (they may not apply to the photo):').replace(/QUESTION:/, 'QUESTION ABOUT ' + pw + ':') : `${cu}QUESTION ABOUT ${pw}: ${q || PHOTO_Q}`)
        : mode === 'grounded' ? bp(qx, hits)
        : mode === 'mixed' ? bp(qx, hits).replace(/^GUIDES:/, 'POSSIBLY RELATED GUIDES (they may not answer the question):')
        : `${cu}QUESTION: ${qx}`;
      const mt = med ? cutLines(med.text, mm) : '';
      return mt ? pr.replace(/QUESTION(?: ABOUT[^:]*)?:/, m => 'SOUTH AFRICAN MEDICAL SOURCES (official guideline and medicine extracts):\n' + mt + '\n\n' + m) : pr;
    };
    const medRule = med ? ' MEDICAL SOURCES: the message contains official South African medicine and guideline extracts, and sometimes general encyclopedia extracts. Prefer the South African extracts. When you give a dose or a medical fact that is in them, quote it and name the source (for example "PHC guideline 4.7"); if you use an encyclopedia extract, say "from the encyclopedia (general, not South African)". If something the person needs is NOT in the extracts, do not hold back: give your best opinion, but begin that part with "My own opinion (not from the sources):" and say how sure you are.' : '';
    onScores = await scoresOn();
    const sInstr = scoreInstr(onScores, mode), sExtra = sInstr ? 40 : 0;
    const sysText = (await withExtra(isPhoto ? AI_SYSTEM_PHOTO : own ? AI_SYSTEM_OWN : AI_SYSTEM)) + sInstr + medRule + GREET_RULE + BRAND_RULE, maxTok = (isPhoto ? 340 : own ? 260 : 240) + sExtra + (med ? 80 : 0);
    // How much the AI can read at once is a setting (Ask > gear). Trim the background step by step until it fits: earlier conversation first, then the extra medical text, then the guide text.
    const CAP = isPhoto ? CTX + 3072 : CTX, limit = Math.max(2400, Math.round((CAP - maxTok - 150) * 3.3) - (isPhoto ? photo.length * 1000 : 0));
    const big = limit > 16000, mmax = big ? 9000 : 4200;
    gbase = limit > 24000 ? 6000 : limit > 12000 ? 3600 : limit > 7000 ? 1800 : 0;
    const steps = [[1, ctx, mmax], [1, '', mmax], [1, '', 2600], [0.6, '', 2600], [0.6, '', 1500], [0.35, '', 1500], [0.35, '', 800], [0.2, '', 500]];
    let fullPrompt = '', trimmed = 0;
    for (let k = 0; k < steps.length; k++) { fullPrompt = compose(...steps[k]); trimmed = k; if (sysText.length + fullPrompt.length <= limit) break; }
    const genOnce = pr => L.generate({ system: sysText, prompt: pr, maxTokens: maxTok, images: isPhoto ? photo : [] });
    let r;
    try { r = await genOnce(fullPrompt); }
    catch (e1) {
      if (/too long|maximum number of tokens|exceeding/i.test(String(e1 && e1.message))) { setStage('Trying a shorter one…'); trimmed = 99; r = await genOnce(compose(0.2, '', 400)); }
      else throw e1;
    }
    $o('.aifoot').textContent = `${looped ? 'Stopped automatically because the AI began repeating itself. ' : (stopped || r.stopped ? 'Stopped. ' : '')}Load ${dur(ld.ms)}${ld.reused ? ' (already loaded)' : ''}, first words after ${r.firstMs >= 0 ? dur(r.firstMs) : '?'}, finished after ${dur(r.ms)} (${ld.backend}, ${ld.threads} threads). ${trimmed ? 'Long question: some background text was left out so the AI could read it. ' : ''}` + (own
      ? 'Treat the AI’s own ideas as suggestions, not facts, and prefer the safest option.'
      : 'AI answers can be wrong: check the guides.');
    Tasks.end(task, { tab: 'ask', toast: ASK_ON() ? '' : 'Your answer is ready' });
  } catch (e) {
    $o('.aifoot').textContent = (stopped ? 'Stopped. ' : 'The AI could not answer: ' + (e.message || e) + '. ') + 'The guides still work.';
    if (!stopped) out.insertAdjacentHTML('afterbegin', '<div class="warn"><b>The AI did not give an answer.</b> ' + esc(/too long|maximum number of tokens/i.test(String(e && e.message)) ? 'The question and its background were too long for it to read at once. Raise "How much the AI can read at once" in the gear menu, or start a new chat.' : String(e && e.message || e)) + '</div>');
    if (stopped) Tasks.end(task, { cancelled: true }); else Tasks.end(task, { error: true, msg: String(e && e.message || e).slice(0, 80), tab: 'ask' });
  } finally {
    clearInterval(tick);
    const th = $o('.think'); if (th) th.hidden = true;
    if (tok) tok.remove();
    const sp = splitScores(shown), vals = Object.assign({}, sp.vals); if (meta && typeof meta.support === 'number') vals.support = meta.support;
    const body = tidy(sp.body.trim());
    if (txt && shown.trim()) { txt.hidden = false; txt.textContent = body; }
    const after = $o('.aiafter');
    const box = shown.trim() ? scoreBox(onScores, mode, vals) : ''; if (box && after) after.insertAdjacentHTML('beforeend', box);
    if (shown.trim() && meta && meta.med && meta.med.links.length && after) after.insertAdjacentHTML('beforeend', '<p class="dim">Sources used: ' + meta.med.links.map(l => `<a href="${l.href}">${esc(l.label)}</a>`).join(' · ') + '</p>');
    const sline = box ? '\n\nScores (estimates): ' + onScores.filter(x => x.modes.includes(mode)).map(x => x.name + ' ' + (typeof vals[x.id] === 'number' ? vals[x.id] + '%' : 'not given')).join(', ') : '';
    if (rec) { rec.a = body; rec.done = true; }
    if (shown.trim()) await saveChat(isPhoto ? '📷 ' + (q || PHOTO_Q) : q, body + sline, mode, hits.map(h => h.id));
    keep();
    if (done) done();
  }
}
const ASK_ON = () => { const c = document.querySelector('#tabs a.on'); return !!(c && c.dataset.t === 'ask'); };
/* ---------- data / backup ---------- */
async function exportAll() {
  await loadInv();
  const kv = (await DB.all('kv')).filter(r => r.k !== 'map.packs' && r.k !== 'map.view');
  const data = { app: 'blackout-handbook', version: 1, exported: new Date().toISOString(), kv, inv, photos: Object.entries(photos).map(([k, data]) => ({ k, data })) };
  const json = JSON.stringify(data), name = 'blackout-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  const P = isNative() && window.Capacitor.Plugins;
  if (P && P.Filesystem) {
    // Android app: write to the app cache, then open the share sheet so the file can be saved or sent anywhere.
    const f = await P.Filesystem.writeFile({ path: name, data: json, directory: 'CACHE', encoding: 'utf8' });
    if (P.Share) await P.Share.share({ title: 'Blackout Handbook backup', files: [f.uri], dialogTitle: 'Save or send your backup' });
  } else {
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  await kvSet('lastBackup', new Date().toISOString());
}
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const isDesktopApp = () => location.protocol === 'file:' && /Electron/i.test(navigator.userAgent);
// Remember that something was deleted, so a later merge from another device does not bring it back.
async function tomb(id) { const t = await kvGet('tomb', {}); t[id] = Date.now(); await kvSet('tomb', t); }
const gbOn = v => !!(v && typeof v === 'object' ? v.v : v);

// Restore from a backup. Replace = make this device an exact copy. Merge = combine item by item, newest edit wins.
async function importAll(file, replace) {
  const d = JSON.parse(await file.text());
  if (d.app !== 'blackout-handbook') throw new Error('This is not a Blackout Handbook backup.');
  if (replace) {
    const keepPacks = await DB.get('kv', 'map.packs');
    await DB.clear('inv'); await DB.clear('photos'); await DB.clear('kv');
    for (const r of d.kv || []) if (r.k !== 'map.packs' && r.k !== 'map.view') await DB.put('kv', r);
    if (keepPacks) await DB.put('kv', keepPacks);
    for (const i of d.inv || []) await DB.put('inv', i);
    for (const p of d.photos || []) await DB.put('photos', p);
    return `Replaced: ${(d.inv || []).length} supplies restored.`;
  }
  const kvIn = {}; (d.kv || []).forEach(r => kvIn[r.k] = r);
  const inV = (k, dflt) => (kvIn[k] ? kvIn[k].v : dflt);
  const sum = { added: 0, updated: 0, removed: 0 };

  // Deletion markers: the latest delete time wins.
  const tombs = Object.assign({}, await kvGet('tomb', {}));
  const tIn = inV('tomb', {}); for (const id in tIn) tombs[id] = Math.max(tombs[id] || 0, tIn[id]);
  await kvSet('tomb', tombs);
  const dead = (id, u) => tombs[id] && tombs[id] > (u || 0);

  // Supplies (and their photos)
  const cur = {}; (await DB.all('inv')).forEach(i => cur[i.k] = i);
  const curPhotos = {}; (await DB.all('photos')).forEach(p => curPhotos[p.k] = p);
  const won = new Set();
  for (const i of d.inv || []) {
    if (dead(i.k, i.u)) continue;
    if (!cur[i.k]) { await DB.put('inv', i); sum.added++; won.add(i.k); cur[i.k] = i; }
    else if ((cur[i.k].u || 0) < (i.u || 0)) { await DB.put('inv', i); sum.updated++; won.add(i.k); cur[i.k] = i; }
  }
  for (const k in cur) if (dead(k, cur[k].u)) { await DB.del('inv', k); await DB.del('photos', k); delete cur[k]; sum.removed++; }
  for (const p of d.photos || []) if (cur[p.k] && (won.has(p.k) || !curPhotos[p.k])) await DB.put('photos', p);

  // People: one by one
  const mine = await kvGet('people', []), byId = {}; mine.forEach(p => byId[p.id] = p);
  for (const p of inV('people', [])) {
    if (dead(p.id, p.u)) continue;
    if (!byId[p.id]) { byId[p.id] = p; sum.added++; }
    else if ((byId[p.id].u || 0) < (p.u || 0)) { byId[p.id] = p; sum.updated++; }
  }
  for (const id in byId) if (dead(id, byId[id].u)) { delete byId[id]; sum.removed++; }
  await kvSet('people', Object.values(byId));

  // Saved AI chats: one by one, newest edit wins, deletions carry over
  const cby = {}; (await kvGet('chats', [])).forEach(c => cby[c.id] = c);
  for (const c of inV('chats', [])) {
    if (dead(c.id, c.u)) continue;
    if (!cby[c.id]) { cby[c.id] = c; sum.added++; }
    else if ((cby[c.id].u || 0) < (c.u || 0)) { cby[c.id] = c; sum.updated++; }
  }
  for (const id in cby) if (dead(id, cby[id].u)) { delete cby[id]; sum.removed++; }
  await kvSet('chats', Object.values(cby).sort((a, b) => b.u - a.u));

  // Map pins: one by one, newest edit wins, deletions carry over. Private pins stay out of merges from other devices only if the backup left them out.
  const pby = {}; (await kvGet('pins', [])).forEach(c => pby[c.id] = c);
  for (const c of inV('pins', [])) {
    if (dead(c.id, c.u)) continue;
    if (!pby[c.id]) { pby[c.id] = c; sum.added++; }
    else if ((pby[c.id].u || 0) < (c.u || 0)) { pby[c.id] = c; sum.updated++; }
  }
  for (const id in pby) if (dead(id, pby[id].u)) { delete pby[id]; sum.removed++; }
  await kvSet('pins', Object.values(pby));

  // Go-bag ticks: one by one, newest tick wins
  const gb = await kvGet('gobag', {}), gin = inV('gobag', {});
  for (const k in gin) {
    const a = gb[k], b = typeof gin[k] === 'object' ? gin[k] : { v: !!gin[k], u: 0 };
    if (!a || (typeof a === 'object' ? a.u || 0 : 0) < (b.u || 0)) gb[k] = b;
  }
  await kvSet('gobag', gb);

  // Notes: keep both if they differ, so nothing is lost
  const nMine = await kvGet('notes', ''), nIn = inV('notes', '');
  if (nIn && nIn !== nMine && !nMine.includes(nIn)) {
    const merged = nIn.includes(nMine) ? nIn : (nMine ? nMine + '\n\n--- from the other device ---\n' + nIn : nIn);
    await kvSet('notes', merged); sum.updated++;
  }

  // Starred guides: combine
  const fv = new Set(await kvGet('favs', [])); inV('favs', []).forEach(f => fv.add(f));
  await kvSet('favs', [...fv]);
  // Display settings (theme, text size, language) stay as set on this device.
  return `Merged: ${sum.added} added, ${sum.updated} updated, ${sum.removed} removed.`;
}
async function paintStorage() {
  const box = $('#stor'); if (!box) return; const L = LLM(), rows = []; let used = '';
  try { const e = await navigator.storage.estimate(); used = `<p class="dim">This app is using about ${(e.usage / 1048576).toFixed(0)} MB of ${(e.quota / 1048576 / 1024).toFixed(1)} GB it may use here.</p>`; } catch (x) {}
  let packs = []; try { packs = window.BHMap ? await window.BHMap.listPacks() : []; } catch (x) {}
  for (const p of packs) rows.push(`<div class="row"><span class="grow"><b>${esc(p.name)}</b><br><span class="dim">Map pack · ${p.mb} MB</span></span><button class="dng" data-rmp="${esc(p.id)}">Remove</button></div>`);
  if (packs.length > 1) rows.push('<div class="row"><button class="dng" id="rmAll">Remove all map packs</button></div>');
  if (!packs.length) rows.push('<p class="dim">No map packs loaded.</p>');
  if (L) { let st = null; try { st = await L.status(); } catch (x) {} if (st && st.installed) rows.push(`<div class="row"><span class="grow"><b>On-device AI pack</b><br><span class="dim">${st.sizeMB} MB on the phone · ${st.loaded ? 'loaded in memory now' : 'not in memory'}</span></span>${st.loaded ? '<button id="aiFree">Free memory</button>' : ''}<button class="dng" id="aiRm">Delete</button></div>`); else rows.push('<p class="dim">On-device AI pack: not installed.</p>'); } else rows.push('<p class="dim">On-device AI: only in the Android app.</p>');
  box.innerHTML = used + rows.join('') + '<p class="dim">Removing a map pack or the AI pack frees space. You can add them again from the flash drive any time. Your supplies, notes, people, chats and pins are not touched.</p>';
  box.onclick = async e => {
    const b = e.target, id = b.dataset && b.dataset.rmp;
    if (id) { if (!confirm('Remove this map pack from the device?')) return; await window.BHMap.removePackById(id); return paintStorage(); }
    if (b.id === 'rmAll') { if (!confirm('Remove ALL map packs from this device? Your pins are kept.')) return; for (const p of await window.BHMap.listPacks()) await window.BHMap.removePackById(p.id); return paintStorage(); }
    if (b.id === 'aiFree') { await L.unload(); return paintStorage(); }
    if (b.id === 'aiRm') { if (!confirm('Delete the AI pack from this phone? You can install it again later.')) return; await L.deleteModel(); return paintStorage(); }
  };
}
/* ---------- Appearance: themes, accent colours, text size, spacing, busy animation ---------- */
const THEMES = { dark: ['Dark', '#07090c', '#10141a'], midnight: ['Midnight', '#070b16', '#0e1527'], forest: ['Forest', '#060b08', '#0d1712'], amoled: ['Black', '#000000', '#0a0a0a'], light: ['Light', '#f6f5f1', '#ffffff'], sand: ['Sand', '#f4eee2', '#fffdf8'] };
const LIGHT_THEMES = new Set(['light', 'sand']);
const ACCENTS = { amber: ['Amber', '#f0b429', '#a86a00'], coral: ['Coral', '#ff7a6b', '#c0392b'], teal: ['Teal', '#2dd4bf', '#0f766e'], sky: ['Sky', '#4da3ff', '#1d5fbf'], violet: ['Violet', '#a98bff', '#6d3fd6'], green: ['Green', '#4cc38a', '#1d7f55'], rose: ['Rose', '#ff6fa5', '#c2185b'] };
const SIZES = { s: ['Small', 15], m: ['Medium', 16], l: ['Large', 18], xl: ['Extra large', 20] };
const DENS = { compact: ['Compact', 34, 10], normal: ['Normal', 38, 12], roomy: ['Roomy', 44, 16] };
const VIZ_TYPES = { hop: 'Hopping dots', wave: 'Wave', pulse: 'Pulse', bars: 'Bars', sweep: 'Sweep' };
const VIZ_PALS = { sunset: ['Sunset', ['#f0b429', '#ff7a6b', '#a98bff']], ocean: ['Ocean', ['#4da3ff', '#2dd4bf', '#7dd3fc']], forest: ['Forest', ['#4cc38a', '#a3e635', '#2dd4bf']], rose: ['Rose', ['#ff6fa5', '#ff9a8a', '#c18bff']], accent: ['Match accent', null] };
const VIZ_SIZES = { tiny: ['Tiny', 5], small: ['Small', 6.5], medium: ['Medium', 8], large: ['Large', 11] };
const LOOK_DEF = { theme: 'dark', acc: 'amber', size: 'm', dens: 'normal', viz: 'hop', pal: 'sunset', vsz: 'small' };
const hexAlpha = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
function applyLook(look) {
  const L = Object.assign({}, LOOK_DEF, look || {}), r = document.documentElement, st = r.style;
  r.dataset.theme = THEMES[L.theme] ? L.theme : 'dark'; const light = LIGHT_THEMES.has(r.dataset.theme);
  const a = ACCENTS[L.acc] || ACCENTS.amber, acc = light ? a[2] : a[1];
  st.setProperty('--acc', acc); st.setProperty('--accfg', light ? '#ffffff' : '#111111');
  st.setProperty('--fs', (SIZES[L.size] || SIZES.m)[1] + 'px');
  const d = DENS[L.dens] || DENS.normal; st.setProperty('--ctl', d[1] + 'px'); st.setProperty('--pad', d[2] + 'px');
  const pal = (VIZ_PALS[L.pal] || VIZ_PALS.sunset)[1] || [acc, hexAlpha(acc, .7), hexAlpha(acc, .45)];
  st.setProperty('--c1', pal[0]); st.setProperty('--c2', pal[1]); st.setProperty('--c3', pal[2]);
  st.setProperty('--vs', String((VIZ_SIZES[L.vsz] || VIZ_SIZES.small)[1]));
  window.__viz = { type: VIZ_TYPES[L.viz] ? L.viz : 'hop' };
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = getComputedStyle(r).getPropertyValue('--bg').trim() || '#000000';
  try { localStorage.setItem('bh_look', JSON.stringify(L)); } catch (e) {}
  return L;
}
async function getLook() {
  let l = await kvGet('look', null);
  if (!l) { const th = await kvGet('theme', 'dark'), big = await kvGet('big', false); l = { theme: th === 'light' ? 'light' : 'dark', size: big ? 'xl' : 'm' }; }   // settings from before 3.12
  return Object.assign({}, LOOK_DEF, l);
}
async function setLook(patch) { const l = Object.assign(await getLook(), patch); await kvSet('look', l); applyLook(l); return l; }
function lookInner(L) {
  const seg = (key, map, cur) => `<div class="seg">${Object.entries(map).map(([k, v]) => `<button class="${cur === k ? 'on' : ''}" data-k="${key}" data-v="${k}">${esc(Array.isArray(v) ? v[0] : v)}</button>`).join('')}</div>`;
  return `<label>Theme</label><div class="swrow">${Object.entries(THEMES).map(([k, [n, c1, c2]]) => `<button class="sw${L.theme === k ? ' on' : ''}" data-k="theme" data-v="${k}"><span class="swc" style="background:linear-gradient(135deg,${c1} 50%,${c2} 50%)"></span>${esc(n)}</button>`).join('')}</div>
    <label>Accent colour</label><div class="swrow">${Object.entries(ACCENTS).map(([k, [n, c1]]) => `<button class="sw dot${L.acc === k ? ' on' : ''}" data-k="acc" data-v="${k}" aria-label="${esc(n)}" title="${esc(n)}"><span class="swc" style="background:${c1}"></span></button>`).join('')}</div>
    <label>Text size</label>${seg('size', SIZES, L.size)}
    <label>Buttons and spacing</label>${seg('dens', DENS, L.dens)}
    <label>Busy animation</label>${seg('viz', VIZ_TYPES, L.viz)}
    <label>Busy animation colours</label>${seg('pal', VIZ_PALS, L.pal)}
    <label>Busy animation size</label>${seg('vsz', VIZ_SIZES, L.vsz)}
    <div class="vzprev">${Tasks.orb(null, false)}<span class="dim">This is how the busy animation looks</span></div>`;
}

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
async function vData() {
  setTab('data'); await loadInv();
  const last = await kvGet('lastBackup', null), LK = await getLook();
  let usage = ''; try { const e = await navigator.storage.estimate(); usage = `${(e.usage / 1048576).toFixed(1)} MB used`; } catch (x) {}
  const installed = isNative() || isDesktopApp();
  const offline = installed || ('serviceWorker' in navigator && navigator.serviceWorker.controller);
  view.innerHTML = `<h1>Settings</h1>
  <h2>Appearance</h2><div id="lookbox">${lookInner(LK)}</div>
  <h2>Back up and move your data</h2>
  <p>Your supplies, photos, stars and settings live only on this device. Save a backup file to the flash drive, then restore it on any other device.</p>
  <p class="dim">Last backup: ${last ? esc(last.slice(0, 16).replace('T', ' ')) : 'never'} · ${inv.length} items · ${usage}</p>
  <div class="row"><button class="pri" id="exp">Save backup file</button></div>
  <label>Restore from a backup file</label><input type="file" id="imp" accept=".json,application/json">
  <div class="row"><button id="impm">Merge into this device</button><button class="dng" id="impr">Replace everything</button></div>
  <p class="dim"><b>Merge</b> combines both: for each item, person and tick the newest edit wins, deletions carry over, and notes from both devices are kept. <b>Replace</b> makes this device an exact copy of the backup.</p>
  <h2>Offline status</h2>
  <p>${offline ? `<span class="ok">Ready: ${installed ? 'this is the installed app, with everything inside it.' : 'this app is stored on the device and works with no signal.'}</span>` : 'Not yet installed for offline use on this device. See the README on the flash drive (start-laptop, or the phone steps), then reopen.'}</p>
  ${deferredInstall ? '<button id="inst" class="pri">Install as an app</button>' : ''}
  <h2>Storage: what is loaded on this device</h2>
  <div id="stor"><p class="dim">Checking…</p></div>
  <h2>About</h2><p class="dim">Version 0.1. Library: ${LIB.items.length} guides in ${LIB.cats.length} topics.</p>`;
  paintStorage();
  $('#exp').onclick = async () => { await exportAll(); vData(); };
  const run = async rep => { const f = $('#imp').files[0]; if (!f) return alert('Choose a backup file first.'); if (rep && !confirm('This erases what is on this device first. Continue?')) return; try { alert(await importAll(f, rep)); vData(); } catch (e) { alert(e.message); } };
  $('#impm').onclick = () => run(false); $('#impr').onclick = () => run(true);
  if ($('#inst')) $('#inst').onclick = () => deferredInstall.prompt();
  $('#lookbox').onclick = async e => { const b = e.target.closest('[data-k]'); if (!b) return; const l = await setLook({ [b.dataset.k]: b.dataset.v }); $('#lookbox').innerHTML = lookInner(l); };
}
async function applyPrefs() { applyLook(await getLook()); }

function showStorageWarning() {
  const d = document.createElement('div'); d.className = 'warn'; d.style.margin = '8px 12px';
  d.textContent = 'This device would not let the app save data, so anything you add will be lost when you close it. Install the app version, or use Data > Save backup file often.';
  $('#top').after(d);
}

/* ---------- router ---------- */
function route() {
  const h = decodeURIComponent(location.hash.slice(1) || '/'), p = h.split('/').filter(Boolean);
  $('#modal').hidden = true;
  if (p[0] !== 'ask') { document.body.classList.remove('ask'); $('#composer').hidden = true; }
  Tasks.clearBlip({ ask: 'ask', meds: 'meds', ency: 'meds', map: 'map', inventory: 'inventory', phrases: 'phrases', data: 'data' }[p[0]] || 'home');
  if (window.BHMap && p[0] !== 'map') { window.BHMap.leave(); view.className = ''; }
  if (!p.length) vHome();
  else if (p[0] === 'cat') vCat(p[1]);
  else if (p[0] === 'e') vEntry(p[1]);
  else if (p[0] === 'search') vSearch(p.slice(1).join('/'));
  else if (p[0] === 'inventory') { p[1] ? vInv().then(() => invForm(p[1])) : vInv(); }
  else if (p[0] === 'gobag') vGobag();
  else if (p[0] === 'notes') vNotes();
  else if (p[0] === 'people') { vPeople().then(async () => { if (p[1]) personForm(await kvGet('people', []), p[1]); }); }
  else if (p[0] === 'phrases') vPhrases();
  else if (p[0] === 'ask') vAsk();
  else if (p[0] === 'data') vData();
  else if (p[0] === 'meds') window.BHMeds.open(view, p.slice(1));
  else if (p[0] === 'ency') window.BHEncy.open(view, p.slice(1));
  else if (p[0] === 'map') window.BHMap.open(view, p.slice(1));
  else vHome();
  if (p[0] !== 'e') window.scrollTo(0, 0);
  Tasks.refresh(); setTimeout(Tasks.refresh, 350);
}
$('#homeBtn').onclick = () => { location.hash = '#/'; };
Tasks.init();
try { applyLook(JSON.parse(localStorage.getItem('bh_look') || 'null')); } catch (e) { applyLook(null); }
$('#quickBtn').onclick = () => { location.hash = '#/e/quick-sheet'; };
$('#searchForm').onsubmit = e => { e.preventDefault(); const q = $('#q').value.trim(); if (q) location.hash = '#/search/' + encodeURIComponent(q); $('#q').blur(); };
window.addEventListener('hashchange', route);

window.BHAPP = { DB, kvGet, kvSet, esc, tomb, uid, setTab, isNative };
(async function init() {
  await DB.open();
  favs = await kvGet('favs', []);
  await applyPrefs();
  route();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !isNative()) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (!DB.db) showStorageWarning();
})();
})();
