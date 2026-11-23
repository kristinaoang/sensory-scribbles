// Turns an OpenStreetMap university/college grounds extract into one compact campus.
// Heights follow the map when it has them, then a floor count, then a type estimate.

export type BuildingKind = "academic" | "housing" | "sports" | "worship" | "service" | "other";
export type RoofShape = "flat" | "pitched" | "dome";
export type HeightSource = "tag" | "levels" | "estimate" | "correction";

export type CampusBuilding = {
  id: string;
  name: string;
  kind: BuildingKind;
  roof: RoofShape;
  heightM: number;
  heightSource: HeightSource;
  areaM2: number;
  ring: Array<[number, number]>;
};

export type CampusModel = {
  name: string;
  osmId: string;
  fetchedAt: string;
  heightsEstimated: boolean;
  note: string;
  buildings: CampusBuilding[];
  roads: Array<{ kind: "road" | "path"; line: Array<[number, number]> }>;
  water: Array<{ name: string; ring: Array<[number, number]> }>;
  streams: Array<{ name: string; line: Array<[number, number]> }>;
  trees: Array<[number, number]>;
  woods: Array<Array<[number, number]>>;
  elevation: {
    cols: number;
    rows: number;
    minX: number;
    minZ: number;
    stepX: number;
    stepZ: number;
    values: number[];
  } | null;
};

type LatLon = { lat: number; lon: number };
type XZ = [number, number];

const MIN_HEIGHT = 3;
const MAX_HEIGHT = 150;
const MAX_BUILDINGS = 650;
const METERS_PER_DEG_LAT = 111_320;

const HEIGHT_CORRECTIONS: Array<{ test: RegExp; meters: number }> = [
  { test: /galen stone tower/i, meters: 55.5 },
  { test: /houghton chapel/i, meters: 22 },
  { test: /whitin observatory/i, meters: 15 },
];

export function clampHeight(meters: number) {
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, meters));
}

export function parseExplicitHeight(raw?: string | null): number | null {
  if (!raw) return null;
  const text = raw.trim().toLowerCase();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  let value = Number(match[0]);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (/(ft|feet|foot|')/.test(text)) value *= 0.3048;
  return value;
}

export function classifyBuilding(tags: Record<string, string>, name: string): BuildingKind {
  const building = `${tags.building || ""}`.toLowerCase();
  const amenity = `${tags.amenity || ""}`.toLowerCase();
  const label = name.toLowerCase();
  if (/church|chapel|cathedral/.test(building) || amenity === "place_of_worship" || /chapel|church/.test(label)) {
    return "worship";
  }
  if (
    /stadium|sports_hall|sports_centre|grandstand/.test(building) ||
    amenity === "sports_centre" ||
    /sports center|gymnasium|field house/.test(label)
  ) {
    return "sports";
  }
  if (
    /garage|garages|shed|carport|parking/.test(building) ||
    amenity === "parking" ||
    /parking|garage|shed|physical plant|service/.test(label)
  ) {
    return "service";
  }
  if (
    /dormitory|apartments|residential|house|detached|terrace|bungalow|semidetached/.test(building) ||
    /dorm|house|residence/.test(label)
  ) {
    return "housing";
  }
  if (
    /university|college|school|public|civic|office|greenhouse|observatory|train_station|kindergarten/.test(building) ||
    /hall|center|centre|library|observatory|greenhouse/.test(label)
  ) {
    return "academic";
  }
  return "other";
}

export function defaultHeightForKind(kind: BuildingKind) {
  if (kind === "academic") return 14;
  if (kind === "housing") return 13;
  if (kind === "sports") return 15;
  if (kind === "worship") return 18;
  if (kind === "service") return 8;
  return 11;
}

export function chooseRoof(tags: Record<string, string>, name: string, kind: BuildingKind): RoofShape {
  const shape = `${tags["roof:shape"] || tags["building:roof:shape"] || ""}`.toLowerCase();
  if (/dome|onion/.test(shape) || /observatory/.test(name)) return "dome";
  if (/flat|skillion/.test(shape)) return "flat";
  if (/gabled|gable|hipped|pitched|pyramidal|gambrel|half-hipped|round/.test(shape)) {
    return /round/.test(shape) ? "dome" : "pitched";
  }
  if (kind === "sports" || kind === "service") return "flat";
  return "pitched";
}

export function estimateBuildingHeight(
  tags: Record<string, string>,
  areaM2: number,
  name: string,
): { heightM: number; heightSource: HeightSource; kind: BuildingKind; roof: RoofShape } {
  const kind = classifyBuilding(tags, name);
  const roof = chooseRoof(tags, name, kind);
  const correction = HEIGHT_CORRECTIONS.find((row) => row.test.test(name));
  if (correction) {
    return { heightM: clampHeight(correction.meters), heightSource: "correction", kind, roof };
  }
  const explicit = parseExplicitHeight(tags.height || tags["building:height"]);
  if (explicit) {
    return { heightM: clampHeight(explicit), heightSource: "tag", kind, roof };
  }
  const levels = Number.parseFloat(tags["building:levels"] || "");
  if (Number.isFinite(levels) && levels > 0) {
    const roofLevels = Number.parseFloat(tags["roof:levels"] || tags["building:levels:roof"] || "");
    const roofs = Number.isFinite(roofLevels) && roofLevels > 0 ? roofLevels : 0;
    return { heightM: clampHeight(levels * 3.6 + 1.5 + roofs * 2.5), heightSource: "levels", kind, roof };
  }
  let estimate = defaultHeightForKind(kind);
  if (areaM2 > 0 && areaM2 < 200) estimate *= 0.7;
  return { heightM: clampHeight(estimate), heightSource: "estimate", kind, roof };
}

export function ringArea(ring: XZ[]) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(sum) / 2;
}

export function pointInRing(x: number, z: number, ring: XZ[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const zi = ring[i][1];
    const xj = ring[j][0];
    const zj = ring[j][1];
    const hit = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi || 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function closeRing(ring: XZ[]): XZ[] {
  if (ring.length < 2) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.4) ring = [...ring, [a[0], a[1]]];
  return ring;
}

function decimate(line: XZ[], minStep: number, maxPoints: number): XZ[] {
  if (line.length <= 2) return line;
  const out: XZ[] = [line[0]];
  for (let i = 1; i < line.length - 1; i++) {
    const prev = out[out.length - 1];
    if (Math.hypot(line[i][0] - prev[0], line[i][1] - prev[1]) >= minStep) out.push(line[i]);
  }
  out.push(line[line.length - 1]);
  if (out.length <= maxPoints) return out;
  const step = Math.ceil(out.length / maxPoints);
  const slim = out.filter((_, i) => i % step === 0);
  const last = out[out.length - 1];
  if (slim[slim.length - 1] !== last) slim.push(last);
  return slim;
}

function toLocal(lat: number, lon: number, anchorLat: number, anchorLon: number): XZ {
  const cos = Math.cos((anchorLat * Math.PI) / 180);
  const x = (lon - anchorLon) * cos * METERS_PER_DEG_LAT;
  const z = (anchorLat - lat) * METERS_PER_DEG_LAT;
  return [x, z];
}

function geometryOf(el: { geometry?: Array<{ lat: number; lon: number }> }) {
  return Array.isArray(el.geometry) ? el.geometry : [];
}

function shiftAll(model: CampusModel, dx: number, dz: number) {
  const move = (ring: XZ[]) => ring.map(([x, z]) => [round1(x - dx), round1(z - dz)] as XZ);
  for (const building of model.buildings) building.ring = move(building.ring);
  for (const road of model.roads) road.line = move(road.line);
  for (const water of model.water) water.ring = move(water.ring);
  for (const stream of model.streams) stream.line = move(stream.line);
  for (const wood of model.woods) {
    for (let i = 0; i < wood.length; i++) wood[i] = [round1(wood[i][0] - dx), round1(wood[i][1] - dz)];
  }
  model.trees = model.trees.map(([x, z]) => [round1(x - dx), round1(z - dz)]);
  if (model.elevation) {
    model.elevation.minX = round1(model.elevation.minX - dx);
    model.elevation.minZ = round1(model.elevation.minZ - dz);
  }
}

function addGalenStoneTower(buildings: CampusBuilding[]) {
  if (buildings.some((b) => /galen stone tower/i.test(b.name))) return;
  const green = buildings.find((b) => /green hall/i.test(b.name));
  if (!green) return;
  let west = green.ring[0];
  for (const p of green.ring) if (p[0] < west[0]) west = p;
  const s = 7;
  const ring: XZ[] = [
    [round1(west[0] - s), round1(west[1] - s)],
    [round1(west[0] + s), round1(west[1] - s)],
    [round1(west[0] + s), round1(west[1] + s)],
    [round1(west[0] - s), round1(west[1] + s)],
    [round1(west[0] - s), round1(west[1] - s)],
  ];
  buildings.push({
    id: "manual/galen-stone-tower",
    name: "Galen Stone Tower",
    kind: "academic",
    roof: "pitched",
    heightM: 55.5,
    heightSource: "correction",
    areaM2: 196,
    ring,
  });
}

export function compileCampus(input: {
  name: string;
  osmId: string;
  boundary: LatLon[];
  elements: Array<{ type?: string; id?: number; lat?: number; lon?: number; tags?: Record<string, string>; geometry?: LatLon[] }>;
  elevationSamples?: Array<{ lat: number; lon: number; meters: number; cols?: number; rows?: number }>;
}): CampusModel {
  const boundary = input.boundary.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  const anchorLat = boundary.reduce((s, p) => s + p.lat, 0) / Math.max(1, boundary.length);
  const anchorLon = boundary.reduce((s, p) => s + p.lon, 0) / Math.max(1, boundary.length);
  const boundaryRing = closeRing(boundary.map((p) => toLocal(p.lat, p.lon, anchorLat, anchorLon)));
  const inside = (x: number, z: number) => pointInRing(x, z, boundaryRing);

  const buildings: CampusBuilding[] = [];
  const roads: CampusModel["roads"] = [];
  const water: CampusModel["water"] = [];
  const streams: CampusModel["streams"] = [];
  const trees: XZ[] = [];
  const woods: XZ[][] = [];

  for (const el of input.elements) {
    const tags = el.tags || {};
    const id = `${el.type || "way"}/${el.id ?? "x"}`;
    if (el.type === "node" && tags.natural === "tree" && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
      const [x, z] = toLocal(el.lat as number, el.lon as number, anchorLat, anchorLon);
      if (inside(x, z)) trees.push([round1(x), round1(z)]);
      continue;
    }
    const geom = geometryOf(el);
    if (geom.length < 2) continue;
    const local = geom.map((p) => toLocal(p.lat, p.lon, anchorLat, anchorLon));
    const insideCount = local.filter(([x, z]) => inside(x, z)).length;
    if (tags.building) {
      if (geom.length < 3 || insideCount < 1) continue;
      const ring = decimate(closeRing(local), 1.5, 80);
      const area = ringArea(ring);
      if (area < 12) continue;
      const name = tags.name || tags["addr:housename"] || "Campus building";
      const sized = estimateBuildingHeight(tags, area, name);
      buildings.push({
        id,
        name,
        kind: sized.kind,
        roof: sized.roof,
        heightM: round1(sized.heightM),
        heightSource: sized.heightSource,
        areaM2: Math.round(area),
        ring: ring.map(([x, z]) => [round1(x), round1(z)]),
      });
      continue;
    }
    if (tags.highway && !/proposed|construction|raceway|bridleway/.test(tags.highway)) {
      if (insideCount < 2) continue;
      const kind = /footway|path|pedestrian|steps|cycleway|track/.test(tags.highway) ? "path" : "road";
      const line = decimate(local, kind === "path" ? 5 : 8, 48).map(([x, z]) => [round1(x), round1(z)] as XZ);
      if (line.length >= 2) roads.push({ kind, line });
      continue;
    }
    if ((tags.natural === "wood" || tags.landuse === "forest") && geom.length >= 3 && insideCount >= 3) {
      woods.push(decimate(closeRing(local), 8, 40).map(([x, z]) => [round1(x), round1(z)]));
      continue;
    }
    const closed =
      geom.length >= 4 &&
      Math.hypot(geom[0].lat - geom[geom.length - 1].lat, geom[0].lon - geom[geom.length - 1].lon) < 0.0002;
    if ((tags.natural === "water" || tags.water === "lake" || tags.water === "pond") && closed && insideCount >= 3) {
      water.push({
        name: tags.name || "Water",
        ring: decimate(closeRing(local), 6, 160).map(([x, z]) => [round1(x), round1(z)]),
      });
      continue;
    }
    if (tags.waterway && insideCount >= 2) {
      const line = decimate(local.filter(([x, z]) => inside(x, z)), 7, 40).map(([x, z]) => [round1(x), round1(z)] as XZ);
      if (line.length >= 2) streams.push({ name: tags.name || "Brook", line });
    }
  }

  addGalenStoneTower(buildings);
  buildings.sort((a, b) => b.areaM2 - a.areaM2);
  const kept = buildings
    .map((b) => {
      let x = 0;
      let z = 0;
      const n = Math.max(1, b.ring.length - 1);
      for (let i = 0; i < n; i++) {
        x += b.ring[i][0];
        z += b.ring[i][1];
      }
      return { b, d: (x / n) ** 2 + (z / n) ** 2 };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_BUILDINGS)
    .map((row) => row.b);

  let elevation: CampusModel["elevation"] = null;
  const samples = input.elevationSamples || [];
  if (samples.length >= 4) {
    const cols = samples[0].cols || Math.round(Math.sqrt(samples.length));
    const rows = samples[0].rows || Math.round(samples.length / Math.max(1, cols));
    const projected = samples.slice(0, cols * rows).map((s) => {
      const [x, z] = toLocal(s.lat, s.lon, anchorLat, anchorLon);
      return { x, z, meters: s.meters };
    });
    const origin = projected[0];
    const east = projected[Math.min(projected.length - 1, cols - 1)];
    const south = projected[Math.min(projected.length - 1, (rows - 1) * cols)];
    const base = Math.min(...projected.map((p) => p.meters));
    elevation = {
      cols,
      rows,
      minX: round1(origin.x),
      minZ: round1(origin.z),
      stepX: round1((east.x - origin.x) / Math.max(1, cols - 1)),
      stepZ: round1((south.z - origin.z) / Math.max(1, rows - 1)),
      values: projected.map((p) => round1(p.meters - base)),
    };
  }

  const model: CampusModel = {
    name: input.name,
    osmId: input.osmId,
    fetchedAt: new Date().toISOString(),
    heightsEstimated: kept.some((b) => b.heightSource === "estimate"),
    note: "Heights are estimated where OpenStreetMap has none.",
    buildings: kept,
    roads,
    water,
    streams,
    trees: trees.slice(0, 80),
    woods: woods.slice(0, 12),
    elevation,
  };

  let cx = 0;
  let cz = 0;
  let count = 0;
  for (const b of kept) {
    const n = Math.max(1, b.ring.length - 1);
    for (let i = 0; i < n; i++) {
      cx += b.ring[i][0];
      cz += b.ring[i][1];
      count++;
    }
  }
  if (count > 0) {
    cx /= count;
    cz /= count;
  }
  shiftAll(model, cx, cz);
  return model;
}
