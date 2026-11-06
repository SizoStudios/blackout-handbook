/* Blackout Handbook: route planner. Finds the best way along roads and tracks, using the road network pack (Routing.bhmap). Works with no internet. */
(function () {
'use strict';
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const B = () => window.BHMap, A = () => window.BHAPP;
const STATE = { stops: [], mode: 'vehicle', sealed: false, avoid: true, avoidKm: 2, hours: { walk: 7, cycle: 7, vehicle: 8 }, start: null, result: null };
let G = null, loading = null;

/* ---------- loading the road network from the imported pack ---------- */
const TYPES = { Int32Array, Uint32Array, Uint8Array, Uint16Array, Int16Array };
async function readChunks(id, bytes) {
  const out = new Uint8Array(bytes); let o = 0, k = 0;
  while (o < bytes) { const d = await B().getRec(`g/${id}/${k++}`); if (!d) throw new Error('The road network pack is incomplete. Add Routing.bhmap again.'); out.set(new Uint8Array(d), o); o += d.byteLength; }
  return out.buffer;
}
async function loadGraph(progress) {
  if (G) return G; if (loading) return loading;
  loading = (async () => {
    const regions = (await A().kvGet('map.packs', [])).find(p => p.pack === 'routing'); if (!regions) throw new Error('The road network is not on this device yet. In Map, Settings, add Routing.bhmap from the flash drive.');
    const ids = ['ls', 'sz', 'mz', 'bw', 'na', 'za'], parts = [];
    for (const id of ids) {
      const hb = await B().getRec(`g/${id}/h`); if (!hb) continue; const h = JSON.parse(new TextDecoder().decode(hb)); if (progress) progress('Reading ' + id.toUpperCase() + '…');
      const buf = await readChunks(id, h.bytes), a = {}; for (const l of h.layout) a[l.k] = new TYPES[l.t](buf, l.o, l.n); parts.push({ id, h, a });
    }
    if (progress) progress('Joining regions…');
    const lk = JSON.parse(new TextDecoder().decode(await B().getRec('g/links') || new TextEncoder().encode('[]')));
    let n = 0, m = 0, sp = 0; const base = {}, ebase = {}, sbase = {};
    for (const p of parts) { base[p.id] = n; ebase[p.id] = m; sbase[p.id] = sp; n += p.h.n; m += p.h.m; sp += p.a.shape.length; }
    const M2 = m + lk.length, lon = new Int32Array(n), lat = new Int32Array(n), from = new Uint32Array(M2), to = new Uint32Array(M2), len = new Uint32Array(M2), cls = new Uint8Array(M2), fl = new Uint8Array(M2), soff = new Uint32Array(M2), sn = new Uint16Array(M2), shape = new Int16Array(sp);
    for (const p of parts) {
      const nb = base[p.id], eb = ebase[p.id], a = p.a; lon.set(a.lon, nb); lat.set(a.lat, nb); for (let i = 0; i < p.h.m; i++) { from[eb + i] = a.from[i] + nb; to[eb + i] = a.to[i] + nb; soff[eb + i] = a.soff[i] + sbase[p.id]; }
      len.set(a.len, eb); cls.set(a.cls, eb); fl.set(a.fl, eb); sn.set(a.sn, eb); shape.set(a.shape, sbase[p.id]);
    }
    let e = m; for (const [ra, na, rb, nb] of lk) { if (base[ra] == null || base[rb] == null) continue; from[e] = base[ra] + na; to[e] = base[rb] + nb; len[e] = 10; cls[e] = 5; fl[e] = 0; sn[e] = 0; e++; }
    const mm = e, deg = new Uint32Array(n + 1); for (let i = 0; i < mm; i++) { deg[from[i] + 1]++; deg[to[i] + 1]++; } for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
    const fill = deg.slice(0, n), adj = new Uint32Array(2 * mm); for (let i = 0; i < mm; i++) { adj[fill[from[i]]++] = i * 2; adj[fill[to[i]]++] = i * 2 + 1; }
    // spatial grid for snapping points to the network
    const GX0 = 11, GY0 = -35.6, CS = 0.02, GW = Math.ceil((34 - GX0) / CS), GH = Math.ceil((-22 - GY0) / CS), cs = new Uint32Array(GW * GH + 1);
    const cellOf = i => { const cx = Math.floor((lon[i] / 1e5 - GX0) / CS), cy = Math.floor((lat[i] / 1e5 - GY0) / CS); return cx < 0 || cy < 0 || cx >= GW || cy >= GH ? -1 : cy * GW + cx; };
    for (let i = 0; i < n; i++) { const c = cellOf(i); if (c >= 0) cs[c + 1]++; } for (let i = 0; i < GW * GH; i++) cs[i + 1] += cs[i];
    const cf = cs.slice(0, GW * GH), cn = new Uint32Array(cs[GW * GH]); for (let i = 0; i < n; i++) { const c = cellOf(i); if (c >= 0) cn[cf[c]++] = i; }
    G = { n, m: mm, lon, lat, from, to, len, cls, fl, soff, sn, shape, adjStart: deg, adj, grid: { GX0, GY0, CS, GW, GH, cs, cn }, ver: 0 };
    return G;
  })();
  try { return await loading; } finally { loading = null; }
}
function snap(lon, lat, okNode) {
  const g = G.grid; const cx = Math.floor((lon - g.GX0) / g.CS), cy = Math.floor((lat - g.GY0) / g.CS); let best = -1, bd = 1e12;
  for (let r = 0; r <= 12; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= g.GW || y >= g.GH) continue; const c = y * g.GW + x; for (let q = g.cs[c]; q < g.cs[c + 1]; q++) { const i = g.cn[q]; if (okNode && !okNode(i)) continue; const d = dist(lon, lat, G.lon[i] / 1e5, G.lat[i] / 1e5); if (d < bd) { bd = d; best = i; } } }
    if (best >= 0 && r >= 1) break;
  }
  return best >= 0 ? { node: best, m: bd } : null;
}
const dist = (lo1, la1, lo2, la2) => { const dx = (lo2 - lo1) * 111320 * Math.cos((la1 + la2) / 2 * Math.PI / 180), dy = (la2 - la1) * 111320; return Math.hypot(dx, dy); };

/* ---------- costs: how long each stretch takes you, by mode and surface ---------- */
const CLS_F = [0, 1, .9, .8, .65, .45, .3, .35, 0];
function speeds(P) { return { walk: P.walk, cycle: P.cycle, vehicle: P.car, gf: P.gravelFactor }; }
// returns { sec, pen, surf } for one edge in one direction; sec = honest time, pen = cost used for choosing (time with penalties)
function edgeTime(e, dir, mode, P, opt) {
  const len = G.len[e] / 10, c = G.cls[e], f = G.fl[e], surf = (f >> 3) & 7, priv = f & 4;
  if (mode === 'vehicle') { if (c === 8) return null; if (dir === 0 && (f & 2)) return null; if (dir === 1 && (f & 1)) return null; }
  let v, sf = 1;
  if (mode === 'vehicle') { v = P.car * CLS_F[c]; } else if (mode === 'cycle') v = P.cycle; else v = P.walk;
  if (mode !== 'walk' || true) {
    const gf = P.gravelFactor, g2 = mode === 'vehicle' ? gf : mode === 'cycle' ? Math.sqrt(gf) : Math.sqrt(Math.sqrt(gf));
    if (surf === 2) sf = g2; else if (surf === 3) sf = g2 * .7; else if (surf === 4) sf = g2 * (mode === 'vehicle' ? .5 : .6);
    else if (surf === 0) sf = c >= 7 ? g2 : (c === 5 || c === 6) ? (1 + g2) / 2 : 1;
  }
  if (c === 7 && mode === 'vehicle') sf = Math.min(sf, 1);
  const sec = len / ((v * sf) / 3.6); let pen = sec;
  if (c === 1 && mode !== 'vehicle') pen *= 2; if (priv) pen *= 4; if (opt.sealed && sf < 1) pen *= 3;
  return { sec, pen, surf: surf || (c >= 7 ? 5 : (c === 5 || c === 6) ? 6 : 7) };
}
// surface classes for the summary: 1 sealed, 2 gravel, 3 dirt, 4 sand, 5 track (surface not recorded), 6 minor road (surface not recorded)

/* ---------- search (A*) ---------- */
class Heap { constructor() { this.k = new Float64Array(1 << 16); this.v = new Uint32Array(1 << 16); this.n = 0; } push(key, val) { if (this.n === this.k.length) { const k = new Float64Array(this.n * 2), v = new Uint32Array(this.n * 2); k.set(this.k); v.set(this.v); this.k = k; this.v = v; } let i = this.n++; while (i > 0) { const p = (i - 1) >> 1; if (this.k[p] <= key) break; this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p; } this.k[i] = key; this.v[i] = val; } pop() { const rv = this.v[0], k = this.k[--this.n], v = this.v[this.n]; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= this.n) break; if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++; if (this.k[c] >= k) break; this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c; } this.k[i] = k; this.v[i] = v; return rv; } }
let WORK = null;
function work() { if (!WORK || WORK.g.length !== G.n) WORK = { g: new Float32Array(G.n), prev: new Int32Array(G.n), stamp: new Uint32Array(G.n), cur: 0 }; return WORK; }
async function astar(a, b, mode, P, opt, danger, status) {
  const W = work(); W.cur++; const cur = W.cur, tLon = G.lon[b] / 1e5, tLat = G.lat[b] / 1e5, vmax = (mode === 'vehicle' ? P.car : mode === 'cycle' ? P.cycle : P.walk) / 3.6;
  const h = i => dist(G.lon[i] / 1e5, G.lat[i] / 1e5, tLon, tLat) / vmax, heap = new Heap(); W.g[a] = 0; W.stamp[a] = cur; W.prev[a] = -1; heap.push(h(a), a); let pops = 0; const closed = new Uint8Array(0);
  while (heap.n) {
    const u = heap.pop(); if (u === b) return path(W, a, b); const gu = W.g[u];
    if (++pops % 200000 === 0) { if (status) status(`Searching… ${(pops / 1e6).toFixed(1)} million junctions checked`); await new Promise(r => setTimeout(r, 0)); if (pops > 25e6) throw new Error('The search took too long. Try a nearer destination or add a stop in between.'); }
    for (let q = G.adjStart[u]; q < G.adjStart[u + 1]; q++) {
      const ed = G.adj[q], e = ed >> 1, dir = ed & 1, v = dir === 0 ? G.to[e] : G.from[e]; const t = edgeTime(e, dir, mode, P, opt); if (!t) continue;
      let cost = t.pen; if (danger && (danger[u] || danger[v])) cost *= 6;
      const ng = gu + cost; if (W.stamp[v] !== cur || ng < W.g[v]) { W.stamp[v] = cur; W.g[v] = ng; W.prev[v] = ed; heap.push(ng + h(v), v); }
    }
  }
  return null;
}
function path(W, a, b) { const eds = []; let u = b; while (u !== a) { const ed = W.prev[u]; eds.push(ed); const e = ed >> 1; u = (ed & 1) === 0 ? G.from[e] : G.to[e]; } return eds.reverse(); }

/* ---------- turning a path into a route ---------- */
function edgePoints(ed, B) {
  const e = ed >> 1, dir = ed & 1, a = G.from[e], b = G.to[e], pts = [[G.lon[a] / 1e5, G.lat[a] / 1e5]]; let x = G.lon[a], y = G.lat[a], o = G.soff[e];
  for (let i = 0; i < G.sn[e]; i++) { x += G.shape[o + 2 * i]; y += G.shape[o + 2 * i + 1]; pts.push([x / 1e5, y / 1e5]); } pts.push([G.lon[b] / 1e5, G.lat[b] / 1e5]); if (dir === 1) pts.reverse(); return pts;
}
function sun(date, lat, lon) {
  const rad = Math.PI / 180, n = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 864e5), g = (2 * Math.PI / 365) * (n - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g)), dc = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const c = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(dc)) - Math.tan(lat * rad) * Math.tan(dc); if (c > 1 || c < -1) return null; const ha = Math.acos(c) / rad, base = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return [new Date(base + (720 - 4 * (lon + ha) - eq) * 60000), new Date(base + (720 - 4 * (lon - ha) - eq) * 60000)];
}
const clock = d => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
function nearestTown(M, lon, lat) { let best = null, bd = 1e9; for (const t of M.base.towns) { const d = B().hav(lon, lat, t.lon, t.lat); if (d < bd) { bd = d; best = t; } } return best ? `${best.n}${bd > 3 ? ' (' + Math.round(bd) + ' km away)' : ''}` : ''; }

async function plan(status) {
  const M = B().M, P = B().P, S = STATE; if (S.stops.length < 2) throw new Error('Add at least two stops: where you start and where you want to get to.');
  await loadGraph(status); const mode = S.mode, opt = { sealed: S.sealed };
  let danger = null;
  if (S.avoid) { const bad = (await A().kvGet('pins', [])).filter(p => p.status === 'unsafe' || p.types.includes('danger')); if (bad.length) { danger = new Uint8Array(G.n); const R = S.avoidKm * 1000, gr = G.grid; for (const p of bad) { const cx = Math.floor((p.lon - gr.GX0) / gr.CS), cy = Math.floor((p.lat - gr.GY0) / gr.CS), r = Math.ceil(S.avoidKm / 2) + 1; for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= gr.GW || y >= gr.GH) continue; const c = y * gr.GW + x; for (let q = gr.cs[c]; q < gr.cs[c + 1]; q++) { const i = gr.cn[q]; if (dist(p.lon, p.lat, G.lon[i] / 1e5, G.lat[i] / 1e5) < R) danger[i] = 1; } } } } }
  const okNode = i => { for (let q = G.adjStart[i]; q < G.adjStart[i + 1]; q++) { const ed = G.adj[q], e = ed >> 1; if (mode !== 'vehicle' || G.cls[e] !== 8) return true; } return false; };
  const sn = S.stops.map(s => snap(s.lon, s.lat, okNode)); if (sn.some(x => !x)) throw new Error('One of your stops is too far from any road or track in the loaded data.');
  let edges = [];
  for (let i = 1; i < sn.length; i++) { if (status) status(`Finding the way for leg ${i} of ${sn.length - 1}…`); const p = await astar(sn[i - 1].node, sn[i].node, mode, P, opt, danger, status); if (!p) throw new Error(`No way through for leg ${i}. The roads may not connect in the loaded data (a river, a border or a missing link).`); edges = edges.concat(p); }
  // totals, surfaces, line
  const line = [], surf = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }, cum = [], pts = []; let dist_m = 0, sec = 0, priv = 0, onMain = 0;
  for (const ed of edges) {
    const e = ed >> 1, t = edgeTime(e, ed & 1, mode, P, opt), len = G.len[e] / 10; dist_m += len; sec += t ? t.sec : len / (P.walk / 3.6); if (t) surf[t.surf] = (surf[t.surf] || 0) + len; if (G.fl[e] & 4) priv += len; if (G.cls[e] <= 2) onMain += len;
    const ep = edgePoints(ed); for (const q of ep) { if (!pts.length || pts[pts.length - 1][0] !== q[0] || pts[pts.length - 1][1] !== q[1]) pts.push(q); } cum.push([dist_m, sec, pts.length - 1]);
  }
  const bh = B(); const fl = new Float32Array(pts.length * 2); pts.forEach((q, i) => { fl[2 * i] = bh.mx(q[0]); fl[2 * i + 1] = bh.my(q[1]); });
  // climb from the coarse height data, sampled about every 500 m
  let up = 0, dn = 0, prev = null, acc = 0; for (let i = 1; i < pts.length; i++) { acc += dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); if (acc >= 500 || i === pts.length - 1) { acc = 0; const el = bh.elevAt(pts[i][0], pts[i][1]); if (el != null) { if (prev != null) { const d = el - prev; d > 0 ? up += d : dn -= d; } prev = el; } } }
  if (mode === 'walk') sec += up / P.climbH * 3600;
  const res = { mode, dist: dist_m, sec, surf, up, dn, priv, onMain, pts, cum, line: fl, stops: S.stops.map(s => [s.lon, s.lat]), snapM: sn.map(x => x.m), danger: !!danger };
  return res;
}
function daysOf(res, P) {
  const S = STATE, per = (S.hours[res.mode] || 8) * 3600, out = []; let start = S.start ? new Date(S.start) : new Date(); if (isNaN(+start)) start = new Date();
  let dayStartIdx = 0, day = 0, t0 = 0, d0 = 0, cursor = 0;
  const at = sec => { // position after 'sec' seconds of moving
    let lo = 0, hi = res.cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (res.cum[m][1] < sec) lo = m + 1; else hi = m; } const c = res.cum[lo]; return { i: c[2], d: c[0], s: c[1] };
  };
  const total = res.sec, n = Math.max(1, Math.ceil(total / per)); let lastD = 0, lastS = 0;
  for (let k = 1; k <= n; k++) {
    const end = k === n ? { i: res.pts.length - 1, d: res.dist, s: total } : at(per * k), p = res.pts[end.i], date = new Date(start.getTime() + (k - 1) * 864e5), sn = sun(date, p[1], p[0]);
    const ds = new Date(date.getTime()); let startClock = k === 1 ? start : (sn ? sn[0] : new Date(date.setHours(6, 30))); const endClock = new Date(startClock.getTime() + (end.s - lastS) * 1000);
    out.push({ k, km: (end.d - lastD) / 1000, h: (end.s - lastS) / 3600, where: nearestTown(B().M, p[0], p[1]), lon: p[0], lat: p[1], rise: sn && sn[0], set: sn && sn[1], startClock, endClock, dark: sn ? endClock > sn[1] || startClock < sn[0] : false });
    lastD = end.d; lastS = end.s;
  }
  return out;
}

/* ---------- screens ---------- */
const MODES = [['vehicle', 'Vehicle'], ['walk', 'Walking'], ['cycle', 'Cycling']];
const SURFN = { 7: 'Main road (surface not recorded, probably sealed)', 1: 'Sealed road (recorded)', 2: 'Gravel', 3: 'Dirt or earth', 4: 'Sand', 5: 'Track (surface not recorded)', 6: 'Minor road (surface not recorded)' };
const toLocalInput = d => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
function stopsHtml() { return STATE.stops.map((s, i) => `<div class="row"><b style="width:1.4em">${String.fromCharCode(65 + i)}</b><span class="grow">${esc(s.title || B().M && '')}${s.title ? '<br>' : ''}<span class="dim">${B().M ? fmtCoord(s) : ''}</span></span><button data-up="${i}" title="Move up">↑</button><button data-rm="${i}" class="dng">✕</button></div>`).join('') || '<p class="dim">No stops yet. Add where you start and where you want to go.</p>'; }
const fmtCoord = s => B().fmtCoord ? B().fmtCoord(s.lat, s.lon) : s.lat.toFixed(5) + ', ' + s.lon.toFixed(5);
function openPlanner() {
  const b = B(), P = b.P, S = STATE; if (!S.start) S.start = toLocalInput(new Date());
  const root = b.openSheet(`<div class="row"><b style="flex:1">Route planner</b><button id="rtMini">Hide, show map</button><button id="shX">Close</button></div>
  <div id="rtStops">${stopsHtml()}</div>
  <div class="row"><button id="rtMe">Add: my location</button><button id="rtCtr">Add: map centre</button><button id="rtPick">Add: tap the map</button></div>
  <label>How are you travelling?</label><div class="row">${MODES.map(([k, n]) => `<label class="chip"><input type="radio" name="rtm" value="${k}"${S.mode === k ? ' checked' : ''}><span>${n}</span></label>`).join('')}</div>
  <p class="dim" id="rtSp"></p>
  <label class="lay"><input type="checkbox" id="rtSealed"${S.sealed ? ' checked' : ''}><span><b>Prefer sealed roads</b><small>Gravel and tracks cost three times as much, so they are used only when needed.</small></span></label>
  <label class="lay"><input type="checkbox" id="rtAvoid"${S.avoid ? ' checked' : ''}><span><b>Keep away from my danger pins</b><small>Stretches within <span id="rtAvKm">${S.avoidKm}</span> km of an unsafe pin cost six times as much.</small></span></label>
  <input type="range" id="rtAvR" min="0.5" max="10" step="0.5" value="${S.avoidKm}">
  <div class="row"><div class="grow"><label>Leaving at</label><input type="datetime-local" id="rtStart" value="${esc(S.start)}"></div><div class="grow"><label>Hours moving per day</label><input type="number" id="rtHrs" min="1" max="16" step="0.5" value="${S.hours[S.mode]}"></div></div>
  <div class="row"><button class="pri" id="rtGo">Plan route</button><button id="rtClear">Clear route</button></div><div class="bar" id="rtBar" hidden><i></i></div><p class="dim" id="rtMsg"></p><div id="rtOut"></div>`, 'tall');
  const sp = () => { $('#rtSp').textContent = S.mode === 'vehicle' ? `Your vehicle cruises at ${P.car} km/h on main roads; gravel at ${Math.round(P.gravelFactor * 100)}% of that. Change this in Settings.` : S.mode === 'walk' ? `You walk ${P.walk} km/h on the flat, plus one hour for every ${P.climbH} m of climb. Change this in Settings.` : `You cycle ${P.cycle} km/h on the flat; gravel is slower. Change this in Settings.`; }; sp();
  if (S.result) showResult(S.result);
  root.onchange = e => { const t = e.target; if (t.name === 'rtm') { S.mode = t.value; $('#rtHrs').value = S.hours[S.mode]; sp(); } if (t.id === 'rtSealed') S.sealed = t.checked; if (t.id === 'rtAvoid') S.avoid = t.checked; if (t.id === 'rtStart') S.start = t.value; if (t.id === 'rtHrs') S.hours[S.mode] = Math.max(1, +t.value || 8); };
  root.oninput = e => { if (e.target.id === 'rtAvR') { S.avoidKm = +e.target.value; $('#rtAvKm').textContent = S.avoidKm; } };
  root.onclick = e => {
    if (root.classList.contains('mini')) { root.classList.remove('mini'); return; }
    const t = e.target, bh = B(), M = bh.M, refresh = () => { $('#rtStops').innerHTML = stopsHtml(); };
    if (t.id === 'shX') return bh.closeSheet();
    if (t.id === 'rtMini') { root.classList.add('mini'); return; }
    if (t.id === 'rtMe') { if (!M.me) return bh.toast('No GPS fix yet. Press the ◎ button on the map first.'); S.stops.push({ lon: M.me.lon, lat: M.me.lat, title: 'My location' }); refresh(); }
    if (t.id === 'rtCtr') { const v = bh.V(); S.stops.push({ lon: bh.unx((M.CW / 2 - v.tx) / v.k), lat: bh.uny((M.CH / 2 - v.ty) / v.k), title: 'Map centre' }); refresh(); }
    if (t.id === 'rtPick') { M.pick = o => { S.stops.push({ lon: o.lon, lat: o.lat, title: o.title || '' }); openPlanner(); }; bh.closeSheet(); bh.toast('Tap the map to place the stop.'); }
    if (t.dataset.rm != null) { S.stops.splice(+t.dataset.rm, 1); refresh(); }
    if (t.dataset.up != null && +t.dataset.up > 0) { const i = +t.dataset.up; [S.stops[i - 1], S.stops[i]] = [S.stops[i], S.stops[i - 1]]; refresh(); }
    if (t.id === 'rtClear') { M.route = null; S.result = null; $('#rtOut').innerHTML = ''; bh.draw(); }
    if (t.id === 'rtGo') run();
    if (t.id === 'rtGpx') gpx(); if (t.id === 'rtFit') fitRoute(); if (t.id === 'rtMini2') { fitRoute(); root.classList.add('mini'); }
    if (t.dataset.day != null) { const d = S.result.days[+t.dataset.day]; bh.closeSheet(); bh.flyTo(d.lon, d.lat, 12); }
  };
}
async function run() {
  const bar = $('#rtBar'), msg = $('#rtMsg'), go = $('#rtGo'); bar.hidden = false; go.disabled = true; msg.textContent = 'Starting…';
  try {
    const res = await plan(t => msg.textContent = t); res.days = daysOf(res, B().P); STATE.result = res; B().M.route = { line: res.line, stops: res.stops }; msg.textContent = ''; showResult(res); fitRoute(); A().kvSet('route.opts', { stops: STATE.stops, mode: STATE.mode, sealed: STATE.sealed, avoid: STATE.avoid, avoidKm: STATE.avoidKm, hours: STATE.hours });
  } catch (e) { msg.textContent = e.message; B().M.route = null; B().draw(); } finally { bar.hidden = true; go.disabled = false; }
}
function fitRoute() {
  const r = STATE.result; if (!r) return; const b = B(); let a = 1e9, c = 1e9, d = -1e9, e = -1e9; r.pts.forEach(q => { a = Math.min(a, q[0]); d = Math.max(d, q[0]); c = Math.min(c, q[1]); e = Math.max(e, q[1]); });
  const M = b.M, w = Math.abs(b.mx(d) - b.mx(a)) || 1, h = Math.abs(b.my(c) - b.my(e)) || 1, k = Math.min(M.CW / w, (M.CH * .36) / h) * .85; b.flyTo((a + d) / 2, (c + e) / 2, Math.min(k, 60)); const v = b.V(); v.ty -= M.CH * .22; b.draw();
}
function showResult(r) {
  const b = B(), P = b.P, out = $('#rtOut'); if (!out) return; const modeN = { vehicle: 'driving', walk: 'walking', cycle: 'cycling' }[r.mode];
  const sealed = r.surf[1] + r.surf[7], unp = r.surf[2] + r.surf[3] + r.surf[4], unk = r.surf[5] + r.surf[6], pc = x => Math.round(100 * x / (r.dist || 1));
  const warn = []; if (r.priv > 0) warn.push(`${b.fmtKm(r.priv / 1000)} of the route is marked private or no-access. It may be gated or fenced.`); if (pc(unk) >= 2) warn.push(`${pc(unk)}% of the route is a track or minor road where the surface is not recorded. It may be rough, sandy or washed out.`); if (r.snapM.some(m => m > 1500)) warn.push('A stop is more than 1.5 km from the nearest road or track, so the route starts or ends at that road.'); if (r.mode === 'walk' && r.onMain > 1000) warn.push(`${b.fmtKm(r.onMain / 1000)} follows main roads, which are dangerous to walk.`); if (r.mode === 'vehicle' && r.surf[5] > 0) warn.push('Some stretches are tracks. Check the vehicle can take them.');
  out.innerHTML = `<h3>${b.fmtKm(r.dist / 1000)}, ${b.fmtH(r.sec / 3600)} ${modeN}</h3>
  <p>Climb +${b.fmtM(r.up)} / descent −${b.fmtM(r.dn)} <span class="dim">(coarse terrain, roughly)</span></p>
  <p class="dim">Time uses your own speeds, with slower speeds on gravel, dirt and sand. It does not allow for traffic, rest stops, weather or breakdowns.</p>
  <div class="tw"><table><tr><th>Surface</th><th>Distance</th><th>Share</th></tr>${[1, 7, 2, 3, 4, 5, 6].filter(k => r.surf[k] > 0).map(k => `<tr><td>${SURFN[k]}</td><td>${b.fmtKm(r.surf[k] / 1000)}</td><td>${pc(r.surf[k])}%</td></tr>`).join('')}</table></div>
  ${warn.map(w => `<div class="warn">${esc(w)}</div>`).join('')}${r.danger ? '<p class="dim">Stretches near your danger pins were avoided where there was another way.</p>' : ''}
  <h3>Day by day</h3><div class="tw"><table><tr><th>Day</th><th>Distance</th><th>Moving</th><th>Ends near</th><th>Daylight</th></tr>${r.days.map((d, i) => `<tr><td>${d.k}</td><td>${b.fmtKm(d.km)}</td><td>${b.fmtH(d.h)}</td><td><a href="javascript:void 0" data-day="${i}">${esc(d.where)}</a></td><td>${d.rise ? clock(d.rise) + '–' + clock(d.set) : 'n/a'}<br>${clock(d.startClock)}–${clock(d.endClock)}${d.dark ? ' <b class="bad">after dark</b>' : ''}</td></tr>`).join('')}</table></div>
  <p class="dim">The route is drawn on the map in green. Daylight is worked out from the date and place.</p>
  <div class="row"><button id="rtFit">Show on map</button><button id="rtMini2">Hide this panel</button><button id="rtGpx">Save as GPX file</button></div>`;
}
function gpx() {
  const r = STATE.result; if (!r) return; const x = ['<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Blackout Handbook" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Blackout Handbook route</name><trkseg>'];
  r.pts.forEach(q => x.push(`<trkpt lat="${q[1].toFixed(5)}" lon="${q[0].toFixed(5)}"/>`)); x.push('</trkseg></trk></gpx>');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([x.join('')], { type: 'application/gpx+xml' })); a.download = 'route-' + new Date().toISOString().slice(0, 10) + '.gpx'; a.click();
}
window.BHRoute = {
  async open() { const o = await A().kvGet('route.opts', null); if (o && !STATE.stops.length) Object.assign(STATE, { stops: o.stops || [], mode: o.mode || 'vehicle', sealed: !!o.sealed, avoid: o.avoid !== false, avoidKm: o.avoidKm || 2, hours: o.hours || STATE.hours }); openPlanner(); },
  async to(M, o) { const me = M.me; if (!STATE.stops.length && me) STATE.stops.push({ lon: me.lon, lat: me.lat, title: 'My location' }); STATE.stops.push({ lon: o.lon, lat: o.lat, title: o.title || '' }); STATE.result = null; openPlanner(); }
};
})();
