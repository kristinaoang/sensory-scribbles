// Explorer Mode: OSM neighborhoods as tactile voxels.
// Buildings go through the existing greedy mesher, 4-corner AO, and fwidth bevel shader.
// Chunks are 250m. Only the chunks around the camera keep meshes, so a campus is not capped at 650 buildings.

import * as THREE from "three";
import { buildCreationGroup, buildVoxelMesh, Vox } from "./vox.js";

export const CHUNK_SIZE = 250;
export const WELLESLEY_ANCHOR = {
  label: "Wellesley College",
  lat: 42.2936,
  lng: -71.3056,
};

const METERS_PER_DEG_LAT = 111_320;
const LOAD_RADIUS_CHUNKS = 1;
const NEAR_LOD_M = 280;
const FAR_LOD_M = 520;

export const CURATED_BLUEPRINT_BY_OSM_ID: Record<string, string> = {
  // Add a confirmed way id here, for example "way/123": "c-wellesley-tower".
};

const CURATED_NAME_TESTS: { re: RegExp; blueprintId: string }[] = [
  { re: /galen|stone tower|wellesley tower|carillon/i, blueprintId: "c-wellesley-tower" },
];

export type Anchor = { label: string; lat: number; lng: number };

export type ExplorerEvent = {
  type: "visit" | "question" | "quest";
  buildingId: string;
  name: string;
  color: string;
  choice?: string;
};

export function toLocalMeters(lat: number, lng: number, anchor: Anchor) {
  const cos = Math.cos((anchor.lat * Math.PI) / 180);
  const x = (lng - anchor.lng) * cos * METERS_PER_DEG_LAT;
  const z = (anchor.lat - lat) * METERS_PER_DEG_LAT;
  return { x, z };
}

export function chunkKeyFor(x: number, z: number) {
  return `${Math.floor(x / CHUNK_SIZE)}:${Math.floor(z / CHUNK_SIZE)}`;
}

export function pointInRing(x: number, z: number, ring: Array<[number, number]>) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const zi = ring[i][1];
    const xj = ring[j][0];
    const zj = ring[j][1];
    const hit = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function buildingHeightMeters(tags: Record<string, string> = {}) {
  const height = Number.parseFloat(tags.height || "");
  if (Number.isFinite(height) && height > 2) return Math.min(48, height);
  const levels = Number.parseFloat(tags["building:levels"] || "");
  if (Number.isFinite(levels) && levels > 0) return Math.min(48, Math.max(4, levels * 3.2));
  return 9;
}

export function paletteForTags(tags: Record<string, string> = {}) {
  const material = `${tags["building:material"] || ""} ${tags.material || ""}`.toLowerCase();
  const kind = `${tags.building || ""} ${tags.amenity || ""}`.toLowerCase();
  if (/brick/.test(material) || /house|residential|apartments/.test(kind)) {
    return { wall: "brick", trim: "mortar", roof: "terracotta", flat: false };
  }
  if (/wood|timber/.test(material)) {
    return { wall: "wood", trim: "woodDark", roof: "woodDark", flat: false };
  }
  if (/stone|limestone|concrete|brick/.test(material) || /church|chapel|university|college|tower/.test(kind)) {
    return { wall: "limestone", trim: "cream", roof: "slate", flat: /tower|church/.test(kind) ? false : true };
  }
  if (/commercial|retail|office|industrial|garage|warehouse/.test(kind)) {
    return { wall: "concrete", trim: "steel", roof: "slate", flat: true };
  }
  const roof = `${tags["roof:shape"] || ""}`.toLowerCase();
  return { wall: "plaster", trim: "cream", roof: "terracotta", flat: roof === "flat" };
}

export function matchBlueprintId(osmId: string, name: string) {
  if (CURATED_BLUEPRINT_BY_OSM_ID[osmId]) return CURATED_BLUEPRINT_BY_OSM_ID[osmId];
  for (const row of CURATED_NAME_TESTS) {
    if (row.re.test(name)) {
      CURATED_BLUEPRINT_BY_OSM_ID[osmId] = row.blueprintId;
      return row.blueprintId;
    }
  }
  return null;
}

type Ring = Array<[number, number]>;

type Feature = {
  id: string;
  kind: "building" | "road" | "water" | "park" | "tree" | "lamp" | "bench";
  tags: Record<string, string>;
  ring?: Ring;
  point?: { x: number; z: number };
  name: string;
};

type BuildingRec = {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  halfX: number;
  halfZ: number;
  height: number;
  color: string;
  group: THREE.Group;
  material: THREE.MeshStandardMaterial | null;
  bubble: THREE.Sprite;
  squash: { y: number; v: number };
  hovered: boolean;
  questColor: string | null;
  visited: boolean;
  blueprintId: string | null;
};

type ChunkRec = {
  key: string;
  lod: 0 | 1;
  group: THREE.Group;
  buildings: BuildingRec[];
  blockers: Array<{ x: number; z: number; halfX: number; halfZ: number; yaw: number }>;
  waters: Ring[];
  paths: Ring[];
};

function featureCentroid(feature: Feature) {
  if (feature.point) return feature.point;
  const ring = feature.ring || [];
  let x = 0;
  let z = 0;
  const n = Math.max(1, ring.length - 1);
  for (let i = 0; i < n; i++) {
    x += ring[i][0];
    z += ring[i][1];
  }
  return { x: x / n, z: z / n };
}

function orientEntrance(ring: Ring[], paths: Ring[]) {
  const c = featureCentroid({ id: "", kind: "building", tags: {}, name: "", ring });
  let bestX = 0;
  let bestZ = 1;
  let bestD = Infinity;
  for (const path of paths) {
    for (const p of path) {
      const dx = p[0] - c.x;
      const dz = p[1] - c.z;
      const d = dx * dx + dz * dz;
      if (d < bestD && d > 4) {
        bestD = d;
        const len = Math.hypot(dx, dz) || 1;
        bestX = dx / len;
        bestZ = dz / len;
      }
    }
  }
  if (!paths.length && ring.length) {
    let minZ = Infinity;
    let doorX = c.x;
    let doorZ = c.z;
    for (const p of ring) {
      if (p[1] < minZ) {
        minZ = p[1];
        doorX = p[0];
        doorZ = p[1];
      }
    }
    const dx = doorX - c.x;
    const dz = doorZ - c.z;
    const len = Math.hypot(dx, dz) || 1;
    bestX = dx / len;
    bestZ = dz / len;
  }
  return { yaw: Math.atan2(bestX, bestZ), dirX: bestX, dirZ: bestZ, center: c };
}

function rasterBuilding(ring: Ring, tags: Record<string, string>, lod: 0 | 1) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of ring) {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minZ = Math.min(minZ, p[1]);
    maxZ = Math.max(maxZ, p[1]);
  }
  const span = Math.max(maxX - minX, maxZ - minZ, 4);
  const cell = lod === 1 ? Math.max(2.2, span / 18) : Math.max(1.05, span / 36);
  const cols = Math.max(3, Math.ceil((maxX - minX) / cell));
  const rows = Math.max(3, Math.ceil((maxZ - minZ) / cell));
  const inside: boolean[] = new Array(cols * rows).fill(false);
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const x = minX + (ix + 0.5) * cell;
      const z = minZ + (iz + 0.5) * cell;
      inside[iz * cols + ix] = pointInRing(x, z, ring);
    }
  }
  const wall: boolean[] = new Array(cols * rows).fill(false);
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const i = iz * cols + ix;
      if (!inside[i]) continue;
      let edge = ix === 0 || iz === 0 || ix === cols - 1 || iz === rows - 1;
      if (!edge) {
        edge = !inside[i - 1] || !inside[i + 1] || !inside[i - cols] || !inside[i + cols];
      }
      wall[i] = edge;
    }
  }
  const pal = paletteForTags(tags);
  const heightM = buildingHeightMeters(tags);
  const levels = Math.max(3, Math.round(heightM / cell));
  const vox = new Vox(cols * 17 + rows);
  const cx = (cols - 1) / 2;
  const cz = (rows - 1) / 2;
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      if (!wall[iz * cols + ix]) continue;
      const x = Math.round(ix - cx);
      const z = Math.round(iz - cz);
      vox.box(x, 0, z, x + 1, levels, z + 1, pal.wall);
      if (lod === 0 && levels > 4 && (ix + iz) % 3 === 0) {
        vox.box(x, 2, z, x + 1, levels - 1, z + 1, "glass", 0.25);
      }
    }
  }
  const doorZ = Math.round(rows - 1 - cz);
  vox.box(-1, 0, doorZ, 1, 3, doorZ + 1, "oak", 0.15);
  if (pal.flat || lod === 1) {
    vox.box(Math.round(-cx), levels, Math.round(-cz), Math.round(cols - cx), levels + 1, Math.round(rows - cz), pal.roof);
  } else {
    vox.roofGable(Math.round(-cx), levels, Math.round(-cz), Math.round(cols - cx), Math.round(rows - cz), Math.max(2, Math.round(Math.min(cols, rows) * 0.28)), cols >= rows ? "z" : "x", pal.roof, pal.trim);
  }
  return { vox, cell, height: heightM, pal, halfX: (maxX - minX) / 2, halfZ: (maxZ - minZ) / 2 };
}

function makeBubbleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = "rgba(255,250,240,0.96)";
  ctx.beginPath();
  ctx.moveTo(40, 18);
  ctx.arcTo(110, 18, 110, 86, 22);
  ctx.arcTo(110, 86, 18, 86, 22);
  ctx.arcTo(18, 86, 18, 18, 22);
  ctx.arcTo(18, 18, 110, 18, 22);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(58, 86);
  ctx.lineTo(48, 112);
  ctx.lineTo(78, 84);
  ctx.fill();
  ctx.fillStyle = "#2c7a4b";
  ctx.beginPath();
  ctx.arc(50, 48, 7, 0, Math.PI * 2);
  ctx.arc(78, 48, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2c7a4b";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(64, 62, 12, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePropMaterial(sway: number) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uSway = { value: sway };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uTime;
        uniform float uSway;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float wind = sin(uTime * 1.35 + instanceMatrix[3].x * 0.17 + instanceMatrix[3].z * 0.11);
        transformed.x += wind * uSway * position.y;
        transformed.z += cos(uTime * 1.1 + instanceMatrix[3].z) * uSway * 0.35 * position.y;`,
      );
    mat.userData.shader = shader;
  };
  mat.customProgramCacheKey = () => `osm-sway-${sway}`;
  return mat;
}

function propGeometry(kind: "tree" | "lamp" | "bench" | "car") {
  const vox = new Vox(kind.length);
  if (kind === "tree") {
    vox.box(0, 0, 0, 1, 4, 1, "woodDark").sphere(0.5, 5.2, 0.5, 2.2, 1.6, 2.2, "leaf");
  } else if (kind === "lamp") {
    vox.box(0, 0, 0, 1, 6, 1, "steel").put(0, 6, 0, "warmGlow", 1.1);
  } else if (kind === "bench") {
    vox.box(0, 1, 0, 3, 2, 1, "wood").box(0, 0, 0, 1, 1, 1, "steelDark").box(2, 0, 0, 3, 1, 1, "steelDark");
  } else {
    vox.box(0, 0, 0, 2, 1, 4, "slate").box(0, 1, 1, 2, 2, 3, "sky");
  }
  const mesh = buildVoxelMesh(vox, { scale: kind === "car" ? 0.55 : 0.42, castShadow: true, receiveShadow: true });
  return mesh.geometry;
}

function fillRingGeometry(ring: Ring, y: number, color: number) {
  if (ring.length < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(ring[0][0], ring[0][1]);
  for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], ring[i][1]);
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, y, 0);
  const col = new THREE.Color(color);
  const colors = new Float32Array((geo.attributes.position.count || 0) * 3);
  for (let i = 0; i < geo.attributes.position.count; i++) {
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function ribbonGeometry(lines: Ring[], width: number, y: number, color: number) {
  const positions: number[] = [];
  const colors: number[] = [];
  const col = new THREE.Color(color);
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz) || 1;
      const px = (-dz / len) * width;
      const pz = (dx / len) * width;
      const quad = [
        a[0] - px, y, a[1] - pz,
        a[0] + px, y, a[1] + pz,
        b[0] + px, y, b[1] + pz,
        a[0] - px, y, a[1] - pz,
        b[0] + px, y, b[1] + pz,
        b[0] - px, y, b[1] - pz,
      ];
      positions.push(...quad);
      for (let v = 0; v < 6; v++) colors.push(col.r, col.g, col.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function classifyElement(el: any, anchor: Anchor): Feature | null {
  const tags = (el.tags || {}) as Record<string, string>;
  const id = `${el.type || "way"}/${el.id}`;
  const name = tags.name || tags["addr:housename"] || "";
  if (el.type === "node" && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
    const point = toLocalMeters(el.lat, el.lon, anchor);
    if (tags.natural === "tree") return { id, kind: "tree", tags, point, name };
    if (tags.highway === "street_lamp") return { id, kind: "lamp", tags, point, name };
    if (tags.amenity === "bench") return { id, kind: "bench", tags, point, name };
    return null;
  }
  const geom = Array.isArray(el.geometry) ? el.geometry : null;
  if (!geom || geom.length < 2) return null;
  const ring: Ring = geom.map((p: { lat: number; lon: number }) => {
    const local = toLocalMeters(p.lat, p.lon, anchor);
    return [local.x, local.z] as [number, number];
  });
  if (tags.building) return { id, kind: "building", tags, ring, name: name || "Building" };
  if (tags.natural === "water") return { id, kind: "water", tags, ring, name };
  if (tags.leisure || tags.landuse) return { id, kind: "park", tags, ring, name };
  if (tags.highway) return { id, kind: "road", tags, ring, name };
  return null;
}

function demoFeatures(): Feature[] {
  const building: Ring = [
    [-16, -10],
    [16, -10],
    [16, 12],
    [-16, 12],
    [-16, -10],
  ];
  const road: Ring = [
    [-40, 18],
    [40, 18],
  ];
  return [
    {
      id: "way/demo-galen",
      kind: "building",
      tags: { building: "tower", name: "Galen Stone Tower", height: "28", "building:material": "stone" },
      ring: building,
      name: "Galen Stone Tower",
    },
    {
      id: "way/demo-hall",
      kind: "building",
      tags: { building: "college", "building:levels": "3", "building:material": "brick" },
      ring: [
        [24, -8],
        [48, -8],
        [48, 10],
        [24, 10],
        [24, -8],
      ],
      name: "Brick Hall",
    },
    { id: "way/demo-path", kind: "road", tags: { highway: "footway" }, ring: road, name: "" },
    { id: "node/demo-tree-1", kind: "tree", tags: {}, point: { x: -8, z: 24 }, name: "" },
    { id: "node/demo-tree-2", kind: "tree", tags: {}, point: { x: 6, z: 26 }, name: "" },
    { id: "node/demo-tree-3", kind: "tree", tags: {}, point: { x: 18, z: 23 }, name: "" },
    { id: "node/demo-lamp", kind: "lamp", tags: {}, point: { x: -20, z: 16 }, name: "" },
    { id: "node/demo-bench", kind: "bench", tags: {}, point: { x: 8, z: 15 }, name: "" },
  ];
}

export function createOsmExplorer(options: { onEvent?: (event: ExplorerEvent) => void; onStatus?: (message: string) => void } = {}) {
  const group = new THREE.Group();
  group.name = "osm-explorer";
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1400, 48),
    new THREE.MeshStandardMaterial({ color: 0x86c864, roughness: 0.92 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  ground.userData.osmKind = "ground";
  group.add(ground);

  const bubbleTex = makeBubbleTexture();
  const bubbleMat = new THREE.SpriteMaterial({ map: bubbleTex, transparent: true, depthWrite: false });
  const propGeos = {
    tree: propGeometry("tree"),
    lamp: propGeometry("lamp"),
    bench: propGeometry("bench"),
    car: propGeometry("car"),
  };
  const propMats = {
    tree: makePropMaterial(0.16),
    lamp: makePropMaterial(0.03),
    bench: makePropMaterial(0),
    car: makePropMaterial(0),
  };

  let enabled = false;
  let anchor: Anchor = { ...WELLESLEY_ANCHOR };
  let features: Feature[] = [];
  let usingDemo = false;
  const chunks = new Map<string, ChunkRec>();
  const buildings = new Map<string, BuildingRec>();
  let hoveredId: string | null = null;
  let kidWalk = false;
  const kid = { x: 0, z: 18, yaw: Math.PI, target: null as { x: number; z: number } | null };
  const focus = {
    active: false,
    t: 0,
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    look: new THREE.Vector3(),
  };
  const confetti = createConfetti();
  group.add(confetti.mesh);
  const summary = { buildingsVisited: new Set<string>(), questionsAsked: 0, questChoices: 0 };
  let blueprintCache: Promise<any> | null = null;

  function createConfetti() {
    const vox = new Vox(3);
    vox.put(0, 0, 0, "gold");
    const cube = buildVoxelMesh(vox, { scale: 0.22, castShadow: false });
    const mesh = new THREE.InstancedMesh(cube.geometry, cube.material, 36);
    mesh.count = 0;
    mesh.frustumCulled = false;
    const bits = Array.from({ length: 36 }, () => ({
      life: 0,
      p: new THREE.Vector3(),
      v: new THREE.Vector3(),
      color: new THREE.Color(),
    }));
    return { mesh, bits };
  }

  function burst(x: number, y: number, z: number) {
    const colors = ["#f4c44e", "#df5246", "#5ce6db", "#86c864", "#ec8db0"];
    confetti.mesh.count = confetti.bits.length;
    confetti.bits.forEach((bit, i) => {
      bit.life = 1.4;
      bit.p.set(x, y, z);
      bit.v.set((Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4);
      bit.color.set(colors[i % colors.length]);
    });
  }

  function status(message: string) {
    options.onStatus?.(message);
  }

  async function loadBlueprint() {
    if (!blueprintCache) {
      blueprintCache = fetch("/api/osm/blueprint?id=c-wellesley-tower")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    }
    return blueprintCache;
  }

  function disposeChunk(chunk: ChunkRec) {
    chunk.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry && mesh.userData.disposeGeo) mesh.geometry.dispose();
    });
    group.remove(chunk.group);
    for (const b of chunk.buildings) buildings.delete(b.id);
    chunks.delete(chunk.key);
  }

  function ensureChunk(key: string, lod: 0 | 1) {
    const existing = chunks.get(key);
    if (existing) {
      if (lod === 0 && existing.lod === 1) disposeChunk(existing);
      else return existing;
    }
    const [cx, cz] = key.split(":").map(Number);
    const minX = cx * CHUNK_SIZE;
    const minZ = cz * CHUNK_SIZE;
    const maxX = minX + CHUNK_SIZE;
    const maxZ = minZ + CHUNK_SIZE;
    const chunkGroup = new THREE.Group();
    chunkGroup.name = `osm-chunk-${key}`;
    const local: Feature[] = [];
    const paths: Ring[] = [];
    const waters: Ring[] = [];
    const parks: Ring[] = [];
    for (const feature of features) {
      const c = featureCentroid(feature);
      if (c.x < minX || c.x >= maxX || c.z < minZ || c.z >= maxZ) continue;
      local.push(feature);
      if (feature.kind === "road" && feature.ring) paths.push(feature.ring);
      if (feature.kind === "water" && feature.ring) waters.push(feature.ring);
      if (feature.kind === "park" && feature.ring) parks.push(feature.ring);
    }
    for (const ring of parks) {
      const geo = fillRingGeometry(ring, 0.02, 0x6fbf63);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
      mesh.userData.disposeGeo = true;
      chunkGroup.add(mesh);
    }
    for (const ring of waters) {
      const geo = fillRingGeometry(ring, 0.03, 0x4fa8de);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25 }));
      mesh.userData.disposeGeo = true;
      chunkGroup.add(mesh);
    }
    if (paths.length) {
      const mesh = new THREE.Mesh(
        ribbonGeometry(paths, 1.6, 0.05, 0xe6d6b5),
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
      );
      mesh.userData.disposeGeo = true;
      chunkGroup.add(mesh);
    }
    const counts = { tree: 0, lamp: 0, bench: 0, car: 0 };
    const matrices = {
      tree: [] as THREE.Matrix4[],
      lamp: [] as THREE.Matrix4[],
      bench: [] as THREE.Matrix4[],
      car: [] as THREE.Matrix4[],
    };
    const buildingsRec: BuildingRec[] = [];
    const blockers: ChunkRec["blockers"] = [];
    for (const feature of local) {
      if (feature.kind === "tree" || feature.kind === "lamp" || feature.kind === "bench") {
        const m = new THREE.Matrix4();
        const p = feature.point!;
        m.makeTranslation(p.x, 0, p.z);
        matrices[feature.kind].push(m);
        counts[feature.kind]++;
      } else if (feature.kind === "road" && feature.ring && /residential|service|unclassified/.test(feature.tags.highway || "")) {
        const a = feature.ring[0];
        const b = feature.ring[Math.min(feature.ring.length - 1, 2)];
        const m = new THREE.Matrix4();
        m.makeTranslation((a[0] + b[0]) / 2 + 2.2, 0, (a[1] + b[1]) / 2);
        matrices.car.push(m);
      } else if (feature.kind === "building" && feature.ring) {
        const built = addBuilding(feature, paths, lod, chunkGroup);
        if (built) {
          buildingsRec.push(built);
          buildings.set(built.id, built);
          blockers.push({ x: built.x, z: built.z, halfX: built.halfX, halfZ: built.halfZ, yaw: built.yaw });
        }
      }
    }
    (["tree", "lamp", "bench", "car"] as const).forEach((kind) => {
      const list = matrices[kind];
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(propGeos[kind], propMats[kind], list.length);
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = kind !== "bench";
      mesh.receiveShadow = true;
      chunkGroup.add(mesh);
    });
    group.add(chunkGroup);
    const rec: ChunkRec = { key, lod, group: chunkGroup, buildings: buildingsRec, blockers, waters, paths };
    chunks.set(key, rec);
    return rec;
  }

  function addBuilding(feature: Feature, paths: Ring[], lod: 0 | 1, parent: THREE.Group): BuildingRec | null {
    if (!feature.ring) return null;
    const facing = orientEntrance(feature.ring, paths);
    const raster = rasterBuilding(feature.ring, feature.tags, lod);
    const holder = new THREE.Group();
    holder.position.set(facing.center.x, 0, facing.center.z);
    holder.rotation.y = facing.yaw;
    holder.userData.osmId = feature.id;
    const blueprintId = matchBlueprintId(feature.id, feature.name);
    let material: THREE.MeshStandardMaterial | null = null;
    if (!blueprintId) {
      const mesh = buildVoxelMesh(raster.vox, { scale: raster.cell, castShadow: true, receiveShadow: true });
      material = (mesh.material as THREE.MeshStandardMaterial).clone();
      mesh.material = material;
      mesh.userData.osmId = feature.id;
      holder.add(mesh);
    }
    const bubble = new THREE.Sprite(bubbleMat);
    bubble.position.set(0, raster.height + 1.4, 0);
    bubble.scale.set(1.8, 1.8, 1.8);
    bubble.userData.osmId = feature.id;
    holder.add(bubble);
    parent.add(holder);
    const rec: BuildingRec = {
      id: feature.id,
      name: feature.name || "Building",
      x: facing.center.x,
      z: facing.center.z,
      yaw: facing.yaw,
      halfX: Math.max(2, raster.halfX),
      halfZ: Math.max(2, raster.halfZ),
      height: raster.height,
      color: raster.pal.wall,
      group: holder,
      material,
      bubble,
      squash: { y: 1, v: 0 },
      hovered: false,
      questColor: null,
      visited: false,
      blueprintId,
    };
    holder.userData.hooks = {
      setQuestColor(hex: string) {
        rec.questColor = hex;
        if (material) {
          material.emissive.set(hex);
          material.emissiveIntensity = 0.55;
        }
      },
      clearQuestColor() {
        rec.questColor = null;
        if (material) {
          material.emissive.set(0x000000);
          material.emissiveIntensity = 0;
        }
      },
      getPalette: () => raster.pal,
    };
    if (blueprintId) void attachBlueprint(rec, raster.height);
    return rec;
  }

  async function attachBlueprint(rec: BuildingRec, fallbackHeight: number) {
    const blueprint = await loadBlueprint();
    if (!blueprint || !buildings.has(rec.id)) return;
    const existing = rec.group.children.find((child) => (child as THREE.Mesh).isMesh);
    if (existing) rec.group.remove(existing);
    const built = buildCreationGroup(blueprint, { seed: 7, useWorldScale: true });
    built.traverse((obj) => {
      obj.userData.osmId = rec.id;
    });
    rec.group.add(built);
    rec.bubble.position.y = Math.max(fallbackHeight, 16) + 1.6;
    const mesh = built.children.find((child) => (child as THREE.Mesh).isMesh) as THREE.Mesh | undefined;
    if (mesh && !Array.isArray(mesh.material)) {
      rec.material = (mesh.material as THREE.MeshStandardMaterial).clone();
      mesh.material = rec.material;
    }
  }

  function blocked(x: number, z: number) {
    for (const chunk of chunks.values()) {
      for (const box of chunk.blockers) {
        const dx = x - box.x;
        const dz = z - box.z;
        const cos = Math.cos(-box.yaw);
        const sin = Math.sin(-box.yaw);
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        if (Math.abs(lx) < box.halfX + 0.45 && Math.abs(lz) < box.halfZ + 0.45) return true;
      }
      for (const water of chunk.waters) {
        if (pointInRing(x, z, water)) return true;
      }
    }
    return false;
  }

  function resolveWalk(x: number, z: number): [number, number] {
    if (!blocked(x, z)) return [x, z];
    if (!blocked(x, kid.z)) return [x, kid.z];
    if (!blocked(kid.x, z)) return [kid.x, z];
    return [kid.x, kid.z];
  }

  function syncChunks(focusX: number, focusZ: number) {
    const cx = Math.floor(focusX / CHUNK_SIZE);
    const cz = Math.floor(focusZ / CHUNK_SIZE);
    const keep = new Set<string>();
    for (let iz = -LOAD_RADIUS_CHUNKS; iz <= LOAD_RADIUS_CHUNKS; iz++) {
      for (let ix = -LOAD_RADIUS_CHUNKS; ix <= LOAD_RADIUS_CHUNKS; ix++) {
        const key = `${cx + ix}:${cz + iz}`;
        const dist = Math.hypot((cx + ix + 0.5) * CHUNK_SIZE - focusX, (cz + iz + 0.5) * CHUNK_SIZE - focusZ);
        if (dist > FAR_LOD_M + CHUNK_SIZE) continue;
        keep.add(key);
        ensureChunk(key, dist > NEAR_LOD_M ? 1 : 0);
      }
    }
    for (const key of chunks.keys()) {
      if (!keep.has(key)) disposeChunk(chunks.get(key)!);
    }
  }

  function step(dt: number, focusX: number, focusZ: number, t: number) {
    if (!enabled) return;
    const time = t;
    for (const mat of Object.values(propMats)) {
      const shader = mat.userData.shader;
      if (shader) shader.uniforms.uTime.value = time;
    }
    for (const building of buildings.values()) {
      building.squash.v += (1 - building.squash.y) * 42 * dt;
      building.squash.v *= Math.exp(-7.5 * dt);
      building.squash.y += building.squash.v * dt;
      const s = Math.max(0.84, building.squash.y);
      building.group.scale.set(1 + (1 - s) * 0.28, s, 1 + (1 - s) * 0.28);
      building.bubble.position.y += Math.sin(time * 2.2 + building.x) * 0.002;
      if (building.material && (building.hovered || building.questColor)) {
        const pulse = 0.28 + Math.sin(time * 6.2) * 0.16;
        building.material.emissiveIntensity = building.questColor ? 0.45 + pulse : pulse;
      }
    }
    if (confetti.mesh.count) {
      const dummy = new THREE.Object3D();
      let alive = 0;
      confetti.bits.forEach((bit) => {
        if (bit.life <= 0) return;
        bit.life -= dt;
        bit.v.y -= 9 * dt;
        bit.p.addScaledVector(bit.v, dt);
        if (bit.p.y < 0.2) bit.life = 0;
        if (bit.life <= 0) return;
        dummy.position.copy(bit.p);
        dummy.rotation.y += dt;
        dummy.scale.setScalar(Math.max(0.2, bit.life));
        dummy.updateMatrix();
        confetti.mesh.setMatrixAt(alive, dummy.matrix);
        confetti.mesh.setColorAt(alive, bit.color);
        alive++;
      });
      confetti.mesh.count = alive;
      confetti.mesh.instanceMatrix.needsUpdate = true;
      if (confetti.mesh.instanceColor) confetti.mesh.instanceColor.needsUpdate = true;
    }
    if (focus.active) {
      focus.t = Math.min(1, focus.t + dt / 1.15);
    }
    syncChunks(kidWalk ? kid.x : focusX, kidWalk ? kid.z : focusZ);
  }

  function stepKid(dt: number) {
    if (!kid.target) return { ...kid, moving: false };
    let tx = kid.target.x;
    let tz = kid.target.z;
    let best = Infinity;
    for (const chunk of chunks.values()) {
      for (const path of chunk.paths) {
        for (const p of path) {
          const d = (p[0] - kid.x) ** 2 + (p[1] - kid.z) ** 2;
          if (d < 36 && d < best) {
            best = d;
            const pull = 0.35;
            tx = tx * (1 - pull) + p[0] * pull;
            tz = tz * (1 - pull) + p[1] * pull;
          }
        }
      }
    }
    const dx = tx - kid.x;
    const dz = tz - kid.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.35) {
      kid.target = null;
      return { ...kid, moving: false };
    }
    const stepLen = Math.min(dist, 2.15 * dt);
    const nx = kid.x + (dx / dist) * stepLen;
    const nz = kid.z + (dz / dist) * stepLen;
    const resolved = resolveWalk(nx, nz);
    kid.x = resolved[0];
    kid.z = resolved[1];
    kid.yaw = Math.atan2(dx, dz);
    return { x: kid.x, z: kid.z, yaw: kid.yaw, moving: true };
  }

  function pick(raycaster: THREE.Raycaster) {
    const hits = raycaster.intersectObjects(group.children, true);
    for (const hit of hits) {
      let cur: THREE.Object3D | null = hit.object;
      while (cur) {
        const id = cur.userData?.osmId as string | undefined;
        if (id && buildings.has(id)) {
          const building = buildings.get(id)!;
          return { kind: "building" as const, id, name: building.name, point: hit.point, building };
        }
        if (cur.userData?.osmKind === "ground") {
          return { kind: "ground" as const, id: "ground", name: "", point: hit.point, building: null };
        }
        cur = cur.parent;
      }
    }
    return null;
  }

  function setHovered(id: string | null) {
    if (hoveredId && buildings.has(hoveredId)) {
      const prev = buildings.get(hoveredId)!;
      prev.hovered = false;
      if (prev.material && !prev.questColor) prev.material.emissiveIntensity = 0;
    }
    hoveredId = id;
    if (id && buildings.has(id)) {
      const next = buildings.get(id)!;
      next.hovered = true;
      if (next.material) next.material.emissive.set(0xfff1c4);
    }
  }

  function tap(id: string) {
    const building = buildings.get(id);
    if (!building) return null;
    building.squash.v = -3.4;
    const first = !building.visited;
    building.visited = true;
    if (first) {
      summary.buildingsVisited.add(id);
      burst(building.x, building.height * 0.7, building.z);
      options.onEvent?.({ type: "visit", buildingId: id, name: building.name, color: building.color });
    } else {
      summary.questionsAsked += 1;
      options.onEvent?.({ type: "question", buildingId: id, name: building.name, color: building.color });
    }
    if (building.questColor) {
      summary.questChoices += 1;
      options.onEvent?.({
        type: "quest",
        buildingId: id,
        name: building.name,
        color: building.questColor,
        choice: building.questColor,
      });
    }
    const forwardX = Math.sin(building.yaw);
    const forwardZ = Math.cos(building.yaw);
    const dist = Math.max(building.halfX, building.halfZ) + 8;
    focus.active = true;
    focus.t = 0;
    focus.to.set(building.x + forwardX * dist, 2.4, building.z + forwardZ * dist);
    focus.look.set(building.x, Math.min(6, building.height * 0.45), building.z);
    const greet = first
      ? `${building.name} waves hello.`
      : `${building.name} is ready to show you around.`;
    return { greet, building };
  }

  function getFocusFrame() {
    if (!focus.active) return null;
    const k = focus.t * focus.t * (3 - 2 * focus.t);
    if (focus.t >= 1 && !kidWalk) {
      return { position: focus.to.clone(), lookAt: focus.look.clone(), done: true };
    }
    return {
      position: focus.to.clone().multiplyScalar(k).add(focus.from.clone().multiplyScalar(1 - k)),
      lookAt: focus.look.clone(),
      done: focus.t >= 1,
    };
  }

  function noteCamera(camera: THREE.Camera) {
    if (focus.t === 0) focus.from.copy(camera.position);
  }

  async function enter(input: { address?: string; lat?: number; lng?: number; label?: string }) {
    usingDemo = false;
    let next = { ...WELLESLEY_ANCHOR };
    if (Number.isFinite(input.lat) && Number.isFinite(input.lng)) {
      next = { label: input.label || input.address || "Chosen place", lat: input.lat as number, lng: input.lng as number };
    } else if (input.address && input.address.trim()) {
      status("Finding that address…");
      const response = await fetch(`/api/osm/geocode?q=${encodeURIComponent(input.address.trim())}`);
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.lat) {
        status(body?.error || "That address could not be found.");
        return { ok: false, message: body?.error || "Address not found." };
      }
      next = { label: body.label || input.address, lat: body.lat, lng: body.lng };
    }
    anchor = next;
    status(`Loading ${anchor.label}…`);
    try {
      const response = await fetch(`/api/osm/overpass?lat=${anchor.lat}&lng=${anchor.lng}&radius=420`);
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Map data failed.");
      features = (body.elements || []).map((el: any) => classifyElement(el, anchor)).filter(Boolean) as Feature[];
      if (!features.some((f) => f.kind === "building")) throw new Error("No buildings in that neighborhood.");
      status(`${anchor.label} is ready to explore.`);
    } catch (err) {
      features = demoFeatures();
      usingDemo = true;
      status("Live map data did not load. Showing a small Wellesley sample you can still tap.");
      console.warn(err);
    }
    for (const key of [...chunks.keys()]) disposeChunk(chunks.get(key)!);
    buildings.clear();
    kid.x = 0;
    kid.z = 18;
    kid.target = null;
    enabled = true;
    group.visible = true;
    syncChunks(0, 0);
    return { ok: true, message: usingDemo ? "Sample campus is on." : `Exploring ${anchor.label}.`, anchor, demo: usingDemo };
  }

  return {
    group,
    isEnabled: () => enabled,
    isDemo: () => usingDemo,
    isKidWalk: () => kidWalk,
    setKidWalk(on: boolean) {
      kidWalk = on && enabled;
      return kidWalk;
    },
    setMoveTarget(x: number, z: number) {
      kid.target = { x, z };
    },
    getKidPose: () => ({ x: kid.x, z: kid.z, yaw: kid.yaw }),
    enter,
    step,
    stepKid,
    resolveWalk,
    pick,
    setHovered,
    tap,
    noteCamera,
    getFocusFrame() {
      const frame = getFocusFrame();
      if (frame?.done) focus.active = false;
      return frame;
    },
    clearFocus() {
      focus.active = false;
    },
    setQuestColor(id: string, hex: string) {
      buildings.get(id)?.group.userData.hooks?.setQuestColor(hex);
    },
    getSummary: () => ({
      buildingsVisited: summary.buildingsVisited.size,
      questionsAsked: summary.questionsAsked,
      questChoices: summary.questChoices,
      anchor,
      demo: usingDemo,
    }),
    exit() {
      enabled = false;
      kidWalk = false;
      focus.active = false;
      group.visible = false;
    },
  };
}
