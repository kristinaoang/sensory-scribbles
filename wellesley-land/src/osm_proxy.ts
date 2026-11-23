import fs from "node:fs";
import path from "node:path";
import { buildWellesleyTowerBlueprint } from "./curated_district_relocations";
import { compileCampus, type CampusModel } from "./campus_model";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "WellesleyLandExplorer/1.0 (educational neighborhood sandbox)";

const overpassCache = new Map<string, { at: number; body: unknown }>();
const CACHE_MS = 10 * 60 * 1000;

export function getCuratedBlueprint(id: string) {
  if (id !== "c-wellesley-tower") return null;
  return buildWellesleyTowerBlueprint();
}

export async function geocodeAddress(query: string): Promise<{
  label: string;
  lat: number;
  lng: number;
} | null> {
  const q = query.trim().slice(0, 160);
  if (q.length < 2) return null;
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", q);
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{ display_name?: string; lat?: string; lon?: string }>;
  const row = rows[0];
  const lat = Number(row?.lat);
  const lng = Number(row?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { label: String(row?.display_name || q).slice(0, 180), lat, lng };
}

export async function fetchOverpassNeighborhood(lat: number, lng: number, radius: number) {
  const key = `${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}`;
  const cached = overpassCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.body;

  const query = `
[out:json][timeout:40];
(
  way["building"](around:${radius},${lat},${lng});
  way["highway"](around:${radius},${lat},${lng});
  way["natural"="water"](around:${radius},${lat},${lng});
  way["leisure"~"park|garden|pitch"](around:${radius},${lat},${lng});
  way["landuse"~"grass|forest|recreation_ground"](around:${radius},${lat},${lng});
  node["natural"="tree"](around:${radius},${lat},${lng});
  node["highway"="street_lamp"](around:${radius},${lat},${lng});
  node["amenity"="bench"](around:${radius},${lat},${lng});
);
out geom;
`.trim();

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "content-type": "text/plain; charset=utf-8",
      accept: "application/json",
      "user-agent": USER_AGENT,
    },
    body: query,
    signal: AbortSignal.timeout(55_000),
  });
  if (!response.ok) {
    throw new Error(`Overpass responded ${response.status}`);
  }
  const body = await response.json();
  overpassCache.set(key, { at: Date.now(), body });
  return body;
}

const CAMPUS_CACHE = path.resolve(process.cwd(), "data/wellesley-campus.json");
const CAMPUS_CACHE_MS = 12 * 60 * 60 * 1000;
const OSM_API = "https://api.openstreetmap.org/api/0.6";
const WELLESLEY_WAY_ID = 123423313;

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "user-agent": USER_AGENT,
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(70_000),
  });
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.json();
}

async function fetchCollegeBoundary(): Promise<{ id: string; name: string; boundary: Array<{ lat: number; lon: number }> }> {
  const body = (await fetchJson(`${OSM_API}/way/${WELLESLEY_WAY_ID}/full.json`)) as {
    elements: Array<{ type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string> }>;
  };
  const nodes = new Map<number, { lat: number; lon: number }>();
  let way: { nodes?: number[]; tags?: Record<string, string> } | null = null;
  for (const el of body.elements) {
    if (el.type === "node" && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
      nodes.set(el.id, { lat: el.lat as number, lon: el.lon as number });
    }
    if (el.type === "way") way = el;
  }
  const boundary = (way?.nodes || [])
    .map((id) => nodes.get(id))
    .filter((p): p is { lat: number; lon: number } => Boolean(p));
  if (boundary.length < 4) throw new Error("Wellesley College grounds are missing from OpenStreetMap.");
  return {
    id: `way/${WELLESLEY_WAY_ID}`,
    name: way?.tags?.name || "Wellesley College",
    boundary,
  };
}

async function fetchElevationGrid(boundary: Array<{ lat: number; lon: number }>) {
  const lats = boundary.map((p) => p.lat);
  const lons = boundary.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const cols = 6;
  const rows = 6;
  const latList: number[] = [];
  const lonList: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      latList.push(minLat + ((maxLat - minLat) * r) / (rows - 1));
      lonList.push(minLon + ((maxLon - minLon) * c) / (cols - 1));
    }
  }
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${latList.join(",")}&longitude=${lonList.join(",")}`;
  const body = (await fetchJson(url)) as { elevation?: number[] };
  const values = body.elevation || [];
  if (values.length < cols * rows) return [];
  return latList.map((lat, i) => ({
    lat,
    lon: lonList[i],
    meters: values[i],
    cols,
    rows,
  }));
}

function readCampusCache(): CampusModel | null {
  try {
    const stat = fs.statSync(CAMPUS_CACHE);
    if (Date.now() - stat.mtimeMs > CAMPUS_CACHE_MS) return null;
    const parsed = JSON.parse(fs.readFileSync(CAMPUS_CACHE, "utf8")) as CampusModel;
    if (!parsed?.buildings?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function fetchWellesleyCampus(force = false): Promise<CampusModel> {
  if (!force) {
    const cached = readCampusCache();
    if (cached) return cached;
  }
  const grounds = await fetchCollegeBoundary();
  const lats = grounds.boundary.map((p) => p.lat);
  const lons = grounds.boundary.map((p) => p.lon);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lons);
  const east = Math.max(...lons);
  const query = `
[out:json][timeout:55];
(
  way["building"](${south},${west},${north},${east});
  way["highway"](${south},${west},${north},${east});
  way["natural"="water"](${south},${west},${north},${east});
  way["natural"="wood"](${south},${west},${north},${east});
  way["landuse"="forest"](${south},${west},${north},${east});
  way["waterway"](${south},${west},${north},${east});
  node["natural"="tree"](${south},${west},${north},${east});
);
out tags geom;
`.trim();
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "content-type": "text/plain; charset=utf-8",
      accept: "application/json",
      "user-agent": USER_AGENT,
    },
    body: query,
    signal: AbortSignal.timeout(70_000),
  });
  if (!response.ok) throw new Error(`Overpass responded ${response.status}`);
  const overpass = (await response.json()) as { elements?: CampusModel extends never ? never : any[] };
  let elevationSamples: Array<{ lat: number; lon: number; meters: number; cols: number; rows: number }> = [];
  try {
    elevationSamples = await fetchElevationGrid(grounds.boundary);
  } catch {
    elevationSamples = [];
  }
  const model = compileCampus({
    name: grounds.name,
    osmId: grounds.id,
    boundary: grounds.boundary,
    elements: overpass.elements || [],
    elevationSamples,
  });
  fs.mkdirSync(path.dirname(CAMPUS_CACHE), { recursive: true });
  fs.writeFileSync(CAMPUS_CACHE, JSON.stringify(model));
  return model;
}

export async function getWellesleyCampus(): Promise<CampusModel> {
  try {
    return await fetchWellesleyCampus(false);
  } catch (err) {
    try {
      const stale = JSON.parse(fs.readFileSync(CAMPUS_CACHE, "utf8")) as CampusModel;
      if (stale?.buildings?.length) return stale;
    } catch {
      /* no cache */
    }
    throw err;
  }
}
