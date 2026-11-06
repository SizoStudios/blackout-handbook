# Map pack tools

Scripts that turn OpenStreetMap files into the `.bhmap` map packs the app imports.
They are written for the author's laptop (file paths at the top of each script) and need Node 20 or later.

- `osm.mjs` reads `.osm.pbf` files without any extra packages.
- `prep.mjs` prepares borders, rivers and towns from Natural Earth.
- `makepacks.mjs <outDir> base|roads|overview` writes the base, road and overview packs.
- `makegraph.mjs <outDir>` writes the road network for the route planner (use `node --max-old-space-size=6000`).
