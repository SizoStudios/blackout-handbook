// Trims the Natural Earth files to the map region and adds the mock-up's places.
// Real data: borders, rivers, lakes, roads, towns. Real places with approximate positions: hazards, choke points, back routes, peaks.
// Illustrative only: forests, water-source dots, resource dots, rally points.
import fs from 'node:fs';
const D = 'C:/Users/sizo1/Documents/blackout-tools/mapdata';
const OUT = new URL('./data.json', import.meta.url);
const BB = { w: 14.5, e: 36.6, s: -35.7, n: -21.3 };
const HOME = ['ZAF', 'LSO', 'SWZ', 'MOZ', 'BWA', 'ZWE', 'NAM'];
const read = f => JSON.parse(fs.readFileSync(`${D}/ne/${f}.geojson`, 'utf8'));
const r3 = v => Math.round(v * 1000) / 1000;

const flatten = (c, depth) => depth === 0 ? [c] : c.flatMap(x => flatten(x, depth - 1)); // -> array of coordinate rings/lines
const polys = g => g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat(1) : [];
const lines = g => g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
const hits = ring => ring.some(([x, y]) => x > BB.w && x < BB.e && y > BB.s && y < BB.n);
function simp(ring, tol) {
  const o = [ring[0]]; let [lx, ly] = ring[0];
  for (let i = 1; i < ring.length - 1; i++) { const [x, y] = ring[i]; if (Math.hypot(x - lx, y - ly) >= tol) { o.push(ring[i]); lx = x; ly = y; } }
  o.push(ring[ring.length - 1]); return o;
}
const flat = ring => { const o = []; for (const [x, y] of ring) o.push(r3(x), r3(y)); return o; };
const clipRing = ring => ring.filter(([x, y]) => x > BB.w - 1 && x < BB.e + 1 && y > BB.s - 1 && y < BB.n + 1);

// ---- countries
const countries = read('ne_10m_admin_0_countries').features.filter(f => HOME.includes(f.properties.ADM0_A3)).map(f => ({
  a3: f.properties.ADM0_A3, n: f.properties.NAME,
  r: polys(f.geometry).filter(hits).map(r => flat(simp(r, 0.004)))
}));
// ---- provinces
const provinces = read('ne_10m_admin_1_states_provinces').features.filter(f => ['ZAF', 'LSO', 'SWZ', 'MOZ'].includes(f.properties.adm0_a3)).map(f => ({
  a3: f.properties.adm0_a3, n: f.properties.name, cn: f.properties.admin,
  r: polys(f.geometry).filter(hits).map(r => flat(simp(r, 0.005)))
})).filter(p => p.r.length);
// ---- rivers and lakes
const rivF = read('ne_10m_rivers_lake_centerlines').features;
const rivers = rivF.map(f => ({ n: f.properties.name || '', l: lines(f.geometry).filter(hits).map(l => flat(simp(l, 0.004))) })).filter(r => r.l.length);
const lakes = read('ne_10m_lakes').features.map(f => ({ n: f.properties.name || '', r: polys(f.geometry).filter(hits).map(r => flat(simp(r, 0.004))) })).filter(l => l.r.length);
// Limpopo, oriented west -> east, for the coverage boundary
const lim = rivF.filter(f => /^limpopo$/i.test(f.properties.name || '')).flatMap(f => lines(f.geometry)).map(l => (l[0][0] > l[l.length - 1][0] ? l.slice().reverse() : l)).sort((a, b) => a[0][0] - b[0][0]);
const limpopo = flat(lim.flat(1).filter(([x, y]) => x > 30.9 && y < -22));
// ---- roads
const roadType = { 'Major Highway': 1, 'Secondary Highway': 2, 'Road': 3, 'Unknown': 3 };
const roads = read('ne_10m_roads').features.filter(f => roadType[f.properties.type]).map(f => ({ c: roadType[f.properties.type], n: f.properties.name || '', l: lines(f.geometry).filter(hits).map(l => flat(simp(l, f.properties.type === 'Road' ? 0.012 : 0.006))) })).filter(r => r.l.length);
// ---- towns
const towns = read('ne_10m_populated_places_simple').features.filter(f => {
  const p = f.properties, [x, y] = f.geometry.coordinates;
  if (x < BB.w || x > BB.e || y < BB.s || y > BB.n) return false;
  if (['ZAF', 'LSO', 'SWZ'].includes(p.adm0_a3)) return p.pop_max >= 8000 || p.adm0cap === 1;
  if (p.adm0_a3 === 'MOZ') return y < -24.4 && p.pop_max >= 8000;
  return false;
}).map(f => ({ n: f.properties.name, lon: r3(f.geometry.coordinates[0]), lat: r3(f.geometry.coordinates[1]), pop: f.properties.pop_max || 0, cap: f.properties.adm0cap === 1 ? 1 : 0, a3: f.properties.adm0_a3 }));

// ---- helpers for seeded illustrative data
let seed = 20261105; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const KM = 111.2;
const dlon = (km, lat) => km / (KM * Math.cos(lat * Math.PI / 180));

// ---- forests (illustrative shapes at real forest belts). [name, class, lon, lat, rxKm, ryKm, rotDeg, patches]
const FOR = [
  ['Knysna-Tsitsikamma forests', 'ind', 23.15, -33.98, 85, 7, 0, 12], ['Outeniqua forests', 'ind', 22.5, -33.93, 35, 5, 0, 6], ['Amatola forests', 'ind', 26.85, -32.65, 24, 10, 20, 7],
  ['Pondoland / Wild Coast forests', 'ind', 29.6, -31.5, 28, 14, 55, 8], ['Magoebaskloof forests', 'ind', 30.0, -23.85, 18, 8, 0, 6], ['Soutpansberg forests', 'ind', 29.9, -23.05, 50, 8, 0, 8],
  ['Dukuduku and St Lucia forests', 'ind', 32.4, -28.3, 14, 8, 90, 5], ['Ngoye and Eshowe forests', 'ind', 31.55, -28.9, 16, 9, 0, 5], ['Karkloof and Midlands forests', 'ind', 30.25, -29.3, 14, 7, 0, 5],
  ['Drakensberg gorge forests', 'ind', 29.3, -29.0, 22, 6, 70, 5], ['Sand forests, Maputaland', 'ind', 32.45, -27.3, 25, 6, 90, 5], ['Cape Peninsula forests', 'ind', 18.42, -34.0, 6, 4, 90, 3],
  ['Graskop-Sabie plantations', 'plant', 30.8, -25.05, 42, 32, 20, 16], ['Piet Retief plantations', 'plant', 30.85, -27.0, 30, 24, 0, 12], ['Natal Midlands plantations', 'plant', 30.35, -29.2, 52, 28, 25, 16],
  ['Southern KZN plantations', 'plant', 29.85, -30.5, 38, 18, 40, 10], ['Eastern Cape plantations', 'plant', 27.3, -32.55, 28, 15, 10, 9], ['Southern Cape plantations', 'plant', 22.9, -33.95, 40, 7, 0, 8],
  ['Elgin-Grabouw plantations', 'plant', 19.0, -34.15, 14, 7, 0, 5], ['Tokai plantations', 'plant', 18.44, -34.06, 5, 3, 0, 2], ['Zululand plantations', 'plant', 32.1, -28.55, 42, 20, 10, 13],
  ['Eswatini plantations', 'plant', 31.15, -26.3, 34, 30, 0, 12], ['Tzaneen plantations', 'plant', 30.2, -23.85, 22, 12, 0, 6], ['Mpumalanga highveld plantations', 'plant', 30.2, -26.2, 26, 16, 0, 7],
  ['Lowveld bushveld', 'wood', 31.6, -24.6, 150, 48, -12, 14], ['Waterberg and Limpopo bushveld', 'wood', 28.3, -24.0, 120, 50, 0, 12], ['Zululand bushveld', 'wood', 32.0, -28.0, 70, 40, 0, 10],
  ['Eastern Cape thicket', 'wood', 26.2, -33.2, 95, 30, 8, 10], ['Pilanesberg and Madikwe bushveld', 'wood', 26.5, -25.3, 100, 42, 0, 9], ['Kalahari thornveld', 'wood', 22.5, -27.5, 200, 90, 0, 10],
  ['Southern Mozambique woodland', 'wood', 33.0, -24.6, 85, 60, 0, 10], ['Limpopo valley woodland', 'wood', 29.5, -22.6, 120, 30, 0, 8], ['Eastern KZN coastal bush', 'wood', 31.0, -29.2, 60, 18, 40, 7]
];
function patch(cx, cy, rkm, lat) {
  const n = 16, ph = rnd() * 6.28, a1 = .25 + rnd() * .2, a2 = .15 + rnd() * .15, pts = [];
  for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2, r = rkm * (1 + a1 * Math.sin(3 * t + ph) + a2 * Math.sin(5 * t + ph * 1.7) + (rnd() - .5) * .18); pts.push([cx + dlon(r * Math.cos(t), lat), cy + r * Math.sin(t) / KM]); }
  pts.push(pts[0]); return flat(pts);
}
const forests = FOR.map(([n, c, lon, lat, rx, ry, rot, np]) => {
  const rings = [], rr = rot * Math.PI / 180;
  for (let i = 0; i < np; i++) {
    const u = (rnd() * 2 - 1), v = (rnd() * 2 - 1); if (u * u + v * v > 1) { i--; continue; }
    const ex = u * rx, ey = v * ry, px = ex * Math.cos(rr) - ey * Math.sin(rr), py = ex * Math.sin(rr) + ey * Math.cos(rr);
    const base = c === 'ind' ? Math.max(2.5, Math.min(rx, ry) * (.35 + rnd() * .35)) : c === 'plant' ? Math.max(3, Math.min(rx, ry) * (.22 + rnd() * .3)) : Math.max(8, Math.min(rx, ry) * (.3 + rnd() * .3));
    rings.push(patch(lon + dlon(px, lat), lat + py / KM, base, lat));
  }
  return { n, c, r: rings };
});

// ---- real places with approximate positions
const haz = [
  ['Sasol Secunda synfuels plant', 29.17, -26.55, 10], ['Sasolburg chemical complex', 27.83, -26.82, 8], ['Durban refineries (Engen / former SAPREF)', 30.94, -29.94, 8], ['Chevron refinery, Milnerton (Cape Town)', 18.52, -33.88, 7],
  ['Koeberg nuclear power station', 18.43, -33.68, 8], ['PetroSA gas-to-liquids plant, Mossel Bay', 22.12, -34.15, 7], ['Saldanha Bay iron-ore port and steel', 17.95, -33.02, 6], ['Richards Bay coal terminal and smelters', 32.07, -28.8, 8],
  ['Matimba and Medupi power stations', 27.58, -23.7, 8], ['Majuba power station', 29.77, -27.1, 7], ['Highveld power stations (Kendal, Kusile, Duvha)', 29.2, -25.9, 9], ['Lethabo power station', 27.98, -26.74, 7],
  ['Tutuka power station', 29.35, -26.77, 7], ['OR Tambo International Airport', 28.24, -26.13, 7], ['Port of Durban', 31.03, -29.87, 7], ['Port of Maputo', 32.57, -25.97, 7], ['Coega port and industrial zone', 25.68, -33.8, 7],
  ['Port of East London', 27.92, -33.02, 6], ['Cape Town harbour', 18.43, -33.91, 6], ['Kimberley mine area', 24.76, -28.74, 6]
].map(([n, lon, lat, r]) => ({ n, lon, lat, r }));
const choke = [
  ["Van Reenen's Pass (N3)", 29.38, -28.37], ['Oliviershoek Pass (R74)', 29.07, -28.57], ['Huguenot Tunnel (N1)', 19.1, -33.73], ['Hex River Pass (N1)', 19.68, -33.55], ['Du Toitskloof Pass (old N1)', 19.13, -33.72],
  ['Outeniqua Pass (N12)', 22.38, -33.78], ['Bloukrans bridge (N2)', 23.65, -33.97], ['Storms River bridge (N2)', 23.9, -33.97], ['Kei River crossing (N2)', 28.33, -32.69], ['Gariep Dam bridge (N1)', 25.51, -30.62],
  ['Mooi River toll plaza (N3)', 29.99, -29.2], ['Sani Pass', 29.28, -29.6], ['Beitbridge border', 29.99, -22.22], ['Lebombo / Ressano Garcia border', 32.0, -25.43], ['Maseru Bridge border', 27.48, -29.32],
  ['Ficksburg Bridge border', 27.9, -28.87], ['Caledonspoort border', 28.25, -28.65], ['Oshoek / Ngwenya border', 30.98, -26.2], ['Golela / Lavumisa border', 31.89, -27.34], ['Kosi Bay / Ponta do Ouro border', 32.88, -26.85],
  ['Vaal River bridge, Vereeniging', 27.93, -26.67], ['Tugela River bridge (N2)', 31.43, -29.2]
].map(([n, lon, lat]) => ({ n, lon, lat }));
const back = [
  ['Oliviershoek back route (bypasses the N3 at Van Reenen)', [[29.87, -29.0], [29.53, -28.82], [29.36, -28.73], [29.07, -28.57], [29.13, -28.27]]],
  ['Du Toitskloof old road (bypasses the Huguenot Tunnel)', [[18.97, -33.73], [19.15, -33.72], [19.33, -33.69], [19.45, -33.65]]],
  ["Prince Alfred's Pass (Knysna to the Karoo side)", [[23.05, -34.04], [23.07, -33.97], [23.08, -33.84], [23.12, -33.73], [23.12, -33.66]]],
  ['Swartberg Pass (Oudtshoorn to Prince Albert)', [[22.2, -33.59], [22.05, -33.35], [22.03, -33.22]]],
  ['Sani Pass to Lesotho', [[29.5, -29.79], [29.28, -29.58], [29.07, -29.29]]]
].map(([n, pts]) => ({ n, l: flat(pts) }));
const rally = [['Rally: Harrismith', 29.13, -28.27], ['Rally: Clarens', 28.42, -28.52], ['Rally: Bergville', 29.36, -28.73], ['Rally: Bloemfontein north', 26.2, -28.95], ['Rally: George', 22.46, -33.96], ['Rally: Maseru', 27.48, -29.31]].map(([n, lon, lat]) => ({ n, lon, lat }));
const peaks = [['Thabana Ntlenyana', 29.3, -29.47, 3482], ['Mafadi', 29.3, -29.2, 3450], ['Giant\'s Castle', 29.45, -29.3, 3315], ['Mont-aux-Sources', 28.88, -28.75, 3282], ['Cathkin Peak', 29.22, -29.0, 3149], ['Cathedral Peak', 29.2, -28.95, 3004], ['Compassberg', 24.98, -32.28, 2504], ['Matroosberg', 19.68, -33.38, 2249], ['Mount Anderson', 30.8, -25.05, 2285], ['Table Mountain', 18.4, -33.96, 1086]].map(([n, lon, lat, h]) => ({ n, lon, lat, h }));

// ---- illustrative water sources: along rivers every ~70 km, plus dam centroids
const water = [];
for (const f of rivF) for (const l of lines(f.geometry)) {
  if (!hits(l)) continue; let acc = 0;
  for (let i = 1; i < l.length; i++) { acc += Math.hypot((l[i][0] - l[i - 1][0]) * Math.cos(l[i][1] * Math.PI / 180), l[i][1] - l[i - 1][1]) * KM; if (acc > 70) { acc = 0; const [x, y] = l[i]; if (x > 16 && x < 35.5 && y > -35.5 && y < -22.2) water.push({ n: (f.properties.name || 'River') + ' (river point)', lon: r3(x), lat: r3(y) }); } }
}
for (const l of read('ne_10m_lakes').features) { if (!hits(polys(l.geometry)[0] || [])) continue; const r = polys(l.geometry)[0]; const cx = r.reduce((a, p) => a + p[0], 0) / r.length, cy = r.reduce((a, p) => a + p[1], 0) / r.length; if (cx > 16 && cx < 35.5 && cy > -35.5 && cy < -22.2) water.push({ n: (l.properties.name || 'Dam or lake'), lon: r3(cx), lat: r3(cy) }); }

// ---- illustrative resources near towns
const SUB = ['clinic', 'pharm', 'hard', 'fuel', 'food'], res = [];
for (const t of towns) {
  if (t.pop < 20000) continue; const n = Math.min(6, 1 + Math.floor(t.pop / 70000));
  for (let i = 0; i < n; i++) { const a = rnd() * 6.28, d = 0.5 + rnd() * (3 + Math.min(8, t.pop / 400000)); res.push({ s: SUB[Math.floor(rnd() * 5)], lon: r3(t.lon + dlon(d * Math.cos(a), t.lat)), lat: r3(t.lat + d * Math.sin(a) / KM) }); }
}


// ---- key national highways, hand-placed through known towns (approximate). Natural Earth's road layer has gaps (for example the N3 at Van Reenen's Pass).
const HW = {
  N1: [[18.42, -33.92], [18.96, -33.73], [19.45, -33.65], [20.86, -33.2], [22.58, -32.35], [24.0, -31.6], [25.1, -30.72], [26.21, -29.12], [27.23, -27.65], [27.9, -26.75], [28.05, -26.2], [28.19, -25.75], [29.45, -23.9], [29.99, -22.22]],
  N2: [[18.42, -33.92], [20.44, -34.03], [22.14, -34.18], [22.46, -33.96], [23.37, -34.05], [25.6, -33.96], [27.9, -33.02], [28.78, -31.59], [30.45, -30.74], [31.02, -29.86], [32.04, -28.78], [32.1, -27.7], [32.0, -27.0]],
  N3: [[28.05, -26.2], [28.36, -26.5], [28.62, -27.04], [28.96, -27.94], [29.13, -28.27], [29.38, -28.37], [29.87, -29.0], [29.99, -29.21], [30.38, -29.6], [31.02, -29.86]],
  N4: [[28.19, -25.75], [29.46, -25.77], [30.97, -25.47], [31.95, -25.43], [32.57, -25.97]],
  N7: [[18.42, -33.92], [18.7, -33.4], [18.95, -32.4], [18.9, -31.4], [17.9, -29.7]]
};
const hwy = Object.entries(HW).map(([n, pts]) => ({ n, l: flat(pts) }));
const data = { hwy, tx0: 69, ty0: 71, nx: 8, ny: 7, countries, provinces, rivers, lakes, roads, towns, forests, limpopo, haz, choke, back, rally, peaks, water, res };
fs.writeFileSync(OUT, JSON.stringify(data));
const sz = k => (JSON.stringify(data[k]).length / 1024).toFixed(0) + ' KB';
console.log('written', (fs.statSync(OUT).size / 1048576).toFixed(2), 'MB');
for (const k of ['countries', 'provinces', 'rivers', 'lakes', 'roads', 'towns', 'forests', 'limpopo', 'water', 'res']) console.log(k.padEnd(10), String(Array.isArray(data[k]) ? data[k].length : data[k].length / 2).padStart(6), sz(k));
console.log('limpopo points', limpopo.length / 2, 'first', limpopo.slice(0, 2), 'last', limpopo.slice(-2));
