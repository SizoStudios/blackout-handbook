/* Blackout Handbook: offline map. Draws from map packs (.bhmap) that you import once from the flash drive. Nothing needs the internet. */
(function () {
'use strict';
const A = window.BHAPP, { DB, kvGet, kvSet, esc, tomb, uid } = A;
const $ = (s, r) => (r || document).querySelector(s);

/* ---------- projection (Web Mercator at zoom 7, origin at tile 69,71) ---------- */
const Z = 7, TS = 256, S0 = TS * 2 ** Z, X0 = 69, Y0 = 71, NX = 8, NY = 7, W = NX * TS, H = NY * TS;
const mx = lon => (lon + 180) / 360 * S0 - X0 * TS;
const my = lat => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * S0 - Y0 * TS; };
const unx = x => (x + X0 * TS) / S0 * 360 - 180;
const uny = y => { const n = Math.PI - 2 * Math.PI * (y + Y0 * TS) / S0; return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };
const kmPerPx = lat => 156.54303 * Math.cos(lat * Math.PI / 180) / 2 ** Z;
const hav = (a, b, c, d) => { const R = 6371.0088, t = Math.PI / 180, dl = (c - a) * t, dp = (d - b) * t, q = Math.sin(dp / 2) ** 2 + Math.cos(b * t) * Math.cos(d * t) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(q)); };

/* ---------- what can be shown ---------- */
const CATS = { 1: 'clinic', 2: 'pharm', 3: 'hard', 4: 'fuel', 5: 'food', 6: 'water', 7: 'shelter', 8: 'police', 9: 'fire', 10: 'gov', 11: 'school' };
const CATNAME = { clinic: 'Clinic, hospital or doctor', pharm: 'Pharmacy', hard: 'Hardware or building supplies', fuel: 'Fuel station', food: 'Food shop', water: 'Water source', shelter: 'Shelter, hut or cave', police: 'Police station', fire: 'Fire or ambulance station', gov: 'Government, municipal, court or post office', school: 'School, college or community hall' };
const PIN_TYPES = [['cache', 'Cache or stash', '#f0b429', 'C'], ['water', 'Water', '#4aa3ff', 'W'], ['shelter', 'Shelter or safe sleeping spot', '#2fd08a', 'S'], ['food', 'Food or supplies', '#ff9a3c', 'F'], ['fuel', 'Fuel', '#d96a3a', 'U'], ['medical', 'Medical', '#ff6b8b', 'M'], ['tools', 'Tools or parts', '#b0b8c4', 'T'], ['rally', 'Rally point', '#c4b5fd', 'R'], ['danger', 'Danger or avoid', '#ff4d4d', '!'], ['vehicle', 'Vehicle or fuel stop', '#7ad7f0', 'V'], ['person', 'Contact (first name only)', '#e8a2ff', 'P'], ['note', 'Note', '#e8ecef', 'N']];
const PT = Object.fromEntries(PIN_TYPES.map(p => [p[0], p]));
const STATUS = [['good', 'Checked and good'], ['unchecked', 'Not checked yet'], ['gone', 'Empty or gone'], ['unsafe', 'Unsafe']];
const LAYERS = [
  ['Terrain and heights', [
    ['tint', 'Height colours', 'Colours the land by height above sea level.'],
    ['shade', 'Hill shading', 'Light and shadow that make hills and valleys stand out.'],
    ['sat', 'Satellite photos (where you added a photo pack)', 'True-colour Sentinel-2 photos at about 10 m per pixel: shows forest, bush, farmland, water, built-up areas and gorges. Single houses are too small to see. Shows only inside the area of the photo pack you added, and only once you zoom in to about 30 km across. Settings > Map packs has a button that takes you there. Contains modified Copernicus Sentinel data.'],
    ['contour', 'Contour lines', 'Lines of equal height. Close lines mean steep ground. Slower to draw.']]],
  ['Borders and names', [
    ['bCountry', 'Country borders', 'Pale-violet line along the country borders.'],
    ['bProv', 'Province borders', 'Dashed line between provinces and districts.'],
    ['lCountry', 'Country names', 'The spaced-out country names.'],
    ['lProv', 'Province names', 'The spaced-out province names. Switch off if they clutter the map.'],
    ['towns', 'Towns and names', 'Towns and cities. The population filter in Settings decides how many show.'],
    ['peaks', 'Named peaks', 'Mountain tops with their height.'],
    ['rivers', 'Rivers and lakes', 'Rivers and lakes. Untreated water is not safe to drink.']]],
  ['Roads and tracks (OpenStreetMap)', [
    ['rMain', 'Main roads', 'Motorways, trunk, primary and secondary roads. Solid light lines.'],
    ['rMinor', 'Streets and minor roads', 'Tertiary roads, residential streets and service roads. Show as you zoom in.'],
    ['rGravel', 'Gravel roads and farm tracks', 'Brown dashed lines. Many are gravel or dirt, but the surface is not always recorded. Check before driving.'],
    ['rPaths', 'Footpaths and bridleways', 'Green dotted lines for walking routes.'],
    ['hwy', 'Key highways N1-N4, N7 (approximate)', 'Hand-placed lines with route numbers. Positions are approximate.']]],
  ['Water, shelter and supplies (OpenStreetMap)', [
    ['water', 'Water sources', 'Blue dots: wells, boreholes, windpumps, springs, water points, tanks and water works. Untreated water is not safe: boil or treat it.'],
    ['shelter', 'Shelters, huts and caves', 'Green triangles that could give cover. Check for people, animals and rockfall first.'],
    ['clinic', 'Clinics and hospitals', 'Amber square with +. May be looted, empty or guarded.'],
    ['pharm', 'Pharmacies', 'Amber square with Rx. Stock and access cannot be assumed.'],
    ['hard', 'Hardware', 'Amber square with H: hardware, DIY and building-material shops.'],
    ['fuel', 'Fuel', 'Amber square with F: fuel stations. Tanks may be dry or unsafe to open.'],
    ['food', 'Food', 'Amber square with S: supermarkets, general dealers, butcheries and greengrocers.']]],
  ['Public and government buildings (OpenStreetMap)', [
    ['police', 'Police stations', 'Blue house with P. Landmarks and official help; may be abandoned, held or a target.'],
    ['fire', 'Fire and ambulance stations', 'Orange house with F. Often hold water, first-aid kit and radios.'],
    ['gov', 'Government, municipal, courts and post offices', 'Teal house with G. Likely gathering or notice points; may be guarded or locked.'],
    ['school', 'Schools, colleges and community halls', 'Pink house with S. Large buildings that can shelter a group. Thousands of them.']]],
  ['Risk (approximate reference points)', [
    ['choke', 'Choke points', 'Purple cross: a narrow place (bridge, pass) where a roadblock or ambush is likely.'],
    ['back', 'Back routes', 'Dashed purple line: a quieter route that avoids a choke point.'],
    ['haz', 'Hazard sites', 'Red diamond: refineries, power stations and similar. Keep well away; plan routes upwind.']]],
  ['My pins (saved on this device)', PIN_TYPES.map(p => ['pin:' + p[0], p[1], 'Your own pins of this type.']).concat([['me', 'You are here', 'Blue dot from the phone GPS. Needs no signal.']])]
];
const ALLKEYS = LAYERS.flatMap(g => g[1].map(i => i[0]));
const DESC = Object.fromEntries(LAYERS.flatMap(g => g[1].map(i => [i[0], i[2]])));
const NAMEOF = Object.fromEntries(LAYERS.flatMap(g => g[1].map(i => [i[0], i[1]])));
const CAVEAT = { water: 'Untreated water is not safe to drink: boil or treat it. Wells and tanks may be dry, fouled or watched.', shelter: 'Check from a distance for occupants, animals and rockfall before going in.', res: 'May be looted, guarded or empty. Never assume stock. Check from cover.', pub: 'May be locked, guarded, damaged or occupied. Do not assume anyone inside is friendly or that supplies remain.', haz: 'Likely target and fire or smoke risk. Keep well away; plan routes upwind.', choke: 'Likely roadblock or ambush point. Avoid if possible.' };

/* ---------- settings ---------- */
const DEF = { layers: {}, icon: 100, label: 100, line: 100, iconAuto: true, units: 'km', coord: 'dec', theme: 'auto', start: 'last', home: null, townMin: 'auto', names: true, measureAuto: 0, walk: 4.5, cycle: 15, car: 90, gravelFactor: 0.6, climbH: 600, staleAmber: 180, staleRed: 365, fps: false, gpsEvery: 'cont', gpsAutoOff: 30, gpsStopLeave: true };
let P = null, firstRun = false, V = { k: 0.5, tx: 0, ty: 0 };
const M = { sat: { keys: new Set(), cache: new Map(), pending: new Set(), regions: [] }, packs: [], base: null, terrain: false, elev: null, tint: null, shade: null, contourC: {}, places: null, cells: new Map(), pending: new Set(), regions: [], overview: null, root: null, cv: null, ctx: null, CW: 1, CH: 1, DPR: 1, raf: 0, measure: [], measureOn: false, mTimer: 0, me: null, watch: 0, sel: null, pins: [], q: '' };
let savePrefsT = 0;
const savePrefs = () => { clearTimeout(savePrefsT); savePrefsT = setTimeout(() => kvSet('map.prefs', P), 150); };
const saveView = () => { clearTimeout(saveView.t); saveView.t = setTimeout(() => kvSet('map.view', V), 600); };
const on = k => !!P.layers[k];

/* ---------- map packs ---------- */
async function loadPacks() {
  M.packs = await kvGet('map.packs', []);
  M.regions = M.packs.filter(p => p.pack === 'roads').map(p => p.region);
  const ov = M.packs.find(p => p.pack === 'roads-ov'); M.hasOv = !!ov;
  M.sat.regions = M.packs.filter(p => p.pack === 'imagery').map(p => p.region); await loadSatKeys();
}
async function importPack(file, progress) {
  const head = new Uint8Array(await file.slice(0, 11).arrayBuffer());
  if (String.fromCharCode(...head.slice(0, 6)) !== 'BHMAP1') throw new Error('That is not a map pack file.');
  const hl = new DataView(head.buffer).getUint32(7, true), hdr = JSON.parse(await file.slice(11, 11 + hl).text()), base = 11 + hl;
  if (!DB.db) throw new Error('This device would not let the app save data, so map packs cannot be stored.');
  // replace an older copy of the same pack
  const id = hdr.pack + ':' + hdr.region;
  let batch = [], bytes = 0, done = 0, total = hdr.entries.length;
  const flush = () => new Promise((res, rej) => { if (!batch.length) return res(); const t = DB.db.transaction('mapdata', 'readwrite'), s = t.objectStore('mapdata'); batch.forEach(r => s.put(r)); t.oncomplete = () => { batch = []; bytes = 0; res(); }; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Storage is full.')); });
  for (const e of hdr.entries) {
    const d = await file.slice(base + e.o, base + e.o + e.l).arrayBuffer();
    batch.push({ k: e.k, d }); bytes += e.l; done++;
    if (bytes > 6 * 1048576 || batch.length > 400) { await flush(); if (progress) progress(done, total); }
  }
  await flush(); if (progress) progress(total, total);
  const meta = { id, pack: hdr.pack, region: hdr.region, name: hdr.name, version: hdr.version, created: hdr.created, entries: total, mb: +(file.size / 1048576).toFixed(1), licence: hdr.licence, info: hdr.info || null, added: Date.now() };
  const list = (await kvGet('map.packs', [])).filter(p => p.id !== id); list.push(meta); await kvSet('map.packs', list);
  M.cells.clear(); M.pending.clear(); M.base = null; M.places = null; M.terrain = false;
  await loadPacks();
  return meta;
}
async function removePack(id) {
  const meta = M.packs.find(p => p.id === id); if (!meta) return;
  const keys = await new Promise(res => { const out = [], t = DB.db.transaction('mapdata', 'readonly'), r = t.objectStore('mapdata').openKeyCursor(); r.onsuccess = () => { const c = r.result; if (c) { out.push(c.key); c.continue(); } }; t.oncomplete = () => res(out); });
  const pref = meta.pack === 'roads' ? 'r/' + meta.region + '/' : meta.pack === 'base' ? null : null;
  const kill = meta.pack === 'imagery' ? keys.filter(k => k.startsWith('i/' + meta.region + '/')) : meta.pack === 'routing' ? keys.filter(k => k.startsWith('g/')) : meta.pack === 'base' ? keys.filter(k => k === 'base' || k === 'places' || k.startsWith('t/')) : meta.pack === 'roads-ov' ? keys.filter(k => k === 'ov') : keys.filter(k => k.startsWith(pref));
  for (let i = 0; i < kill.length; i += 500) await new Promise(res => { const t = DB.db.transaction('mapdata', 'readwrite'), s = t.objectStore('mapdata'); kill.slice(i, i + 500).forEach(k => s.delete(k)); t.oncomplete = res; });
  await kvSet('map.packs', M.packs.filter(p => p.id !== id));
  M.cells.clear(); M.pending.clear(); M.base = null; M.places = null; M.terrain = false; await loadPacks();
}
const getRec = k => new Promise(res => { try { const r = DB.db.transaction('mapdata', 'readonly').objectStore('mapdata').get(k); r.onsuccess = () => res(r.result ? r.result.d : null); r.onerror = () => res(null); } catch (e) { res(null); } });

/* ---------- loading the base data, terrain and places ---------- */
const flat = a => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i += 2) { o[i] = mx(a[i]); o[i + 1] = my(a[i + 1]); } return o; };
async function loadBase() {
  if (M.base) return true;
  const d = await getRec('base'); if (!d) return false;
  const D = JSON.parse(new TextDecoder().decode(d)), pt = o => { o.x = mx(o.lon); o.y = my(o.lat); return o; };
  M.base = {
    countries: D.countries.map(c => ({ a3: c.a3, n: c.n, p: c.r.map(flat), c: c.r[0] ? [mx(avg(c.r[0], 0)), my(avg(c.r[0], 1))] : [0, 0] })),
    provinces: D.provinces.map(c => ({ a3: c.a3, n: c.n, p: c.r.map(flat) })),
    rivers: D.rivers.map(c => ({ n: c.n, p: c.l.map(flat) })), lakes: D.lakes.map(c => ({ n: c.n, p: c.r.map(flat) })),
    hwy: D.hwy.map(c => ({ n: c.n, p: flat(c.l) })), back: D.back.map(c => ({ n: c.n, p: flat(c.l) })),
    towns: D.towns.map(pt), peaks: D.peaks.map(pt), haz: D.haz.map(pt), choke: D.choke.map(pt)
  };
  return true;
}
const avg = (r, o) => { let s = 0, n = 0; for (let i = o; i < r.length; i += 2) { s += r[i]; n++; } return s / n; };
async function loadPlaces() {
  if (M.places) return;
  const d = await getRec('places'); if (!d) return;
  const u = new Uint8Array(d), dv = new DataView(d), td = new TextDecoder(), lon = [], lat = [], c = [], nm = []; let o = 0;
  while (o + 10 <= u.length) { const nl = u[o + 9]; c.push(u[o]); lon.push(dv.getInt32(o + 1, true) / 1e5); lat.push(dv.getInt32(o + 5, true) / 1e5); nm.push(nl ? td.decode(u.subarray(o + 10, o + 10 + nl)) : ''); o += 10 + nl; }
  const n = c.length, x = new Float32Array(n), y = new Float32Array(n), cc = new Uint8Array(n), by = {};
  for (let i = 0; i < n; i++) { x[i] = mx(lon[i]); y[i] = my(lat[i]); cc[i] = c[i]; const k = CATS[c[i]]; if (k) (by[k] || (by[k] = [])).push(i); }
  M.places = { n, x, y, c: cc, lon, lat, nm, by };
}
async function loadTerrain() {
  if (M.terrain) return true;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true }); let got = 0;
  for (let xi = 0; xi < NX; xi++) for (let yi = 0; yi < NY; yi++) {
    const d = await getRec(`t/7/${X0 + xi}/${Y0 + yi}`); if (!d) continue;
    try { const bm = await createImageBitmap(new Blob([d], { type: 'image/png' })); g.drawImage(bm, xi * TS, yi * TS); if (bm.close) bm.close(); got++; } catch (e) {}
  }
  if (!got) return false;
  const px = g.getImageData(0, 0, W, H).data, el = new Float32Array(W * H);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) el[j] = px[i] * 256 + px[i + 1] + px[i + 2] / 256 - 32768;
  M.elev = el; M.terrain = true; buildRasters(); return true;
}
const RAMPS = {
  natural: [[0, [28, 52, 62]], [150, [32, 66, 60]], [500, [44, 82, 58]], [900, [78, 96, 56]], [1300, [112, 108, 62]], [1700, [140, 112, 74]], [2100, [150, 118, 96]], [2600, [170, 150, 140]], [3100, [210, 205, 205]], [3500, [245, 245, 248]]],
  grey: [[0, [24, 24, 24]], [3500, [245, 245, 245]]], night: [[0, [30, 0, 0]], [1000, [90, 15, 10]], [2000, [150, 35, 25]], [3500, [230, 90, 70]]]
};
const PALS = {
  dark: { ocean: '#081426', home: '#172544', foreign: '#0f182c', bC: '#d8c7ff', bP: 'rgba(125,141,179,.6)', text: '#d6deee', halo: 'rgba(5,9,18,.88)', river: '#4aa3ff', lake: '#2f6bb8', hwy: '#d9e2f5', ramp: 'natural', r: ['#f4f7ff', '#d3dcf0', '#b0bdd8', '#8f9db9', '#74829f', '#5d6b86'] },
  light: { ocean: '#c9ddf0', home: '#efe9da', foreign: '#ddd6c6', bC: '#6b3fc4', bP: 'rgba(80,90,125,.65)', text: '#17202e', halo: 'rgba(255,255,255,.92)', river: '#1d63b8', lake: '#86b4e6', hwy: '#2c3a55', ramp: 'natural', r: ['#1b2334', '#2c3a55', '#46536f', '#66738d', '#808ba3', '#99a3b6'] },
  contrast: { ocean: '#000', home: '#0d0d0d', foreign: '#070707', bC: '#ff4dff', bP: '#cfcfcf', text: '#fff', halo: '#000', river: '#00d5ff', lake: '#0077aa', hwy: '#fff', ramp: 'grey', r: ['#ffffff', '#ffe600', '#ffd400', '#e0e0e0', '#c8c8c8', '#a8a8a8'] },
  night: { ocean: '#0a0000', home: '#1a0505', foreign: '#100303', bC: '#ffb0a5', bP: 'rgba(200,90,80,.6)', text: '#ff9a8a', halo: 'rgba(10,0,0,.9)', river: '#ff6a5a', lake: '#7a1f18', hwy: '#ffb0a5', ramp: 'night', r: ['#ffb0a5', '#ff8a7a', '#e66e5f', '#c8574a', '#a14439', '#7d342b'] }
};
const themeName = () => P.theme === 'auto' ? (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark') : P.theme;
const pal = () => PALS[themeName()] || PALS.dark;
function colourAt(e, ramp) { if (e <= ramp[0][0]) return ramp[0][1]; for (let i = 1; i < ramp.length; i++) if (e <= ramp[i][0]) { const a = ramp[i - 1], b = ramp[i], t = (e - a[0]) / (b[0] - a[0]); return [0, 1, 2].map(j => a[1][j] + (b[1][j] - a[1][j]) * t); } return ramp[ramp.length - 1][1]; }
function buildRasters() {
  const el = M.elev; if (!el) return; M.builtTheme = themeName();
  const tint = document.createElement('canvas'), shade = document.createElement('canvas'); tint.width = shade.width = W; tint.height = shade.height = H;
  const ti = tint.getContext('2d').createImageData(W, H), si = shade.getContext('2d').createImageData(W, H), ramp = RAMPS[pal().ramp] || RAMPS.natural, az = 315 * Math.PI / 180, alt = 40 * Math.PI / 180;
  for (let y = 1; y < H - 1; y++) {
    const cell = 156543.03 * Math.cos(uny(y) * Math.PI / 180) / 2 ** Z;
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, e = el[i]; if (e <= 1) continue;
      const c = colourAt(e, ramp), o = i * 4; ti.data[o] = c[0]; ti.data[o + 1] = c[1]; ti.data[o + 2] = c[2]; ti.data[o + 3] = 255;
      const dzdx = (el[i + 1] - el[i - 1]) / (2 * cell), dzdy = (el[i + W] - el[i - W]) / (2 * cell), slope = Math.atan(Math.hypot(dzdx, dzdy)), asp = Math.atan2(dzdy, -dzdx);
      let hs = Math.cos(Math.PI / 2 - alt) * Math.cos(slope) + Math.sin(Math.PI / 2 - alt) * Math.sin(slope) * Math.cos(az - asp); hs = Math.max(0, Math.min(1, hs));
      const v = hs < 0.7 ? 0 : 255, a = hs < 0.7 ? (0.7 - hs) * 255 * 1.1 : (hs - 0.7) * 255 * 0.9; si.data[o] = v; si.data[o + 1] = v; si.data[o + 2] = v; si.data[o + 3] = Math.min(190, a);
    }
  }
  tint.getContext('2d').putImageData(ti, 0, 0); shade.getContext('2d').putImageData(si, 0, 0); M.tint = tint; M.shade = shade;
}
function elevAt(lon, lat) {
  const el = M.elev; if (!el) return null; const x = mx(lon), y = my(lat); if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) return null;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * W + x0;
  return el[i] * (1 - fx) * (1 - fy) + el[i + 1] * fx * (1 - fy) + el[i + W] * (1 - fx) * fy + el[i + W + 1] * fx * fy;
}
function contours(iv) {
  if (M.contourC[iv]) return M.contourC[iv]; const el = M.elev, seg = [[], []];
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const i = y * W + x, a = el[i], b = el[i + 1], c = el[i + W + 1], d = el[i + W], mn = Math.min(a, b, c, d), mxv = Math.max(a, b, c, d); if (mxv <= 5 || mn === mxv) continue;
    for (let l = Math.ceil(Math.max(mn, 1) / iv); l * iv <= mxv; l++) {
      const v = l * iv, bold = l % 5 === 0 ? 1 : 0, p = [], ip = (q, r, px, py, qx, qy) => { const t = (v - q) / (r - q); p.push(px + (qx - px) * t, py + (qy - py) * t); };
      if ((a < v) !== (b < v)) ip(a, b, x, y, x + 1, y); if ((b < v) !== (c < v)) ip(b, c, x + 1, y, x + 1, y + 1); if ((d < v) !== (c < v)) ip(d, c, x, y + 1, x + 1, y + 1); if ((a < v) !== (d < v)) ip(a, d, x, y, x, y + 1);
      if (p.length === 4) seg[bold].push(p[0], p[1], p[2], p[3]); else if (p.length === 8) { seg[bold].push(p[0], p[1], p[2], p[3]); seg[bold].push(p[4], p[5], p[6], p[7]); }
    }
  }
  return (M.contourC[iv] = seg.map(a => new Float32Array(a)));
}

/* ---------- roads: cells loaded as you move ---------- */
const CELL = 0.25, cellKey = (cx, cy) => cx + '_' + cy;
function decodeCell(bufs) {
  const cls = [], off = [0], pts = [];
  for (const b of bufs) {
    const u = new Uint8Array(b), dv = new DataView(b); let o = 0;
    while (o + 11 <= u.length) {
      const c = u[o], n = dv.getUint16(o + 1, true); let lon = dv.getInt32(o + 3, true), lat = dv.getInt32(o + 7, true); o += 11;
      pts.push(mx(lon / 1e5), my(lat / 1e5));
      for (let i = 1; i < n; i++) { lon += dv.getInt16(o, true); lat += dv.getInt16(o + 2, true); o += 4; pts.push(mx(lon / 1e5), my(lat / 1e5)); }
      cls.push(c); off.push(pts.length);
    }
  }
  return cls.length ? { cls: Uint8Array.from(cls), off: Uint32Array.from(off), pts: Float32Array.from(pts) } : null;
}
function wantCells(b) {
  const x0 = Math.floor((b[0] + 180) / CELL), x1 = Math.floor((b[2] + 180) / CELL), y0 = Math.floor((b[1] + 90) / CELL), y1 = Math.floor((b[3] + 90) / CELL), out = [];
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 420) return out;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([cellKey(x, y), x, y]);
  return out;
}
function loadCell(key) {
  if (M.cells.has(key) || M.pending.has(key)) return; M.pending.add(key);
  Promise.all(M.regions.map(r => getRec('r/' + r + '/' + key))).then(bufs => {
    M.pending.delete(key); M.cells.set(key, decodeCell(bufs.filter(Boolean)));
    if (M.cells.size > 700) { const it = M.cells.keys(); for (let i = 0; i < 150; i++) M.cells.delete(it.next().value); }
    draw();
  });
}
async function loadOverview() {
  if (M.overview || !M.hasOv) return; const d = await getRec('ov'); if (d) M.overview = decodeCell([d]);
}

/* ---------- satellite photo tiles (added as photo packs) ---------- */
async function loadSatKeys() {
  const s = M.sat; s.keys = new Set(); s.cache.forEach(b => { try { b.close && b.close(); } catch (e) {} }); s.cache = new Map(); s.pending = new Set();
  if (!s.regions.length || !DB.db) return;
  await new Promise(res => { try { const t = DB.db.transaction('mapdata', 'readonly'), r = t.objectStore('mapdata').openKeyCursor(IDBKeyRange.bound('i/', 'i0')); r.onsuccess = () => { const c = r.result; if (c) { s.keys.add(c.key.slice(2)); c.continue(); } }; t.oncomplete = res; t.onerror = res; } catch (e) { res(); } });
}
function satFind(z, x, y) { for (const r of M.sat.regions) { const k = r + '/' + z + '/' + x + '/' + y; if (M.sat.keys.has(k)) return k; } return null; }
function satWant(key) {
  const s = M.sat; if (s.cache.has(key) || s.pending.has(key)) return; s.pending.add(key);
  getRec('i/' + key).then(d => d ? createImageBitmap(new Blob([d], { type: 'image/jpeg' })) : null).then(bm => { s.pending.delete(key); if (bm) { s.cache.set(key, bm); if (s.cache.size > 260) { const it = s.cache.keys(); for (let i = 0; i < 60; i++) { const kk = it.next().value; const b = s.cache.get(kk); try { b.close && b.close(); } catch (e) {} s.cache.delete(kk); } } draw(); } }).catch(() => s.pending.delete(key));
}
function drawSat(g, k) {
  if (!M.sat.keys.size) return; const z = Math.max(10, Math.min(14, Math.round(7 + Math.log2(k) + 0.3))), sz = 256 / 2 ** (z - 7), c = M.sat.cache;
  const bx0 = -V.tx / k, by0 = -V.ty / k, bx1 = (M.CW - V.tx) / k, by1 = (M.CH - V.ty) / k;
  const x0 = Math.floor((bx0 + X0 * TS) / sz), x1 = Math.floor((bx1 + X0 * TS) / sz), y0 = Math.floor((by0 + Y0 * TS) / sz), y1 = Math.floor((by1 + Y0 * TS) / sz);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 120) return; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const key = satFind(z, x, y); if (!key) continue; const dx = x * sz - X0 * TS, dy = y * sz - Y0 * TS, bm = c.get(key);
    if (bm) { g.drawImage(bm, dx - 0.02, dy - 0.02, sz + 0.04, sz + 0.04); continue; }
    satWant(key);
    for (let d = 1; d <= 4 && z - d >= 10; d++) { const ax = x >> d, ay = y >> d, ak = satFind(z - d, ax, ay), ab = ak && c.get(ak); if (ab) { const f = 256 >> d; g.drawImage(ab, (x - (ax << d)) * f, (y - (ay << d)) * f, f, f, dx, dy, sz, sz); break; } }
  }
}
/* ---------- icons ---------- */
const RESG = { clinic: '+', pharm: 'Rx', hard: 'H', fuel: 'F', food: 'S' }, PUBS = { police: ['#6c8cff', 'P'], fire: ['#ff7043', 'F'], gov: ['#34d3c0', 'G'], school: ['#ff9ecb', 'S'] };
const ICON = {
  water: (g, x, y, s) => { g.beginPath(); g.arc(x, y, 3.4 * s, 0, 7); g.fillStyle = '#4aa3ff'; g.fill(); g.strokeStyle = '#06111f'; g.lineWidth = .8; g.stroke(); },
  shelter: (g, x, y, s) => { const r = 5 * s; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y + r * .8); g.lineTo(x - r, y + r * .8); g.closePath(); g.fillStyle = '#2fd08a'; g.fill(); g.strokeStyle = '#04150d'; g.lineWidth = .8; g.stroke(); },
  res: (g, x, y, s, sub, gl) => { const q = 3.6 * s; g.fillStyle = '#f2b134'; g.fillRect(x - q, y - q, q * 2, q * 2); g.strokeStyle = '#1b1405'; g.lineWidth = .8; g.strokeRect(x - q, y - q, q * 2, q * 2); if (gl && q >= 4.5) { g.fillStyle = '#000'; g.font = `bold ${Math.round(q * 1.25)}px system-ui`; g.textAlign = 'center'; g.fillText(RESG[sub] || '', x, y + q * .38); g.textAlign = 'left'; } },
  pub: (g, x, y, s, sub, gl) => { const q = 4 * s, st = PUBS[sub] || PUBS.gov; g.beginPath(); g.moveTo(x, y - q * 1.45); g.lineTo(x + q, y - q * .45); g.lineTo(x + q, y + q); g.lineTo(x - q, y + q); g.lineTo(x - q, y - q * .45); g.closePath(); g.fillStyle = st[0]; g.fill(); g.strokeStyle = '#0a1020'; g.lineWidth = .9; g.stroke(); if (gl && q >= 4.6) { g.fillStyle = '#000'; g.font = `bold ${Math.round(q * 1.2)}px system-ui`; g.textAlign = 'center'; g.fillText(st[1], x, y + q * .62); g.textAlign = 'left'; } },
  choke: (g, x, y, s) => { const r = 6 * s; g.strokeStyle = '#150f2a'; g.lineWidth = 5; g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); g.stroke(); g.strokeStyle = '#a78bfa'; g.lineWidth = 2.6; g.stroke(); },
  haz: (g, x, y, s) => { const r = 6 * s; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fillStyle = '#ff5c5c'; g.fill(); g.strokeStyle = '#2a0707'; g.lineWidth = 1; g.stroke(); },
  peak: (g, x, y, s, p) => { g.fillStyle = p ? p.text : '#fff'; g.beginPath(); g.moveTo(x, y - 5 * s); g.lineTo(x - 4 * s, y + 3 * s); g.lineTo(x + 4 * s, y + 3 * s); g.closePath(); g.fill(); },
  town: (g, x, y, s, big, p) => { g.beginPath(); g.arc(x, y, (big ? 3.6 : 2.4) * s, 0, 7); g.fillStyle = p ? p.text : '#fff'; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke(); },
  pin: (g, x, y, s, pin) => {
    const t = PT[pin.types[0]] || PT.note, r = 8 * s, age = (Date.now() - new Date(pin.checked || pin.c).getTime()) / 864e5, ring = pin.status === 'unsafe' ? '#ff4d4d' : pin.status === 'gone' ? '#777' : age > P.staleRed ? '#ff4d4d' : age > P.staleAmber ? '#f0b429' : '#fff';
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = pin.status === 'gone' ? '#333' : t[2]; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = ring; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#000'; g.font = `bold ${Math.round(r * 1.15)}px system-ui`; g.textAlign = 'center'; g.fillText(t[3], x, y + r * .4); g.textAlign = 'left';
    if (pin.types.length > 1) { g.beginPath(); g.arc(x + r * .85, y - r * .85, r * .42, 0, 7); g.fillStyle = '#000'; g.fill(); g.fillStyle = '#fff'; g.font = `bold ${Math.round(r * .7)}px system-ui`; g.textAlign = 'center'; g.fillText(String(pin.types.length), x + r * .85, y - r * .6); g.textAlign = 'left'; }
  },
  me: (g, x, y, s) => { g.beginPath(); g.arc(x, y, 14 * s, 0, 7); g.fillStyle = 'rgba(74,163,255,.22)'; g.fill(); g.beginPath(); g.arc(x, y, 6 * s, 0, 7); g.fillStyle = '#4aa3ff'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
};
function swatch(key, dpr) {
  const c = document.createElement('canvas'); c.width = 34 * dpr; c.height = 22 * dpr; const g = c.getContext('2d'), w = 34, h = 22, p = pal(); g.scale(dpr, dpr);
  const line = (col, lw, dash) => { g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath(); g.moveTo(3, h / 2); g.lineTo(w - 3, h / 2); g.stroke(); g.setLineDash([]); };
  const txt = (t, col, f) => { g.fillStyle = col; g.font = f; g.textAlign = 'center'; g.fillText(t, w / 2, h / 2 + 3); };
  const cx = w / 2, cy = h / 2;
  if (key === 'tint') { const gr = g.createLinearGradient(2, 0, w - 2, 0); (RAMPS[p.ramp] || RAMPS.natural).forEach(([e, c]) => gr.addColorStop(Math.min(1, e / 3500), `rgb(${c.map(Math.round)})`)); g.fillStyle = gr; g.fillRect(2, 4, w - 4, h - 8); }
  else if (key === 'shade') { const gr = g.createLinearGradient(2, h, w - 2, 0); gr.addColorStop(0, '#111'); gr.addColorStop(.5, '#777'); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.fillRect(2, 4, w - 4, h - 8); }
  else if (key === 'sat') { const cs = ['#5b7a3a', '#8a7a4a', '#3d5a2f', '#6c8b52', '#a08a5a', '#2f4a28']; for (let i = 0; i < 6; i++) { g.fillStyle = cs[i]; g.fillRect(2 + (i % 3) * 10, 3 + Math.floor(i / 3) * 8, 10, 8); } }
  else if (key === 'contour') { g.strokeStyle = '#e7c98a'; g.lineWidth = 1; for (const o of [4, 9, 14]) { g.beginPath(); g.moveTo(2, h * .7 - o + 8); g.bezierCurveTo(12, h * .1 + o - 6, 20, h + 2 - o, w - 2, h * .4 + o - 8); g.stroke(); } }
  else if (key === 'bCountry') line('#d8c7ff', 2.2); else if (key === 'bProv') line('#7d8db3', 1.2, [4, 3]);
  else if (key === 'lCountry') txt('L E S O T H O', '#d8c7ff', '700 7.5px system-ui'); else if (key === 'lProv') { g.globalAlpha = .7; txt('G A U T E N G', '#d6deee', '600 7px system-ui'); g.globalAlpha = 1; }
  else if (key === 'towns') { ICON.town(g, 8, cy, 1.6, true); g.fillStyle = '#d6deee'; g.font = '9px system-ui'; g.fillText('Town', 13, cy + 3); }
  else if (key === 'peaks') { ICON.peak(g, 10, cy + 1, 1.7); g.fillStyle = '#d6deee'; g.font = '9px system-ui'; g.fillText('3,4', 17, cy + 4); }
  else if (key === 'rivers') { g.strokeStyle = '#4aa3ff'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(3, h * .65); g.bezierCurveTo(10, 0, 16, h, w - 3, h * .3); g.stroke(); }
  else if (key === 'rMain') line('#d9e2f5', 3.2); else if (key === 'rMinor') { line('#aebbd6', 1.6); g.strokeStyle = 'rgba(150,165,195,.9)'; g.lineWidth = 1; for (const x of [7, 14, 21, 28]) { g.beginPath(); g.moveTo(x, 2); g.lineTo(x + (x % 2 ? 4 : -4), h - 2); g.stroke(); } }
  else if (key === 'rGravel') line('#c9a56b', 2, [5, 3]); else if (key === 'rPaths') line('#8fbf7a', 1.6, [1.5, 3]);
  else if (key === 'hwy') { line('#d9e2f5', 3.2); g.fillStyle = '#0b1220'; g.fillRect(10, cy - 6, 15, 12); txt('N3', '#d9e2f5', 'bold 8px system-ui'); }
  else if (key === 'water') ICON.water(g, cx, cy, 1.5); else if (key === 'shelter') ICON.shelter(g, cx, cy, 1.4);
  else if (RESG[key]) ICON.res(g, cx, cy, 1.6, key, true); else if (PUBS[key]) ICON.pub(g, cx, cy + 1, 1.5, key, true);
  else if (key === 'choke') ICON.choke(g, cx, cy, 1.1); else if (key === 'back') line('#a78bfa', 2.6, [6, 4]); else if (key === 'haz') ICON.haz(g, cx, cy, 1);
  else if (key === 'me') ICON.me(g, cx, cy, .9); else if (key.startsWith('pin:')) ICON.pin(g, cx, cy, 1, { types: [key.slice(4)], status: 'good', checked: new Date().toISOString() });
  return c;
}

/* ---------- units and text ---------- */
const fmtKm = km => P.units === 'mi' ? (km * 0.621371).toFixed(km * 0.621371 < 10 ? 1 : 0) + ' mi' : km.toFixed(km < 10 ? 1 : 0) + ' km';
const fmtM = m => P.units === 'mi' ? Math.round(m * 3.28084).toLocaleString('en-GB') + ' ft' : Math.round(m).toLocaleString('en-GB') + ' m';
const dms = (v, p, n) => { const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = ((a - d) * 60 - m) * 60; return `${d}°${String(m).padStart(2, '0')}′${s.toFixed(0).padStart(2, '0')}″ ${v >= 0 ? p : n}`; };
const fmtCoord = (lat, lon) => P.coord === 'dms' ? `${dms(lat, 'N', 'S')}, ${dms(lon, 'E', 'W')}` : `${lat.toFixed(5)}°, ${lon.toFixed(5)}°`;
const fmtH = h => h < 1 ? Math.max(1, Math.round(h * 60)) + ' min' : h >= 48 ? (h / 24).toFixed(1) + ' days' : Math.floor(h) + ' h ' + String(Math.round((h % 1) * 60)).padStart(2, '0') + ' min';
const zoomF = () => P.iconAuto ? Math.max(.7, Math.min(1.8, .7 + Math.log2(Math.max(V.k, .25)) * .17 + .35)) : 1;
const sc = g => (P.icon / 100) * zoomF();

/* ---------- drawing ---------- */
const S = x => x * V.k + V.tx, T = y => y * V.k + V.ty;
const onScr = (x, y, m) => x > -(m || 20) && y > -(m || 20) && x < M.CW + (m || 20) && y < M.CH + (m || 20);
function draw() { if (!M.raf && M.cv) M.raf = requestAnimationFrame(render); }
function viewBounds() { return [unx(-V.tx / V.k), uny((M.CH - V.ty) / V.k), unx((M.CW - V.tx) / V.k), uny(-V.ty / V.k)]; }
function pathPoly(g, rings) { rings.forEach(p => { g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); }); }
function pathLine(g, p) { g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); }
function render() { try { renderInner(); } catch (e) { M.raf = 0; const m = 'Map drawing problem: ' + (e && e.message || e); if (M.lastErr !== m) { M.lastErr = m; try { toast(m); } catch (x) {} } } }
function renderInner() {
  M.raf = 0;
  // Safety net: if the screen size was not known when the map opened, or the saved view is broken, measure again and fit the whole map.
  if (M.root && !(M.CW > 10 && M.CH > 10)) { setSize(); if (!(M.CW > 10 && M.CH > 10)) { draw(); return; } }
  if (!(V && V.k > 0 && isFinite(V.k) && isFinite(V.tx) && isFinite(V.ty))) V = (() => { const k = fitK(); return { k, tx: (M.CW - W * k) / 2, ty: (M.CH - H * k) / 2 }; })();
  const t0 = performance.now(), g = M.ctx, k = V.k, p = pal(), dpr = M.DPR, ls = P.line / 100, fs = P.label / 100;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = p.ocean; g.fillRect(0, 0, M.cv.width, M.cv.height);
  if (!M.base) { g.setTransform(dpr, 0, 0, dpr, 0, 0); return; }
  g.setTransform(dpr * k, 0, 0, dpr * k, dpr * V.tx, dpr * V.ty);
  const HOME = ['ZAF', 'LSO', 'SWZ', 'MOZ', 'BWA', 'NAM'];
  for (const c of M.base.countries) { g.beginPath(); pathPoly(g, c.p); g.fillStyle = HOME.includes(c.a3) ? p.home : p.foreign; g.fill('evenodd'); }
  if (M.terrain && M.builtTheme !== themeName()) buildRasters();
  if (M.tint && on('tint')) g.drawImage(M.tint, 0, 0); if (M.shade && on('shade')) g.drawImage(M.shade, 0, 0);
  if (on('sat')) drawSat(g, k);
  if (M.elev && on('contour')) { const iv = k < 1.5 ? 500 : k < 4 ? 200 : 100, cs = contours(iv); g.lineWidth = .5 * ls / k * 2; g.strokeStyle = 'rgba(231,201,138,.45)'; g.beginPath(); for (let i = 0; i < cs[0].length; i += 4) { g.moveTo(cs[0][i], cs[0][i + 1]); g.lineTo(cs[0][i + 2], cs[0][i + 3]); } g.stroke(); g.lineWidth = 1 * ls / k * 2; g.strokeStyle = 'rgba(231,201,138,.8)'; g.beginPath(); for (let i = 0; i < cs[1].length; i += 4) { g.moveTo(cs[1][i], cs[1][i + 1]); g.lineTo(cs[1][i + 2], cs[1][i + 3]); } g.stroke(); }
  if (on('rivers')) { g.lineJoin = 'round'; g.strokeStyle = p.river; g.lineWidth = 1.8 * ls / k; g.beginPath(); M.base.rivers.forEach(r => r.p.forEach(l => pathLine(g, l))); g.stroke(); g.fillStyle = p.lake; g.beginPath(); M.base.lakes.forEach(l => pathPoly(g, l.p)); g.fill('evenodd'); }
  if (on('bProv')) { g.strokeStyle = p.bP; g.lineWidth = 1 * ls / k; g.setLineDash([4 / k, 3 / k]); g.beginPath(); M.base.provinces.forEach(c => c.p.forEach(r => { pathLine(g, r); g.closePath(); })); g.stroke(); g.setLineDash([]); }
  if (on('bCountry')) { g.strokeStyle = p.bC; g.lineWidth = 2 * ls / k; g.beginPath(); M.base.countries.forEach(c => c.p.forEach(r => { pathLine(g, r); g.closePath(); })); g.stroke(); }
  drawRoads(g, p, ls);
  if (on('hwy')) { g.strokeStyle = p.hwy; g.lineWidth = 2.6 * ls / k; g.globalAlpha = .75; g.beginPath(); M.base.hwy.forEach(h => pathLine(g, h.p)); g.stroke(); g.globalAlpha = 1; }
  if (on('back')) { g.strokeStyle = '#a78bfa'; g.lineWidth = 2.6 * ls / k; g.setLineDash([6 / k, 4 / k]); g.beginPath(); M.base.back.forEach(h => pathLine(g, h.p)); g.stroke(); g.setLineDash([]); }
  // measuring line and route
  if (M.measure.length > 1) { g.strokeStyle = '#000'; g.lineWidth = 6 / k; g.beginPath(); M.measure.forEach((q, i) => i ? g.lineTo(mx(q[0]), my(q[1])) : g.moveTo(mx(q[0]), my(q[1]))); g.stroke(); g.strokeStyle = '#ffd24a'; g.lineWidth = 3.5 / k; g.setLineDash([8 / k, 5 / k]); g.beginPath(); M.measure.forEach((q, i) => i ? g.lineTo(mx(q[0]), my(q[1])) : g.moveTo(mx(q[0]), my(q[1]))); g.stroke(); g.setLineDash([]); }
  if (M.route && M.route.line) { g.strokeStyle = '#000'; g.lineWidth = 7 / k; g.lineJoin = 'round'; g.beginPath(); pathLine(g, M.route.line); g.stroke(); g.strokeStyle = '#38e0b0'; g.lineWidth = 4 / k; g.beginPath(); pathLine(g, M.route.line); g.stroke(); }
  // screen space from here
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (M.base) drawLabels(g, p, fs);
  drawPlaces(g, p, fs);
  if (M.measure.length) { M.measure.forEach((q, i) => { const x = S(mx(q[0])), y = T(my(q[1])); g.beginPath(); g.arc(x, y, 8, 0, 7); g.fillStyle = '#ffd24a'; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#000'; g.font = 'bold 11px system-ui'; g.textAlign = 'center'; g.fillText(String(i + 1), x, y + 3.2); g.textAlign = 'left'; }); }
  if (M.route && M.route.stops) M.route.stops.forEach((q, i) => { const x = S(mx(q[0])), y = T(my(q[1])); g.beginPath(); g.arc(x, y, 8, 0, 7); g.fillStyle = '#38e0b0'; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#000'; g.font = 'bold 10px system-ui'; g.textAlign = 'center'; g.fillText(i === 0 ? 'A' : String.fromCharCode(65 + i), x, y + 3.5); g.textAlign = 'left'; });
  if (M.sel) { const x = S(mx(M.sel.lon)), y = T(my(M.sel.lat)); g.beginPath(); g.arc(x, y, 14, 0, 7); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.stroke(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke(); }
  if (on('me') && M.me) { if (!M.gpsOn) g.globalAlpha = .45; ICON.me(g, S(mx(M.me.lon)), T(my(M.me.lat)), sc()); g.globalAlpha = 1; }
  updateReadout(performance.now() - t0);
}
const RSTYLE = { 1: [2.8, 0], 2: [2.3, 1], 3: [1.9, 2], 4: [1.4, 3], 5: [1.0, 4], 6: [0.8, 5] };
const RMIN = { 1: 0, 2: .9, 3: 1.6, 4: 2.6, 5: 4.5, 6: 8, 7: 3.2, 8: 8 };
function drawRoads(g, p, ls) {
  const k = V.k, want = { 1: on('rMain'), 2: on('rMain'), 3: on('rMain'), 4: on('rMinor'), 5: on('rMinor'), 6: on('rMinor'), 7: on('rGravel'), 8: on('rPaths') };
  if (!Object.values(want).some(Boolean)) return;
  const sources = [];
  if (k < 1.2) { if (M.overview && (want[1] || want[2])) sources.push(M.overview); }
  else if (M.regions.length) {
    const b = viewBounds(), cells = wantCells(b); for (const [key] of cells) { const c = M.cells.get(key); if (c) sources.push(c); else if (c === undefined) loadCell(key); }
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  const classes = [8, 6, 5, 4, 3, 2, 1, 7];
  for (const c of classes) {
    if (!want[c] || k < RMIN[c]) continue;
    const st = RSTYLE[c]; g.beginPath();
    if (c === 7) { g.strokeStyle = '#c9a56b'; g.lineWidth = 1.4 * ls / k; g.setLineDash([4 / k, 3 / k]); }
    else if (c === 8) { g.strokeStyle = '#8fbf7a'; g.lineWidth = 1 * ls / k; g.setLineDash([1.5 / k, 3 / k]); }
    else { g.strokeStyle = p.r[st[1]]; g.lineWidth = st[0] * ls / k * (k > 8 ? 1.25 : 1); g.setLineDash([]); }
    for (const s of sources) { const { cls, off, pts } = s; for (let i = 0; i < cls.length; i++) if (cls[i] === c) { const a = off[i], b = off[i + 1]; g.moveTo(pts[a], pts[a + 1]); for (let j = a + 2; j < b; j += 2) g.lineTo(pts[j], pts[j + 1]); } }
    g.stroke();
  }
  g.setLineDash([]);
}
const spaced = s => s.split('').join(' ');
function drawLabels(g, p, fs) {
  const k = V.k; g.textAlign = 'center'; g.font = `600 ${Math.round(11 * fs)}px system-ui`;
  if (on('lProv') && k < 2.4) M.base.provinces.forEach(c => { if (c.a3 !== 'ZAF') return; if (!c.ctr) { const b = bnds(c.p); c.ctr = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; } const x = S(c.ctr[0]), y = T(c.ctr[1]); if (!onScr(x, y)) return; g.fillStyle = p.text; g.globalAlpha = .55; g.fillText(spaced(c.n.toUpperCase()), x, y); g.globalAlpha = 1; });
  if (on('lCountry') && k < 1.6) M.base.countries.forEach(c => { if (!['BWA', 'NAM', 'MOZ', 'LSO', 'SWZ', 'ZWE', 'ZAF'].includes(c.a3)) return; if (!c.ctr) { const b = bnds(c.p); c.ctr = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; if (c.a3 === 'ZAF') c.ctr = [mx(25), my(-29.5)]; } const x = S(c.ctr[0]), y = T(c.ctr[1]); if (!onScr(x, y)) return; g.fillStyle = p.bC; g.globalAlpha = .8; g.font = `700 ${Math.round(12 * fs)}px system-ui`; g.fillText(spaced(c.n.toUpperCase()), x, y); g.globalAlpha = 1; });
  g.textAlign = 'left';
  if (on('towns')) {
    const ts = (P.icon / 100) * zoomF(), min = P.townMin === 'all' ? 0 : P.townMin === '5k' ? 5000 : P.townMin === '20k' ? 20000 : P.townMin === '100k' ? 100000 : (k < .55 ? 700000 : k < .9 ? 200000 : k < 1.5 ? 60000 : k < 3 ? 15000 : 0), boxes = [];
    for (const t of M.base.towns) {
      if (t.pop < min && !t.cap) continue; const x = S(t.x), y = T(t.y); if (!onScr(x, y)) continue;
      const big = t.pop > 800000, fsz = Math.round(12 * fs); g.font = (big ? '700 ' : '') + fsz + 'px system-ui'; const w = g.measureText(t.n).width, bx = [x + 5, y - fsz, w, fsz + 2];
      if (boxes.some(b => bx[0] < b[0] + b[2] && bx[0] + bx[2] > b[0] && bx[1] < b[1] + b[3] && bx[1] + bx[3] > b[1])) continue; boxes.push(bx);
      ICON.town(g, x, y, ts, big, p); g.lineWidth = 3; g.strokeStyle = p.halo; g.strokeText(t.n, x + 6 * ts, y + 4); g.fillStyle = p.text; g.fillText(t.n, x + 6 * ts, y + 4);
    }
  }
  if (on('peaks')) { const s = sc(); g.font = `${Math.round(11 * fs)}px system-ui`; for (const q of M.base.peaks) { const x = S(q.x), y = T(q.y); if (!onScr(x, y)) continue; ICON.peak(g, x, y, s, p); if (k > 2 || (q.h > 3400 && k > 1.2)) { g.lineWidth = 3; g.strokeStyle = p.halo; g.strokeText(`${q.n} ${fmtM(q.h)}`, x + 7 * s, y + 3); g.fillStyle = p.text; g.fillText(`${q.n} ${fmtM(q.h)}`, x + 7 * s, y + 3); } } }
}
function bnds(ps) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; ps.forEach(p => { for (let i = 0; i < p.length; i += 2) { if (p[i] < a) a = p[i]; if (p[i] > c) c = p[i]; if (p[i + 1] < b) b = p[i + 1]; if (p[i + 1] > d) d = p[i + 1]; } }); return [a, b, c, d]; }
function drawPlaces(g, p, fs) {
  const k = V.k, s = sc(), pl = M.places;
  if (M.base) {
    if (on('choke')) for (const c of M.base.choke) { const x = S(c.x), y = T(c.y); if (onScr(x, y)) ICON.choke(g, x, y, s); }
    if (on('haz')) for (const c of M.base.haz) { const x = S(c.x), y = T(c.y); if (onScr(x, y)) ICON.haz(g, x, y, s); }
  }
  if (pl) {
    let named = 0; const showName = (i, x, y, sz) => { if (P.names && k >= 6 && pl.nm[i] && ++named < 90) { g.font = Math.round(10 * fs) + 'px system-ui'; g.lineWidth = 3; g.strokeStyle = p.halo; g.strokeText(pl.nm[i], x + 6 * sz, y + 3); g.fillStyle = p.text; g.fillText(pl.nm[i], x + 6 * sz, y + 3); } };
    for (const key of Object.keys(pl.by)) {
      if (!on(key)) continue; const idx = pl.by[key];
      for (let n = 0; n < idx.length; n++) { const i = idx[n], x = S(pl.x[i]), y = T(pl.y[i]); if (!onScr(x, y)) continue; if (key === 'water') ICON.water(g, x, y, s); else if (key === 'shelter') ICON.shelter(g, x, y, s); else if (RESG[key]) { ICON.res(g, x, y, s, key, k > 2.6 || s >= 1.3); showName(i, x, y, s); } else { ICON.pub(g, x, y, s, key, k > 2.6 || s >= 1.3); showName(i, x, y, s); } }
    }
  }
  for (const pin of M.pins) if (pinShown(pin)) { const x = S(mx(pin.lon)), y = T(my(pin.lat)); if (!onScr(x, y)) continue; ICON.pin(g, x, y, s, pin); if (k >= 3 && pin.title) { g.font = `bold ${Math.round(11 * fs)}px system-ui`; g.lineWidth = 3; g.strokeStyle = p.halo; g.strokeText(pin.title, x + 11 * s, y + 4); g.fillStyle = p.text; g.fillText(pin.title, x + 11 * s, y + 4); } }
}
const pinShown = pin => pin.types.some(t => on('pin:' + t));
function updateReadout(ms) {
  const r = $('#mpRead'); if (!r) return; const lat = uny((M.CH / 2 - V.ty) / V.k), lon = unx((M.CW / 2 - V.tx) / V.k), km = 100 * kmPerPx(lat) / V.k;
  r.textContent = `${fmtCoord(lat, lon)} · 100 px ≈ ${fmtKm(km)}${M.gpsOn ? ' · GPS on' : ''}${on('sat') && M.sat.keys.size ? ' · Contains modified Copernicus Sentinel data' : ''}${P.fps ? ' · ' + ms.toFixed(0) + ' ms' : ''}`;
}

/* ---------- view control ---------- */
function setSize() { const root = M.root; if (!root) return; const top = $('#top').getBoundingClientRect().bottom, bot = $('#tabs').getBoundingClientRect().top; root.style.height = Math.max(240, bot - top) + 'px'; const r = root.getBoundingClientRect(); M.CW = r.width; M.CH = r.height; M.DPR = Math.min(window.devicePixelRatio || 1, 2); M.cv.width = Math.round(M.CW * M.DPR); M.cv.height = Math.round(M.CH * M.DPR); M.cv.style.width = M.CW + 'px'; M.cv.style.height = M.CH + 'px'; }
const fitK = () => Math.min(M.CW / W, M.CH / H) * 0.98;
function fit() { const k = fitK(); V = { k, tx: (M.CW - W * k) / 2, ty: (M.CH - H * k) / 2 }; draw(); }
function zoomAt(f, cx, cy) { const k0 = V.k, k = Math.max(fitK() * .8, Math.min(220, k0 * f)); V.tx = cx - (cx - V.tx) * k / k0; V.ty = cy - (cy - V.ty) * k / k0; V.k = k; saveView(); draw(); }
function flyTo(lon, lat, k) { V.k = Math.max(fitK() * .8, Math.min(220, k)); V.tx = M.CW / 2 - mx(lon) * V.k; V.ty = M.CH / 2 - my(lat) * V.k; saveView(); draw(); }
function bindPointer() {
  const cv = M.cv, ptrs = new Map(); let start = null, pinch = null;
  cv.style.touchAction = 'none';
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.offsetX, e.offsetY]); if (ptrs.size === 1) start = { x: e.offsetX, y: e.offsetY, t: Date.now(), moved: false, tx: V.tx, ty: V.ty }; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: V.k, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 }; start && (start.moved = true); } };
  cv.onpointermove = e => {
    if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomAt((pinch.k * d / pinch.d) / V.k, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return; }
    if (start && ptrs.size === 1) { const dx = e.offsetX - start.x, dy = e.offsetY - start.y; if (Math.abs(dx) + Math.abs(dy) > 6) start.moved = true; if (start.moved) { V.tx = start.tx + dx; V.ty = start.ty + dy; saveView(); draw(); } }
  };
  // After a pinch, the finger that stays down must start a fresh drag from where it is now, or the map jumps back to where that finger first touched.
  const rebase = () => { if (ptrs.size === 1) { const p = [...ptrs.values()][0]; start = { x: p[0], y: p[1], t: 0, moved: true, tx: V.tx, ty: V.ty }; } else if (ptrs.size === 0) start = null; };
  const up = e => { const was = start; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (was && !was.moved && ptrs.size === 0 && Date.now() - was.t < 600) tap(e.offsetX, e.offsetY); rebase(); };
  cv.onpointerup = up; cv.onpointercancel = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; rebase(); };
  cv.onwheel = e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.offsetX, e.offsetY); };
  cv.ondblclick = e => zoomAt(2, e.offsetX, e.offsetY);
}

/* ---------- tapping ---------- */
function nearest(x, y) {
  let best = null, bd = 22; const s = sc(), test = (px, py, o, type) => { const d = Math.hypot(S(px) - x, T(py) - y); if (d < bd) { bd = d; best = { type, ...o }; } };
  for (const pin of M.pins) if (pinShown(pin)) test(mx(pin.lon), my(pin.lat), { pin, lon: pin.lon, lat: pin.lat, title: pin.title || PT[pin.types[0]][1] }, 'pin');
  const pl = M.places; if (pl) for (const key of Object.keys(pl.by)) { if (!on(key)) continue; for (const i of pl.by[key]) { const px = pl.x[i], py = pl.y[i], sx = S(px), sy = T(py); if (sx < x - 24 || sx > x + 24 || sy < y - 24 || sy > y + 24) continue; test(px, py, { cat: key, lon: pl.lon[i], lat: pl.lat[i], title: pl.nm[i] || CATNAME[key] }, 'place'); } }
  if (M.base) {
    if (on('towns')) for (const t of M.base.towns) test(t.x, t.y, { lon: t.lon, lat: t.lat, title: t.n, pop: t.pop }, 'town');
    if (on('peaks')) for (const t of M.base.peaks) test(t.x, t.y, { lon: t.lon, lat: t.lat, title: t.n, h: t.h }, 'peak');
    if (on('choke')) for (const t of M.base.choke) test(t.x, t.y, { lon: t.lon, lat: t.lat, title: t.n }, 'choke');
    if (on('haz')) for (const t of M.base.haz) test(t.x, t.y, { lon: t.lon, lat: t.lat, title: t.n }, 'haz');
  }
  return best;
}
function tap(x, y) {
  const lon = unx((x - V.tx) / V.k), lat = uny((y - V.ty) / V.k), hit = nearest(x, y);
  if (M.pick) { const f = M.pick; M.pick = null; f(hit ? { lon: hit.lon, lat: hit.lat, title: hit.title } : { lon, lat }); return; }
  if (M.measureOn) { const q = hit ? [hit.lon, hit.lat] : [lon, lat]; M.measure.push(q); armMeasureTimer(); updateMeasure(); draw(); return; }
  if (hit) { M.sel = hit; showCard(hit); } else { M.sel = { lon, lat }; showSpot(lon, lat); }
  draw();
}

/* ---------- measuring ---------- */
function legStats(a, b) {
  const d = hav(a[0], a[1], b[0], b[1]); let up = 0, dn = 0, prev = elevAt(a[0], a[1]); const n = Math.max(2, Math.min(40, Math.ceil(d / 0.5)));
  for (let i = 1; i <= n; i++) { const t = i / n, e = elevAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); if (e != null && prev != null) { const dv = e - prev; dv > 0 ? up += dv : dn -= dv; } if (e != null) prev = e; }
  return { d, up, dn };
}
const walkH = (d, up) => d / P.walk + up / P.climbH;
function updateMeasure() {
  const el = $('#mpMeasInfo'); if (!el) return; const m = M.measure;
  if (!M.measureOn && !m.length) { el.hidden = true; return; } el.hidden = false;
  if (m.length < 2) { el.innerHTML = `<b>Measuring</b><br>${m.length ? 'Tap the next point.' : 'Tap the first point on the map or on a pin.'}<div class="row"><button id="mpMoff">Stop measuring</button></div>`; $('#mpMoff').onclick = () => toggleMeasure(false); return; }
  let D = 0, U = 0, Dn = 0; const rows = [];
  for (let i = 1; i < m.length; i++) { const s = legStats(m[i - 1], m[i]); D += s.d; U += s.up; Dn += s.dn; rows.push(`<tr><td>${i}→${i + 1}</td><td>${fmtKm(s.d)}</td><td>+${fmtM(s.up)} −${fmtM(s.dn)}</td></tr>`); }
  const hw = walkH(D, U), hc = D / P.cycle + U / (P.climbH * 2), hv = D / P.car;
  el.innerHTML = `<b>${fmtKm(D)}</b> in a straight line <span class="dim">(not along roads)</span><br>Climb +${fmtM(U)} / descent −${fmtM(Dn)} <span class="dim">(from coarse terrain, so roughly)</span><br>Walking ${fmtH(hw)} · cycling ${fmtH(hc)} · vehicle ${fmtH(hv)} <span class="dim">(your speeds, Settings)</span>
  <div class="tw"><table>${rows.join('')}</table></div><div class="row"><button id="mpMundo">Undo last point</button><button id="mpMclr">Clear</button><button id="mpMoff">Stop measuring</button></div>`;
  $('#mpMundo').onclick = () => { M.measure.pop(); updateMeasure(); draw(); }; $('#mpMclr').onclick = () => { M.measure = []; updateMeasure(); draw(); }; $('#mpMoff').onclick = () => toggleMeasure(false);
}
function toggleMeasure(v) {
  M.measureOn = v == null ? !M.measureOn : v; const b = $('#mpMeas'); if (b) { b.classList.toggle('pri', M.measureOn); b.textContent = M.measureOn ? 'Measuring: ON' : 'Measure'; }
  clearTimeout(M.mTimer); if (M.measureOn) { armMeasureTimer(); closeSheet(); toast('Measure is on. Tap points on the map.'); } else toast('Measure is off. Taps select again.');
  updateMeasure(); draw();
}
function armMeasureTimer() { clearTimeout(M.mTimer); if (M.measureOn && P.measureAuto > 0) M.mTimer = setTimeout(() => toggleMeasure(false), P.measureAuto * 60000); }
function toast(t) { const el = $('#mpToast'); if (!el) return; el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2600); }

/* ---------- sheets: layers, settings, cards, pins, packs ---------- */
function closeSheet() { const s = $('#mpSheet'); if (s) { s.hidden = true; s.innerHTML = ''; } M.sel = null; draw(); }
function openSheet(html, cls) { const s = $('#mpSheet'); s.className = 'mp-sheet ' + (cls || ''); s.innerHTML = html; s.hidden = false; s.scrollTop = 0; return s; }
function paintSwatches(root) { root.querySelectorAll('canvas[data-ic]').forEach(c => { const n = swatch(c.dataset.ic, M.DPR); c.width = n.width; c.height = n.height; c.getContext('2d').drawImage(n, 0, 0); }); }
function layersHtml(first) {
  return (first ? `<h2>What do you want to see?</h2><p>Nothing is shown until you tick it. Your choices are saved on this device and stay until you change them. You can reopen this list any time from <b>Layers</b>.</p>` : `<div class="row"><b style="flex:1">Layers and legend</b><button id="shX">Close</button></div>`) +
    `<div class="row"><button data-p="none">Untick all</button><button data-p="all">Tick all</button><button data-p="survival">Survival set</button><button data-p="travel">Travel set</button></div>` +
    LAYERS.map(([t, items]) => `<details open><summary>${esc(t)}</summary>${items.map(([k, n, d]) => `<label class="lay"><input type="checkbox" data-k="${k}"${on(k) ? ' checked' : ''}><canvas data-ic="${k}"></canvas><span><b>${esc(n)}</b><small>${esc(d)}</small></span></label>`).join('')}</details>`).join('') +
    (first ? `<div class="row"><button class="pri" id="shGo">Show my map</button></div>` : '') + `<p class="dim">Roads, places and water come from OpenStreetMap volunteers and can be wrong or out of date. Check everything from cover before you rely on it.</p>`;
}
function openLayers(first) {
  const s = openSheet(layersHtml(first), 'tall'); paintSwatches(s);
  const SETS = { survival: ['tint', 'shade', 'rivers', 'towns', 'rMain', 'rMinor', 'rGravel', 'water', 'shelter', 'clinic', 'pharm', 'hard', 'fuel', 'food', 'police', 'fire', 'gov', 'me', 'bCountry', ...PIN_TYPES.map(p => 'pin:' + p[0])], travel: ['tint', 'rivers', 'towns', 'bCountry', 'rMain', 'rMinor', 'rGravel', 'hwy', 'choke', 'back', 'haz', 'fuel', 'water', 'police', 'fire', 'me', ...PIN_TYPES.map(p => 'pin:' + p[0])] };
  s.onchange = e => { const k = e.target.dataset && e.target.dataset.k; if (!k) return; P.layers[k] = e.target.checked; savePrefs(); if (k === 'contour' && e.target.checked) toast('Drawing contours…'); draw(); };
  s.onclick = e => {
    const t = e.target; if (t.id === 'shX') return closeSheet();
    if (t.id === 'shGo') { firstRun = false; savePrefs(); closeSheet(); return; }
    const pset = t.dataset && t.dataset.p; if (!pset) return; const onSet = pset === 'all' ? ALLKEYS : pset === 'none' ? [] : SETS[pset]; ALLKEYS.forEach(k => P.layers[k] = onSet.includes(k)); savePrefs(); s.querySelectorAll('input[data-k]').forEach(i => i.checked = on(i.dataset.k)); draw();
  };
}
function infoLines(o) {
  const el = elevAt(o.lon, o.lat), out = [`<div class="dim">${fmtCoord(o.lat, o.lon)}</div>`];
  if (el != null && el > 0) out.push(`<div class="dim">${fmtM(el)} above sea level (coarse)</div>`);
  if (M.me) { const d = hav(M.me.lon, M.me.lat, o.lon, o.lat); out.push(`<div class="dim">${fmtKm(d)} from you in a straight line · walking about ${fmtH(walkH(d, 0))}</div>`); }
  return out.join('');
}
function cardActions(o, extra) { return `<div class="row">${extra || ''}<button id="cMeasure">Measure from here</button><button id="cRoute">Route to here</button></div>`; }
function wireCard(o) {
  $('#cx').onclick = closeSheet;
  $('#cMeasure').onclick = () => { M.measure = [[o.lon, o.lat]]; closeSheet(); toggleMeasure(true); updateMeasure(); draw(); };
  $('#cRoute').onclick = () => { if (window.BHRoute) { closeSheet(); window.BHRoute.to(M, o); } else toast('The route planner is not installed in this build.'); };
}
function showCard(h) {
  const cat = h.cat, grp = ['police', 'fire', 'gov', 'school'].includes(cat) ? 'pub' : RESG[cat] ? 'res' : cat, caveat = CAVEAT[grp] || (h.type === 'haz' ? CAVEAT.haz : h.type === 'choke' ? CAVEAT.choke : '');
  if (h.type === 'pin') return pinForm(h.pin, true);
  const kind = h.type === 'place' ? CATNAME[cat] + ' (OpenStreetMap)' : h.type === 'town' ? 'Town · pop. ' + h.pop.toLocaleString('en-GB') : h.type === 'peak' ? 'Peak · ' + fmtM(h.h) : h.type === 'haz' ? 'Hazard site (approximate)' : 'Choke point (approximate)';
  const s = openSheet(`<button class="x" id="cx">×</button><h3>${esc(h.title)}</h3><div class="dim">${esc(kind)}</div>${caveat ? `<div class="warn">${esc(caveat)}</div>` : ''}${infoLines(h)}${cardActions(h, '<button class="pri" id="cPin">Save as my pin</button>')}`);
  wireCard(h); $('#cPin').onclick = () => pinForm({ lon: h.lon, lat: h.lat, title: h.type === 'place' && h.title !== CATNAME[cat] ? h.title : '', types: [pinTypeFor(cat)] });
}
const pinTypeFor = c => ({ water: 'water', shelter: 'shelter', clinic: 'medical', pharm: 'medical', hard: 'tools', fuel: 'fuel', food: 'food' }[c] || 'note');
function showSpot(lon, lat) {
  openSheet(`<button class="x" id="cx">×</button><h3>${P.coord === 'dms' ? fmtCoord(lat, lon) : 'This spot'}</h3>${infoLines({ lon, lat })}${cardActions({ lon, lat }, '<button class="pri" id="cPin">Add my pin here</button>')}`);
  wireCard({ lon, lat }); $('#cPin').onclick = () => pinForm({ lon, lat, title: '', types: ['note'] });
}
async function savePins() { await kvSet('pins', M.pins); }
function pinForm(pin, viewing) {
  const isNew = !pin.id, p = Object.assign({ status: 'unchecked', checked: new Date().toISOString().slice(0, 10), note: '', tags: [], vis: 'private' }, pin);
  const age = p.checked ? Math.floor((Date.now() - new Date(p.checked).getTime()) / 864e5) : null;
  const s = openSheet(`<button class="x" id="cx">×</button><h3>${isNew ? 'New pin' : 'Pin'}</h3><div class="dim">${fmtCoord(p.lat, p.lon)}${age != null && !isNew ? ` · checked ${age} day${age === 1 ? '' : 's'} ago` : ''}</div>
  <label>Name</label><input type="text" id="pnm" value="${esc(p.title || '')}" placeholder="e.g. Uncle Piet's borehole">
  <label>Type (tick more than one if it fits)</label><div class="chips">${PIN_TYPES.map(t => `<label class="chip"><input type="checkbox" value="${t[0]}"${p.types.includes(t[0]) ? ' checked' : ''}><span style="border-color:${t[2]}">${esc(t[1])}</span></label>`).join('')}</div>
  <div class="row"><div class="grow"><label>Status</label><select id="pst">${STATUS.map(x => `<option value="${x[0]}"${p.status === x[0] ? ' selected' : ''}>${x[1]}</option>`).join('')}</select></div><div class="grow"><label>Last checked</label><input type="date" id="pck" value="${esc(p.checked || '')}"></div></div>
  <label>Note</label><textarea id="pnt" placeholder="What is here, how to get in, who owns it, how much, risks…">${esc(p.note)}</textarea>
  <label>Tags (separate with commas)</label><input type="text" id="ptg" value="${esc((p.tags || []).join(', '))}">
  <label>Who can see it</label><select id="pvs"><option value="private"${p.vis === 'private' ? ' selected' : ''}>Private: only on this device, left out of shared backups</option><option value="shared"${p.vis === 'shared' ? ' selected' : ''}>Shared: included when you save a backup for your group</option></select>
  <div class="row"><button class="pri" id="psave">Save pin</button>${isNew ? '' : '<button id="pmeas">Measure from here</button><button id="proute">Route to here</button><button class="dng" id="pdel">Delete</button>'}</div>`, 'tall');
  $('#cx').onclick = closeSheet;
  $('#psave').onclick = async () => {
    const types = [...s.querySelectorAll('.chips input:checked')].map(i => i.value); if (!types.length) types.push('note');
    const rec = { id: p.id || uid(), lon: p.lon, lat: p.lat, title: $('#pnm').value.trim(), types, status: $('#pst').value, checked: $('#pck').value || null, note: $('#pnt').value.trim(), tags: $('#ptg').value.split(',').map(x => x.trim()).filter(Boolean), vis: $('#pvs').value, c: p.c || new Date().toISOString(), u: Date.now() };
    const i = M.pins.findIndex(x => x.id === rec.id); if (i >= 0) M.pins[i] = rec; else M.pins.push(rec);
    types.forEach(t => { if (!on('pin:' + t)) P.layers['pin:' + t] = true; }); savePrefs(); await savePins(); closeSheet(); toast('Pin saved'); draw();
  };
  if (!isNew) {
    $('#pdel').onclick = async () => { if (!confirm('Delete this pin?')) return; M.pins = M.pins.filter(x => x.id !== p.id); await savePins(); await tomb(p.id); closeSheet(); draw(); };
    $('#pmeas').onclick = () => { M.measure = [[p.lon, p.lat]]; closeSheet(); toggleMeasure(true); updateMeasure(); draw(); };
    $('#proute').onclick = () => { if (window.BHRoute) { closeSheet(); window.BHRoute.to(M, { lon: p.lon, lat: p.lat, title: p.title }); } else toast('The route planner is not installed in this build.'); };
  }
}

/* ---------- settings ---------- */
function range(k, label, min, max, step, unit) { return `<label>${label}: <b id="v_${k}">${P[k]}${unit || ''}</b></label><input type="range" data-s="${k}" min="${min}" max="${max}" step="${step}" value="${P[k]}">`; }
function sel(k, label, opts) { return `<label>${label}</label><select data-s="${k}">${opts.map(([v, n]) => `<option value="${v}"${String(P[k]) === String(v) ? ' selected' : ''}>${n}</option>`).join('')}</select>`; }
function tog(k, label) { return `<label class="lay"><input type="checkbox" data-t="${k}"${P[k] ? ' checked' : ''}><span><b>${label}</b></span></label>`; }
function openSettings() {
  const s = openSheet(`<div class="row"><b style="flex:1">Map settings</b><button id="shX">Close</button></div>
  <h3>Map packs</h3><div id="packList"><p class="dim">Checking what is on this device…</p></div><label>Add map packs from the flash drive or Downloads (.bhmap). You can choose several at once, and add the missing ones later.</label><input type="file" id="packIn" multiple><div class="bar" id="packBar" hidden><i></i></div><p class="dim" id="packMsg"></p><div id="packLog"></div>
  <h3>When the map opens</h3>${sel('start', 'Start the map at', [['last', 'Where I left it'], ['gps', 'My GPS position'], ['home', 'My home spot'], ['all', 'The whole region']])}<div class="row"><button id="setHome">Use the map centre as my home spot</button></div>
  <h3>Units and numbers</h3>${sel('units', 'Distances', [['km', 'Kilometres and metres'], ['mi', 'Miles and feet']])}${sel('coord', 'Coordinates', [['dec', 'Decimal degrees'], ['dms', 'Degrees, minutes, seconds']])}${sel('theme', 'Map colours', [['auto', 'Follow the app'], ['dark', 'Dark'], ['light', 'Light'], ['contrast', 'High contrast'], ['night', 'Night (red)']])}${sel('townMin', 'Towns shown', [['auto', 'Automatic by zoom'], ['all', 'All towns'], ['5k', 'Over 5,000 people'], ['20k', 'Over 20,000'], ['100k', 'Over 100,000']])}
  <h3>Sizes</h3>${range('icon', 'Icon size', 40, 320, 5, '%')}${range('label', 'Text size', 60, 260, 5, '%')}${range('line', 'Line thickness', 50, 320, 5, '%')}${tog('iconAuto', 'Icons grow and shrink as you zoom')}${tog('names', 'Show names of shops and buildings when zoomed in close')}<div class="row"><button id="szReset">Back to default sizes</button></div>
  <h3>Measuring and travel times</h3>${sel('measureAuto', 'Switch Measure off by itself after', [[0, 'Never'], [2, '2 minutes'], [10, '10 minutes'], [30, '30 minutes']])}${range('walk', 'Your walking speed (km/h, flat)', 2, 8, .1, ' km/h')}${range('climbH', 'Climb that costs you one hour of walking (m)', 200, 1200, 25, ' m')}${range('cycle', 'Cycling speed (km/h)', 6, 35, 1, ' km/h')}${range('car', 'Vehicle cruising speed on main roads (km/h)', 20, 130, 5, ' km/h')}${range('gravelFactor', 'Gravel and tracks run at this share of your speed', .2, 1, .05, '')}
  <h3>GPS and battery</h3><p class="dim">GPS needs no internet but uses battery while it is on. Use the GPS button on the map to switch it off any time.</p>${sel('gpsEvery', 'How often to check your position', [['cont', 'Continuously (most accurate, most battery)'], [15, 'Every 15 seconds'], [60, 'Every minute'], [300, 'Every 5 minutes (saves most)']])}${sel('gpsAutoOff', 'Switch GPS off by itself after', [[0, 'Never'], [10, '10 minutes'], [30, '30 minutes'], [60, '1 hour'], [120, '2 hours']])}${tog('gpsStopLeave', 'Switch GPS off when I leave the Map tab')}
  <h3>Pins</h3>${range('staleAmber', 'Pin turns amber after (days)', 30, 720, 10, ' d')}${range('staleRed', 'Pin turns red after (days)', 60, 1500, 10, ' d')}
  <h3>Other</h3>${tog('fps', 'Show draw time (for testing speed on this device)')}<div class="row"><button class="dng" id="clean">Back to clean (hide all layers and show the chooser)</button></div>`, 'tall');
  refreshPackList();
  s.onclick = async e => {
    const t = e.target;
    if (t.id === 'shX') return closeSheet();
    if (t.id === 'setHome') { const lat = uny((M.CH / 2 - V.ty) / V.k), lon = unx((M.CW / 2 - V.tx) / V.k); P.home = [lon, lat]; savePrefs(); toast('Home spot saved'); }
    if (t.id === 'szReset') { P.icon = P.label = P.line = 100; P.iconAuto = true; savePrefs(); openSettings(); draw(); }
    if (t.id === 'clean') { if (!confirm('Hide every layer and show the "What do you want to see?" list again? Your pins are kept.')) return; P.layers = {}; firstRun = true; savePrefs(); openLayers(true); draw(); }
    if (t.dataset && t.dataset.sat) { goSat(t.dataset.sat); return; }
    if (t.dataset && t.dataset.rm) { if (!confirm('Remove this map pack from the device?')) return; await removePack(t.dataset.rm); await boot(); refreshPackList(); draw(); }
  };
  s.oninput = e => { const t = e.target, k = t.dataset && t.dataset.s; if (!k || t.type !== 'range') return; P[k] = +t.value; const b = $('#v_' + k); if (b) b.textContent = t.value + (k === 'icon' || k === 'label' || k === 'line' ? '%' : k.includes('Factor') ? '' : ''); savePrefs(); draw(); };
  s.onchange = e => { const t = e.target; if (t.dataset && t.dataset.s && t.tagName === 'SELECT') { const v = t.value; P[t.dataset.s] = isNaN(+v) || t.dataset.s === 'townMin' || t.dataset.s === 'theme' || t.dataset.s === 'units' || t.dataset.s === 'coord' || t.dataset.s === 'start' ? v : +v; savePrefs(); if (M.gpsOn && (t.dataset.s === 'gpsEvery' || t.dataset.s === 'gpsAutoOff')) gpsStart(false); draw(); } if (t.dataset && t.dataset.t) { P[t.dataset.t] = t.checked; savePrefs(); draw(); } if (t.id === 'packIn') addPacks(t.files); };
}
function goSat(id) {
  const p = M.packs.find(x => x.id === id), b = p && p.info && p.info.bbox; if (!b) return toast('This photo pack does not say where it is.');
  P.layers.sat = true; savePrefs(); closeSheet(); flyTo((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 10); toast('Satellite photos are on. Zoom in to see more detail.');
}
const KNOWN = [
  ['base:all', 'Base-Terrain-Places.bhmap', 'Base map, terrain and places', 5, 1], ['roads-ov:all', 'Roads-Overview.bhmap', 'Main roads when zoomed out', 1, 0],
  ['roads:za', 'Roads-South-Africa.bhmap', 'Roads and tracks: South Africa', 49, 0], ['roads:ls', 'Roads-Lesotho.bhmap', 'Roads and tracks: Lesotho', 4, 0], ['roads:sz', 'Roads-Eswatini.bhmap', 'Roads and tracks: Eswatini', 2, 0],
  ['roads:mz', 'Roads-Southern-Mozambique.bhmap', 'Roads and tracks: southern Mozambique', 3, 0], ['roads:bw', 'Roads-Botswana-south-of-22S.bhmap', 'Roads and tracks: Botswana (south of 22°S)', 3, 0], ['roads:na', 'Roads-Namibia-south-of-22S.bhmap', 'Roads and tracks: Namibia (south of 22°S)', 2, 0],
  ['routing:all', 'Routing.bhmap', 'Road network for the Route planner', 160, 0]
];
// satellite photo packs: optional, listed on their own and not counted in "x of y"
const PHOTOS = [
  ['imagery:cape', 'Photos-Cape-Region.bhmap', 'Photos: Cape Town, the Peninsula and the mountains beyond', 60],
  ['imagery:capepen', 'Photos-CapePeninsula.bhmap', 'Photos: Cape Peninsula only', 16],
  ['imagery:gauteng', 'Photos-Gauteng.bhmap', 'Photos: all of Gauteng', 104],
  ['imagery:nwest', 'Photos-NorthWest-Springs.bhmap', 'Photos: North-West springs area', 24],
  ['imagery:lesotho', 'Photos-Lesotho-Belt.bhmap', 'Photos: Lesotho and a 20 km belt around it', 213],
  ['imagery:durban', 'Photos-Durban-Pietermaritzburg.bhmap', 'Photos: Durban, Pietermaritzburg and the coast', 38],
  ['imagery:ec1', 'Photos-EastLondon-Pilot.bhmap', 'Photos: East London, Qonce and the coast to Hamburg', 25]
];
const COVERED_BY = { 'imagery:capepen': 'imagery:cape' };   // the Cape Region photos already include the Peninsula
async function peekPack(file) {
  try {
    const head = new Uint8Array(await file.slice(0, 11).arrayBuffer());
    if (String.fromCharCode(...head.slice(0, 6)) !== 'BHMAP1') return null;
    const hl = new DataView(head.buffer).getUint32(7, true); return JSON.parse(await file.slice(11, 11 + hl).text());
  } catch (e) { return null; }
}
async function checkPacks() {
  const keys = await new Promise(res => { const out = []; try { const t = DB.db.transaction('mapdata', 'readonly'), r = t.objectStore('mapdata').openKeyCursor(); r.onsuccess = () => { const c = r.result; if (c) { out.push(c.key); c.continue(); } }; t.oncomplete = () => res(out); t.onerror = () => res(out); } catch (e) { res(out); } });
  const have = {}; const add = id => have[id] = (have[id] || 0) + 1;
  for (const k of keys) { if (k === 'base' || k === 'places' || k.startsWith('t/')) add('base:all'); else if (k === 'ov') add('roads-ov:all'); else if (k.startsWith('g/')) add('routing:all'); else if (k.startsWith('r/')) add('roads:' + k.split('/')[1]); else if (k.startsWith('i/')) add('imagery:' + k.split('/')[1]); }
  return have;
}
async function refreshPackList() {
  const box = $('#packList'); if (!box) return; const have = await checkPacks(), byId = Object.fromEntries(M.packs.map(p => [p.id, p]));
  let ok = 0; const missing = [];
  const rows = KNOWN.map(([id, file, name, mb, req]) => {
    const p = byId[id], n = have[id] || 0; let st, cls;
    if (p && n >= p.entries) { st = 'Added'; cls = 'ok'; ok++; }
    else if (p || n) { st = 'Incomplete' + (p ? ' (' + n + ' of ' + p.entries + ' parts)' : '') + '. Add this file again.'; cls = 'bad'; missing.push(file); }
    else { st = req ? 'Not added yet. Needed first.' : 'Not added yet'; cls = req ? 'bad' : 'soon'; missing.push(file); }
    const mark = cls === 'ok' ? '✓' : cls === 'bad' ? '✗' : '○';
    return '<div class="row"><b class="' + cls + '" style="width:1.3em">' + mark + '</b><span class="grow"><b>' + esc(name) + '</b><br><span class="dim">' + esc(file) + ' · about ' + mb + ' MB · <span class="' + cls + '">' + st + '</span></span></span>' + (p ? '<button class="dng" data-rm="' + esc(id) + '">Remove</button>' : '') + '</div>';
  });
  const done = id => byId[id] && (have[id] || 0) >= byId[id].entries;
  const photoRows = PHOTOS.map(([id, file, name, mb]) => {
    const p = byId[id], n = have[id] || 0, covered = COVERED_BY[id] && done(COVERED_BY[id]); let st, cls;
    if (p && n >= p.entries) { st = 'Added' + (covered ? '. The Cape Region photos already cover this area: you can remove this one to save space.' : ''); cls = 'ok'; }
    else if (p || n) { st = 'Incomplete' + (p ? ' (' + n + ' of ' + p.entries + ' parts)' : '') + '. Add this file again.'; cls = 'bad'; }
    else if (covered) { st = 'Not needed: the Cape Region photos already cover this area'; cls = 'soon'; }
    else { st = 'Not added yet (optional)'; cls = 'soon'; }
    const mark = cls === 'ok' ? '✓' : cls === 'bad' ? '✗' : '○';
    return '<div class="row"><b class="' + cls + '" style="width:1.3em">' + mark + '</b><span class="grow"><b>' + esc(name) + '</b><br><span class="dim">' + esc(file) + ' · about ' + mb + ' MB · <span class="' + cls + '">' + st + '</span></span></span>' + (p && n >= p.entries ? '<button data-sat="' + esc(id) + '">Show on map</button>' : '') + (p ? '<button class="dng" data-rm="' + esc(id) + '">Remove</button>' : '') + '</div>';
  });
  const extra = M.packs.filter(p => !KNOWN.some(k => k[0] === p.id) && !PHOTOS.some(k => k[0] === p.id)).map(p => '<div class="row"><b class="ok" style="width:1.3em">✓</b><span class="grow"><b>' + esc(p.name) + '</b><br><span class="dim">' + p.mb + ' MB' + (p.pack === 'imagery' ? ' · satellite photos. Show them on the map with the button, then zoom in.' : '') + '</span></span>' + (p.pack === 'imagery' ? '<button data-sat="' + esc(p.id) + '">Show on map</button>' : '') + '<button class="dng" data-rm="' + esc(p.id) + '">Remove</button></div>').join('');
  box.innerHTML = '<p><b>' + ok + ' of ' + KNOWN.length + ' map packs added.</b>' + (missing.length ? ' <span class="dim">Still to add: ' + esc(missing.join(', ')) + '</span>' : ' Everything is in.') + '</p>' + rows.join('') + '<p style="margin-top:14px"><b>Satellite photos</b> <span class="dim">(optional: add only the areas you want)</span></p>' + photoRows.join('') + extra;
}
async function addPacks(files) {
  const bar = $('#packBar'), msg = $('#packMsg'), log = $('#packLog'), res = []; if (bar) bar.hidden = false;
  const list = [...files], paint = () => { if (log) log.innerHTML = res.map(r => '<div class="' + (r.skipped ? 'dim' : r.ok ? 'ok' : 'bad') + '">' + (r.skipped ? '○ Skipped (' + (r.why || 'already on this device') + ')' : r.ok ? '✓ Added' : '✗ Failed') + ': ' + esc(r.name) + (r.ok ? '' : ' — ' + esc(r.err)) + (r.note ? '<br><span class="dim">' + esc(r.note) + '</span>' : '') + '</div>').join(''); };
  for (let i = 0; i < list.length; i++) {
    const f = list[i]; if (msg) msg.textContent = 'File ' + (i + 1) + ' of ' + list.length + ': checking ' + f.name + '…';
    // already on this device? ask before spending minutes and battery on the same pack again
    const hdr = await peekPack(f), id = hdr && hdr.pack + ':' + hdr.region, old = id && M.packs.find(p => p.id === id); let skip = false, note = '', why = '';
    if (old) { const have = await checkPacks(); if ((have[id] || 0) >= old.entries && old.created === hdr.created) why = 'already on this device'; skip = !confirm('"' + (hdr.name || f.name) + '" is already on this device and complete. Adding it again changes nothing and takes a while. Add it again anyway?'); }
    else if (id && COVERED_BY[id] && M.packs.some(p => p.id === COVERED_BY[id])) why = 'the Cape Region photos already cover it'; skip = !confirm('The Cape Region photos are already on this device and already cover the Peninsula. Add the Peninsula pack as well? It would use about 16 MB more and show nothing extra.');
    if (skip) { res.push({ ok: true, skipped: true, why: why || 'already on this device', name: f.name }); paint(); continue; }
    if (msg) msg.textContent = 'File ' + (i + 1) + ' of ' + list.length + ': adding ' + f.name + '…';
    try { await importPack(f, (d, t) => { if (msg) msg.textContent = 'File ' + (i + 1) + ' of ' + list.length + ': ' + f.name + ' (' + d + ' of ' + t + ' parts)'; }); if (id && Object.values(COVERED_BY).includes(id) && M.packs.some(p => COVERED_BY[p.id] === id)) note = 'This pack covers the Cape Peninsula pack already on this device. You can remove the Peninsula pack in the list below to save 16 MB.'; res.push({ ok: true, name: f.name, note }); }
    catch (e) { res.push({ ok: false, name: f.name, err: e && e.message ? e.message : 'unknown problem' }); }
    paint();
  }
  const nAdd = res.filter(r => r.ok && !r.skipped).length, nSkip = res.filter(r => r.skipped).length;
  if (msg) msg.textContent = 'Finished: ' + nAdd + ' of ' + res.length + ' added' + (nSkip ? ', ' + nSkip + ' skipped because already on this device' : '') + '.'; if (bar) bar.hidden = true;
  if (res.some(r => r.ok && !r.skipped && /photo/i.test(r.name)) && msg) msg.textContent += ' Photos are added but not switched on: tap "Show on map" next to the photo pack below, or tick Layers > Satellite photos and zoom in.';
  await boot(); await refreshPackList(); draw();
}

/* ---------- finding things ---------- */
function searchBox() {
  const q = $('#mpQ'), box = $('#mpFind'); const go = () => {
    const v = q.value.trim().toLowerCase(); if (v.length < 2) { box.hidden = true; return; }
    const out = []; if (M.base) M.base.towns.forEach(t => { if (t.n.toLowerCase().includes(v)) out.push({ t: t.n + ' (town)', lon: t.lon, lat: t.lat, k: 9 }); });
    M.pins.forEach(p => { if ((p.title || '').toLowerCase().includes(v) || (p.tags || []).some(x => x.toLowerCase().includes(v))) out.push({ t: (p.title || 'Pin') + ' (my pin)', lon: p.lon, lat: p.lat, k: 24 }); });
    const m = v.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/); if (m) out.unshift({ t: 'Go to ' + m[1] + ', ' + m[2], lat: +m[1], lon: +m[2], k: 30 });
    M.packs.filter(p => p.pack === 'imagery' && p.info && p.info.bbox && /photo|satell|imag/.test(v)).forEach(p => { const b = p.info.bbox; out.unshift({ t: 'Satellite photos: ' + p.name, lon: (b[0] + b[2]) / 2, lat: (b[1] + b[3]) / 2, k: 10, sat: 1 }); });
    if (M.places) { let n = 0; for (let i = 0; i < M.places.n && n < 8; i++) { const nm = M.places.nm[i]; if (nm && nm.toLowerCase().includes(v)) { out.push({ t: nm + ' (' + CATNAME[CATS[M.places.c[i]]] + ')', lon: M.places.lon[i], lat: M.places.lat[i], k: 40 }); n++; } } }
    box.innerHTML = out.slice(0, 12).map((r, i) => `<button data-i="${i}">${esc(r.t)}</button>`).join('') || '<div class="dim" style="padding:8px">Nothing found. Try a town name or coordinates like -26.2, 28.05</div>'; box.hidden = false; box._r = out;
  };
  q.oninput = go; box.onclick = e => { const i = e.target.dataset && e.target.dataset.i; if (i == null) return; const r = box._r[i]; if (r.sat) { P.layers.sat = true; savePrefs(); } flyTo(r.lon, r.lat, r.k); box.hidden = true; q.value = ''; M.sel = { lon: r.lon, lat: r.lat }; draw(); };
}

/* ---------- GPS ---------- */
function updateGpsBtn() { const b = $('#mpGps'); if (!b) return; b.textContent = M.gpsOn ? 'GPS: ON' : 'GPS: off'; b.classList.toggle('pri', !!M.gpsOn); b.title = M.gpsOn ? 'Tap to switch the GPS off and save battery' : 'Tap to switch the GPS on'; }
function gpsStop(silent, why) {
  if (M.watch) { try { navigator.geolocation.clearWatch(M.watch); } catch (e) {} M.watch = 0; }
  clearInterval(M.gpsTimer); clearTimeout(M.gpsOffT); M.gpsTimer = 0; M.gpsOffT = 0; const was = M.gpsOn; M.gpsOn = false; updateGpsBtn();
  if (!silent && was) toast(why || 'GPS is off, saving battery. Your last position stays on the map, faded.'); draw();
}
function gpsStart(centre) {
  if (!navigator.geolocation) return toast('This device has no GPS access from the app.');
  gpsStop(true); M.gpsOn = true; M.gpsCentre = !!centre; updateGpsBtn(); toast('GPS is on. Finding you… (it needs a clear sky, not a signal)');
  const opts = { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 };
  const ok = pos => { const first = !M.me || M.gpsCentre; M.gpsCentre = false; M.me = { lon: pos.coords.longitude, lat: pos.coords.latitude, acc: pos.coords.accuracy, t: Date.now() }; P.layers.me = true; if (first) flyTo(M.me.lon, M.me.lat, Math.max(V.k, 6)); draw(); };
  const err = e => toast(e.code === 1 ? 'Location is switched off for this app. Allow it in the phone settings.' : 'Could not get a GPS fix yet. Try somewhere with a clear sky.');
  if (P.gpsEvery === 'cont') M.watch = navigator.geolocation.watchPosition(ok, err, opts);
  else { const poll = () => navigator.geolocation.getCurrentPosition(ok, err, opts); poll(); M.gpsTimer = setInterval(poll, Math.max(5, +P.gpsEvery) * 1000); }
  if (+P.gpsAutoOff > 0) M.gpsOffT = setTimeout(() => gpsStop(false, 'GPS switched itself off after ' + P.gpsAutoOff + ' minutes to save battery. Tap GPS to turn it on again.'), P.gpsAutoOff * 60000);
}
function locate() { if (M.gpsOn && M.me) { flyTo(M.me.lon, M.me.lat, Math.max(V.k, 6)); } else gpsStart(true); }
function toggleGps() { M.gpsOn ? gpsStop(false) : gpsStart(true); }

/* ---------- opening the map ---------- */
async function boot() {
  await loadPacks(); const ok = await loadBase(); if (ok) { await loadPlaces(); loadTerrain().then(() => draw()); loadOverview().then(() => draw()); }
  return ok;
}
function noPacksHtml() {
  return `<div class="mp-empty"><h2>Map</h2><p>The map works with no internet, but it needs its map packs first. Copy them once from the flash drive.</p>
  <ol><li>On the flash drive open the <b>Map-Packs</b> folder.</li><li>Tap the button below and choose <b>Base-Terrain-Places.bhmap</b>, then the <b>Roads</b> files (South Africa first). You can pick several at once.</li><li>When it says Added, the map opens.</li></ol>
  <div id="packList"></div><input type="file" id="packIn" multiple><div class="bar" id="packBar" hidden><i></i></div><p class="dim" id="packMsg"></p><div id="packLog"></div>
  <p class="dim">Map data: OpenStreetMap contributors (ODbL), Natural Earth, AWS Terrain Tiles. The packs are only stored on this device.</p></div>`;
}
async function open(view, sub) {
  A.setTab('map'); document.body.classList.add('mapmode'); view.className = 'mapv';
  P = Object.assign({}, DEF, await kvGet('map.prefs', null) || {}); const had = await kvGet('map.prefs', null); firstRun = !had; P.layers = P.layers || {};
  M.pins = await kvGet('pins', []);
  const ok = await boot();
  if (!DB.db) { view.innerHTML = '<div class="mp-empty"><h2>Map</h2><p class="warn">This device would not let the app save data, so map packs cannot be stored here.</p></div>'; return; }
  if (!ok) { view.innerHTML = noPacksHtml(); $('#packIn').onchange = async e => { await addPacks(e.target.files); if (M.base) open(view, sub); }; refreshPackList(); $('#packList').onclick = async e => { const b = e.target.dataset && e.target.dataset.rm; if (b) { await removePack(b); refreshPackList(); } }; return; }
  view.innerHTML = `<div class="mp" id="mp"><canvas id="mpc"></canvas>
  <div class="mp-top"><button id="mpL" class="pri">Layers</button><button id="mpS">Settings</button><input id="mpQ" type="search" placeholder="Find a town, pin or coordinates…" autocomplete="off"></div><div class="mp-find" id="mpFind" hidden></div>
  <div class="mp-fab"><button id="mpZin" aria-label="Zoom in">+</button><button id="mpZout" aria-label="Zoom out">−</button><button id="mpLoc" aria-label="Go to my location">◎</button><button id="mpGps" class="pill">GPS: off</button><button id="mpMeas" class="pill">Measure</button><button id="mpRt" class="pill">Route</button></div>
  <div class="mp-meas" id="mpMeasInfo" hidden></div><div class="mp-read" id="mpRead"></div><div class="mp-toast" id="mpToast" hidden></div><div class="mp-sheet" id="mpSheet" hidden></div></div>`;
  M.root = $('#mp'); M.cv = $('#mpc'); M.ctx = M.cv.getContext('2d'); setSize();
  const saved = await kvGet('map.view', null);
  if (P.start === 'last' && saved && saved.k) V = saved; else if (P.start === 'home' && P.home) flyTo(P.home[0], P.home[1], 6); else fit();
  if (!(P.start === 'home' && P.home)) { if (!(P.start === 'last' && saved && saved.k)) fit(); }
  bindPointer(); searchBox();
  $('#mpL').onclick = () => openLayers(false); $('#mpS').onclick = openSettings;
  $('#mpZin').onclick = () => zoomAt(1.6, M.CW / 2, M.CH / 2); $('#mpZout').onclick = () => zoomAt(1 / 1.6, M.CW / 2, M.CH / 2); $('#mpLoc').onclick = locate; $('#mpGps').onclick = toggleGps; updateGpsBtn();
  $('#mpMeas').onclick = () => toggleMeasure(); $('#mpRt').onclick = () => { if (window.BHRoute) window.BHRoute.open(); else toast('The route planner is not installed in this build.'); };
  M.measureOn = false; if (P.start === 'gps') gpsStart(true);
  window.addEventListener('resize', onResize); draw();
  if (firstRun) openLayers(true);
}
function onResize() { if (!M.root || !document.body.contains(M.root)) return window.removeEventListener('resize', onResize); setSize(); draw(); }
function leave() { document.body.classList.remove('mapmode'); clearTimeout(M.mTimer); if (P && P.gpsStopLeave && M.gpsOn) gpsStop(true); }
window.BHMap = { listPacks: async () => { await loadPacks(); return M.packs; }, removePackById: id => removePack(id), open, leave, M, mx, my, unx, uny, hav, kmPerPx, getRec, elevAt, flyTo, draw, openSheet, closeSheet, fmtKm, fmtM, fmtH, fmtCoord, toast, get P() { return P; }, V: () => V };
})();
