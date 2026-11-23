// Wellesley College academic quad from the remix campus map,
// drawn as detailed New England collegiate halls: red brick, cream trim,
// slate roofs, copper cupolas, and fall maples.
// Layout coordinates come from the remix fallback campus.

import * as THREE from "three";
import { Vox, buildVoxelMesh } from "./vox.js";

const CENTER_LAT = 42.2936;
const CENTER_LON = -71.3058;
const SCALE = 0.27;
const CELL = 0.5;

const LANDMARKS = [
  { id: 9101, name: "Galen Stone Tower", kind: "tower", lat: 42.2922, lon: -71.3083, dLat: 0.00018, dLon: 0.00018, floors: 8 },
  { id: 9102, name: "Tower Court", kind: "stone", lat: 42.2923, lon: -71.3087, dLat: 0.00042, dLon: 0.00032, floors: 4 },
  { id: 9103, name: "Severance Hall", kind: "brick", lat: 42.2926, lon: -71.3074, dLat: 0.00028, dLon: 0.00035, floors: 4 },
  { id: 9104, name: "Claflin Hall", kind: "brick", lat: 42.2929, lon: -71.3088, dLat: 0.00032, dLon: 0.00026, floors: 4 },
  { id: 9105, name: "Green Hall", kind: "brick", lat: 42.2935, lon: -71.306, dLat: 0.00024, dLon: 0.00034, floors: 4 },
  { id: 9106, name: "Pendleton Hall", kind: "brick", lat: 42.2939, lon: -71.3054, dLat: 0.00022, dLon: 0.00038, floors: 3 },
  { id: 9107, name: "Founders Hall", kind: "brick", lat: 42.2943, lon: -71.3061, dLat: 0.00024, dLon: 0.00034, floors: 3 },
  { id: 9108, name: "Jewett Arts Center", kind: "brick", lat: 42.2935, lon: -71.3073, dLat: 0.00026, dLon: 0.00032, floors: 3 },
  { id: 9109, name: "Houghton Memorial Chapel", kind: "chapel", lat: 42.2943, lon: -71.3073, dLat: 0.00022, dLon: 0.00024, floors: 3 },
  { id: 9110, name: "Margaret Clapp Library", kind: "brick", lat: 42.2946, lon: -71.3051, dLat: 0.0003, dLon: 0.00038, floors: 4 },
  { id: 9111, name: "Wellesley Science Center", kind: "brick", lat: 42.295, lon: -71.3036, dLat: 0.00042, dLon: 0.00048, floors: 4 },
  { id: 9112, name: "Lulu Chow Wang Campus Center", kind: "brick", lat: 42.2951, lon: -71.3068, dLat: 0.0003, dLon: 0.00042, floors: 3 },
  { id: 9113, name: "Stone-Davis Hall", kind: "brick", lat: 42.2927, lon: -71.3033, dLat: 0.00028, dLon: 0.00036, floors: 4 },
  { id: 9114, name: "Bates Hall", kind: "brick", lat: 42.2938, lon: -71.3018, dLat: 0.00028, dLon: 0.00036, floors: 4 },
  { id: 9115, name: "Freeman Hall", kind: "brick", lat: 42.2945, lon: -71.3022, dLat: 0.00026, dLon: 0.00034, floors: 4 },
];

const PATHS = [
  [[42.2923, -71.3083], [42.2935, -71.3066], [42.2945, -71.3056], [42.2951, -71.3038]],
  [[42.2942, -71.3073], [42.2936, -71.3058], [42.2928, -71.3033], [42.2938, -71.3018]],
  [[42.2968, -71.3068], [42.2954, -71.3064], [42.294, -71.3065], [42.2928, -71.3077], [42.2924, -71.3088]],
];

const LAKE = [
  [42.2904, -71.3112],
  [42.2896, -71.3088],
  [42.2892, -71.3062],
  [42.2898, -71.3044],
  [42.291, -71.3052],
  [42.2914, -71.3084],
  [42.2908, -71.3106],
];

function project(lat, lon) {
  const cos = Math.cos((CENTER_LAT * Math.PI) / 180);
  const x = (lon - CENTER_LON) * cos * 111320 * SCALE;
  const z = (CENTER_LAT - lat) * 111320 * SCALE;
  return [x, z];
}

function spanMeters(dLat, dLon) {
  const cos = Math.cos((CENTER_LAT * Math.PI) / 180);
  return [Math.max(8, dLat * 2 * 111320 * SCALE), Math.max(7, dLon * 2 * cos * 111320 * SCALE)];
}

function buildHall(spec) {
  const v = new Vox(spec.id);
  const stone = spec.kind === "tower" || spec.kind === "chapel" || spec.kind === "stone";
  const wall = stone ? "limestone" : "brick";
  const course = stone ? "cream" : "brick2";
  const trim = "cream";
  const hw = Math.max(5, Math.round(spec.w / 2 / CELL));
  const hd = Math.max(4, Math.round(spec.d / 2 / CELL));
  const story = 3;
  const H = spec.floors * story + 1;

  v.box(-hw - 1, 0, -hd - 1, hw + 1, 1, hd + 1, "stone");
  for (let y = 1; y < H; y++) {
    const col = y % 4 === 0 ? course : wall;
    v.box(-hw, y, -hd, hw, y + 1, -hd + 1, col);
    v.box(-hw, y, hd - 1, hw, y + 1, hd, col);
    v.box(-hw, y, -hd, -hw + 1, y + 1, hd, col);
    v.box(hw - 1, y, -hd, hw, y + 1, hd, col);
  }
  const corners = [
    [-hw, -hd],
    [hw - 1, -hd],
    [-hw, hd - 1],
    [hw - 1, hd - 1],
  ];
  for (const [x, z] of corners) v.box(x, 1, z, x + 1, H, z + 1, trim);

  for (let s = 0; s < spec.floors; s++) {
    const y0 = 2 + s * story;
    for (let x = -hw + 2; x <= hw - 2; x += 2) {
      v.put(x, y0, -hd, "glass", 0.2);
      v.put(x, y0 + 1, -hd, "glass", 0.16);
      v.put(x, y0 - 1, -hd, trim);
      if (y0 + 2 < H) v.put(x, y0 + 2, -hd, trim);
      v.put(x, y0, hd - 1, "glass", 0.2);
      v.put(x, y0 + 1, hd - 1, "glass", 0.16);
    }
    for (let z = -hd + 2; z <= hd - 2; z += 2) {
      v.put(-hw, y0, z, "glass", 0.18);
      v.put(-hw, y0 + 1, z, "glass", 0.14);
      v.put(hw - 1, y0, z, "glass", 0.18);
      v.put(hw - 1, y0 + 1, z, "glass", 0.14);
    }
  }

  v.arch(0, 1, -hd, 1, 3, 1, "z", "oak");
  v.box(-1, 1, -hd, 1, 3, -hd + 1, "oak");
  v.stairs(-2, 0, -hd - 3, 2, 4, "+z", "limestone");

  const rise = Math.max(5, Math.round(Math.min(hw, hd) * 0.9));
  laySlateRoof(v, -hw, H, -hd, hw, hd, rise);

  if (!stone && spec.floors >= 3) {
    for (let x = -hw + 1; x < hw; x += 3) {
      if ((x + spec.id) % 2 === 0) v.put(x, 2, -hd, "leaf");
      else v.put(x, 3, -hd, "orange");
    }
  }

  if (spec.kind === "chapel" || spec.kind === "tower" || /library|green hall|founders|tower court/i.test(spec.name)) {
    v.box(-1, H + 1, -1, 2, H + rise + 2, 2, "teal");
    v.sphere(0.4, H + rise + 2.4, 0.2, 1.5, 1.3, 1.5, "tealDark");
    v.put(0, H + rise + 4, 0, "gold", 0.4);
  }

  if (spec.kind === "tower") {
    const tx = -hw + 1;
    v.box(tx - 1, 1, -2, tx + 3, H + 14, 3, "limestone");
    v.box(tx, 1, -2, tx + 2, 4, -1, "oak");
    for (let y = 4; y < H + 10; y += 3) {
      v.put(tx - 1, y, 0, "glass", 0.25);
      v.put(tx + 2, y, 0, "glass", 0.25);
      v.put(tx, y, -2, "glass", 0.25);
      v.put(tx, y, 2, "glass", 0.25);
    }
    v.box(tx - 1, H + 10, -2, tx + 3, H + 13, 3, "slate");
    v.box(tx, H + 11, -1, tx + 2, H + 13, 2, "gold", 0.35);
    v.roofPyramid(tx - 2, H + 14, -3, tx + 4, 4, "slate", "teal");
    v.box(tx, H + 18, 0, tx + 1, H + 22, 1, "tealDark");
  }

  if (spec.kind === "chapel") {
    v.roofPyramid(-2, H, -2, 3, 3, "slate", "teal");
    v.box(-1, H + 4, -1, 1, H + 9, 1, "limestone");
    v.put(0, H + 9, 0, "gold", 0.55);
  }

  return { vox: v, hw, hd };
}

function laySlateRoof(v, x0, yBase, z0, x1, z1, rise) {
  const ax0 = Math.round(Math.min(x0, x1));
  const ax1 = Math.round(Math.max(x0, x1));
  const az0 = Math.round(Math.min(z0, z1));
  const az1 = Math.round(Math.max(z0, z1));
  v.box(ax0 - 1, yBase, az0 - 1, ax1 + 1, yBase + 1, az1 + 1, "cream");
  v.box(ax0, yBase, az0, ax1, yBase + 1, az1, "woodDark");
  let peak = yBase;
  for (let step = 0; step < rise; step++) {
    if (az0 + step >= az1 - step) break;
    const course = step % 2 === 0 ? "slate" : "slateLight";
    v.box(ax0, yBase + 1 + step, az0 + step, ax1, yBase + 2 + step, az1 - step, course);
    v.box(ax0 - 1, yBase + 1 + step, az0 + step, ax0, yBase + 2 + step, az1 - step, "cream");
    v.box(ax1, yBase + 1 + step, az0 + step, ax1 + 1, yBase + 2 + step, az1 - step, "cream");
    peak = yBase + 1 + step;
  }
  const ridgeZ = Math.round((az0 + az1) / 2);
  v.box(ax0, peak, ridgeZ - 1, ax1, peak + 1, ridgeZ + 1, "teal");
  v.box(ax0, peak + 1, ridgeZ, ax1, peak + 2, ridgeZ + 1, "tealDark");
  const span = ax1 - ax0;
  const dormers = span > 16 ? 3 : span > 9 ? 2 : 1;
  for (let i = 0; i < dormers; i++) {
    const x = Math.round(ax0 + ((i + 1) * span) / (dormers + 1));
    const z = az0 + 1;
    v.box(x - 1, yBase + 2, z, x + 2, yBase + 5, z + 3, "limestone");
    v.put(x, yBase + 3, z, "glass", 0.35);
    v.put(x + 1, yBase + 3, z, "glass", 0.35);
    v.box(x - 1, yBase + 5, z, x + 2, yBase + 6, z + 3, "slate");
    v.box(x, yBase + 6, z + 1, x + 1, yBase + 8, z + 2, "teal");
  }
  v.box(ax1 - 3, yBase + 2, az1 - 4, ax1 - 1, peak + 3, az1 - 2, "brick");
  v.box(ax1 - 3, peak + 3, az1 - 4, ax1 - 1, peak + 4, az1 - 2, "terracotta");
  v.box(ax0 + 2, yBase + 2, az0 + 2, ax0 + 4, peak + 2, az0 + 4, "brickDark");
  v.put(ax0 + 3, peak + 2, az0 + 3, "terracotta");
  v.put(Math.round((ax0 + ax1) / 2), peak + 2, ridgeZ, "gold", 0.45);
}

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const zi = ring[i][1];
    const xj = ring[j][0];
    const zj = ring[j][1];
    const hit = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi || 1e-9) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function distToPolyline(x, z, line) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = line[i][0];
    const az = line[i][1];
    const bx = line[i + 1][0];
    const bz = line[i + 1][1];
    const vx = bx - ax;
    const vz = bz - az;
    const len2 = vx * vx + vz * vz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / len2));
    const d = (x - (ax + vx * t)) ** 2 + (z - (az + vz * t)) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

function roundCanopyTree(seed) {
  const v = new Vox(800 + seed);
  const greens = ["#1f6b34", "#2f7d3a", "#3e9144", "#24633a", "#4c9a48", "#185c30"];
  const blossom = seed % 8 === 0;
  const a = blossom ? "#f4b7c8" : greens[seed % greens.length];
  const b = blossom ? "#f7d5e2" : greens[(seed + 2) % greens.length];
  const c = blossom ? "#fff6f8" : greens[(seed + 4) % greens.length];
  v.box(0, 0, 0, 1, 9, 1, "wood");
  v.sphere(0.3, 8.4, 0.2, 3.4, 2.8, 3.3, a);
  v.sphere(-2.0, 7.6, 0.8, 2.2, 1.9, 2.1, b);
  v.sphere(2.1, 7.8, -0.7, 2.0, 1.8, 2.0, c);
  return buildVoxelMesh(v, {
    scale: 1.28 + (seed % 4) * 0.12,
    castShadow: true,
    receiveShadow: true,
  });
}

function ribbon(lines, width, color) {
  const positions = [];
  const colors = [];
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
      positions.push(
        a[0] - px, 0.12, a[1] - pz,
        a[0] + px, 0.12, a[1] + pz,
        b[0] + px, 0.12, b[1] + pz,
        a[0] - px, 0.12, a[1] - pz,
        b[0] + px, 0.12, b[1] + pz,
        b[0] - px, 0.12, b[1] - pz,
      );
      for (let k = 0; k < 6; k++) colors.push(col.r, col.g, col.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }),
  );
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.raycast = () => {};
  return mesh;
}

export function createNewEnglandCampus() {
  const group = new THREE.Group();
  group.name = "new-england-campus";
  const blockers = [];
  const records = [];

  for (const landmark of LANDMARKS) {
    const [w, d] = spanMeters(landmark.dLat, landmark.dLon);
    const [x, z] = project(landmark.lat, landmark.lon);
    const built = buildHall({ ...landmark, w, d });
    const mesh = buildVoxelMesh(built.vox, { scale: CELL, castShadow: true, receiveShadow: true });
    mesh.position.set(x, 0, z);
    mesh.userData.campusBuilding = {
      id: `campus-${landmark.id}`,
      name: landmark.name,
      description: `${landmark.name}. A New England collegiate hall of brick and cream stone, slate roof, and copper, standing in the fall quad.`,
      category: "building",
    };
    group.add(mesh);
    blockers.push({
      x,
      z,
      halfX: Math.max(1.4, w / 2 + 0.4),
      halfZ: Math.max(1.4, d / 2 + 0.4),
    });
    records.push(landmark.name);
  }

  const paths = PATHS.map((line) => line.map(([lat, lon]) => project(lat, lon)));
  group.add(ribbon(paths, 1.05, "#e4d3ae"));

  const lake = LAKE.map(([lat, lon]) => project(lat, lon));
  const shape = new THREE.Shape();
  shape.moveTo(lake[0][0], -lake[0][1]);
  for (let i = 1; i < lake.length; i++) shape.lineTo(lake[i][0], -lake[i][1]);
  const waterGeo = new THREE.ShapeGeometry(shape);
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.translate(0, 0.06, 0);
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.MeshStandardMaterial({ color: 0x9ecfe4, roughness: 0.28, metalness: 0.02, transparent: true, opacity: 0.9 }),
  );
  water.receiveShadow = true;
  water.raycast = () => {};
  group.add(water);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const b of blockers) {
    minX = Math.min(minX, b.x - b.halfX);
    maxX = Math.max(maxX, b.x + b.halfX);
    minZ = Math.min(minZ, b.z - b.halfZ);
    maxZ = Math.max(maxZ, b.z + b.halfZ);
  }
  const signX = Number.isFinite(minX) ? Math.max(-70, Math.min(70, minX + 8)) : 3.8;
  const signZ = Number.isFinite(minZ) ? Math.max(-90, Math.min(90, minZ - 8)) : -10.8;

  let trees = 0;
  for (let i = 0; i < 190 && trees < 84; i++) {
    const ang = i * 2.399963;
    const rad = 18 + (i % 12) * 5.8;
    const x = Math.cos(ang) * rad + 1.5;
    const z = Math.sin(ang) * rad * 0.86 + 4;
    if (Math.hypot(x - 2.5, z - 4) < 22) continue;
    if (Math.hypot(x - signX, z - signZ) < 14) continue;
    if (Math.hypot(x - 20.4, z - 15) < 7.2) continue;
    if (Math.hypot(x - 19, z - 19) < 11) continue;
    if (pointInRing(x, z, lake)) continue;
    const blocked = blockers.some((b) => Math.abs(x - b.x) < b.halfX + 4.4 && Math.abs(z - b.z) < b.halfZ + 4.4);
    if (blocked) continue;
    if (paths.some((line) => distToPolyline(x, z, line) < 6)) continue;
    const tree = roundCanopyTree(i + 3);
    tree.position.set(x, 0, z);
    tree.rotation.y = ang;
    group.add(tree);
    trees++;
  }

  return {
    group,
    blockers,
    records,
    lawn: [2.5, 4],
    bounds: { minX, maxX, minZ, maxZ },
  };
}
