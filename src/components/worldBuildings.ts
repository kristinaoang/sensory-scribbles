import * as THREE from 'three';

export interface GuidedPathStop {
  id: string;
  title: string;
  caption: string;
  minLevel: number;
  x: number;
  z: number;
}

export function getPlayableRadius(level: number): number {
  const lvl = Math.max(1, level);
  if (lvl === 1) return 3.6;
  if (lvl === 2) return 7.2;
  if (lvl === 3) return 10.8;
  if (lvl === 4) return 14.2;
  if (lvl === 5) return 17.6;
  return Math.min(23.0, 17.6 + (lvl - 5) * 3.0);
}

export function groundHeightAt(x: number, z: number, level: number): number {
  const maxR = getPlayableRadius(level);
  const r = Math.hypot(x, z);
  const hill = Math.sin(x * 0.22) * Math.cos(z * 0.22) * 0.11;

  // Gentle elevated Highland Ridge on the north side unlocked at Stage 6+ (level 5 completed)
  const ridge =
    level >= 6 && z < -10.5
      ? Math.max(0, Math.min(1.25, (-z - 10.5) * 0.22)) * Math.max(0, 1 - Math.abs(x) * 0.065)
      : 0;

  // Sunken Crystal Lake basin centered at (6.2, 0.4) unlocked at Stage 3+ (level 2 completed)
  const lakeDist = Math.hypot(x - 6.2, z - 0.4);
  const lakeDip =
    level >= 3 && lakeDist < 2.75
      ? -0.74 * Math.pow(1 - lakeDist / 2.75, 0.72)
      : 0;

  const shoreDip = r > maxR ? -Math.min(0.95, (r - maxR) * 0.52) : 0;
  return hill + ridge + lakeDip + shoreDip;
}

export function walkSurfaceHeightAt(x: number, z: number, level: number): number {
  const terrainY = groundHeightAt(x, z, level);
  if (level >= 3 && Math.abs(z - 0.4) < 0.75 && Math.abs(x - 6.2) <= 2.9) {
    const t = Math.max(0, Math.min(1, (x - (6.2 - 2.9)) / 5.8));
    const bridgeDeckY = 0.12 + Math.sin(t * Math.PI) * 0.56;
    return Math.max(terrainY, bridgeDeckY);
  }
  return terrainY;
}

export const ALL_GUIDED_PATH_STOPS: GuidedPathStop[] = [
  {
    id: 'campfire_hearth',
    title: 'Campfire Clearing',
    caption: 'Begin around the starter campfire and Shared Canvas Board. Answer prompts to raise nearby landmarks and grow your island.',
    minLevel: 1,
    x: 0,
    z: 1.4,
  },
  {
    id: 'canvas_easel',
    title: 'Shared Canvas Board',
    caption: 'Available from Stage 1 — click the board or use Answer & Draw to add your word-stroke to the island.',
    minLevel: 1,
    x: 0,
    z: -1.4,
  },
  {
    id: 'great_windmill',
    title: 'Trailhead Arch & Great Meadow Windmill',
    caption: 'Added at Level 1 completion — walk beneath the wooden arch toward a tall windmill with four turning canvas sails.',
    minLevel: 2,
    x: -3.8,
    z: -3.2,
  },
  {
    id: 'crystal_lake_bridge',
    title: 'Crystal Lake & Arched Bridge',
    caption: 'Added at Level 2 completion — cross the curved wooden bridge spanning the newly formed lake.',
    minLevel: 3,
    x: 6.2,
    z: 0.4,
  },
  {
    id: 'seed_cottage',
    title: 'Seed Cottage',
    caption: 'Added at Level 3 completion — a warm timber cottage tucked beside blossom trees.',
    minLevel: 4,
    x: -6.8,
    z: 3.6,
  },
  {
    id: 'botanical_greenhouse',
    title: 'Botanical Greenhouse',
    caption: 'Added at Level 3 completion — sunlit glass panes sheltering meadow seedlings.',
    minLevel: 4,
    x: 4.4,
    z: -7.8,
  },
  {
    id: 'tea_pavilion',
    title: 'Lakeside Tea Pavilion',
    caption: 'Added at Level 3 completion — a quiet wooden shelter overlooking the southern lake shore.',
    minLevel: 4,
    x: 7.4,
    z: 5.8,
  },
  {
    id: 'harbor_boathouse',
    title: 'Harbor Boathouse & Pier',
    caption: 'Added at Level 4 completion — walk down the long timber pier to the moored rowboat.',
    minLevel: 5,
    x: 0.2,
    z: 13.8,
  },
  {
    id: 'coastal_lighthouse',
    title: 'Coastal Brick Lighthouse',
    caption: 'Added at Level 4 completion — beacon tower watching over the southern cove.',
    minLevel: 5,
    x: -10.8,
    z: 9.2,
  },
  {
    id: 'sky_observatory',
    title: 'Highland Ridge & Sky Observatory',
    caption: 'Added at Level 5 completion — copper-domed lookout crowning the elevated northern ridge.',
    minLevel: 6,
    x: -4.8,
    z: -14.8,
  },
];

export function getGuidedPathStops(level: number): GuidedPathStop[] {
  return ALL_GUIDED_PATH_STOPS.filter((s) => s.minLevel <= Math.max(1, level));
}

export function getNextLockedFrontier(level: number): GuidedPathStop | null {
  return ALL_GUIDED_PATH_STOPS.find((s) => s.minLevel > Math.max(1, level)) ?? null;
}

/**
 * Composite 6-part Trailhead Wooden Arch marking the start of the guided path (Stage 1)
 */
export function buildTrailheadArch(): THREE.Group {
  const g = new THREE.Group();
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x7c5338, roughness: 0.84 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.88 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.85,
    roughness: 0.25,
  });

  [-0.78, 0.78].forEach((px) => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.2, 8), stoneMat);
    base.position.set(px, 0.1, 0);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1.55, 8), timberMat);
    post.position.set(px, 0.9, 0);
    post.castShadow = true;
    g.add(base, post);
  });

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.14, 0.18), timberMat);
  lintel.position.set(0, 1.66, 0);
  lintel.castShadow = true;

  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(0.84, 0.24, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xf4ece0, roughness: 0.72 }),
  );
  plaque.position.set(0, 1.46, 0.06);

  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), glowMat);
  lantern.position.set(0.78, 1.82, 0);

  g.add(lintel, plaque, lantern);
  return g;
}

/**
 * Grand Large Meadow Windmill added on Level 1 completion (Stage 2+)
 */
export function buildLargeWindmill(rotorsOut: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8f96a2, roughness: 0.88 });
  const plasterMat = new THREE.MeshStandardMaterial({ color: 0xf6efe2, roughness: 0.8 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6f482f, roughness: 0.84 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xc26d4a, roughness: 0.65 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xfff8eb, roughness: 0.72 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.8,
    roughness: 0.25,
  });

  // Stone plinth + doorstep
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.34, 0.56, 8), stoneMat);
  plinth.position.y = 0.28;
  plinth.receiveShadow = true;
  plinth.castShadow = true;

  const step = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.16, 0.44), stoneMat);
  step.position.set(0, 0.08, 1.24);

  // Tapered main tower
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.02, 2.35, 10), plasterMat);
  tower.position.y = 1.72;
  tower.castShadow = true;

  // Timber structural collar rings
  const collarLow = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.98, 0.12, 10), woodMat);
  collarLow.position.y = 1.25;
  const collarTop = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.78, 0.14, 10), woodMat);
  collarTop.position.y = 2.86;

  // Arched wooden door & loft window
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.78, 0.14), woodMat);
  door.position.set(0, 0.68, 1.06);
  const loftWin = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.12), glowMat);
  loftWin.position.set(0, 1.78, 0.84);

  // Conical shingle roof
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.98, 0.96, 10), roofMat);
  cap.position.y = 3.36;
  cap.castShadow = true;

  // Rotor hub & 4 long framed canvas sails
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.34, 10), woodMat);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0, 2.55, 0.92);

  const rotor = new THREE.Group();
  rotor.position.set(0, 2.55, 1.02);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2 + Math.PI / 4;

    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.88, 0.07), woodMat);
    spar.position.y = 0.94;
    spar.castShadow = true;

    const sail = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.38, 0.03), sailMat);
    sail.position.set(0.27, 1.12, 0.02);
    sail.castShadow = true;

    // Cross slats across each sail
    for (let b = 0; b < 3; b++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.05), woodMat);
      slat.position.set(0.25, 0.64 + b * 0.44, 0.03);
      arm.add(slat);
    }

    arm.add(spar, sail);
    rotor.add(arm);
  }
  rotorsOut.push(rotor);

  g.add(plinth, step, tower, collarLow, collarTop, door, loftWin, cap, hub, rotor);
  return g;
}

/**
 * Crystal Lake with shoreline stones, lily pads & Arched Wooden Bridge spanning bank-to-bank
 * Centered in world space at (6.2, 0.4), unlocked on Level 2 completion (Stage 3+)
 */
export function buildLakeWithBridge(darkMode: boolean): THREE.Group {
  const g = new THREE.Group();
  const cx = 6.2;
  const cz = 0.4;

  // Water surface inside carved lake basin
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: darkMode ? 0x2d6696 : 0x56b2e0,
    roughness: 0.09,
    metalness: 0.05,
    clearcoat: 0.92,
    transparent: true,
    opacity: 0.88,
  });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, 0.08, 32), waterMat);
  water.position.set(cx, -0.22, cz);
  water.receiveShadow = true;
  g.add(water);

  // Shoreline rocks around lake perimeter (avoiding bridge ends at west/east)
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8f97a3, roughness: 0.88 });
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    // Skip narrow bridge landing slots around ang = 0 and ang = PI
    if (Math.abs(Math.sin(ang)) < 0.34) continue;
    const dist = 2.48 + (i % 3) * 0.18;
    const rx = cx + Math.cos(ang) * dist;
    const rz = cz + Math.sin(ang) * dist;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.18 + (i % 3) * 0.07, 0),
      stoneMat,
    );
    rock.position.set(rx, -0.05, rz);
    rock.scale.set(1.2, 0.68, 1.0);
    rock.rotation.y = ang;
    rock.castShadow = true;
    g.add(rock);
  }

  // Floating lily pads & blossoms on the lake
  const padMat = new THREE.MeshStandardMaterial({ color: 0x459a5b, roughness: 0.72 });
  const blossomMat = new THREE.MeshStandardMaterial({ color: 0xf7c6cf, roughness: 0.55 });
  const lilyCoords = [
    [-0.9, -1.0],
    [0.85, -1.15],
    [-0.75, 1.25],
    [1.1, 0.95],
  ];
  lilyCoords.forEach(([ox, oz], idx) => {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 12), padMat);
    pad.position.set(cx + ox, -0.17, cz + oz);
    g.add(pad);
    if (idx % 2 === 0) {
      const bloom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09, 0), blossomMat);
      bloom.position.set(cx + ox, -0.11, cz + oz);
      g.add(bloom);
    }
  });

  // Cattail reeds near south/north banks
  const reedMat = new THREE.MeshStandardMaterial({ color: 0x3b7a4a, roughness: 0.8 });
  const cattailMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.85 });
  [
    [-1.4, -1.75],
    [-1.25, -1.85],
    [1.35, 1.8],
    [1.5, 1.68],
  ].forEach(([ox, oz]) => {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.72, 6), reedMat);
    stalk.position.set(cx + ox, 0.14, cz + oz);
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.14, 4, 6), cattailMat);
    head.position.set(cx + ox, 0.44, cz + oz);
    g.add(stalk, head);
  });

  // Arched Wooden Bridge spanning across the lake from x = cx - 2.95 to cx + 2.95
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.84 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x674227, roughness: 0.85 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.85,
    roughness: 0.25,
  });

  const bridgeGroup = new THREE.Group();
  const halfSpan = 2.9;
  const plankCount = 13;
  for (let i = 0; i < plankCount; i++) {
    const t = i / (plankCount - 1); // 0..1
    const bx = -halfSpan + t * (halfSpan * 2);
    const archCurve = Math.sin(t * Math.PI);
    const by = 0.08 + archCurve * 0.56;
    const slopeAngle = Math.cos(t * Math.PI) * 0.26;

    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 1.48), plankMat);
    plank.position.set(bx, by, 0);
    plank.rotation.z = slopeAngle;
    plank.castShadow = true;
    plank.receiveShadow = true;
    bridgeGroup.add(plank);

    // Support pilings down into the water under inner & bank sections
    if (i % 3 === 0) {
      [-0.62, 0.62].forEach((pz) => {
        const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 1.15, 7), railMat);
        piling.position.set(bx, by - 0.55, pz);
        bridgeGroup.add(piling);
      });
    }
  }

  // Bridge posts, arched side handrails & glowing entry lanterns
  [-halfSpan, -halfSpan * 0.45, 0, halfSpan * 0.45, halfSpan].forEach((px, idx) => {
    const t = (px + halfSpan) / (halfSpan * 2);
    const deckY = 0.08 + Math.sin(t * Math.PI) * 0.56;
    [-0.68, 0.68].forEach((pz) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.84, 8), railMat);
      post.position.set(px, deckY + 0.38, pz);
      post.castShadow = true;
      bridgeGroup.add(post);

      if (idx === 0 || idx === 4) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), glowMat);
        lamp.position.set(px, deckY + 0.85, pz);
        bridgeGroup.add(lamp);
      }
    });
  });

  // Connect rail spans smoothly between the 5 posts on each side
  const railOffsets = [-halfSpan, -halfSpan * 0.45, 0, halfSpan * 0.45, halfSpan];
  for (let s = 0; s < railOffsets.length - 1; s++) {
    const x1 = railOffsets[s];
    const x2 = railOffsets[s + 1];
    const y1 = 0.08 + Math.sin(((x1 + halfSpan) / (halfSpan * 2)) * Math.PI) * 0.56 + 0.72;
    const y2 = 0.08 + Math.sin(((x2 + halfSpan) / (halfSpan * 2)) * Math.PI) * 0.56 + 0.72;
    const segLen = Math.hypot(x2 - x1, y2 - y1);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    [-0.68, 0.68].forEach((pz) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.06, 0.07, 0.07), railMat);
      rail.position.set((x1 + x2) / 2, (y1 + y2) / 2, pz);
      rail.rotation.z = ang;
      bridgeGroup.add(rail);
    });
  }

  bridgeGroup.position.set(cx, 0, cz);
  g.add(bridgeGroup);
  return g;
}

/**
 * Composite 8-part Seed Cottage added in Stage 2
 */
export function buildSeedCottage(): THREE.Group {
  const g = new THREE.Group();
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.9 });
  const plasterMat = new THREE.MeshStandardMaterial({ color: 0xf6efe2, roughness: 0.82 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xc26d4a, roughness: 0.65 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6f482f, roughness: 0.85 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.78,
    roughness: 0.25,
  });

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 1.9), plinthMat);
  plinth.position.y = 0.09;
  plinth.receiveShadow = true;

  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.05, 1.45), plasterMat);
  walls.position.y = 0.7;
  walls.castShadow = true;

  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.38, 0.88, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.65;
  roof.castShadow = true;

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.68, 0.26), plinthMat);
  chimney.position.set(-0.5, 1.68, -0.32);
  chimney.castShadow = true;

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.64, 0.08), woodMat);
  door.position.set(0, 0.5, 0.74);

  const awning = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.08, 0.34), roofMat);
  awning.position.set(0, 0.92, 0.88);
  awning.rotation.x = 0.22;

  const winL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.08), glowMat);
  winL.position.set(-0.5, 0.75, 0.74);
  const winR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.08), glowMat);
  winR.position.set(0.5, 0.75, 0.74);

  g.add(plinth, walls, roof, chimney, door, awning, winL, winR);
  return g;
}

/**
 * Composite 7-part Botanical Glass Greenhouse added in Stage 2
 */
export function buildGlassGreenhouse(): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9299a3, roughness: 0.88 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2e6f4e, roughness: 0.55, metalness: 0.15 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdff5ff,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.58,
  });
  const potMat = new THREE.MeshStandardMaterial({ color: 0xc86d3b, roughness: 0.78 });
  const bloomMat = new THREE.MeshStandardMaterial({ color: 0xf7c6cf, roughness: 0.6 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.34, 1.5), stoneMat);
  base.position.y = 0.17;
  base.receiveShadow = true;

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.86, 1.34), glassMat);
  body.position.y = 0.77;

  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.26, 0.72, 4), glassMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.54;

  const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.08, 0.12), frameMat);
  ridgeBeam.position.y = 1.2;

  [-0.85, 0.85].forEach((px) => {
    [-0.65, 0.65].forEach((pz) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.92, 0.08), frameMat);
      post.position.set(px, 0.78, pz);
      g.add(post);
    });
  });

  // Inside flower boxes visible through the glass
  [-0.38, 0.38].forEach((bx) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.22, 8), potMat);
    pot.position.set(bx, 0.45, 0);
    const bloom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), bloomMat);
    bloom.position.set(bx, 0.66, 0);
    g.add(pot, bloom);
  });

  g.add(base, body, roof, ridgeBeam);
  return g;
}

/**
 * Composite 7-part Riverside Tea Pavilion added in Stage 3
 */
export function buildTeaPavilion(): THREE.Group {
  const g = new THREE.Group();
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.84 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x674227, roughness: 0.82 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2e7d5b, roughness: 0.65 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.82,
  });

  const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.32, 0.18, 8), deckMat);
  deck.position.y = 0.09;
  deck.receiveShadow = true;
  g.add(deck);

  [[-0.74, -0.74], [0.74, -0.74], [-0.74, 0.74], [0.74, 0.74]].forEach(([px, pz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 1.35, 8), postMat);
    post.position.set(px, 0.84, pz);
    post.castShadow = true;
    g.add(post);
  });

  const lowerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.58, 0.56, 4), roofMat);
  lowerRoof.rotation.y = Math.PI / 4;
  lowerRoof.position.y = 1.72;
  lowerRoof.castShadow = true;

  const upperRoof = new THREE.Mesh(new THREE.ConeGeometry(0.92, 0.44, 4), roofMat);
  upperRoof.rotation.y = Math.PI / 4;
  upperRoof.position.y = 2.08;

  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glowMat);
  lantern.position.y = 1.24;

  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.32, 10), postMat);
  table.position.y = 0.34;

  g.add(lowerRoof, upperRoof, lantern, table);
  return g;
}

/**
 * Composite 7-part Harbor Boathouse added in Stage 4
 */
export function buildHarborBoathouse(): THREE.Group {
  const g = new THREE.Group();
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x7a5234, roughness: 0.85 });
  const sidingMat = new THREE.MeshStandardMaterial({ color: 0x5c8ab5, roughness: 0.74 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd99b43, roughness: 0.62 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.78,
  });

  const dock = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 1.85), timberMat);
  dock.position.y = 0.08;
  dock.receiveShadow = true;

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.68, 1.0, 1.44), sidingMat);
  body.position.y = 0.66;
  body.castShadow = true;

  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.34, 0.74, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.52;
  roof.castShadow = true;

  const archDoor = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.68, 0.08), timberMat);
  archDoor.position.set(0, 0.5, 0.74);

  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), glowMat);
  lantern.position.set(0.55, 0.92, 0.78);

  const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.36, 8), timberMat);
  bollard.position.set(-0.82, 0.32, 0.75);

  g.add(dock, body, roof, archDoor, lantern, bollard);
  return g;
}

/**
 * Composite 7-part Coastal Lighthouse added in Stage 4
 */
export function buildCoastalLighthouse(): THREE.Group {
  const g = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x8a929e, roughness: 0.88 });
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xf6f0e4, roughness: 0.78 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xc24942, roughness: 0.68 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.95,
    roughness: 0.2,
  });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.08, 0.24, 12), baseMat);
  plinth.position.y = 0.12;
  plinth.receiveShadow = true;

  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.72, 1.35, 12), towerMat);
  lower.position.y = 0.91;
  lower.castShadow = true;

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.56, 0.58, 12), stripeMat);
  band.position.y = 1.87;
  band.castShadow = true;

  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.54, 0.14, 12), baseMat);
  gallery.position.y = 2.23;

  const lanternRoom = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.48, 10), glassMat);
  lanternRoom.position.y = 2.54;

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.44, 10), stripeMat);
  cap.position.y = 2.98;
  cap.castShadow = true;

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.52, 0.12), stripeMat);
  door.position.set(0, 0.5, 0.66);

  g.add(plinth, lower, band, gallery, lanternRoom, cap, door);
  return g;
}

/**
 * Composite 7-part Sky Observatory Gazebo added in Stage 5
 */
export function buildObservatoryGazebo(): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ad, roughness: 0.86 });
  const copperMat = new THREE.MeshStandardMaterial({ color: 0x4b9382, roughness: 0.38, metalness: 0.35 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.25, metalness: 0.85 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.24, 0.22, 12), stoneMat);
  base.position.y = 0.11;
  base.receiveShadow = true;
  g.add(base);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.15, 8), stoneMat);
    col.position.set(Math.cos(a) * 0.88, 0.78, Math.sin(a) * 0.88);
    col.castShadow = true;
    g.add(col);
  }

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.98, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
    copperMat,
  );
  dome.position.y = 1.32;
  dome.castShadow = true;

  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 8), brassMat);
  finial.position.y = 2.4;

  const tripod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.16, 0.62, 6), stoneMat);
  tripod.position.y = 0.52;

  const telescope = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.92, 10), brassMat);
  telescope.position.set(0, 0.92, 0.14);
  telescope.rotation.x = Math.PI * 0.32;

  g.add(dome, finial, tripod, telescope);
  return g;
}

/**
 * Builds the physical stepping-stone path, warm trailside lanterns,
 * and next-expansion milestone signpost connecting all unlocked stops.
 */
export function buildGuidedTrailMeshes(
  stops: GuidedPathStop[],
  level: number,
  darkMode: boolean,
  nextFrontier: GuidedPathStop | null,
): { group: THREE.Group; activeRing: THREE.Mesh } {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    color: darkMode ? 0x67779c : 0xd5ccb8,
    roughness: 0.88,
    metalness: 0.04,
  });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x764f36, roughness: 0.85 });
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.82,
    roughness: 0.25,
  });

  if (stops.length >= 2) {
    const curvePts = stops.map((s) => new THREE.Vector3(s.x, groundHeightAt(s.x, s.z, level) + 0.05, s.z));
    const curve = new THREE.CatmullRomCurve3(curvePts, false, 'catmullrom', 0.45);
    const totalLen = curve.getLength();
    const stoneCount = Math.max(8, Math.min(90, Math.floor(totalLen / 0.72)));

    const stoneGeo = new THREE.CylinderGeometry(0.28, 0.31, 0.06, 9);
    const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, stoneCount);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < stoneCount; i++) {
      const t = i / Math.max(1, stoneCount - 1);
      const pt = curve.getPointAt(t);
      const gy = groundHeightAt(pt.x, pt.z, level) + 0.035;
      dummy.position.set(pt.x, gy, pt.z);
      dummy.rotation.set(0, (i * 0.7) % Math.PI, 0);
      const s = 0.85 + ((i * 19) % 10) * 0.03;
      dummy.scale.set(s, 1, s * 0.9);
      dummy.updateMatrix();
      stones.setMatrixAt(i, dummy.matrix);
    }
    stones.instanceMatrix.needsUpdate = true;
    stones.receiveShadow = true;
    stones.computeBoundingSphere();
    group.add(stones);

    // Warm trailside guide lanterns placed slightly off-path at major building stops
    stops.slice(1).forEach((stop, idx) => {
      const lx = stop.x + (idx % 2 === 0 ? 0.95 : -0.95);
      const lz = stop.z + 0.65;
      const ly = groundHeightAt(lx, lz, level);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.56, 6), woodMat);
      post.position.set(lx, ly + 0.28, lz);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), lanternMat);
      cap.position.set(lx, ly + 0.6, lz);
      group.add(post, cap);
    });
  }

  // Next-Expansion Frontier Signpost pointing outward toward the upcoming biome (Stage 2+)
  if (nextFrontier && level >= 2) {
    const dir = new THREE.Vector2(nextFrontier.x, nextFrontier.z);
    const len = dir.length() || 1;
    const edgeR = Math.max(2.6, getPlayableRadius(level) - 0.9);
    const sx = (dir.x / len) * edgeR;
    const sz = (dir.y / len) * edgeR;
    const sy = groundHeightAt(sx, sz, level);

    const signGroup = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.82, 6), woodMat);
    post.position.y = 0.41;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.22, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xf7c6cf, roughness: 0.62 }),
    );
    board.position.y = 0.72;
    signGroup.add(post, board);
    signGroup.position.set(sx, sy, sz);
    signGroup.lookAt(nextFrontier.x, sy, nextFrontier.z);
    group.add(signGroup);
  }

  // Active Destination Ring (hidden until user activates Guided Trail)
  const activeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.05, 8, 24),
    new THREE.MeshStandardMaterial({
      color: 0x7cd4c0,
      emissive: 0x2e7d5b,
      emissiveIntensity: 0.9,
      roughness: 0.25,
    }),
  );
  activeRing.rotation.x = Math.PI / 2;
  activeRing.visible = false;
  group.add(activeRing);

  return { group, activeRing };
}
