// Converter: OpenStreetMap files -> Blackout map packs (.bhmap), for import into the app.
// Usage: node makepacks.mjs <outDir> [base|roads|all]
// Pack container: "BHMAP1\n" + u32 headerLen + header JSON + blobs. Header: { pack, region, version, created, licence, entries:[{k,o,l}] } (o = offset from start of blobs).
import fs from 'node:fs';
import { extractNeeded, encode } from './osm.mjs';
const OSM = 'C:/Users/sizo1/Documents/blackout-tools/mapdata/osm/';
const TILES = 'C:/Users/sizo1/Documents/blackout-tools/mapdata/tiles/';
const here = new URL('./', import.meta.url);
const out = process.argv[2] || 'packs', what = process.argv[3] || 'all';
fs.mkdirSync(out, { recursive: true });
const LICENCE = 'Map data (c) OpenStreetMap contributors, ODbL 1.0 (openstreetmap.org/copyright). Borders, rivers and towns: Natural Earth (public domain). Terrain: AWS Terrain Tiles (SRTM and others; see registry.opendata.aws/terrain-tiles).';

function writePack(file, header, entries) { // entries: [[key, Buffer]]
  let o = 0; const list = entries.map(([k, b]) => { const e = { k, o, l: b.length }; o += b.length; return e; });
  const hd = Buffer.from(JSON.stringify({ ...header, created: new Date().toISOString(), licence: LICENCE, entries: list }), 'utf8');
  const pre = Buffer.alloc(11); pre.write('BHMAP1\n', 0, 'latin1'); pre.writeUInt32LE(hd.length, 7);
  const fd = fs.openSync(file, 'w'); fs.writeSync(fd, pre); fs.writeSync(fd, hd); for (const [, b] of entries) fs.writeSync(fd, b); fs.closeSync(fd);
  console.log('wrote', file, (fs.statSync(file).size / 1048576).toFixed(2), 'MB,', entries.length, 'entries');
}

/* ---------- roads: ways cut into 0.25 degree cells ---------- */
const CELL = 0.25, cellOf = (lo, la) => Math.floor((lo + 180) / CELL) + '_' + Math.floor((la + 90) / CELL);
function toCells(ways) {
  const cells = new Map(); const add = (k, c, pts) => { if (pts.length < 2) return; let a = cells.get(k); if (!a) cells.set(k, a = []); a.push([c, pts]); };
  for (const [c, pts] of ways) {
    let cur = [pts[0]], ck = cellOf(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const k = cellOf(pts[i][0], pts[i][1]);
      if (k === ck) cur.push(pts[i]); else { cur.push(pts[i]); add(ck, c, cur); cur = [pts[i]]; ck = k; }
    }
    add(ck, c, cur);
  }
  return cells;
}
const REGIONS = [
  ['za', 'South Africa', 'south-africa-latest.osm.pbf', [16, -35.2, 33.1, -22.0]], ['ls', 'Lesotho', 'lesotho-latest.osm.pbf', [27, -30.75, 29.5, -28.5]],
  ['sz', 'Eswatini', 'swaziland-latest.osm.pbf', [30.7, -27.4, 32.2, -25.7]], ['mz', 'Southern Mozambique', 'mozambique-latest.osm.pbf', [30.8, -27, 34, -22.3]],
  ['bw', 'Botswana (south of 22S)', 'botswana-latest.osm.pbf', [19.9, -26.95, 29.5, -22]], ['na', 'Namibia (south of 22S)', 'namibia-latest.osm.pbf', [11.5, -29.3, 20.1, -22]]
];
if (what === 'roads' || what === 'all') {
  for (const [id, name, file, box] of REGIONS) {
    const t0 = Date.now(); let ways = [];
    for (const classes of [[1, 2, 3, 4, 5], [6, 7, 8]]) { const r = extractNeeded(OSM + file, box, { classes }); ways = ways.concat(r.out); }
    const cells = toCells(ways), entries = [...cells].map(([k, w]) => ['r/' + id + '/' + k, encode(w)]);
    writePack(out + '/Roads-' + name.replace(/[^A-Za-z]+/g, '-') + '.bhmap', { pack: 'roads', region: id, name: 'Roads and tracks: ' + name, version: 1, cell: CELL }, entries);
    console.log(id, 'ways', ways.length, 'cells', cells.size, Math.round((Date.now() - t0) / 1000) + 's');
  }
}

/* ---------- base: borders, towns, terrain tiles, places ---------- */
if (what === 'base' || what === 'all') {
  const D = JSON.parse(fs.readFileSync(new URL('data.json', here), 'utf8'));
  const base = { hwy: D.hwy, countries: D.countries, provinces: D.provinces, rivers: D.rivers, lakes: D.lakes, towns: D.towns, haz: D.haz, choke: D.choke, back: D.back, peaks: D.peaks, limpopo: D.limpopo };
  const entries = [['base', Buffer.from(JSON.stringify(base))]];
  // places: all the point files, de-duplicated
  function readPoi(p) { if (!fs.existsSync(p)) return []; const b = fs.readFileSync(p), o = []; let i = 0; while (i + 10 <= b.length) { const nl = b[i + 9]; o.push({ raw: b.subarray(i, i + 10 + nl), c: b[i], lon: b.readInt32LE(i + 1), lat: b.readInt32LE(i + 5) }); i += 10 + nl; } return o; }
  const seen = new Set(), keep = [];
  for (const f of ['sa', 'lesotho', 'swz', 'moz', 'bwa', 'nam']) for (const p of readPoi(new URL(f + '.poi.bin', here).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) { const k = `${p.c}|${Math.round(p.lon / 20)}|${Math.round(p.lat / 20)}`; if (seen.has(k)) continue; seen.add(k); keep.push(p.raw); }
  entries.push(['places', Buffer.concat(keep)]); console.log('places', keep.length);
  for (const f of fs.readdirSync(TILES)) { const m = f.match(/^(\d+)_(\d+)_(\d+)\.png$/); if (m) entries.push([`t/${m[1]}/${m[2]}/${m[3]}`, fs.readFileSync(TILES + f)]); }
  writePack(out + '/Base-Terrain-Places.bhmap', { pack: 'base', region: 'all', name: 'Base map, terrain and places', version: 1, terrainZoom: 7 }, entries);
}

/* ---------- overview roads (motorways and trunk/primary only, heavily simplified) for the zoomed-out map ---------- */
if (what === 'overview') {
  let all = [];
  for (const [id, name, file, box] of REGIONS) { const r = extractNeeded(OSM + file, box, { classes: [1, 2], tol: 0.004 }); all = all.concat(r.out); console.log(id, r.out.length); }
  writePack(out + '/Roads-Overview.bhmap', { pack: 'roads-ov', region: 'all', name: 'Main roads overview (zoomed out)', version: 1 }, [['ov', encode(all)]]);
}
