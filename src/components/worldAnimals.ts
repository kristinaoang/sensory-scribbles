import * as THREE from 'three';
import type { WildAnimalSpec } from '../types';
import { PET_TOOLS, type PetToolId, type PetToolSpec } from '../shared/wildAnimals';
import { getPlayableRadius } from './worldBuildings';

export { PET_TOOLS, type PetToolId, type PetToolSpec };

export interface AnimalRig {
  spec: WildAnimalSpec;
  root: THREE.Group;
  hitBox: THREE.Mesh;
  tailPivot: THREE.Object3D | null;
  wingLPivot: THREE.Object3D | null;
  wingRPivot: THREE.Object3D | null;
  headPivot: THREE.Object3D | null;
  tamedBadge: THREE.Group;
  blushMat: THREE.MeshStandardMaterial;
  blushMeshes: [THREE.Mesh, THREE.Mesh];
  blushLevel: number;
  targetBlush: number;
  petTimer: number;
  activePetTool: PetToolId | null;
  isTamed: boolean;
  homeX: number;
  homeZ: number;
  x: number;
  z: number;
  roamAngle: number;
  roamTimer: number;
  phase: number;
}

export function clampAnimalPosToIsland(x: number, z: number, level: number): { x: number; z: number } {
  let ax = x;
  let az = z;
  const safeR = Math.max(1.85, getPlayableRadius(level) - 0.85);
  const r = Math.hypot(ax, az);
  if (r > safeR) {
    const scale = safeR / (r || 1);
    ax *= scale;
    az *= scale;
  }
  // Keep clear of central campfire hearth at (0, 0)
  const fireDist = Math.hypot(ax, az);
  if (fireDist < 1.25) {
    const ang = fireDist > 0.01 ? Math.atan2(az, ax) : 0.7;
    ax = Math.cos(ang) * 1.45;
    az = Math.sin(ang) * 1.45;
  }
  // Keep clear of Shared Canvas Board at (0, -2.15)
  if (Math.hypot(ax, az + 2.15) < 1.15) {
    ax += ax >= 0 ? 1.15 : -1.15;
    az += 0.95;
  }
  // Keep clear of Crystal Lake basin at (6.2, 0.4)
  if (level >= 3 && Math.hypot(ax - 6.2, az - 0.4) < 3.05) {
    const dx = ax - 6.2;
    const dz = az - 0.4;
    const d = Math.hypot(dx, dz) || 1;
    ax = 6.2 + (dx / d) * 3.15;
    az = 0.4 + (dz / d) * 3.15;
  }
  const finalR = Math.hypot(ax, az);
  if (finalR > safeR) {
    const scale = safeR / (finalR || 1);
    ax *= scale;
    az *= scale;
  }
  return { x: ax, z: az };
}

export function disposeAnimalGroup(group: THREE.Group) {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      m.geometry.dispose();
      if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
      else m.material.dispose();
    }
  });
}

function attachRosyCheeks(
  head: THREE.Group,
  blushMat: THREE.MeshStandardMaterial,
  xOffset: number,
  yOffset: number,
  zOffset: number,
): [THREE.Mesh, THREE.Mesh] {
  const blushGeo = new THREE.SphereGeometry(0.048, 8, 8);
  const blushL = new THREE.Mesh(blushGeo, blushMat);
  blushL.scale.set(1.15, 0.72, 0.55);
  blushL.position.set(-xOffset, yOffset, zOffset);
  const blushR = new THREE.Mesh(blushGeo.clone(), blushMat);
  blushR.scale.set(1.15, 0.72, 0.55);
  blushR.position.set(xOffset, yOffset, zOffset);
  head.add(blushL, blushR);
  return [blushL, blushR];
}

export function buildWildAnimalMesh(spec: WildAnimalSpec, isTamed: boolean, indexSeed = 0): AnimalRig {
  const root = new THREE.Group();
  const primaryMat = new THREE.MeshStandardMaterial({ color: spec.palette.primary, roughness: 0.72 });
  const secondaryMat = new THREE.MeshStandardMaterial({ color: spec.palette.secondary, roughness: 0.78 });
  const detailMat = new THREE.MeshStandardMaterial({ color: spec.palette.detail, roughness: 0.68 });
  const accentMat = new THREE.MeshStandardMaterial({ color: spec.palette.accent, roughness: 0.55 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x161922, roughness: 0.25 });
  const blushMat = new THREE.MeshStandardMaterial({
    color: 0xff6b93,
    emissive: 0xf43f5e,
    emissiveIntensity: 0.68,
    transparent: true,
    opacity: 0,
    roughness: 0.42,
    depthWrite: false,
  });

  let tailPivot: THREE.Object3D | null = null;
  let wingLPivot: THREE.Object3D | null = null;
  let wingRPivot: THREE.Object3D | null = null;
  let headPivot: THREE.Object3D | null = null;
  let blushMeshes: [THREE.Mesh, THREE.Mesh];

  if (spec.species === 'bird') {
    const bodyGroup = new THREE.Group();

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), primaryMat);
    torso.scale.set(0.95, 0.92, 1.28);
    torso.position.set(0, 0.36, 0);
    torso.castShadow = true;
    bodyGroup.add(torso);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), secondaryMat);
    chest.scale.set(0.92, 0.9, 1.0);
    chest.position.set(0, 0.33, 0.12);
    bodyGroup.add(chest);

    // Collar band
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 14), detailMat);
    collar.rotation.x = Math.PI / 2.2;
    collar.position.set(0, 0.45, 0.1);
    bodyGroup.add(collar);

    const head = new THREE.Group();
    head.position.set(0, 0.57, 0.16);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), primaryMat);
    skull.castShadow = true;
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), primaryMat);
    crest.position.set(0, 0.17, -0.04);
    crest.rotation.x = -0.35;
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 6), accentMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.01, 0.17);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), eyeMat);
    eyeL.position.set(-0.085, 0.03, 0.11);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.085;
    head.add(skull, crest, beak, eyeL, eyeR);
    if (spec.key === 'crimson_cardinal') {
      const faceMask = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.08), detailMat);
      faceMask.position.set(0, -0.01, 0.11);
      head.add(faceMask);
    }
    blushMeshes = attachRosyCheeks(head, blushMat, 0.105, -0.025, 0.095);
    headPivot = head;
    bodyGroup.add(head);

    // Pivotable wings
    const wingGeo = new THREE.BoxGeometry(0.06, 0.18, 0.34);
    const wingL = new THREE.Group();
    wingL.position.set(-0.21, 0.41, -0.02);
    const wingLMesh = new THREE.Mesh(wingGeo, spec.key === 'crimson_cardinal' ? secondaryMat : primaryMat);
    wingLMesh.position.set(-0.02, -0.04, -0.05);
    wingLMesh.castShadow = true;
    wingL.add(wingLMesh);
    wingLPivot = wingL;

    const wingR = new THREE.Group();
    wingR.position.set(0.21, 0.41, -0.02);
    const wingRMesh = new THREE.Mesh(wingGeo, spec.key === 'crimson_cardinal' ? secondaryMat : primaryMat);
    wingRMesh.position.set(0.02, -0.04, -0.05);
    wingRMesh.castShadow = true;
    wingR.add(wingRMesh);
    wingRPivot = wingR;

    // Tail feathers
    const tail = new THREE.Group();
    tail.position.set(0, 0.34, -0.26);
    const tailFeather = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.28), detailMat);
    tailFeather.position.set(0, 0.04, -0.1);
    tailFeather.rotation.x = 0.32;
    tail.add(tailFeather);
    tailPivot = tail;

    // Tiny legs
    [-0.07, 0.07].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6), accentMat);
      leg.position.set(lx, 0.08, 0.02);
      bodyGroup.add(leg);
    });

    bodyGroup.add(wingL, wingR, tail);
    root.add(bodyGroup);
  } else if (spec.species === 'squirrel') {
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.24, 6, 10), primaryMat);
    torso.position.set(0, 0.32, 0);
    torso.rotation.x = 0.22;
    torso.castShadow = true;

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), secondaryMat);
    belly.scale.set(0.85, 1.1, 0.7);
    belly.position.set(0, 0.3, 0.11);

    const head = new THREE.Group();
    head.position.set(0, 0.56, 0.12);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.155, 10, 10), primaryMat);
    skull.castShadow = true;
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), secondaryMat);
    snout.position.set(0, -0.03, 0.12);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), eyeMat);
    nose.position.set(0, -0.01, 0.18);
    [-0.09, 0.09].forEach((ex) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.14, 5), primaryMat);
      ear.position.set(ex, 0.15, -0.02);
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 4), detailMat);
      tuft.position.set(ex, 0.22, -0.02);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), eyeMat);
      eye.position.set(ex * 0.95, 0.03, 0.12);
      head.add(ear, tuft, eye);
    });
    head.add(skull, snout, nose);
    blushMeshes = attachRosyCheeks(head, blushMat, 0.108, -0.02, 0.1);
    headPivot = head;

    // Tiny acorn held in front paws
    const acornCap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), detailMat);
    acornCap.position.set(0, 0.34, 0.24);
    const acornNut = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), accentMat);
    acornNut.position.set(0, 0.3, 0.24);

    // Big fluffy curled squirrel tail
    const tail = new THREE.Group();
    tail.position.set(0, 0.2, -0.15);
    const t1 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 9, 8), primaryMat);
    t1.position.set(0, 0.12, -0.14);
    t1.castShadow = true;
    const t2 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 9, 8), primaryMat);
    t2.position.set(0, 0.34, -0.2);
    t2.castShadow = true;
    const t3 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 9, 8), primaryMat);
    t3.position.set(0, 0.52, -0.08);
    t3.castShadow = true;
    tail.add(t1, t2, t3);
    tailPivot = tail;

    // Hind feet
    [-0.1, 0.1].forEach((fx) => {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.15), primaryMat);
      foot.position.set(fx, 0.04, 0.05);
      root.add(foot);
    });

    root.add(torso, belly, head, acornCap, acornNut, tail);
  } else if (spec.species === 'raccoon') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.36, 6, 10), primaryMat);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0.3, 0);
    body.castShadow = true;

    const head = new THREE.Group();
    head.position.set(0, 0.44, 0.3);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), primaryMat);
    skull.scale.set(1.12, 0.94, 1.0);
    skull.castShadow = true;
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.095, 0.1), detailMat);
    mask.position.set(0, 0.01, 0.13);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.15, 7), secondaryMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.04, 0.18);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), eyeMat);
    nose.position.set(0, -0.03, 0.26);
    [-0.12, 0.12].forEach((ex) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.12, 6), detailMat);
      ear.position.set(ex, 0.17, 0);
      const earTip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 6), secondaryMat);
      earTip.position.set(ex, 0.21, 0.01);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), secondaryMat);
      eye.position.set(ex * 0.72, 0.02, 0.175);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), eyeMat);
      pupil.position.set(ex * 0.72, 0.02, 0.192);
      head.add(ear, earTip, eye, pupil);
    });
    head.add(skull, mask, snout, nose);
    blushMeshes = attachRosyCheeks(head, blushMat, 0.135, -0.04, 0.14);
    headPivot = head;

    // Ringed fluffy raccoon tail (alternating bands)
    const tail = new THREE.Group();
    tail.position.set(0, 0.32, -0.28);
    for (let r = 0; r < 5; r++) {
      const ringMat = r % 2 === 0 ? detailMat : r === 1 || r === 3 ? (spec.key === 'rusty_raccoon' ? accentMat : secondaryMat) : primaryMat;
      const seg = new THREE.Mesh(new THREE.SphereGeometry(0.11 - r * 0.01, 8, 8), ringMat);
      seg.position.set(0, r * 0.055, -0.08 - r * 0.095);
      seg.castShadow = true;
      tail.add(seg);
    }
    tailPivot = tail;

    // 4 paws
    [[-0.13, 0.18], [0.13, 0.18], [-0.13, -0.18], [0.13, -0.18]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.2, 6), detailMat);
      leg.position.set(lx, 0.1, lz);
      root.add(leg);
    });

    root.add(body, head, tail);
  } else if (spec.species === 'cat') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.38, 6, 10), primaryMat);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0.3, 0);
    body.castShadow = true;

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), secondaryMat);
    chest.position.set(0, 0.29, 0.18);

    if (spec.key === 'calico_cat') {
      const patch1 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), secondaryMat);
      patch1.position.set(0.09, 0.38, -0.05);
      const patch2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), detailMat);
      patch2.position.set(-0.1, 0.36, 0.06);
      root.add(patch1, patch2);
    }

    const head = new THREE.Group();
    head.position.set(0, 0.48, 0.28);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 10), primaryMat);
    skull.castShadow = true;
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), spec.key === 'calico_cat' || spec.key === 'journal_tuxedo_cat' ? accentMat : detailMat);
    nose.position.set(0, -0.02, 0.17);
    [-0.1, 0.1].forEach((ex, idx) => {
      const earMat = spec.key === 'calico_cat' && idx === 0 ? secondaryMat : primaryMat;
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.15, 4), earMat);
      ear.position.set(ex, 0.16, 0);
      ear.rotation.y = Math.PI / 4;
      const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.09, 4), spec.key === 'calico_cat' ? accentMat : detailMat);
      innerEar.position.set(ex, 0.15, 0.02);
      innerEar.rotation.y = Math.PI / 4;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), eyeMat);
      eye.position.set(ex * 0.72, 0.02, 0.145);
      head.add(ear, innerEar, eye);
    });
    head.add(skull, nose);
    blushMeshes = attachRosyCheeks(head, blushMat, 0.115, -0.028, 0.12);
    headPivot = head;

    // Slender curved tail
    const tail = new THREE.Group();
    tail.position.set(0, 0.34, -0.26);
    const tBase = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.045, 0.28, 6), primaryMat);
    tBase.rotation.x = -0.65;
    tBase.position.set(0, 0.1, -0.09);
    const tTip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.22, 6), secondaryMat);
    tTip.rotation.x = -0.15;
    tTip.position.set(0, 0.28, -0.19);
    tail.add(tBase, tTip);
    tailPivot = tail;

    // Legs + white-dipped paws
    [[-0.11, 0.18], [0.11, 0.18], [-0.11, -0.18], [0.11, -0.18]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.04, 0.2, 6), primaryMat);
      leg.position.set(lx, 0.12, lz);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.048, 6, 6), secondaryMat);
      paw.position.set(lx, 0.03, lz + 0.02);
      root.add(leg, paw);
    });

    root.add(body, chest, head, tail);
  } else {
    // Dog
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 6, 10), primaryMat);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0.34, 0);
    body.castShadow = true;

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), secondaryMat);
    chest.position.set(0, 0.33, 0.2);

    if (spec.key === 'spotted_pup') {
      [
        [0.14, 0.4, -0.05],
        [-0.13, 0.38, 0.08],
        [0.05, 0.48, -0.14],
      ].forEach(([sx, sy, sz]) => {
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 7), secondaryMat);
        spot.position.set(sx, sy, sz);
        root.add(spot);
      });
    }

    // Collar + gold tag
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 7, 14), accentMat);
    collar.rotation.x = Math.PI / 2.3;
    collar.position.set(0, 0.42, 0.24);
    const tag = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.65, roughness: 0.25 }),
    );
    tag.position.set(0, 0.34, 0.36);

    const head = new THREE.Group();
    head.position.set(0, 0.56, 0.32);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), primaryMat);
    skull.castShadow = true;
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.11, 0.16), primaryMat);
    muzzle.position.set(0, -0.05, 0.16);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.038, 6, 6), eyeMat);
    nose.position.set(0, -0.02, 0.24);
    [-0.17, 0.17].forEach((ex) => {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.2, 0.12), detailMat);
      ear.position.set(ex, 0.0, -0.02);
      ear.rotation.z = ex < 0 ? 0.25 : -0.25;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), eyeMat);
      eye.position.set(ex * 0.52, 0.04, 0.155);
      head.add(ear, eye);
    });
    head.add(skull, muzzle, nose);
    blushMeshes = attachRosyCheeks(head, blushMat, 0.125, -0.03, 0.145);
    headPivot = head;

    // Wagging upright tail
    const tail = new THREE.Group();
    tail.position.set(0, 0.4, -0.3);
    const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.055, 0.28, 7), primaryMat);
    tailMesh.rotation.x = -0.68;
    tailMesh.position.set(0, 0.12, -0.08);
    tail.add(tailMesh);
    tailPivot = tail;

    // 4 sturdy legs
    [[-0.13, 0.2], [0.13, 0.2], [-0.13, -0.2], [0.13, -0.2]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.046, 0.24, 7), primaryMat);
      leg.position.set(lx, 0.12, lz);
      leg.castShadow = true;
      root.add(leg);
    });

    root.add(body, chest, collar, tag, head, tail);
  }

  // Tamed companion marker (glowing golden-mint ribbon orb hovering gently above tamed companions)
  const tamedBadge = new THREE.Group();
  const badgeMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: 0x34d399,
    emissiveIntensity: 0.78,
    roughness: 0.25,
  });
  const starOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), badgeMat);
  starOrb.position.set(0, 0.98, 0.05);
  tamedBadge.add(starOrb);
  tamedBadge.visible = isTamed;
  root.add(tamedBadge);

  // Generous invisible raycast proxy for responsive clicking on animals
  const hitBox = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 1.45, 1.45),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitBox.position.set(0, 0.55, 0);
  hitBox.userData.animal = spec;
  hitBox.layers.set(1);
  root.add(hitBox);

  root.position.set(spec.homePos.x, 0, spec.homePos.z);

  return {
    spec,
    root,
    hitBox,
    tailPivot,
    wingLPivot,
    wingRPivot,
    headPivot,
    tamedBadge,
    blushMat,
    blushMeshes,
    blushLevel: 0,
    targetBlush: 0,
    petTimer: 0,
    activePetTool: null,
    isTamed,
    homeX: spec.homePos.x,
    homeZ: spec.homePos.z,
    x: spec.homePos.x,
    z: spec.homePos.z,
    roamAngle: (indexSeed * 1.9) % (Math.PI * 2),
    roamTimer: 1.5 + (indexSeed % 3),
    phase: indexSeed * 1.37,
  };
}

