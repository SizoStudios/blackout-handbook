// Routing graph builder: OpenStreetMap -> road network with junctions (nodes), edges with length, class, surface, one-way, access, shape.
// Usage: node --max-old-space-size=4096 makegraph.mjs <outDir> [region ids, e.g. ls sz]
// Output pack: Routing.bhmap (entries g/<region>/h, g/<region>/0.., g/links)
import fs from 'node:fs';
import { dataBlocks, parseBlock, CLASS, dp } from './osm.mjs';
const OSM = 'C:/Users/sizo1/Documents/blackout-tools/mapdata/osm/';
const REGIONS = [
  ['ls', 'lesotho-latest.osm.pbf', [27, -30.75, 29.5, -28.5]], ['sz', 'swaziland-latest.osm.pbf', [30.7, -27.4, 32.2, -25.7]], ['mz', 'mozambique-latest.osm.pbf', [30.8, -27, 34, -22.3]],
  ['bw', 'botswana-latest.osm.pbf', [19.9, -26.95, 29.5, -22]], ['na', 'namibia-latest.osm.pbf', [11.5, -29.3, 20.1, -22]], ['za', 'south-africa-latest.osm.pbf', [16, -35.2, 33.1, -22.0]]
];
const out = process.argv[2] || 'packs', only = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });
const SURF = { asphalt: 1, paved: 1, concrete: 1, 'concrete:plates': 1, 'concrete:lanes': 1, paving_stones: 1, sett: 1, cobblestone: 1, metal: 1, unpaved: 2, gravel: 2, fine_gravel: 2, compacted: 2, pebblestone: 2, dirt: 3, earth: 3, ground: 3, mud: 3, grass: 3, sand: 4, rock: 3 };

class Grow { constructor(T) { this.T = T; this.a = new T(1 << 16); this.n = 0; } push(v) { if (this.n === this.a.length) { const b = new this.T(this.a.length * 2); b.set(this.a); this.a = b; } this.a[this.n++] = v; } out() { return this.a.subarray(0, this.n); } }
const mPerDegLat = 111320, hav = (lo1, la1, lo2, la2) => { const dx = (lo2 - lo1) * 111320 * Math.cos((la1 + la2) / 2 * Math.PI / 180), dy = (la2 - la1) * mPerDegLat; return Math.hypot(dx, dy); };

function build(id, file, box) {
  const t0 = Date.now(), [W, S, E, N] = box; const classes = [1, 2, 3, 4, 5, 6, 7, 8];
  // pass 1: the ways
  const wRefs = [], wCls = [], wFlag = [];
  let total = 0;
  for (const blk of dataBlocks(OSM + file)) parseBlock(blk, null, (wid, refs, hw, name, tags) => {
    const c = CLASS[hw]; if (!c) return; let fl = 0;
    if (tags) { const ow = tags.oneway; if (ow === 'yes' || ow === '1' || ow === 'true' || tags.junction === 'roundabout') fl |= 1; else if (ow === '-1') fl |= 2; if (tags.access === 'private' || tags.access === 'no' || tags.access === 'customers') fl |= 4; let s = SURF[tags.surface] || 0; if (!s && tags.tracktype) s = tags.tracktype === 'grade1' ? 1 : tags.tracktype === 'grade2' ? 2 : tags.tracktype ? 3 : 0; fl |= s << 3; }
    wRefs.push(refs.slice()); wCls.push(c); wFlag.push(fl); total += refs.length;
  }, ['surface', 'tracktype', 'oneway', 'access', 'junction']);
  const all = new Float64Array(total); let o = 0; for (const r of wRefs) { all.set(r, o); o += r.length; } all.sort();
  let U = 0; const cntTmp = new Uint8Array(total);
  for (let i = 0; i < all.length; i++) { if (i === 0 || all[i] !== all[i - 1]) { all[U] = all[i]; cntTmp[U] = 1; U++; } else if (cntTmp[U - 1] < 255) cntTmp[U - 1]++; }
  const uniq = all.subarray(0, U), cnt = cntTmp.subarray(0, U), lonU = new Int32Array(U), latU = new Int32Array(U), have = new Uint8Array(U);
  // pass 2: coordinates (blocks arrive in id order, so one moving pointer is enough)
  let j = 0;
  for (const blk of dataBlocks(OSM + file)) parseBlock(blk, (ids, lons, lats, n) => { for (let i = 0; i < n; i++) { const nid = ids[i]; while (j < U && uniq[j] < nid) j++; if (j < U && uniq[j] === nid) { lonU[j] = Math.round(lons[i] * 1e5); latU[j] = Math.round(lats[i] * 1e5); have[j] = 1; } } }, null);
  const bs = id => { let lo = 0, hi = U - 1; while (lo <= hi) { const m = (lo + hi) >> 1, v = uniq[m]; if (v === id) return m; if (v < id) lo = m + 1; else hi = m - 1; } return -1; };
  const gidx = new Int32Array(U).fill(-1), nLon = new Grow(Int32Array), nLat = new Grow(Int32Array);
  const eFrom = new Grow(Uint32Array), eTo = new Grow(Uint32Array), eLen = new Grow(Uint32Array), eCls = new Grow(Uint8Array), eFl = new Grow(Uint8Array), eSOff = new Grow(Uint32Array), eSN = new Grow(Uint16Array), shape = new Grow(Int16Array);
  const node = b => { if (gidx[b] < 0) { gidx[b] = nLon.n; nLon.push(lonU[b]); nLat.push(latU[b]); } return gidx[b]; };
  const inBox = b => { const lo = lonU[b] / 1e5, la = latU[b] / 1e5; return lo >= W && lo <= E && la >= S && la <= N; };
  let edges = 0;
  for (let w = 0; w < wRefs.length; w++) {
    const refs = wRefs[w], c = wCls[w], fl = wFlag[w]; let a = -1, len = 0, mid = [], prev = -1;
    for (let i = 0; i < refs.length; i++) {
      const b = bs(refs[i]); if (b < 0 || !have[b] || !inBox(b)) { a = -1; prev = -1; mid = []; len = 0; continue; }
      if (a < 0) { a = b; prev = b; len = 0; mid = []; continue; }
      len += hav(lonU[prev] / 1e5, latU[prev] / 1e5, lonU[b] / 1e5, latU[b] / 1e5); prev = b;
      if (cnt[b] >= 2 || i === refs.length - 1) {
        if (a !== b || len > 20) {
          const A = node(a), B = node(b); let pts = [[lonU[a] / 1e5, latU[a] / 1e5], ...mid.map(m => [lonU[m] / 1e5, latU[m] / 1e5]), [lonU[b] / 1e5, latU[b] / 1e5]];
          if (pts.length > 2) pts = dp(pts, 0.00008); const off = shape.n; let px = Math.round(pts[0][0] * 1e5), py = Math.round(pts[0][1] * 1e5), ns = 0;
          for (let q = 1; q < pts.length - 1; q++) { const x = Math.round(pts[q][0] * 1e5), y = Math.round(pts[q][1] * 1e5), dx = x - px, dy = y - py; if (Math.abs(dx) > 32000 || Math.abs(dy) > 32000) break; shape.push(dx); shape.push(dy); px = x; py = y; ns++; }
          eFrom.push(A); eTo.push(B); eLen.push(Math.min(4294967295, Math.round(len * 10))); eCls.push(c); eFl.push(fl); eSOff.push(off); eSN.push(ns); edges++;
        }
        a = b; len = 0; mid = [];
      } else mid.push(b);
    }
  }
  console.log(id, 'ways', wRefs.length, 'uniqueNodes', U, 'graph nodes', nLon.n, 'edges', edges, Math.round((Date.now() - t0) / 1000) + 's');
  return { id, n: nLon.n, m: edges, lon: nLon.out(), lat: nLat.out(), from: eFrom.out(), to: eTo.out(), len: eLen.out(), cls: eCls.out(), fl: eFl.out(), soff: eSOff.out(), sn: eSN.out(), shape: shape.out(), box };
}
const pad4 = n => (4 - (n % 4)) % 4;
function serialize(g) {
  const parts = [['lon', g.lon], ['lat', g.lat], ['from', g.from], ['to', g.to], ['len', g.len], ['cls', g.cls], ['fl', g.fl], ['soff', g.soff], ['sn', g.sn], ['shape', g.shape]];
  const bufs = [], layout = []; let o = 0;
  for (const [k, a] of parts) { const b = Buffer.from(a.buffer, a.byteOffset, a.byteLength); layout.push({ k, t: a.constructor.name, o, n: a.length }); bufs.push(b); o += b.length; const p = pad4(b.length); if (p) { bufs.push(Buffer.alloc(p)); o += p; } }
  return { header: { id: g.id, n: g.n, m: g.m, box: g.box, layout, bytes: o }, data: Buffer.concat(bufs) };
}
// cross-region links: nodes of different regions that sit within 60 m of each other (border crossings)
function links(gs) {
  const out = [];
  for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) {
    const a = gs[i], b = gs[j], pad = 0.05, w = Math.max(a.box[0], b.box[0]) - pad, s = Math.max(a.box[1], b.box[1]) - pad, e = Math.min(a.box[2], b.box[2]) + pad, n = Math.min(a.box[3], b.box[3]) + pad; if (w >= e || s >= n) continue;
    const grid = new Map(), key = (lo, la) => Math.round(lo * 1000) + ',' + Math.round(la * 1000);
    for (let q = 0; q < a.n; q++) { const lo = a.lon[q] / 1e5, la = a.lat[q] / 1e5; if (lo < w || lo > e || la < s || la > n) continue; const k = key(lo, la); (grid.get(k) || grid.set(k, []).get(k)).push(q); }
    let c = 0;
    for (let q = 0; q < b.n; q++) {
      const lo = b.lon[q] / 1e5, la = b.lat[q] / 1e5; if (lo < w || lo > e || la < s || la > n) continue; const cx = Math.round(lo * 1000), cy = Math.round(la * 1000); let best = -1, bd = 60;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const l = grid.get((cx + dx) + ',' + (cy + dy)); if (!l) continue; for (const p of l) { const d = hav(lo, la, a.lon[p] / 1e5, a.lat[p] / 1e5); if (d < bd) { bd = d; best = p; } } }
      if (best >= 0) { out.push([a.id, best, b.id, q]); c++; }
    }
    console.log('links', a.id, b.id, c);
  }
  return out;
}
const todo = REGIONS.filter(r => !only.length || only.includes(r[0])), gs = [], entries = [], CH = 8 * 1048576;
for (const [id, file, box] of todo) {
  const g = build(id, file, box); gs.push(g); const { header, data } = serialize(g);
  entries.push([`g/${id}/h`, Buffer.from(JSON.stringify(header))]); for (let i = 0, k = 0; i < data.length; i += CH, k++) entries.push([`g/${id}/${k}`, data.subarray(i, i + CH)]);
  console.log(id, 'graph MB', (data.length / 1048576).toFixed(1));
}
entries.push(['g/links', Buffer.from(JSON.stringify(links(gs)))]);
// container
let o = 0; const list = entries.map(([k, b]) => { const e = { k, o, l: b.length }; o += b.length; return e; });
const hd = Buffer.from(JSON.stringify({ pack: 'routing', region: 'all', name: 'Road network for route planning', version: 1, created: new Date().toISOString(), licence: 'Map data (c) OpenStreetMap contributors, ODbL 1.0 (openstreetmap.org/copyright).', entries: list }));
const pre = Buffer.alloc(11); pre.write('BHMAP1\n', 0, 'latin1'); pre.writeUInt32LE(hd.length, 7);
const file = out + '/Routing' + (only.length ? '-' + only.join('-') : '') + '.bhmap', fd = fs.openSync(file, 'w'); fs.writeSync(fd, pre); fs.writeSync(fd, hd); for (const [, b] of entries) fs.writeSync(fd, b); fs.closeSync(fd);
console.log('wrote', file, (fs.statSync(file).size / 1048576).toFixed(1), 'MB');
