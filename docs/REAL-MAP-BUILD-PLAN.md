# Blackout Handbook: real map build plan (draft, 5 Nov 2026)

Status: preparation only. Nothing in the app has been changed. The mock-up is `mockups/Blackout-Map-Mockup-v5.html`; its source is in `blackout-build/mockup/` (template.html, osm.mjs, build.mjs).

## 0. Order of work (agreed earlier)
1. Security layer first (app lock, encrypted data and backups, decoy PIN, wipe-after-N-tries, need-to-know sharing, compromised marker). The map stores private pins, so it must sit on top of this.
2. Places (supply locations) and pins. These share one store with the map.
3. Map engine inside the app (offline, whole coverage).
4. Route planner (roads and tracks, gravel, own speeds).
5. Reference packs, laptop AI, library import (later).

## 1. Decisions already made by Sizo
- The map is built into the main app (a tab), not a plugin. Map data is separate packs imported from the flash drive.
- First use on a device: every layer OFF. Sizo ticks what he wants. Choices are saved permanently on that device until he changes them. Start-up view is a setting (last view, GPS, or a home spot).
- Pins: tap a spot, pick one or more types, free text, status, checked date (goes stale), optional photo, private / shared / need-to-know.
- Floating Measure toggle: off = taps only select; on = taps add legs. Distance, height gain and loss, time. Auto-off timer.
- Route planner: distance and time along roads and tracks, gravel included, surface shown per stretch, own walking, cycling and vehicle speeds, all-out information display.
- Coverage: all of South Africa, Lesotho, Eswatini, southern Mozambique (west bank of the Limpopo), Botswana and Namibia south of 22 degrees S. Zimbabwe excluded.

Open questions for Sizo: (a) do layer choices travel inside backups (optional tick suggested)? (b) keep Overview / Survival / Travel as one-tap presets that never apply at start-up? (c) any pin types to add or drop?

## 2. Measured data sizes (geometry only, simplified to 6 m, delta-encoded; measured 5 Nov 2026 from the real OpenStreetMap files)
| Area | Sealed roads (motorway to residential) | Service roads | Tracks (gravel/farm) | Paths |
|---|---|---|---|---|
| South Africa | 27.9 MB (1.24 M ways) | 6.7 MB | 10.1 MB | 1.9 MB |
| Lesotho | 0.9 MB | 0.2 MB | 1.1 MB | 1.5 MB |
| Eswatini | 1.0 MB | 0.1 MB | 0.4 MB | 0.1 MB |
| S Mozambique (west bank) | 2.2 MB | 0.1 MB | 0.2 MB | 0.1 MB |
| Botswana south of 22S | 1.8 MB | 0.2 MB | 0.9 MB | 0.2 MB |
| Namibia south of 22S | 0.5 MB | 0.2 MB | 1.2 MB | 0.1 MB |
| Total | about 34 MB | about 7.5 MB | about 14 MB | about 4 MB |

So all road geometry for the whole coverage is about 60 MB, far less than the mock-up planner estimated. The planner's road figures should be replaced with these. Things that will add to it: junction topology for routing (about 2 to 3 times), names, surface and speed attributes, and buildings if wanted. Plan for 150 to 250 MB for roads with routing; confirm by building it.

Places (water, clinics, public buildings etc.) are about 51,000 points, under 2 MB.

Terrain (measured earlier): tiles z7 to z9 over the whole coverage about 33 MB; z10 adds about 70 MB; z11 about 330 MB over the whole coverage; z12 (30 m) is the source limit. Decide the terrain depth with the storage planner.

Gravel note: OpenStreetMap `highway=track` and `highway=unclassified` are the gravel network. Surface tags (`surface=gravel|dirt|sand|asphalt`, `tracktype=grade1..5`) are patchy, so the planner will show sealed / gravel / unknown and never guess.

## 3. Architecture
- Renderer: keep the Canvas 2D engine proven in the mock-up (no dependencies, runs offline, light on memory). Evolve it to draw from tiled data instead of one big array. MapLibre is not needed and would add WebGL and tooling risk on the Huawei.
- Packs (made on the laptop by a converter, one file per area, with licence and source inside):
  - `terrain` pack: Terrarium PNG tiles by zoom, index at the head of the file.
  - `roads` pack: ways cut into grid cells (about 0.25 degrees), one blob per cell, with a cell index. Loaded lazily by what is on screen.
  - `routing` pack: a proper graph (nodes at every junction, edges with class, length, surface, speed, access, one-way, bridge/ford flags). Ways MUST be split at junctions and must not be simplified across junction nodes (the current display format loses junctions).
  - `places` pack: the POI list with categories and names.
  - `base` pack: borders, provinces, towns, rivers, peaks.
- Import: Settings, Maps, "Add map pack" from the drive. Read in chunks with `File.slice`, store each cell as one IndexedDB record (store `mapcells`, key pack:cell), verify checksum, show progress. Packs stay out of the APK so the app stays small.
- Preferences: IndexedDB `kv` key `map.prefs` (layers on/off, sizes, theme, start view, zones). First run shows the "What do you want to see?" checklist with every layer's icon and description (reuse the DESC map in the mock-up). Nothing is ticked by default.
- Pins: new store `pins`, same tombstone merge as chats and stock (Replace vs Merge on import). Fields: id, lon, lat, types[], title, note, tags[], status, checkedAt, photoId, visibility, createdAt, updatedAt.
- Measure toggle and route planner share one "path" object (points, legs, distance, ascent, descent, time).
- Route planner:
  - A* over the routing graph, loaded by cell; a coarse graph of main roads for long hops, refined near ends.
  - Profiles: walk, cycle, vehicle, each with the user's own flat speed, uphill and downhill penalties, gravel factor, load factor. Avoid-zones from pins marked danger.
  - Output: distance, time, ascent and descent, surface split, daylight left, fuel use from a given consumption, per-leg table, and a day-by-day split for multi-day trips.
- Phone limits: Huawei nova 13 has no Google services assumed; GPS "you are here" must be tested without signal. Mock-up render cost on the laptop was 5 to 19 ms per frame; the phone is unmeasured, so build a frame-time readout into the first version.

## 4. Converter (laptop tool) to write
`makepacks.mjs`: reads the six downloaded `.osm.pbf` files (in `blackout-tools/mapdata/osm`) plus the terrain tiles and writes the packs above. `osm.mjs` already has the streaming PBF reader, the two-pass node method, POI extraction and the delta encoder. Still to add: junction splitting with node ids, surface/maxspeed/oneway/access tags, grid cutting, pack index and checksums.

Downloaded and verified source files (OpenStreetMap, ODbL, attribution required): South Africa, Lesotho, Eswatini, Mozambique, Botswana, Namibia from Geofabrik, plus Natural Earth and AWS Terrain Tiles.

## 5. Suggested first steps tomorrow
1. Sizo reviews v5 and answers the open questions above.
2. Security layer (design, then build).
3. Pack format and converter prototype for one area (Gauteng) with real junction topology; measure size and phone speed.
4. Map tab in the app reading that pack, first-run checklist, saved preferences.
5. Pins, then Measure toggle, then the route planner.
Each step ships as a numbered release with the usual routine (bump `bh-vN`, versionCode, repack).
