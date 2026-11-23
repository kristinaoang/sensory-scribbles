// Moving campus life: deer, raccoons, squirrels, birds, ducks, a fox,
// and drifting fall leaves. Built with the same voxel meshes as the halls.

import * as THREE from "three";
import { Vox, buildVoxelMesh } from "./vox.js";

function part(seed, scale, draw, castShadow = true) {
  const vox = new Vox(seed);
  draw(vox);
  return buildVoxelMesh(vox, { scale, castShadow, receiveShadow: true });
}

function legPair(seed, scale, color) {
  const pivots = [];
  for (let i = 0; i < 2; i++) {
    const piv = new THREE.Group();
    piv.add(part(seed + i, scale, (v) => {
      v.box(0, -3, 0, 1, 0, 1, color);
      v.put(0, -3, 0, "charcoal");
    }, false));
    pivots.push(piv);
  }
  return pivots;
}

function buildDeer(i) {
  const s = 0.28;
  const root = new THREE.Group();
  root.add(part(1200 + i, s, (v) => {
    v.box(-2, 0, -4, 2, 3, 3, i % 2 ? "wood" : "woodLight");
    v.box(-1, 0, -4, 1, 2, -3, "cream");
    v.box(-1, 1, 3, 1, 3, 5, "woodDark");
    v.box(-1, 3, 4, 1, 6, 6, "wood");
    v.put(-1, 4, 6, "charcoal");
    v.put(0, 4, 6, "charcoal");
    v.put(-1, 5, 5, "oak");
    v.put(0, 5, 5, "oak");
    v.box(-2, 5, 4, -1, 7, 5, "woodDark");
    v.box(1, 5, 4, 2, 7, 5, "woodDark");
  }));
  const legs = [];
  const spots = [[-1.2, 0.2], [1.2, 0.2], [-1.2, -2.4], [1.2, -2.4]];
  spots.forEach(([x, z], n) => {
    const piv = new THREE.Group();
    piv.position.set(x * s * 2.2, 0.55, z * s * 2.2);
    piv.add(part(1300 + i * 4 + n, s, (v) => {
      v.box(0, -4, 0, 1, 0, 1, "woodDark");
      v.put(0, -4, 1, "charcoal");
    }, false));
    root.add(piv);
    legs.push(piv);
  });
  return { root, legs, kind: "deer" };
}

function buildRaccoon(i) {
  const s = 0.2;
  const root = new THREE.Group();
  root.add(part(1400 + i, s, (v) => {
    v.box(-2, 0, -3, 2, 3, 2, "slate");
    v.box(-1, 0, -3, 1, 1, -2, "cream");
    v.box(-1, 2, 2, 1, 4, 4, "slate");
    v.box(-2, 3, 2, 2, 4, 3, "charcoal");
    v.put(-1, 3, 4, "charcoal");
    v.put(1, 3, 4, "white");
    v.put(0, 2, 4, "charcoal");
  }));
  const tail = new THREE.Group();
  tail.position.set(0, 0.42, -0.55);
  tail.add(part(1450 + i, s, (v) => {
    v.box(0, 0, -4, 1, 1, 0, "slate");
    v.box(0, 0, -3, 1, 1, -2, "charcoal");
    v.box(0, 0, -2, 1, 1, -1, "cream");
    v.put(0, 0, -4, "charcoal");
  }, false));
  root.add(tail);
  const legs = legPair(1460 + i, s * 0.85, "charcoal");
  legs[0].position.set(-0.16, 0.28, 0.15);
  legs[1].position.set(0.16, 0.28, 0.15);
  const back = legPair(1470 + i, s * 0.85, "charcoal");
  back[0].position.set(-0.16, 0.28, -0.28);
  back[1].position.set(0.16, 0.28, -0.28);
  root.add(legs[0], legs[1], back[0], back[1]);
  return { root, legs: [...legs, ...back], tail, kind: "raccoon" };
}

function buildSquirrel(i) {
  const s = 0.16;
  const root = new THREE.Group();
  const coat = i % 2 ? "orange" : "wood";
  root.add(part(1500 + i, s, (v) => {
    v.box(-1, 0, -2, 2, 2, 2, coat);
    v.box(0, 1, 2, 2, 3, 4, coat);
    v.put(0, 2, 4, "charcoal");
    v.put(1, 2, 4, "charcoal");
    v.box(-1, 0, -1, 2, 1, 1, "cream");
  }));
  const tail = new THREE.Group();
  tail.position.set(0.05, 0.28, -0.22);
  tail.add(part(1550 + i, s, (v) => {
    v.box(0, 0, -1, 1, 1, 1, coat);
    v.box(-1, 1, -2, 2, 4, 0, i % 2 ? "amber" : "orange");
  }, false));
  root.add(tail);
  const legs = legPair(1560 + i, s * 0.75, "woodDark");
  legs[0].position.set(-0.1, 0.16, 0.08);
  legs[1].position.set(0.1, 0.16, 0.08);
  root.add(legs[0], legs[1]);
  return { root, legs, tail, kind: "squirrel" };
}

function buildFox() {
  const s = 0.22;
  const root = new THREE.Group();
  root.add(part(1600, s, (v) => {
    v.box(-2, 0, -3, 2, 3, 2, "orange");
    v.box(-1, 0, -3, 1, 1, -2, "cream");
    v.box(-1, 2, 2, 1, 4, 4, "orange");
    v.put(-1, 3, 4, "charcoal");
    v.put(1, 3, 4, "charcoal");
    v.box(0, 1, 3, 1, 2, 5, "charcoal");
    v.box(-2, 4, 2, -1, 6, 3, "orange");
    v.box(1, 4, 2, 2, 6, 3, "orange");
  }));
  const tail = new THREE.Group();
  tail.position.set(0, 0.4, -0.5);
  tail.add(part(1610, s, (v) => {
    v.box(0, 0, -4, 1, 2, 0, "orange");
    v.put(0, 1, -4, "white");
  }, false));
  root.add(tail);
  const legs = legPair(1620, s * 0.9, "orange");
  legs[0].position.set(-0.16, 0.3, 0.12);
  legs[1].position.set(0.18, 0.3, 0.12);
  root.add(legs[0], legs[1]);
  return { root, legs, tail, kind: "fox" };
}

function buildRabbit(i) {
  const s = 0.14;
  const root = new THREE.Group();
  root.add(part(1650 + i, s, (v) => {
    v.box(-1, 0, -2, 2, 2, 2, "cream");
    v.box(0, 1, 2, 2, 3, 3, "cream");
    v.put(0, 2, 3, "charcoal");
    v.put(1, 2, 3, "charcoal");
    v.box(0, 3, 2, 1, 6, 3, "cream");
    v.box(1, 3, 2, 2, 5, 3, "cream");
  }));
  return { root, legs: [], kind: "rabbit" };
}

function buildBird(i) {
  const s = 0.14;
  const coats = ["crimson", "blue", "amber", "slate", "yellow"];
  const coat = coats[i % coats.length];
  const root = new THREE.Group();
  root.add(part(1700 + i, s, (v) => {
    v.box(-1, 0, -1, 2, 2, 2, coat);
    v.box(0, 1, 2, 1, 2, 3, "gold");
    v.put(0, 1, 1, "charcoal");
  }, false));
  const wings = [];
  for (const side of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(side * 0.12, 0.12, 0);
    piv.add(part(1750 + i + side, s, (v) => {
      v.box(0, 0, -2, 1, 1, 2, coat);
    }, false));
    root.add(piv);
    wings.push(piv);
  }
  return { root, wings, kind: "bird" };
}

function buildDuck(i) {
  const s = 0.18;
  const root = new THREE.Group();
  root.add(part(1800 + i, s, (v) => {
    v.box(-2, 0, -2, 2, 2, 2, "busYellow");
    v.box(-1, 1, 2, 1, 3, 4, "tealDark");
    v.put(0, 2, 4, "gold");
    v.put(-1, 2, 3, "charcoal");
  }));
  return { root, kind: "duck" };
}

function overlaps(x, z, r, blockers) {
  for (const b of blockers) {
    if (Math.abs(x - b.x) < b.halfX + r && Math.abs(z - b.z) < b.halfZ + r) return true;
  }
  return false;
}

function makeGroundAnimal(rig, spec, blockers) {
  const actor = {
    ...rig,
    ...spec,
    wait: 0,
  };
  actor.root.position.set(spec.x, 0, spec.z);
  actor.root.rotation.y = spec.yaw;
  function turn() {
    actor.yaw = Math.random() * Math.PI * 2;
    actor.wait = actor.kind === "squirrel" ? 0.2 + Math.random() * 0.6 : 0.8 + Math.random() * 2.4;
  }
  turn();
  actor.step = (dt, t) => {
    const flap = actor.kind === "squirrel" ? 9 : actor.kind === "rabbit" ? 7 : 5;
    const swing = Math.sin(t * flap + actor.phase) * (actor.speed > 0.2 ? 0.55 : 0.08);
    actor.legs?.forEach((leg, n) => {
      leg.rotation.x = swing * (n % 2 ? 1 : -1);
    });
    if (actor.tail) {
      actor.tail.rotation.x = -0.4 + Math.sin(t * (actor.kind === "squirrel" ? 8 : 3) + actor.phase) * 0.35;
      actor.tail.rotation.y = Math.sin(t * 4 + actor.phase) * 0.25;
    }
    actor.wait -= dt;
    if (actor.wait > 0 && actor.kind !== "duck") {
      actor.speed = 0;
      return;
    }
    const dash = actor.kind === "squirrel" && Math.random() < 0.02;
    actor.speed = dash ? 4.2 : spec.cruise;
    const nx = actor.x + Math.sin(actor.yaw) * actor.speed * dt;
    const nz = actor.z + Math.cos(actor.yaw) * actor.speed * dt;
    const inside = nx > spec.minX && nx < spec.maxX && nz > spec.minZ && nz < spec.maxZ;
    if (!inside || overlaps(nx, nz, spec.radius, blockers)) {
      turn();
      return;
    }
    actor.x = nx;
    actor.z = nz;
    actor.root.position.set(actor.x, actor.kind === "duck" ? 0.16 + Math.sin(t * 3 + actor.phase) * 0.05 : 0, actor.z);
    actor.root.rotation.y = actor.yaw;
    if (actor.wait <= 0 && Math.random() < dt * 0.35) turn();
  };
  if (actor.root) {
    actor.root.userData.guideAnimal = {
      id: `${actor.kind}-${Math.round(spec.x)}-${Math.round(spec.z)}`,
      kind: actor.kind,
      name: `the ${actor.kind}`,
    };
  }
  return actor;
}

function makeBird(rig, i) {
  const radius = 18 + (i % 5) * 8;
  const height = 7 + (i % 4) * 2.4;
  const speed = 0.28 + (i % 3) * 0.08;
  const centerX = ((i * 17) % 40) - 20;
  const centerZ = ((i * 11) % 30) - 10;
  const actor = { ...rig, phase: i, radius, height, speed, centerX, centerZ };
  actor.step = (dt, t) => {
    const a = t * speed + i;
    actor.root.position.set(
      centerX + Math.cos(a) * radius,
      height + Math.sin(a * 2) * 1.4,
      centerZ + Math.sin(a) * radius * 0.72,
    );
    actor.root.rotation.y = -a + Math.PI / 2;
    const flap = Math.sin(t * 14 + i) * 0.7;
    actor.wings?.forEach((wing, n) => {
      wing.rotation.z = (n === 0 ? 1 : -1) * (0.4 + flap);
    });
  };
  actor.root.userData.guideAnimal = {
    id: `bird-${i}`,
    kind: "bird",
    name: "the bird",
  };
  return actor;
}

function makeLeaves(group) {
  const geo = new THREE.BoxGeometry(0.28, 0.05, 0.18);
  const colors = [0xf4c2d0, 0xf7d5e2, 0xe7c98a, 0xc5e0b4, 0xf6e7a8];
  const leaves = [];
  for (let i = 0; i < 42; i++) {
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.7 }),
    );
    mesh.castShadow = false;
    mesh.raycast = () => {};
    const leaf = {
      mesh,
      x: (Math.random() - 0.5) * 120,
      y: 2 + Math.random() * 16,
      z: (Math.random() - 0.5) * 90,
      spin: Math.random() * 2,
      drift: 0.35 + Math.random() * 0.7,
    };
    mesh.position.set(leaf.x, leaf.y, leaf.z);
    group.add(mesh);
    leaves.push(leaf);
  }
  return (dt, t) => {
    for (const leaf of leaves) {
      leaf.y -= leaf.drift * dt;
      leaf.x += Math.sin(t * 0.8 + leaf.spin) * dt * 0.8;
      leaf.z += Math.cos(t * 0.6 + leaf.spin) * dt * 0.5;
      if (leaf.y < 0.15) {
        leaf.y = 8 + Math.random() * 12;
        leaf.x = (Math.random() - 0.5) * 120;
        leaf.z = (Math.random() - 0.5) * 90;
      }
      leaf.mesh.position.set(leaf.x, leaf.y, leaf.z);
      leaf.mesh.rotation.x = t * 1.4 + leaf.spin;
      leaf.mesh.rotation.z = t * 0.8 + leaf.spin;
    }
  };
}

export function createCampusWildlife(bounds, blockers) {
  const group = new THREE.Group();
  group.name = "campus-wildlife";
  const actors = [];
  const pad = { minX: bounds.minX - 6, maxX: bounds.maxX + 6, minZ: bounds.minZ - 8, maxZ: bounds.maxZ + 18 };

  function spot(radius) {
    for (let n = 0; n < 24; n++) {
      const x = pad.minX + Math.random() * (pad.maxX - pad.minX);
      const z = pad.minZ + Math.random() * (pad.maxZ - pad.minZ);
      if (!overlaps(x, z, radius, blockers)) return [x, z];
    }
    return [bounds.minX - 4, bounds.minZ + 6];
  }

  const ground = [
    ["deer", 4, 1.1, 1.3, buildDeer],
    ["raccoon", 3, 0.7, 0.9, buildRaccoon],
    ["squirrel", 7, 0.45, 1.6, buildSquirrel],
    ["rabbit", 3, 0.4, 1.3, buildRabbit],
  ];
  let n = 0;
  for (const [, count, radius, cruise, build] of ground) {
    for (let i = 0; i < count; i++) {
      const [x, z] = spot(radius);
      const rig = build(i);
      const actor = makeGroundAnimal(rig, {
        x, z, yaw: Math.random() * Math.PI * 2, phase: n, radius, cruise,
        minX: pad.minX, maxX: pad.maxX, minZ: pad.minZ, maxZ: pad.maxZ, speed: 0,
      }, blockers);
      group.add(actor.root);
      actors.push(actor);
      n++;
    }
  }
  {
    const [x, z] = spot(1);
    const rig = buildFox();
    const actor = makeGroundAnimal(rig, {
      x, z, yaw: 0.4, phase: 3, radius: 0.9, cruise: 1.15,
      minX: pad.minX, maxX: pad.maxX, minZ: pad.minZ, maxZ: pad.maxZ, speed: 0,
    }, blockers);
    group.add(actor.root);
    actors.push(actor);
  }
  for (let i = 0; i < 8; i++) {
    const rig = buildBird(i);
    const actor = makeBird(rig, i);
    group.add(actor.root);
    actors.push(actor);
  }
  for (let i = 0; i < 4; i++) {
    const rig = buildDuck(i);
    const actor = makeGroundAnimal(rig, {
      x: -55 + i * 6,
      z: 62 + (i % 2) * 4,
      yaw: i,
      phase: i * 1.7,
      radius: 0.6,
      cruise: 0.55,
      minX: -78,
      maxX: -30,
      minZ: 48,
      maxZ: 88,
      speed: 0.4,
    }, []);
    group.add(actor.root);
    actors.push(actor);
  }
  const stepLeaves = makeLeaves(group);

  const calm = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  return {
    group,
    step(dt, t) {
      const motionDt = calm ? 0 : dt;
      const motionT = calm ? 0 : t;
      for (const actor of actors) actor.step(motionDt, motionT);
      if (!calm) stepLeaves(dt, t);
    },
  };
}
