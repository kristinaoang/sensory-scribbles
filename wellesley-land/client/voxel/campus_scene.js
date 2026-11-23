// Real Wellesley College grounds, drawn with the same voxel mesher that casts the island shadows.
// Map meters are fit onto the plateau. Vertical scale stays a little taller so the halls read at street level.

import * as THREE from "three";
import { Vox, buildVoxelMesh } from "./vox.js";

const WORLD_SPAN = 206;

const KIND_COLORS = {
  academic: { wall: "limestone", trim: "cream", roof: "slate", foundation: "stone" },
  housing: { wall: "brick", trim: "mortar", roof: "terracotta", foundation: "brickDark" },
  sports: { wall: "concrete", trim: "steel", roof: "slateLight", foundation: "concreteDark" },
  worship: { wall: "cream", trim: "limestone", roof: "slate", foundation: "stone" },
  service: { wall: "concrete", trim: "steelDark", roof: "asphalt", foundation: "concreteDark" },
  other: { wall: "plaster", trim: "cream", roof: "terracotta", foundation: "stone" },
};

function boundsOf(ring) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of ring) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
}

function pointInRing(x, z, ring) {
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

function makeHeightSampler(elevation, xzScale, elevScale) {
  if (!elevation || !elevation.values?.length || elevation.stepX === 0 || elevation.stepZ === 0) {
    return () => 0;
  }
  return (localX, localZ) => {
    const c = (localX - elevation.minX) / elevation.stepX;
    const r = (localZ - elevation.minZ) / elevation.stepZ;
    const c0 = Math.max(0, Math.min(elevation.cols - 1, Math.floor(c)));
    const r0 = Math.max(0, Math.min(elevation.rows - 1, Math.floor(r)));
    const c1 = Math.min(elevation.cols - 1, c0 + 1);
    const r1 = Math.min(elevation.rows - 1, r0 + 1);
    const tx = Math.max(0, Math.min(1, c - c0));
    const tz = Math.max(0, Math.min(1, r - r0));
    const at = (rr, cc) => elevation.values[rr * elevation.cols + cc] || 0;
    const h = at(r0, c0) * (1 - tx) * (1 - tz) + at(r0, c1) * tx * (1 - tz) + at(r1, c0) * (1 - tx) * tz + at(r1, c1) * tx * tz;
    return h * elevScale;
  };
}

function sampleFootprint(ring, heightAt) {
  const box = boundsOf(ring);
  let minH = Infinity;
  let maxH = -Infinity;
  for (let iz = 0; iz <= 3; iz++) {
    for (let ix = 0; ix <= 3; ix++) {
      const x = box.minX + ((box.maxX - box.minX) * ix) / 3;
      const z = box.minZ + ((box.maxZ - box.minZ) * iz) / 3;
      if (ix > 0 && ix < 3 && iz > 0 && iz < 3 && !pointInRing(x, z, ring)) continue;
      const h = heightAt(x, z);
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h);
    }
  }
  if (!Number.isFinite(minH)) return { minH: 0, maxH: 0 };
  return { minH, maxH };
}

function rasterBuilding(ring, heightM, yScale, kind, roof) {
  const box = boundsOf(ring);
  const width = Math.max(4, box.maxX - box.minX);
  const depth = Math.max(4, box.maxZ - box.minZ);
  const cols = Math.max(4, Math.min(18, Math.round(width / 4.2)));
  const rows = Math.max(4, Math.min(18, Math.round(depth / 4.2)));
  const cellX = width / cols;
  const cellZ = depth / rows;
  const inside = new Uint8Array(cols * rows);
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const x = box.minX + (ix + 0.5) * cellX;
      const z = box.minZ + (iz + 0.5) * cellZ;
      inside[iz * cols + ix] = pointInRing(x, z, ring) ? 1 : 0;
    }
  }
  let filled = 0;
  for (const v of inside) filled += v;
  if (filled < 4) {
    inside.fill(1);
    filled = inside.length;
  }
  const wall = new Uint8Array(cols * rows);
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const i = iz * cols + ix;
      if (!inside[i]) continue;
      const edge =
        ix === 0 ||
        iz === 0 ||
        ix === cols - 1 ||
        iz === rows - 1 ||
        !inside[i - 1] ||
        !inside[i + 1] ||
        !inside[i - cols] ||
        !inside[i + cols];
      wall[i] = edge ? 1 : 0;
    }
  }
  const colors = KIND_COLORS[kind] || KIND_COLORS.other;
  const yStep = 0.82;
  const wallVox = Math.max(3, Math.min(16, Math.round((heightM * yScale) / yStep)));
  const vox = new Vox((cols * 13 + rows + heightM) | 0);
  const ox = (cols - 1) / 2;
  const oz = (rows - 1) / 2;
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      if (!wall[iz * cols + ix]) continue;
      const x = Math.round(ix - ox);
      const z = Math.round(iz - oz);
      vox.box(x, 0, z, x + 1, wallVox, z + 1, colors.wall);
      if (wallVox > 4 && (ix + iz) % 2 === 0) {
        vox.box(x, 2, z, x + 1, wallVox - 1, z + 1, "glass", 0.18);
      }
    }
  }
  const doorZ = Math.round(rows - 1 - oz);
  vox.box(-1, 0, doorZ, 1, Math.min(3, wallVox), doorZ + 1, "oak");
  if (roof === "dome") {
    vox.sphere(0, wallVox + 1.2, 0, Math.max(2, Math.round(Math.min(cols, rows) * 0.28)), Math.max(2, Math.round(wallVox * 0.35)), Math.max(2, Math.round(Math.min(cols, rows) * 0.28)), colors.roof);
  } else if (roof === "flat") {
    vox.box(Math.round(-ox), wallVox, Math.round(-oz), Math.round(cols - ox), wallVox + 1, Math.round(rows - oz), colors.roof);
  } else {
    vox.roofGable(
      Math.round(-ox),
      wallVox,
      Math.round(-oz),
      Math.round(cols - ox),
      Math.round(rows - oz),
      Math.max(2, Math.round(Math.min(cols, rows) * 0.22)),
      cols >= rows ? "z" : "x",
      colors.roof,
      colors.trim,
    );
  }
  return { vox, cellX, cellZ, yStep, cols, rows };
}

function ribbonGeometry(lines, width, yAt) {
  const positions = [];
  const colors = [];
  const col = new THREE.Color("#d7c7a4");
  const road = new THREE.Color("#5c6168");
  for (const line of lines) {
    const tint = line.kind === "path" ? col : road;
    const w = line.kind === "path" ? width * 0.55 : width;
    const pts = line.line;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz) || 1;
      const px = (-dz / len) * w;
      const pz = (dx / len) * w;
      const ay = yAt(a[0], a[1]) + 0.08;
      const by = yAt(b[0], b[1]) + 0.08;
      positions.push(
        a[0] - px, ay, a[1] - pz,
        a[0] + px, ay, a[1] + pz,
        b[0] + px, by, b[1] + pz,
        a[0] - px, ay, a[1] - pz,
        b[0] + px, by, b[1] + pz,
        b[0] - px, by, b[1] - pz,
      );
      for (let v = 0; v < 6; v++) colors.push(tint.r, tint.g, tint.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function waterMesh(ring, y) {
  if (ring.length < 4) return null;
  const shape = new THREE.Shape();
  shape.moveTo(ring[0][0], -ring[0][1]);
  for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], -ring[i][1]);
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3f8fba,
    roughness: 0.22,
    metalness: 0.04,
    transparent: true,
    opacity: 0.88,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function treeMesh(seed = 1) {
  const vox = new Vox(7 + seed);
  const blossom = seed % 2 === 0;
  vox.box(0, 0, 0, 1, 5, 1, "wood");
  vox.sphere(0.4, 7.2, 0.3, 3.3, 3.0, 3.2, blossom ? "pink" : "leaf");
  vox.sphere(-1.5, 6.2, 0.6, 2.0, 1.8, 1.9, blossom ? "#f7d5e2" : "leafLight");
  vox.sphere(1.6, 6.3, -0.5, 1.8, 1.7, 1.8, blossom ? "leafLight" : "pink");
  return buildVoxelMesh(vox, { scale: 0.82, castShadow: true, receiveShadow: true });
}

function scatterWoods(woods, buildings, limit) {
  const spots = [];
  const boxes = buildings.map((b) => boundsOf(b.ring));
  for (const ring of woods) {
    const box = boundsOf(ring);
    for (let z = box.minZ; z <= box.maxZ && spots.length < limit; z += 28) {
      for (let x = box.minX; x <= box.maxX && spots.length < limit; x += 28) {
        if (!pointInRing(x, z, ring)) continue;
        const blocked = boxes.some((b) => x >= b.minX - 8 && x <= b.maxX + 8 && z >= b.minZ - 8 && z <= b.maxZ + 8);
        if (blocked) continue;
        spots.push([x, z]);
      }
    }
  }
  return spots;
}

export function buildCampusView(campus) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const building of campus.buildings) {
    for (const [x, z] of building.ring) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }
  const span = Math.max(40, maxX - minX, maxZ - minZ);
  const xzScale = WORLD_SPAN / span;
  const yScale = Math.min(0.48, Math.max(0.34, xzScale * 2.5));
  let elevScale = yScale;
  if (campus.elevation?.values?.length) {
    const range = Math.max(...campus.elevation.values) - Math.min(...campus.elevation.values);
    if (range * elevScale > 14) elevScale = 14 / Math.max(0.5, range);
  }
  const heightAtLocal = makeHeightSampler(campus.elevation, xzScale, elevScale);
  const toWorld = (x, z) => [x * xzScale, z * xzScale];
  const worldHeight = (x, z) => heightAtLocal(x / xzScale, z / xzScale);

  const group = new THREE.Group();
  group.name = "wellesley-campus";
  const blockers = [];
  const buildingRecords = [];

  for (const building of campus.buildings) {
    const worldRing = building.ring.map(([x, z]) => toWorld(x, z));
    const box = boundsOf(worldRing);
    const footprint = sampleFootprint(
      building.ring,
      (x, z) => heightAtLocal(x, z),
    );
    const foundation = Math.max(0, footprint.maxH - footprint.minH);
    const made = rasterBuilding(building.ring, building.heightM, yScale, building.kind, building.roof);
    const mesh = buildVoxelMesh(made.vox, { scale: 1, castShadow: true, receiveShadow: true });
    const worldW = Math.max(2.5, (boundsOf(building.ring).maxX - boundsOf(building.ring).minX) * xzScale);
    const worldD = Math.max(2.5, (boundsOf(building.ring).maxZ - boundsOf(building.ring).minZ) * xzScale);
    mesh.scale.set(worldW / made.cols, made.yStep, worldD / made.rows);
    mesh.position.set(box.cx, footprint.minH, box.cz);
    const foundVox = foundation > 0.35 ? Math.max(1, Math.round(foundation / made.yStep)) : 0;
    if (foundVox > 0) {
      mesh.position.y = footprint.minH;
      mesh.scale.y = made.yStep;
    }
    mesh.userData.campusBuilding = building;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    blockers.push({
      x: box.cx,
      z: box.cz,
      halfX: Math.max(0.8, (box.maxX - box.minX) / 2 + 0.35),
      halfZ: Math.max(0.8, (box.maxZ - box.minZ) / 2 + 0.35),
    });
    buildingRecords.push(building);
  }

  const roadLines = [];
  for (const road of campus.roads || []) {
    roadLines.push({
      kind: road.kind,
      line: road.line.map(([x, z]) => toWorld(x, z)),
    });
  }
  for (const stream of campus.streams || []) {
    roadLines.push({
      kind: "path",
      line: stream.line.map(([x, z]) => toWorld(x, z)),
    });
  }
  if (roadLines.length) {
    const geo = ribbonGeometry(roadLines, 1.15, worldHeight);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
    const roads = new THREE.Mesh(geo, mat);
    roads.receiveShadow = true;
    roads.castShadow = false;
    roads.raycast = () => {};
    group.add(roads);
  }

  const waterRings = [];
  for (const lake of campus.water || []) {
    const ring = lake.ring.map(([x, z]) => toWorld(x, z));
    let y = 0;
    let n = 0;
    for (const [x, z] of ring) {
      y += worldHeight(x, z);
      n++;
    }
    const mesh = waterMesh(ring, n ? y / n + 0.05 : 0.05);
    if (mesh) {
      mesh.userData.campusWater = lake.name;
      group.add(mesh);
      waterRings.push(ring);
    }
  }

  const treeProtos = [treeMesh(1), treeMesh(2)];
  const spots = [
    ...(campus.trees || []).map(([x, z]) => toWorld(x, z)),
    ...scatterWoods(campus.woods || [], campus.buildings, 110).map(([x, z]) => toWorld(x, z)),
  ].slice(0, 120);
  spots.forEach(([x, z], index) => {
    const tree = treeProtos[index % treeProtos.length].clone();
    tree.position.set(x, worldHeight(x, z), z);
    tree.castShadow = true;
    tree.receiveShadow = true;
    group.add(tree);
  });

  function pushOutOfWater(x, z) {
    for (const ring of waterRings) {
      if (!pointInRing(x, z, ring)) continue;
      let bestX = x;
      let bestZ = z;
      let best = Infinity;
      for (let i = 0; i < ring.length - 1; i++) {
        const ax = ring[i][0];
        const az = ring[i][1];
        const bx = ring[i + 1][0];
        const bz = ring[i + 1][1];
        const vx = bx - ax;
        const vz = bz - az;
        const len2 = vx * vx + vz * vz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / len2));
        const px = ax + vx * t;
        const pz = az + vz * t;
        const d = (x - px) ** 2 + (z - pz) ** 2;
        if (d < best) {
          best = d;
          bestX = px;
          bestZ = pz;
        }
      }
      const dx = x - bestX;
      const dz = z - bestZ;
      const len = Math.hypot(dx, dz) || 1;
      return [bestX - (dx / len) * 0.8, bestZ - (dz / len) * 0.8];
    }
    return null;
  }

  return {
    group,
    blockers,
    buildings: buildingRecords,
    worldHeight,
    pushOutOfWater,
    bounds: {
      minX: minX * xzScale,
      maxX: maxX * xzScale,
      minZ: minZ * xzScale,
      maxZ: maxZ * xzScale,
    },
    note: campus.note,
  };
}

export async function loadCampusView() {
  const response = await fetch("/api/osm/campus");
  if (!response.ok) throw new Error("campus map unavailable");
  const campus = await response.json();
  if (!campus?.buildings?.length) throw new Error("campus map was empty");
  return buildCampusView(campus);
}
