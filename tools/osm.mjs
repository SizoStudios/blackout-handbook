// Streaming OpenStreetMap PBF reader + road extractor (no dependencies, low memory).
// Usage: node osm.mjs <file.osm.pbf> <name> <lonW> <latS> <lonE> <latN> [cap]
// Writes <name>.streets.bin: roads inside the box, simplified, delta-encoded.
import fs from 'node:fs';
import zlib from 'node:zlib';

class R {
  constructor(b, p, e) { this.b = b; this.p = p; this.e = e; }
  eof() { return this.p >= this.e; }
  varint() { let r = 0, m = 1, x; do { x = this.b[this.p++]; r += (x & 127) * m; m *= 128; } while (x & 128); return r; }
  skip(w) { if (w === 0) this.varint(); else if (w === 2) { const l = this.varint(); this.p += l; } else if (w === 1) this.p += 8; else if (w === 5) this.p += 4; else throw new Error('bad wire type ' + w); }
}
const zig = v => (v % 2 === 1 ? -(v + 1) / 2 : v / 2);

function* dataBlocks(path) {
  const fd = fs.openSync(path, 'r'), size = fs.fstatSync(fd).size, lenBuf = Buffer.alloc(4); let pos = 0;
  try {
    while (pos < size) {
      fs.readSync(fd, lenBuf, 0, 4, pos); pos += 4; const hl = lenBuf.readUInt32BE(0);
      const hb = Buffer.alloc(hl); fs.readSync(fd, hb, 0, hl, pos); pos += hl;
      let type = '', dsz = 0; const hr = new R(hb, 0, hl);
      while (!hr.eof()) { const t = hr.varint(), f = t >>> 3, w = t & 7; if (w === 2) { const l = hr.varint(); if (f === 1) type = hb.toString('utf8', hr.p, hr.p + l); hr.p += l; } else if (w === 0) { const v = hr.varint(); if (f === 3) dsz = v; } else hr.skip(w); }
      const blob = Buffer.alloc(dsz); fs.readSync(fd, blob, 0, dsz, pos); pos += dsz;
      if (type !== 'OSMData') continue;
      const br = new R(blob, 0, dsz); let raw = null, z = null;
      while (!br.eof()) { const t = br.varint(), f = t >>> 3, w = t & 7; if (w === 2) { const l = br.varint(), s = br.p; br.p += l; if (f === 1) raw = blob.subarray(s, s + l); else if (f === 3) z = blob.subarray(s, s + l); } else br.skip(w); }
      yield raw || zlib.inflateSync(z);
    }
  } finally { fs.closeSync(fd); }
}
function packedZig(buf, s, e, out) { const r = new R(buf, s, e); let n = 0; while (!r.eof()) out[n++] = zig(r.varint()); return n; }
function packedU(buf, s, e) { const r = new R(buf, s, e), a = []; while (!r.eof()) a.push(r.varint()); return a; }

// calls onDense(ids, lons, lats, n) for node blocks and onWay(id, refs, highwayValue, name) for ways
function parseBlock(buf, onDense, onWay, want) {
  const r = new R(buf, 0, buf.length), groups = []; let strings = null, gran = 100;
  while (!r.eof()) {
    const t = r.varint(), f = t >>> 3, w = t & 7;
    if (w === 2) { const l = r.varint(), s = r.p; r.p += l; if (f === 1) { strings = []; const sr = new R(buf, s, s + l); while (!sr.eof()) { const tt = sr.varint(), ww = tt & 7; if (ww === 2) { const ll = sr.varint(); strings.push(buf.toString('utf8', sr.p, sr.p + ll)); sr.p += ll; } else sr.skip(ww); } } else if (f === 2) groups.push([s, s + l]); }
    else if (w === 0) { const v = r.varint(); if (f === 17) gran = v; } else r.skip(w);
  }
  const hwKey = strings ? strings.indexOf('highway') : -1, nameKey = strings ? strings.indexOf('name') : -1, k = gran * 1e-9, wantIdx = new Map(); if (want && strings) want.forEach(nm => { const i = strings.indexOf(nm); if (i >= 0) wantIdx.set(i, nm); });
  for (const [gs, ge] of groups) {
    const g = new R(buf, gs, ge);
    while (!g.eof()) {
      const t = g.varint(), f = t >>> 3, w = t & 7;
      if (w !== 2) { g.skip(w); continue; }
      const l = g.varint(), s = g.p, e = s + l; g.p = e;
      if (f === 2 && onDense) { // DenseNodes
        const d = new R(buf, s, e); let ids = null, lat = null, lon = null, n = 0, idN = 0, lat0 = 0, lon0 = 0, kv = null;
        while (!d.eof()) { const tt = d.varint(), ff = tt >>> 3, ww = tt & 7; if (ww === 2) { const ll = d.varint(), ss = d.p; d.p += ll; if (ff === 1) { ids = new Float64Array(ll); idN = packedZig(buf, ss, ss + ll, ids); } else if (ff === 8) { lat = new Float64Array(ll); n = packedZig(buf, ss, ss + ll, lat); } else if (ff === 9) { lon = new Float64Array(ll); packedZig(buf, ss, ss + ll, lon); } else if (ff === 10 && want) kv = packedU(buf, ss, ss + ll); } else d.skip(ww); }
        if (ids && lat && lon) { let id = 0; for (let i = 0; i < n; i++) { id += ids[i]; lat0 += lat[i]; lon0 += lon[i]; ids[i] = id; lat[i] = lat0 * k; lon[i] = lon0 * k; } let tagsFor = null; if (want && kv && kv.length) { const starts = new Int32Array(n); let q = 0; for (let i = 0; i < n; i++) { starts[i] = q; while (q < kv.length && kv[q] !== 0) q += 2; q++; } tagsFor = i => { let q2 = starts[i], o = null; while (q2 < kv.length && kv[q2] !== 0) { const nm = wantIdx.get(kv[q2]); if (nm) { (o || (o = {}))[nm] = strings[kv[q2 + 1]]; } q2 += 2; } return o; }; } onDense(ids, lon, lat, n, tagsFor); }
      } else if (f === 3 && onWay) { // Way
        const wr = new R(buf, s, e); let id = 0, keys = null, vals = null, refsS = -1, refsE = -1;
        while (!wr.eof()) { const tt = wr.varint(), ff = tt >>> 3, ww = tt & 7; if (ww === 0) { const v = wr.varint(); if (ff === 1) id = v; } else if (ww === 2) { const ll = wr.varint(), ss = wr.p; wr.p += ll; if (ff === 2) keys = packedU(buf, ss, ss + ll); else if (ff === 3) vals = packedU(buf, ss, ss + ll); else if (ff === 8) { refsS = ss; refsE = ss + ll; } } else wr.skip(ww); }
        if (!keys || refsS < 0) continue;
        let hw = null, name = '', tags = null; for (let i = 0; i < keys.length; i++) { if (keys[i] === hwKey) hw = strings[vals[i]]; else if (keys[i] === nameKey) name = strings[vals[i]]; if (want) { const nm = wantIdx.get(keys[i]); if (nm) (tags || (tags = {}))[nm] = strings[vals[i]]; } }
        if (!hw && !tags) continue;
        const refs = new Float64Array(refsE - refsS); const n = packedZig(buf, refsS, refsE, refs); let a = 0; for (let i = 0; i < n; i++) { a += refs[i]; refs[i] = a; }
        onWay(id, refs.subarray(0, n), hw, name, tags);
      }
    }
  }
}

// ---- node hash (open addressing), only nodes inside the box are kept
class NodeHash {
  constructor(cap) { this.cap = cap; this.keys = new Float64Array(cap); this.lon = new Int32Array(cap); this.lat = new Int32Array(cap); this.n = 0; }
  put(id, lon, lat) { let h = id % this.cap; while (this.keys[h] !== 0 && this.keys[h] !== id) { h++; if (h === this.cap) h = 0; } if (this.keys[h] === 0) this.n++; this.keys[h] = id; this.lon[h] = Math.round(lon * 1e6); this.lat[h] = Math.round(lat * 1e6); }
  idx(id) { let h = id % this.cap; while (this.keys[h] !== 0) { if (this.keys[h] === id) return h; h++; if (h === this.cap) h = 0; } return -1; }
}
const CLASS = { motorway: 1, motorway_link: 1, trunk: 1, trunk_link: 1, primary: 2, primary_link: 2, secondary: 3, secondary_link: 3, tertiary: 4, tertiary_link: 4, unclassified: 5, residential: 5, living_street: 5, service: 6, track: 7, path: 8, bridleway: 8 };

function dp(pts, tol) { // Douglas-Peucker on [lon,lat] pairs, tolerance in degrees
  if (pts.length < 3) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let md = 0, mi = -1; const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) { const [x, y] = pts[i]; let d; if (L === 0) d = Math.hypot(x - x1, y - y1); else { let t = ((x - x1) * dx + (y - y1) * dy) / L; t = Math.max(0, Math.min(1, t)); d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)); } if (d > md) { md = d; mi = i; } }
    if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return pts.filter((_, i) => keep[i]);
}

export function extract(file, bbox, opts = {}) {
  const boxes = Array.isArray(bbox[0]) ? bbox : [bbox], inBox = (lo, la) => { for (const [w, s, e, n] of boxes) if (lo >= w && lo <= e && la >= s && la <= n) return true; return false; }, cap = opts.cap || (1 << 24), classes = opts.classes || [1, 2, 3, 4, 5], tol = opts.tol || 0.00006;
  const hash = new NodeHash(cap), ways = [], seen = new Set(); let nodes = 0, nodesIn = 0, wayTotal = 0, overflow = false;
  for (const blk of dataBlocks(file)) {
    parseBlock(blk, (ids, lons, lats, n) => { nodes += n; for (let i = 0; i < n; i++) { const lo = lons[i], la = lats[i]; if (inBox(lo, la)) { nodesIn++; if (hash.n > cap * 0.8) { overflow = true; continue; } hash.put(ids[i], lo, la); } } },
      (id, refs, hw, name) => {
        const c = CLASS[hw]; if (!c || !classes.includes(c)) return; wayTotal++; if (seen.has(id)) return;
        let pts = [], any = false; for (let i = 0; i < refs.length; i++) { const h = hash.idx(refs[i]); if (h < 0) { if (pts.length > 1) { ways.push([c, pts]); } pts = []; continue; } any = true; pts.push([hash.lon[h] / 1e6, hash.lat[h] / 1e6]); }
        if (pts.length > 1) ways.push([c, pts]); if (any) seen.add(id);
      });
  }
  if (overflow) throw new Error(`node hash overflow (${nodesIn} nodes inside the box, capacity ${cap}); use a smaller box or a larger cap`);
  const out = ways.map(([c, p]) => [c, dp(p, tol)]).filter(([, p]) => p.length > 1);
  return { out, nodes, nodesIn, wayTotal };
}
// binary: per way: u8 class, u16 npts, i32 lon0*1e5, i32 lat0*1e5, then (npts-1) x (i16 dlon, i16 dlat) in 1e-5 degrees
export function encode(ways) {
  const parts = []; let total = 0;
  for (const [c, p] of ways) { // split ways whose steps exceed int16 or whose length exceeds u16
    let i = 0; while (i < p.length - 1) { const seg = [p[i]]; let j = i + 1; while (j < p.length && seg.length < 60000) { const dx = Math.round((p[j][0] - seg[seg.length - 1][0]) * 1e5), dy = Math.round((p[j][1] - seg[seg.length - 1][1]) * 1e5); if (Math.abs(dx) > 32000 || Math.abs(dy) > 32000) break; seg.push(p[j]); j++; } if (seg.length > 1) { const b = Buffer.alloc(11 + (seg.length - 1) * 4); b.writeUInt8(c, 0); b.writeUInt16LE(seg.length, 1); let x = Math.round(seg[0][0] * 1e5), y = Math.round(seg[0][1] * 1e5); b.writeInt32LE(x, 3); b.writeInt32LE(y, 7); let o = 11; for (let q = 1; q < seg.length; q++) { const nx = Math.round(seg[q][0] * 1e5), ny = Math.round(seg[q][1] * 1e5); b.writeInt16LE(nx - x, o); b.writeInt16LE(ny - y, o + 2); o += 4; x = nx; y = ny; } parts.push(b); total += b.length; } i = Math.max(j - 1, i + 1); }
  }
  return Buffer.concat(parts, total);
}

// ---- points of interest (real OpenStreetMap places), found nationwide in two light passes
const POI_KEYS = ['amenity', 'shop', 'healthcare', 'man_made', 'natural', 'tourism', 'historic', 'name', 'drinking_water', 'office', 'government', 'emergency', 'content', 'building'];
const POI_SUB = { clinic: 1, pharm: 2, hard: 3, fuel: 4, food: 5, water: 6, shelter: 7, police: 8, fire: 9, gov: 10, school: 11 };
function classify(t) {
  if (!t) return 0; const a = t.amenity, s = t.shop, h = t.healthcare, m = t.man_made, nat = t.natural, tr = t.tourism;
  if (a === 'police') return 8;
  if (a === 'fire_station' || a === 'ambulance_station' || t.emergency === 'ambulance_station') return 9;
  if (a === 'townhall' || a === 'courthouse' || a === 'post_office' || t.office === 'government' || t.government || t.building === 'government') return 10;
  if (a === 'school' || a === 'college' || a === 'university' || a === 'community_centre') return 11;
  if (m === 'windpump' || m === 'borehole' || m === 'water_works' || m === 'reservoir_covered' || a === 'water_point' || t.emergency === 'water_tank' || (m === 'storage_tank' && t.content === 'water')) return 6;
  if (a === 'pharmacy' || h === 'pharmacy') return 2;
  if (a === 'hospital' || a === 'clinic' || a === 'doctors' || h === 'hospital' || h === 'clinic' || h === 'doctor') return 1;
  if (a === 'fuel') return 4;
  if (s === 'hardware' || s === 'doityourself' || s === 'building_materials') return 3;
  if (s === 'supermarket' || s === 'convenience' || s === 'general' || s === 'greengrocer' || s === 'butcher') return 5;
  if (m === 'water_well' || m === 'water_tower' || m === 'water_tap' || nat === 'spring' || a === 'drinking_water' || t.drinking_water === 'yes') return 6;
  if (a === 'shelter' || tr === 'wilderness_hut' || tr === 'alpine_hut' || nat === 'cave_entrance') return 7;
  return 0;
}
export function extractPoi(file, bbox) {
  const [W, S, E, N] = bbox, ways = []; let total = 0;
  for (const blk of dataBlocks(file)) parseBlock(blk, null, (id, refs, hw, name, tags) => { const c = classify(tags); if (!c) return; ways.push([c, tags.name || '', refs.slice()]); total += refs.length; }, POI_KEYS);
  const all = new Float64Array(total); let o = 0; for (const [, , r] of ways) { all.set(r, o); o += r.length; } all.sort();
  let u = 0; for (let i = 0; i < all.length; i++) if (i === 0 || all[i] !== all[i - 1]) all[u++] = all[i];
  const needed = all.subarray(0, u), hash = new NodeHash(Math.max(1024, Math.ceil(u * 1.6))), out = []; let j = 0;
  for (const blk of dataBlocks(file)) parseBlock(blk, (ids, lons, lats, n, tagsFor) => { for (let i = 0; i < n; i++) { const id = ids[i]; while (j < u && needed[j] < id) j++; if (j < u && needed[j] === id) hash.put(id, lons[i], lats[i]); if (tagsFor) { const tg = tagsFor(i); const c = classify(tg); if (c && lons[i] >= W && lons[i] <= E && lats[i] >= S && lats[i] <= N) out.push([c, lons[i], lats[i], tg.name || '']); } } }, null, POI_KEYS);
  for (const [c, name, refs] of ways) { let sx = 0, sy = 0, k = 0; for (const r of refs) { const h = hash.idx(r); if (h >= 0) { sx += hash.lon[h] / 1e6; sy += hash.lat[h] / 1e6; k++; } } if (k) { const lo = sx / k, la = sy / k; if (lo >= W && lo <= E && la >= S && la <= N) out.push([c, lo, la, name]); } }
  return out;
}
export function encodePoi(list) {
  const parts = []; for (const [c, lo, la, name] of list) { const nb = Buffer.from(String(name || '').slice(0, 36), 'utf8').subarray(0, 40); const b = Buffer.alloc(10 + nb.length); b.writeUInt8(c, 0); b.writeInt32LE(Math.round(lo * 1e5), 1); b.writeInt32LE(Math.round(la * 1e5), 5); b.writeUInt8(nb.length, 9); nb.copy(b, 10); parts.push(b); } return Buffer.concat(parts);
}
// Method 2 (for files with huge numbers of nodes, e.g. Lesotho): read only the roads first, remember which nodes they use, then keep just those.
export function extractNeeded(file, bbox, opts = {}) {
  const [W, S, E, N] = bbox, classes = opts.classes || [1, 2, 3, 4, 5], tol = opts.tol || 0.00006, list = []; let total = 0;
  for (const blk of dataBlocks(file)) parseBlock(blk, null, (id, refs, hw) => { const c = CLASS[hw]; if (!c || !classes.includes(c)) return; list.push([c, refs.slice()]); total += refs.length; });
  const all = new Float64Array(total); let o = 0; for (const [, r] of list) { all.set(r, o); o += r.length; } all.sort();
  let u = 0; for (let i = 0; i < all.length; i++) if (i === 0 || all[i] !== all[i - 1]) all[u++] = all[i];
  const needed = all.subarray(0, u), hash = new NodeHash(Math.max(1024, Math.ceil(u * 1.6))); let j = 0, nodes = 0;
  for (const blk of dataBlocks(file)) parseBlock(blk, (ids, lons, lats, n) => { nodes += n; for (let i = 0; i < n; i++) { const id = ids[i]; while (j < u && needed[j] < id) j++; if (j < u && needed[j] === id) hash.put(id, lons[i], lats[i]); } }, null);
  const out = [];
  for (const [c, refs] of list) { let pts = []; const flush = () => { if (pts.length > 1) out.push([c, dp(pts, tol)]); pts = []; };
    for (let i = 0; i < refs.length; i++) { const h = hash.idx(refs[i]); if (h < 0) { flush(); continue; } const lo = hash.lon[h] / 1e6, la = hash.lat[h] / 1e6; if (lo < W || lo > E || la < S || la > N) { flush(); continue; } pts.push([lo, la]); } flush(); }
  return { out: out.filter(([, p]) => p.length > 1), nodes, nodesIn: u, wayTotal: list.length };
}
// Method 1 with automatic splitting of the box when the node table would overflow
export function extractAuto(file, bbox, opts = {}, depth = 0) {
  try { return extract(file, bbox, opts); }
  catch (e) {
    if (!/overflow/.test(e.message) || depth >= 4) throw e; const [W, S, E, N] = bbox, ov = 0.003; console.error(`  box too dense (${bbox.map(v => +v.toFixed(3))}); splitting`);
    const halves = (E - W) > (N - S) * 1.2 ? [[W, S, (W + E) / 2 + ov, N], [(W + E) / 2 - ov, S, E, N]] : [[W, S, E, (S + N) / 2 + ov], [W, (S + N) / 2 - ov, E, N]];
    const a = extractAuto(file, halves[0], opts, depth + 1), b = extractAuto(file, halves[1], opts, depth + 1);
    return { out: a.out.concat(b.out), nodes: a.nodes + b.nodes, nodesIn: a.nodesIn + b.nodesIn, wayTotal: a.wayTotal + b.wayTotal };
  }
}

if (process.argv[1] && process.argv[1].endsWith('osm.mjs')) {
  const [, , file, name, w, s, e, n, mode, cap] = process.argv; const t0 = Date.now(), box = w && w.startsWith('[') ? JSON.parse(w) : [+w, +s, +e, +n];
  if (mode === 'poi') { const list = extractPoi(file, box), by = {}; list.forEach(x => by[x[0]] = (by[x[0]] || 0) + 1); const bin = encodePoi(list); fs.writeFileSync(new URL(`./${name}.poi.bin`, import.meta.url), bin); console.log(JSON.stringify({ name, mode: 'poi', seconds: Math.round((Date.now() - t0) / 1000), pois: list.length, bySub: by, MB: +(bin.length / 1048576).toFixed(2) })); process.exit(0); }
  const r = mode === 'needed' ? extractNeeded(file, box) : extractAuto(file, box, { cap: cap ? +cap : undefined });
  const bin = encode(r.out); fs.writeFileSync(new URL(`./${name}.streets.bin`, import.meta.url), bin);
  const byClass = {}; r.out.forEach(([c]) => { byClass[c] = (byClass[c] || 0) + 1; });
  console.log(JSON.stringify({ name, mode: mode || 'hash', seconds: Math.round((Date.now() - t0) / 1000), nodesScanned: r.nodes, nodesUsed: r.nodesIn, highwayWays: r.wayTotal, ways: r.out.length, points: r.out.reduce((a, [, p]) => a + p.length, 0), byClass, MB: +(bin.length / 1048576).toFixed(2) }));
}export { dataBlocks, parseBlock, NodeHash, CLASS, dp };
