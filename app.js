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
  lost: ['separated', 'navigation'], scared: ['stress', 'panic'], thief: ['security', 'de-escalating'], robbery: ['de-escalating'], zulu: ['phrases'], translate: ['phrases']
};
const toks = q => q.toLowerCase().split(/[^a-z0-9À-ɏ]+/).filter(Boolean);
const STOP = new Set('a an the i me my we our you your is are am be do does did how what when where why which who can could should would will to of for and or in on at it its this that with from if as by about there any some get have has suggestion suggest advice please tell explain give make unknown thing things something need want know use using after before someone somebody without best way ways good okay'.split(' '));
const search = q => searchScored(q).map(r => r.i);
window.BH = { searchScored }; // used for testing
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
  const need = ts.length <= 2 ? 1 : Math.max(1, Math.ceil(ts.length * 0.34)), res = [];
  for (const i of LIB.items) {
    let s = 0, n = 0;
    for (const t of ts) {
      let h = score(i, t);
      for (const alt of SYN[t] || []) h = Math.max(h, Math.round(score(i, alt) * .8));
      if (h) { n++; s += h; }
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
function plainGuide(body, max) {
  const t = String(body).replace(/\r/g, '').split('\n').map(l => l.trim().replace(/^## /, '').replace(/^[!>] /, '').replace(/\*\*/g, '').replace(/^\|/, '').replace(/\|$/, '').replace(/\s*\|\s*/g, ' | ')).filter(Boolean).join('\n');
  if (t.length <= max) return t;
  const cut = t.lastIndexOf('\n', max); return t.slice(0, cut > max * .5 ? cut : max);
}
function buildPrompt(q, hits, ctx = '', scale = 1) {
  // Shorter guide text means less for the phone to read before it can start answering.
  const guides = hits.map(i => `### ${i.title}\n${plainGuide(i.body, Math.round((hits.length > 1 ? 1000 : 1500) * scale))}`).join('\n\n');
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
  const box = $('#chats'); if (!box) return;
  const cs = await getChats();
  $('#chatn').textContent = cs.length ? `(${cs.length})` : '';
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

async function vAsk() {
  setTab('ask'); await loadInv();
  const L = LLM();
  view.innerHTML = `<h1>Ask the library</h1>
  <p class="dim">Type a question. The matching guides appear straight away${L ? ', and the AI starts answering (uses battery)' : ''}.</p>
  <form id="askf" class="row"><input class="grow" id="askq" type="text" placeholder="e.g. how do I treat a burn?"><button class="pri" id="askgo">Ask</button><button type="button" id="askg" hidden>Guides only</button></form>
  <div class="row" id="askph" hidden><span class="dim">Ask about photos (up to ${MAX_PHOTOS}):</span>${onPhone() ? '<button type="button" id="askcam">Take photo</button>' : ''}<button type="button" id="askpic">${onPhone() ? 'Choose photo' : 'Upload photos'}</button><input type="file" id="askfile" accept="image/*" multiple hidden></div>
  <div id="askpv"></div>
  <div id="ans" class="chat"></div>
  <details id="chatbox" style="margin-top:12px"><summary class="dim">Saved chats <span id="chatn"></span></summary><div id="chats"></div></details>
  <div id="aibox"></div>`;
  let st = null;
  if (L) { try { st = await L.status(); } catch (e) { st = null; } }
  const hasModel = () => st && st.installed;
  const paintBox = async () => {
    const box = $('#aibox'); if (!box) return;
    if (!L) { box.innerHTML = `<div class="note"><b>On-device AI:</b> available in the Android app. On this device you get the guides, which are the more reliable source anyway.</div>`; return; }
    try { st = await L.status(); } catch (e) {}
    $('#askg').hidden = !hasModel(); $('#askph').hidden = !hasModel();
    const be = await kvGet('aiBackend', 'cpu'), th = await kvGet('aiThreads', 4), scOn = (await kvGet('aiScores', {})) || {};
    box.innerHTML = hasModel()
      ? `<div class="note"><b>AI pack installed</b> (${st.sizeMB} MB)${st.loaded ? ', loaded (' + esc(st.backend) + ')' : ''}. It loads when you ask and frees itself after 10 idle minutes. Use <b>Guides only</b> to save battery.</div>
         <details><summary class="dim">AI settings</summary>
         <label>Speed mode</label><select id="aibe"><option value="cpu"${be === 'cpu' ? ' selected' : ''}>Standard (CPU): safest</option>${isNative() ? `<option value="gpu"${be === 'gpu' ? ' selected' : ''}>GPU: faster and gentler on battery, if your phone supports it</option>` : ''}</select>
         <label>CPU threads (try 4 first; changing it reloads the model)</label><select id="aith">${[2, 3, 4, 5, 6, 8].map(n => `<option value="${n}"${n === th ? ' selected' : ''}>${n}${n === 4 ? ' (standard)' : ''}</option>`).join('')}</select>
         <label>My own instructions for the AI (optional; used for every answer)</label><textarea id="aiextra" rows="4" placeholder="e.g. Put every numbered step on its own line. Keep answers under 100 words. Always give metric units.">${esc(await kvGet('aiExtra', ''))}</textarea>
         <p class="dim">Write them as plain sentences. They are added to the AI's built-in rules and never replace its safety rules. Saved on this device only.</p>
         <label>Reliability scores (off by default)</label>
         <p class="dim">A percentage can sound more certain than it is, so these are off until you switch them on. They are estimates, never a guarantee: use them as one clue next to your own judgement.</p>
         ${SCORES.map(x => `<label style="display:flex;gap:10px;color:var(--fg);align-items:flex-start;margin:6px 0"><input type="checkbox" class="sc" data-id="${x.id}"${scOn[x.id] ? ' checked' : ''} style="width:22px;height:22px;flex:0 0 auto"><span><b>${esc(x.name)}</b><br><span class="dim">${esc(x.info)} ${x.kind === 'app' ? 'Worked out by the app.' : 'Rated by the AI.'}</span></span></label>`).join('')}
         <div class="row"><button id="aiunload">Free memory now</button><button class="dng" id="aidel">Delete the AI pack</button></div></details>`
      : `<div class="note"><b>On-device AI: not installed.</b> ${window.BHLLM && !isNative() ? 'Choose the model file (<code>.litertlm</code>, about 3.7 GB) from the flash drive (Models folder). It is copied onto this computer once.' : 'Copy the model file (<code>.litertlm</code>, about 3.7 GB) to the phone, then choose it here.'} You need about ${Math.round((3700 + 300))} MB free${st ? ' (you have ' + st.freeMB + ' MB)' : ''}.</div>
         <div class="row"><button class="pri" id="aiinst">Install AI pack</button></div><p class="dim" id="ip"></p>`;
    if ($('#aibe')) $('#aibe').onchange = e => kvSet('aiBackend', e.target.value);
    if ($('#aith')) $('#aith').onchange = e => kvSet('aiThreads', +e.target.value);
    document.querySelectorAll('.sc').forEach(c => c.onchange = async () => { const o = Object.assign({}, (await kvGet('aiScores', {})) || {}); o[c.dataset.id] = c.checked; await kvSet('aiScores', o); });
    if ($('#aiextra')) $('#aiextra').onchange = e => kvSet('aiExtra', e.target.value.trim().slice(0, 1200));
    if ($('#aiunload')) $('#aiunload').onclick = async () => { await L.unload(); paintBox(); };
    if ($('#aidel')) $('#aidel').onclick = async () => { if (confirm('Delete the AI pack from this phone? You can install it again later.')) { await L.deleteModel(); paintBox(); } };
    if ($('#aiinst')) $('#aiinst').onclick = async () => {
      $('#aiinst').disabled = true; $('#ip').textContent = 'Choose the model file…';
      const h = await L.addListener('installProgress', p => { $('#ip').textContent = `Copying… ${p.copiedMB} of ${p.totalMB} MB. Keep the app open.`; });
      try { const r = await L.pickModel(); alert('AI pack installed (' + r.sizeMB + ' MB).'); }
      catch (e) { if (!/cancel/i.test(e.message || '')) alert(e.message || 'Install failed.'); }
      finally { h.remove(); paintBox(); }
    };
  };
  paintBox(); paintChats();
  { const pf = await kvGet('askPrefill', ''); if (pf) { $('#askq').value = pf; kvSet('askPrefill', ''); } }

  // One tap: guides appear, and (if the AI is installed) the AI starts answering at once.
  const ask = async withAI => {
    const q = $('#askq').value.trim(); if (!q && !photos.length) return;
    const scored = q ? searchScored(q).slice(0, 5) : [], hits = scored.map(r => r.i);
    // Guides the AI may use: the best one, plus the next only if nearly as relevant.
    const forAI = scored.filter((r, k) => k === 0 || (k === 1 && r.s >= scored[0].s * 0.8)).map(r => r.i);
    // grounded = a clearly matching guide; mixed = only loosely related guides; own = nothing relevant.
    const top = scored[0];
    const mode = photos.length ? 'photo' : !forAI.length ? 'own' : (top.s >= STRONG_MATCH && top.n / top.t >= 0.6) ? 'grounded' : 'mixed';
    const pic = photos.slice();
    window.BH_LAST_MODE = mode; // used for testing
    const canAI = hasModel();
    const med = canAI && window.BHMeds && q ? await window.BHMeds.context(q) : null;   // matching South African medicine cards and guideline extracts
    const gpref = await kvGet('askGuides', null), gopen = gpref === null ? !canAI : !!gpref;
    // how strongly the guides match (0 to 100), worked out here and shown only if the Handbook Support Score is switched on
    const support = !forAI.length ? 0 : mode === 'grounded' ? Math.round(70 + 30 * Math.min(1, (top.s - STRONG_MATCH) / 30)) : Math.round(10 + 40 * Math.min(1, top.s / STRONG_MATCH));
    $('#ans').innerHTML = `<div class="msg me">${pic.map(u => `<img src="${u}" style="max-width:31%;border-radius:8px;margin:0 6px 6px 0">`).join('')}${pic.length ? '<br>' : ''}${esc(q || PHOTO_Q)}</div>
      ${canAI ? `<div id="aiout"></div>${withAI ? '' : '<div class="row"><button class="pri" id="aigo">Get an AI answer</button><span class="dim">Uses battery and warms the phone.</span></div>'}` : ''}
      ${pic.length && !hits.length ? '' : hits.length ? `<details id="gdet"${gopen ? ' open' : ''}><summary class="msg" style="cursor:pointer">Most relevant guides (${hits.length}) <span class="dim">tap to ${gopen ? 'hide' : 'show'}</span></summary>${hits.map(i => itemCard(i, `<div class="snip">${snippet(i, q)}</div>`)).join('')}</details>` : '<div class="msg">Nothing matched. Try different words.</div>'}`;
    // remember whether the guides were left open or closed (the first time: closed when the AI is answering, open when it is not)
    if ($('#gdet')) $('#gdet').querySelector('summary').onclick = () => setTimeout(() => { const d = $('#gdet'); if (d) { kvSet('askGuides', d.open); const h = d.querySelector('summary .dim'); if (h) h.textContent = 'tap to ' + (d.open ? 'hide' : 'show'); } }, 0);
    const go = async () => { const g = $('#aigo'); if (g) g.disabled = true; await runAI(q, forAI, mode, await contextText(), async () => { await paintBox(); await paintChats(); }, follow, pic, { support, med }); if (g) g.disabled = false; };
    if ($('#aigo')) $('#aigo').onclick = go;
    if (canAI && withAI) go();
    if (pic.length) { photos = []; paintPhoto(); }
  };
  // Photo for the AI: taken with the camera or chosen from the gallery, shrunk first so it is quicker to read.
  let photos = [];
  const paintPhoto = () => {
    $('#askpv').innerHTML = photos.length ? `<div class="card"><div style="display:flex;flex-wrap:wrap;gap:8px">${photos.map((u, i) => `<div style="position:relative"><img src="${u}" style="height:90px;border-radius:8px;display:block"><button type="button" class="askpx" data-i="${i}" style="position:absolute;top:2px;right:2px;padding:2px 8px;min-height:0">✕</button></div>`).join('')}</div>
      <div class="row"><button type="button" id="askpall">Remove all</button><span class="dim">${photos.length} of ${MAX_PHOTOS} photos. Add more angles if one is not enough. Type a question, or just tap Ask.</span></div></div>` : '';
    document.querySelectorAll('.askpx').forEach(b => b.onclick = () => { photos.splice(+b.dataset.i, 1); paintPhoto(); });
    if ($('#askpall')) $('#askpall').onclick = () => { photos = []; paintPhoto(); };
  };
  const takePhoto = async cam => { if (photos.length >= MAX_PHOTOS) { alert('Up to ' + MAX_PHOTOS + ' photos at a time.'); return; } const d = await getPhoto(cam); if (d) { photos.push(d); paintPhoto(); $('#askq').placeholder = 'About these photos (optional)'; } };
  // Computer: pick several image files at once.
  const uploadPhotos = () => { const i = $('#askfile'); i.value = ''; i.onchange = async () => { const fs = [...i.files].slice(0, MAX_PHOTOS - photos.length); if (i.files.length > fs.length) alert('Up to ' + MAX_PHOTOS + ' photos at a time: the extra ones were left out.'); for (const f of fs) { const d = await shrink(f); if (d) photos.push(d); } paintPhoto(); $('#askq').placeholder = 'About these photos (optional)'; }; i.click(); };
  if ($('#askcam')) $('#askcam').onclick = () => takePhoto(true);
  $('#askpic').onclick = () => onPhone() ? takePhoto(false) : uploadPhotos();
  // After an answer: "Ask a follow-up" ticks that chat as background and returns to the question box.
  const follow = id => { if (!ctxIds.includes(id)) { ctxIds.push(id); while (ctxIds.length > MAX_CTX) ctxIds.shift(); } paintChats(); const i = $('#askq'); i.value = ''; i.placeholder = 'Your follow-up question…'; i.focus(); window.scrollTo(0, 0); };
  $('#askf').onsubmit = e => { e.preventDefault(); ask(true); };
  $('#askg').onclick = () => ask(false);
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
async function runAI(q, hits, mode, ctx, done, follow, photo, meta) {
  const L = LLM(), out = $('#aiout'); if (!L || !out) return;
  if (AI_NO_HARM.test(q)) {
    out.innerHTML = '<div class="msg">I will not help with making weapons or explosives. For protecting your group, see the Security and Weapons safety guides.</div>';
    return;
  }
  const own = mode !== 'grounded', isPhoto = mode === 'photo' && !!photo && photo.length > 0;
  out.innerHTML = `<div class="${own ? 'warn' : 'note'}" id="aitag">${AI_TAG[mode]}${meta && meta.med ? ' Medical extracts (South African guidelines and a general encyclopedia) were given to the AI; anything outside them is the AI\u2019s own opinion and is labelled.' : ''}</div>
    <div class="think" id="aithink"><div class="steps"><span data-s="1" class="on">1 Loading</span><span data-s="2">2 Reading</span><span data-s="3">3 Writing</span></div><div class="bar"><i></i></div><p class="dim" id="aiwait"></p></div>
    <div class="msg" id="aitext" hidden></div><div class="row"><button id="aistop">Stop</button></div><p class="dim" id="aifoot"></p><div id="aifollow"></div>`;
  const txt = $('#aitext'), wait = $('#aiwait');
  const setStep = n => out.querySelectorAll('.steps span').forEach(s => { s.className = +s.dataset.s < n ? 'done' : +s.dataset.s === n ? 'on' : ''; });
  let onScores = [];
  let tok = null, stopped = false, got = false, phase = isPhoto ? 'Loading the AI and its picture reader' : 'Loading the AI', shown = '', looped = false;
  const t0 = Date.now(), sec = ms => Math.round(ms / 1000);
  // A visible clock and step display, so a slow phone never looks frozen.
  const tick = setInterval(() => {
    const s = sec(Date.now() - t0);
    wait.textContent = got ? `Writing… ${shown.trim() ? shown.trim().split(/\s+/).length : 0} words, ${s} s` : `${phase}… ${s} s. The first words can take a minute or more on this phone. Tap Stop to cancel.`;
  }, 1000);
  wait.textContent = phase + '…';
  $('#aistop').onclick = async () => { stopped = true; try { await L.stop(); } catch (e) {} };
  try {
    const ld = await L.load({ backend: await kvGet('aiBackend', 'cpu'), threads: await kvGet('aiThreads', 4), vision: isPhoto });
    phase = isPhoto ? 'Looking at your photo' : 'Reading the guides and your question'; setStep(2);
    tok = await L.addListener('token', ev => {
      if (looped) return;
      if (!got) { got = true; setStep(3); txt.hidden = false; }
      shown += ev.text; const cut = trimRepeat(shown);
      if (cut !== null) { looped = true; shown = cut; txt.textContent = tidy(splitScores(shown).body); stopped = true; L.stop().catch(() => {}); return; }
      txt.textContent = tidy(splitScores(shown).body);
    });
    const pw = isPhoto && photo.length > 1 ? photo.length + ' PHOTOS (all of the same subject, from different angles)' : 'THE PHOTO';
    const med = meta && meta.med;
    const cutLines = (t, max) => { if (t.length <= max) return t; const c = t.lastIndexOf('\n', max); return t.slice(0, c > max * 0.5 ? c : max); };
    const compose = (gs, cu, mm) => {
      const bp = (qq, hh) => buildPrompt(qq, hh, cu, gs);
      const pr = isPhoto ? (hits.length ? bp(q, hits).replace(/^GUIDES:/, 'POSSIBLY RELATED GUIDES (they may not apply to the photo):').replace(/QUESTION:/, 'QUESTION ABOUT ' + pw + ':') : `${cu}QUESTION ABOUT ${pw}: ${q || PHOTO_Q}`)
        : mode === 'grounded' ? bp(q, hits)
        : mode === 'mixed' ? bp(q, hits).replace(/^GUIDES:/, 'POSSIBLY RELATED GUIDES (they may not answer the question):')
        : `${cu}QUESTION: ${q}`;
      const mt = med ? cutLines(med.text, mm) : '';
      return mt ? pr.replace(/QUESTION(?: ABOUT[^:]*)?:/, m => 'SOUTH AFRICAN MEDICAL SOURCES (official guideline and medicine extracts):\n' + mt + '\n\n' + m) : pr;
    };
    const medRule = med ? ' MEDICAL SOURCES: the message contains official South African medicine and guideline extracts, and sometimes general encyclopedia extracts. Prefer the South African extracts. When you give a dose or a medical fact that is in them, quote it and name the source (for example "PHC guideline 4.7"); if you use an encyclopedia extract, say "from the encyclopedia (general, not South African)". If something the person needs is NOT in the extracts, do not hold back: give your best opinion, but begin that part with "My own opinion (not from the sources):" and say how sure you are.' : '';
    onScores = await scoresOn();
    const sInstr = scoreInstr(onScores, mode), sExtra = sInstr ? 40 : 0;
    const sysText = (await withExtra(isPhoto ? AI_SYSTEM_PHOTO : own ? AI_SYSTEM_OWN : AI_SYSTEM)) + sInstr + medRule, maxTok = (isPhoto ? 340 : own ? 260 : 240) + sExtra + (med ? 80 : 0);
    // The AI can hold about 3,000 tokens (question and answer together). Trim background step by step until it fits: earlier chats first, then the extra medical text, then the guide text.
    const CAP = isPhoto ? 6144 : 3072, limit = Math.max(2400, Math.round((CAP - maxTok - 150) * 3.3) - (isPhoto ? photo.length * 1000 : 0));
    const steps = [[1, ctx, 4200], [1, '', 4200], [1, '', 2600], [0.6, '', 2600], [0.6, '', 1500], [0.35, '', 1500], [0.35, '', 800], [0.2, '', 500]];
    let fullPrompt = '', trimmed = 0;
    for (let k = 0; k < steps.length; k++) { fullPrompt = compose(...steps[k]); trimmed = k; if (sysText.length + fullPrompt.length <= limit) break; }
    const genOnce = pr => L.generate({ system: sysText, prompt: pr, maxTokens: maxTok, images: isPhoto ? photo : [] });
    let r;
    try { r = await genOnce(fullPrompt); }
    catch (e1) {
      if (/too long|maximum number of tokens|exceeding/i.test(String(e1 && e1.message))) { phase = 'The question was long, so trying again with less background'; trimmed = 99; r = await genOnce(compose(0.2, '', 400)); }
      else throw e1;
    }
    $('#aifoot').textContent = `${looped ? 'Stopped automatically because the AI began repeating itself. ' : (stopped || r.stopped ? 'Stopped. ' : '')}Load ${sec(ld.ms)} s${ld.reused ? ' (already loaded)' : ''}, first words after ${r.firstMs >= 0 ? sec(r.firstMs) : '?'} s, finished after ${sec(r.ms)} s (${ld.backend}, ${ld.threads} threads). ${trimmed ? 'Long question: some background text was left out so the AI could read it. ' : ''}` + (own
      ? 'Treat the AI\u2019s own ideas as suggestions, not facts, and prefer the safest option.'
      : 'AI answers can be wrong: check the guides below.');
  } catch (e) {
    $('#aifoot').textContent = (stopped ? 'Stopped. ' : 'The AI could not answer: ' + (e.message || e) + '. ') + 'The guides below still work.';
    if (!stopped && out) out.insertAdjacentHTML('afterbegin', '<div class="warn"><b>The AI did not give an answer.</b> ' + esc(/too long|maximum number of tokens/i.test(String(e && e.message)) ? 'The question and its background were too long for it to read at once. Try asking it on its own, without ticked earlier chats.' : String(e && e.message || e)) + '</div>');
  } finally {
    clearInterval(tick);
    const th = $('#aithink'); if (th) th.hidden = true;
    if (tok) tok.remove(); const b = $('#aistop'); if (b) b.remove();
    const sp = splitScores(shown), vals = Object.assign({}, sp.vals); if (meta && typeof meta.support === 'number') vals.support = meta.support;
    const body = tidy(sp.body.trim());
    if (txt && shown.trim()) txt.textContent = body;
    const box = shown.trim() ? scoreBox(onScores, mode, vals) : ''; if (box) { const f0 = $('#aifollow'); if (f0) f0.insertAdjacentHTML('beforebegin', box); }
    if (shown.trim() && meta && meta.med && meta.med.links.length) { const f1 = $('#aifollow'); if (f1) f1.insertAdjacentHTML('beforebegin', '<p class="dim">Sources used: ' + meta.med.links.map(l => `<a href="${l.href}">${esc(l.label)}</a>`).join(' \u00b7 ') + '</p>'); }
    const sline = box ? '\n\nScores (estimates): ' + onScores.filter(x => x.modes.includes(mode)).map(x => x.name + ' ' + (typeof vals[x.id] === 'number' ? vals[x.id] + '%' : 'not given')).join(', ') : '';
    if (shown.trim()) {
      const c = await saveChat(isPhoto ? '📷 ' + (q || PHOTO_Q) : q, body + sline, mode, hits.map(h => h.id));
      const f = $('#aifollow'); if (f) { f.innerHTML = '<div class="row"><button id="aifu">Ask a follow-up</button><span class="dim">Saved to your chats.</span></div>'; $('#aifu').onclick = () => follow && follow(c.id); }
    }
    if (done) done();
  }
}
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
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
async function vData() {
  setTab('data'); await loadInv();
  const last = await kvGet('lastBackup', null), theme = await kvGet('theme', 'dark'), big = await kvGet('big', false);
  let usage = ''; try { const e = await navigator.storage.estimate(); usage = `${(e.usage / 1048576).toFixed(1)} MB used`; } catch (x) {}
  const installed = isNative() || isDesktopApp();
  const offline = installed || ('serviceWorker' in navigator && navigator.serviceWorker.controller);
  view.innerHTML = `<h1>Data and settings</h1>
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
  <h2>Display</h2>
  <div class="row"><button id="th">Theme: ${theme}</button><button id="bg">Large text: ${big ? 'on' : 'off'}</button></div>
  <h2>About</h2><p class="dim">Version 0.1. Library: ${LIB.items.length} guides in ${LIB.cats.length} topics.</p>`;
  paintStorage();
  $('#exp').onclick = async () => { await exportAll(); vData(); };
  const run = async rep => { const f = $('#imp').files[0]; if (!f) return alert('Choose a backup file first.'); if (rep && !confirm('This erases what is on this device first. Continue?')) return; try { alert(await importAll(f, rep)); vData(); } catch (e) { alert(e.message); } };
  $('#impm').onclick = () => run(false); $('#impr').onclick = () => run(true);
  if ($('#inst')) $('#inst').onclick = () => deferredInstall.prompt();
  $('#th').onclick = async () => { await kvSet('theme', theme === 'dark' ? 'light' : 'dark'); applyPrefs(); vData(); };
  $('#bg').onclick = async () => { await kvSet('big', !big); applyPrefs(); vData(); };
}
async function applyPrefs() {
  const r = document.documentElement; r.dataset.theme = await kvGet('theme', 'dark'); r.dataset.big = String(await kvGet('big', false));
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = r.dataset.theme === 'dark' ? '#000000' : '#fafaf7';
}

function showStorageWarning() {
  const d = document.createElement('div'); d.className = 'warn'; d.style.margin = '8px 12px';
  d.textContent = 'This device would not let the app save data, so anything you add will be lost when you close it. Install the app version, or use Data > Save backup file often.';
  $('#top').after(d);
}

/* ---------- router ---------- */
function route() {
  const h = decodeURIComponent(location.hash.slice(1) || '/'), p = h.split('/').filter(Boolean);
  $('#modal').hidden = true;
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
}
$('#homeBtn').onclick = () => { location.hash = '#/'; };
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
