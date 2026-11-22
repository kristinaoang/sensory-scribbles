import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Eye,
  Gamepad2,
  Grid2x2,
  Moon,
  Music,
  PenLine,
  Route,
  Sparkles,
  Sun,
  UserCircle2,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  AvatarCustomization,
  CanvasStroke,
  JournalEntry,
  RoomQuest,
  WorldProgressionState,
} from '../types';
import {
  AMBIENT_AUDIO_TRACKS,
  type AmbientAudioTrack,
  WorldAmbientAudio,
  getSoundscapeLabel,
} from '../utils/worldAudio';
import {
  DEFAULT_AVATAR_LOOK,
  buildCustomizableAvatar,
  disposeAvatarGroup,
  type AvatarRig,
} from './avatarBuilder';
import { renderWordStrokeToCanvas } from './StrokeCanvas';
import {
  buildCoastalLighthouse,
  buildGlassGreenhouse,
  buildGuidedTrailMeshes,
  buildHarborBoathouse,
  buildLakeWithBridge,
  buildLargeWindmill,
  buildObservatoryGazebo,
  buildSeedCottage,
  buildTeaPavilion,
  buildTrailheadArch,
  getGuidedPathStops,
  getNextLockedFrontier,
  getPlayableRadius,
  groundHeightAt,
  walkSurfaceHeightAt,
} from './worldBuildings';

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _lookAt = new THREE.Vector3();
const _scratchMatrix = new THREE.Matrix4();
const _scratchPos = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3();
const _scratchEuler = new THREE.Euler();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}



function createMeadowTexture(darkMode: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = darkMode ? '#294943' : '#73BC6E';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 820; i++) {
    const px = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1) * 256;
    const py = Math.abs((Math.sin(i * 78.233) * 43758.5453) % 1) * 256;
    ctx.fillStyle =
      i % 4 === 0
        ? darkMode
          ? '#39635B'
          : '#8ED184'
        : i % 3 === 0
          ? darkMode
            ? '#1E3A38'
            : '#5DA659'
          : 'rgba(255,255,255,0.12)';
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.arc(px, py, 1.4 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  return tex;
}

function createTapestryTexture(
  strokes: CanvasStroke[],
  darkMode: boolean,
  activeChapter?: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = darkMode ? '#182140' : '#FAF6EC';
  ctx.fillRect(0, 0, 512, 320);

  const chapterStrokes =
    typeof activeChapter === 'number'
      ? strokes.filter((s) => (s.chapterNumber ?? 1) === activeChapter)
      : strokes;

  const off = document.createElement('canvas');
  off.width = 512;
  off.height = 320;
  const offCtx = off.getContext('2d')!;
  for (const s of chapterStrokes.slice(-14)) {
    renderWordStrokeToCanvas(offCtx, 512, 320, s.strokeJson, s.reflection, darkMode);
    ctx.drawImage(off, 0, 0);
  }

  // Subtle woven border frame
  ctx.strokeStyle = darkMode ? '#52639C' : '#D4C7A9';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 504, 312);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildCompositeTree(style: 'pine' | 'blossom' | 'birch', scale = 1): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({
    color: style === 'birch' ? 0xe7e2d8 : 0x764f36,
    roughness: 0.88,
    metalness: 0.02,
  });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 1.05, 8), trunkMat);
  trunk.position.y = 0.52;
  trunk.castShadow = true;
  g.add(trunk);

  const branchL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.45, 6), trunkMat);
  branchL.position.set(-0.18, 0.86, 0);
  branchL.rotation.z = 0.65;
  g.add(branchL);

  const branchR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.42, 6), trunkMat);
  branchR.position.set(0.17, 0.92, 0.06);
  branchR.rotation.z = -0.58;
  g.add(branchR);

  if (style === 'pine') {
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2e6f4e, roughness: 0.78 });
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.1, 8), foliageMat);
    c1.position.y = 1.25;
    c1.castShadow = true;
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.95, 8), foliageMat);
    c2.position.y = 1.78;
    c2.castShadow = true;
    const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.7, 8), foliageMat);
    c3.position.y = 2.25;
    c3.castShadow = true;
    g.add(c1, c2, c3);
  } else {
    const leafHex = style === 'blossom' ? 0xf2b5c4 : 0x529b66;
    const accentHex = style === 'blossom' ? 0xfbe0e7 : 0x7cc488;
    const matA = new THREE.MeshStandardMaterial({ color: leafHex, roughness: 0.74 });
    const matB = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.7 });
    const puff1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.54, 1), matA);
    puff1.position.set(0, 1.48, 0);
    puff1.castShadow = true;
    const puff2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), matB);
    puff2.position.set(-0.32, 1.24, 0.12);
    puff2.castShadow = true;
    const puff3 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 1), matB);
    puff3.position.set(0.3, 1.28, -0.1);
    puff3.castShadow = true;
    g.add(puff1, puff2, puff3);
  }

  g.scale.setScalar(scale);
  return g;
}

function buildEntryPlotMesh(
  entry: JournalEntry,
  rotorsOut: THREE.Object3D[],
): { group: THREE.Group; hitBox: THREE.Mesh } {
  const group = new THREE.Group();
  const spec = entry.worldSpec;
  const mood = new THREE.Color(spec.moodColor || '#3B845E');
  const accent = new THREE.Color(spec.secondaryColor || '#F2C572');
  const strokeColor = new THREE.Color(entry.strokeJson?.color || '#2E7D5B');

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xa1a7b0, roughness: 0.88, metalness: 0.04 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c5338, roughness: 0.85, metalness: 0.04 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xf4ece0, roughness: 0.82 });
  const moodMat = new THREE.MeshStandardMaterial({ color: mood, roughness: 0.56, metalness: 0.08 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35, metalness: 0.25 });
  const signMat = new THREE.MeshStandardMaterial({ color: strokeColor, roughness: 0.5, metalness: 0.12 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.72,
    roughness: 0.25,
  });

  // Grounded stone garden plinth
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.18, 0.16, 12), stoneMat);
  plinth.position.y = 0.08;
  plinth.receiveShadow = true;
  group.add(plinth);

  const landmark =
    spec.landmark ||
    (spec.elementType === 'windmill'
      ? 'windmill'
      : spec.elementType === 'pond'
        ? 'stepping_pond'
        : spec.elementType === 'loom'
          ? 'weaver_loom'
          : spec.elementType === 'lantern'
            ? 'stone_lantern'
            : 'wooden_cabin');

  if (landmark === 'wooden_cabin') {
    const walls = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.78, 0.96), creamMat);
    walls.position.y = 0.55;
    walls.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.64, 4), moodMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.24;
    roof.castShadow = true;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.44, 0.08), woodMat);
    door.position.set(0, 0.38, 0.49);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.08), glowMat);
    win.position.set(0.32, 0.6, 0.49);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 0.18), stoneMat);
    chimney.position.set(-0.34, 1.24, -0.2);
    group.add(walls, roof, door, win, chimney);
  } else if (landmark === 'windmill') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, 1.18, 10), creamMat);
    base.position.y = 0.74;
    base.castShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.46, 10), moodMat);
    cap.position.y = 1.54;
    const rotor = new THREE.Group();
    rotor.position.set(0, 1.18, 0.4);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Group();
      b.rotation.z = (i * Math.PI) / 2;
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.64, 0.03), woodMat);
      spar.position.y = 0.32;
      const sail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.46, 0.02), accentMat);
      sail.position.set(0.1, 0.36, 0.01);
      b.add(spar, sail);
      rotor.add(b);
    }
    rotorsOut.push(rotor);
    group.add(base, cap, rotor);
  } else if (landmark === 'stepping_pond') {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.12, 8, 18), stoneMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.2;
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.72, 0.06, 18),
      new THREE.MeshPhysicalMaterial({ color: 0x5ea9d6, roughness: 0.1, clearcoat: 0.9 }),
    );
    water.position.y = 0.18;
    const lily = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12), moodMat);
    lily.position.set(-0.2, 0.22, 0.14);
    const lotus = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), accentMat);
    lotus.position.set(-0.2, 0.3, 0.14);
    group.add(rim, water, lily, lotus);
  } else if (landmark === 'tea_pavilion') {
    for (const [px, pz] of [[-0.44, -0.44], [0.44, -0.44], [-0.44, 0.44], [0.44, 0.44]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.92, 8), woodMat);
      post.position.set(px, 0.62, pz);
      post.castShadow = true;
      group.add(post);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.92, 0.52, 4), moodMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.3;
    roof.castShadow = true;
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), glowMat);
    lantern.position.y = 0.46;
    group.add(roof, lantern);
  } else if (landmark === 'weaver_loom') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.1, 0.52), woodMat);
    base.position.y = 0.2;
    [-0.36, 0.36].forEach((x) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.98, 0.1), woodMat);
      post.position.set(x, 0.68, 0);
      post.castShadow = true;
      group.add(post);
    });
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.68, 0.05), moodMat);
    cloth.position.y = 0.72;
    const shuttle = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.18, 4, 8), accentMat);
    shuttle.rotation.z = Math.PI / 2;
    shuttle.position.set(0, 0.72, 0.08);
    group.add(base, cloth, shuttle);
  } else {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.76, 6), stoneMat);
    col.position.y = 0.52;
    col.castShadow = true;
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), glowMat);
    core.position.y = 1.02;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.34, 6), stoneMat);
    cap.position.y = 1.32;
    cap.castShadow = true;
    group.add(col, core, cap);
  }

  // Colored garden signpost / pennant matching the author's ink stroke
  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.68, 6), woodMat);
  stake.position.set(0.82, 0.42, 0.64);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.04), signMat);
  flag.position.set(0.96, 0.64, 0.64);
  group.add(stake, flag);

  // Invisible raycast proxy box for responsive clicking
  const hitBox = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 2.2, 2.2),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitBox.position.y = 1.0;
  hitBox.userData.entry = entry;
  hitBox.layers.set(1);
  group.add(hitBox);

  return { group, hitBox };
}

function getPlotCoordinate(index: number, level: number): { x: number; z: number } {
  // Keep central campfire hearth and Stage 1 Shared Canvas Board clear
  const maxR = getPlayableRadius(level);
  const ring = index < 5 ? 0 : index < 12 ? 1 : 2;
  const ringCount = ring === 0 ? 5 : ring === 1 ? 7 : 10;
  const idxInRing = ring === 0 ? index : ring === 1 ? index - 5 : index - 12;
  const radius =
    ring === 0
      ? Math.min(2.55, Math.max(1.95, maxR - 1.05))
      : ring === 1
        ? Math.min(maxR - 1.35, 5.4)
        : Math.min(maxR - 1.45, 9.2);
  const angle = (idxInRing / ringCount) * Math.PI * 2 + ring * 0.5 + 0.55;
  let x = Math.cos(angle) * radius;
  let z = Math.sin(angle) * radius;
  // Avoid Shared Canvas Board at (0, -2.15) at ALL levels
  if (Math.hypot(x, z + 2.15) < 2.05) {
    x += x >= 0 ? 1.85 : -1.85;
    z = Math.max(0.8, z + 1.8);
  }
  // Avoid Great Windmill at (-3.8, -3.2)
  if (level >= 2 && Math.hypot(x + 3.8, z + 3.2) < 2.2) {
    x = Math.abs(x) + 1.6;
  }
  // Avoid Crystal Lake at (6.2, 0.4)
  if (level >= 3 && Math.hypot(x - 6.2, z - 0.4) < 3.15) {
    x = -Math.abs(x);
    z += z >= 0 ? 1.4 : -1.4;
  }
  return { x, z };
}

interface RoomWorld3DProps {
  roomName: string;
  roomCode: string;
  entries: JournalEntry[];
  strokes?: CanvasStroke[];
  progression?: WorldProgressionState;
  darkMode?: boolean;
  presenceCount?: number;
  userAvatarColor?: string;
  avatarLook?: AvatarCustomization;
  justExpandedQuest?: RoomQuest | null;
  onDismissExpansionBanner?: () => void;
  onSelectEntry: (entry: JournalEntry) => void;
  onOpenMinigame?: (entry: JournalEntry) => void;
  onOpenStudio?: () => void;
  onOpenMosaic?: () => void;
  onOpenCustomizer?: () => void;
  onToggleDarkMode?: () => void;
  embedded?: boolean;
}

export const RoomWorld3D: React.FC<RoomWorld3DProps> = ({
  roomName,
  roomCode,
  entries,
  strokes = [],
  progression,
  darkMode = false,
  presenceCount = 1,
  userAvatarColor = '#2E7D5B',
  avatarLook,
  justExpandedQuest = null,
  onDismissExpansionBanner,
  onSelectEntry,
  onOpenMinigame,
  onOpenStudio,
  onOpenMosaic,
  onOpenCustomizer,
  onToggleDarkMode,
  embedded = false,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const walkTargetRef = useRef<THREE.Vector3 | null>(null);
  const camModeRef = useRef<'follow' | 'aerial' | 'first'>('follow');
  const levelRef = useRef<number>(progression?.level ?? 1);
  const onSelectEntryRef = useRef(onSelectEntry);
  const onOpenStudioRef = useRef(onOpenStudio);
  const audioRef = useRef<WorldAmbientAudio | null>(null);

  const [camMode, setCamMode] = useState<'follow' | 'aerial' | 'first'>('follow');
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [questBarMinimized, setQuestBarMinimized] = useState(false);
  const [muted, setMuted] = useState(false);
  const [audioTrack, setAudioTrack] = useState<AmbientAudioTrack>('lofi_hearth');
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [inspectedEntry, setInspectedEntry] = useState<JournalEntry | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);

  const effectiveAvatarLook = useMemo<AvatarCustomization>(
    () =>
      avatarLook ?? {
        ...DEFAULT_AVATAR_LOOK,
        tunicColor: userAvatarColor || DEFAULT_AVATAR_LOOK.tunicColor,
      },
    [avatarLook, userAvatarColor],
  );

  useEffect(() => {
    camModeRef.current = camMode;
  }, [camMode]);

  useEffect(() => {
    onSelectEntryRef.current = onSelectEntry;
  }, [onSelectEntry]);

  useEffect(() => {
    onOpenStudioRef.current = onOpenStudio;
  }, [onOpenStudio]);

  const level = progression?.level ?? 1;
  const activeChapter = progression?.activeQuest?.chapterNumber ?? level;
  useEffect(() => {
    levelRef.current = level;
    audioRef.current?.setLevel(level);
  }, [level]);

  const pathStops = useMemo(() => getGuidedPathStops(level), [level]);
  const nextFrontier = useMemo(() => getNextLockedFrontier(level), [level]);

  // Ref holding scene handles so prop updates sync into the existing WebGL scene without tearing down context
  const sceneSyncRef = useRef<{
    syncWorld: (
      nextEntries: JournalEntry[],
      nextStrokes: CanvasStroke[],
      nextLevel: number,
      nextChapter: number,
      nextDark: boolean,
      nextAvatarLook: AvatarCustomization,
    ) => void;
    triggerCelebration: () => void;
    setGuidedMarker: (stop: { x: number; z: number } | null, lvl: number) => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSoftwareGl = detectSoftwareGl();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 560;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => setContextLost(false);
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(darkMode ? '#1A2444' : '#CBE8FA');
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(skyColor.getHex(), darkMode ? 0.022 : 0.016);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 140);

    const hemi = new THREE.HemisphereLight(darkMode ? 0x6c88c4 : 0xdbeafe, darkMode ? 0x2a2438 : 0x6b4f35, darkMode ? 0.65 : 0.85);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(darkMode ? 0xc7d8ff : 0xfff1d6, darkMode ? 1.15 : 1.55);
    keyLight.position.set(12, 18, 11);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.left = -22;
    keyLight.shadow.camera.right = 22;
    keyLight.shadow.camera.top = 22;
    keyLight.shadow.camera.bottom = -22;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    // Extended surrounding sea so there are no cut-off edges
    const seaMat = new THREE.MeshPhysicalMaterial({
      color: darkMode ? 0x264873 : 0x5ca8d6,
      roughness: 0.16,
      clearcoat: 0.8,
    });
    const sea = new THREE.Mesh(new THREE.CylinderGeometry(72, 72, 0.3, 48), seaMat);
    sea.position.y = -0.68;
    scene.add(sea);

    // Distant horizon silhouette islets for natural depth
    const horizonGroup = new THREE.Group();
    const horizonMat = new THREE.MeshStandardMaterial({ color: darkMode ? 0x25385c : 0x7cb992, roughness: 0.9 });
    [
      { x: -29, z: -24, r: 6.5, h: 2.2 },
      { x: 31, z: -20, r: 5.5, h: 1.9 },
      { x: -24, z: 28, r: 5.0, h: 1.7 },
      { x: 26, z: 26, r: 6.0, h: 2.1 },
    ].forEach((isle) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(isle.r, isle.h, 9), horizonMat);
      m.position.set(isle.x, -0.35, isle.z);
      horizonGroup.add(m);
    });
    scene.add(horizonGroup);

    // Dynamic Island Ground Mesh (regenerated cleanly when expansion level increases)
    let currentGroundTex = createMeadowTexture(darkMode);
    currentGroundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const groundMat = new THREE.MeshStandardMaterial({ map: currentGroundTex, roughness: 0.9, metalness: 0.02 });
    const groundGeo = new THREE.PlaneGeometry(46, 46, 56, 56);
    groundGeo.rotateX(-Math.PI / 2);
    const updateTerrainHeights = (lvl: number) => {
      const posAttr = groundGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);
        posAttr.setY(i, groundHeightAt(vx, vz, lvl));
      }
      posAttr.needsUpdate = true;
      groundGeo.computeVertexNormals();
    };
    updateTerrainHeights(levelRef.current);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    scene.add(ground);

    // Level 1 Seed Clearing Hearth (center)
    const hearthGroup = new THREE.Group();
    const hearthStoneMat = new THREE.MeshStandardMaterial({ color: 0x8e95a0, roughness: 0.88 });
    const logMat = new THREE.MeshStandardMaterial({ color: 0x6d472e, roughness: 0.86 });
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0xfdba74,
      emissive: 0xf97316,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), hearthStoneMat);
      st.position.set(Math.cos(a) * 0.72, 0.12, Math.sin(a) * 0.72);
      st.castShadow = true;
      hearthGroup.add(st);
    }
    const logA = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.95, 8), logMat);
    logA.rotation.z = Math.PI / 2;
    logA.rotation.y = 0.5;
    logA.position.y = 0.15;
    const logB = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.95, 8), logMat);
    logB.rotation.z = Math.PI / 2;
    logB.rotation.y = -0.6;
    logB.position.y = 0.19;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.48, 7), emberMat);
    flame.position.y = 0.34;
    const fireLight = new THREE.PointLight(0xffa94d, 1.35, 8);
    fireLight.position.set(0, 0.82, 0);
    hearthGroup.add(logA, logB, flame, fireLight);
    hearthGroup.position.set(0, groundHeightAt(0, 0, levelRef.current), 0);
    scene.add(hearthGroup);

    // Community Shared Canvas Board (present from Stage 1 alongside the campfire!)
    const tapestryGroup = new THREE.Group();
    const frameWoodMat = new THREE.MeshStandardMaterial({ color: 0x764f36, roughness: 0.82 });
    [-1.45, 1.45].forEach((px) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.35, 8), frameWoodMat);
      post.position.set(px, 1.15, 0);
      post.castShadow = true;
      tapestryGroup.add(post);
    });
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 0.16), frameWoodMat);
    topBeam.position.set(0, 2.28, 0);
    topBeam.castShadow = true;
    const botBeam = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.12), frameWoodMat);
    botBeam.position.set(0, 0.45, 0);
    let currentTapestryTex = createTapestryTexture(strokes, darkMode, activeChapter);
    currentTapestryTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const tapestryMat = new THREE.MeshStandardMaterial({ map: currentTapestryTex, roughness: 0.72 });
    const tapestryPanel = new THREE.Mesh(new THREE.BoxGeometry(2.74, 1.72, 0.06), tapestryMat);
    tapestryPanel.position.set(0, 1.36, 0);
    tapestryPanel.castShadow = true;
    const tapestryHit = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 2.3, 0.5),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    tapestryHit.position.set(0, 1.2, 0);
    tapestryHit.userData.openCanvas = true;
    tapestryHit.layers.set(1);
    tapestryGroup.add(topBeam, botBeam, tapestryPanel, tapestryHit);
    tapestryGroup.position.set(0, groundHeightAt(0, -2.15, levelRef.current), -2.15);
    tapestryGroup.visible = true;
    scene.add(tapestryGroup);

    // Dynamic Groups for Expansion Tiers, Buildings, Guided Path, Trees, Landmarks & Rotors
    const expansionGroup = new THREE.Group();
    const plotsGroup = new THREE.Group();
    scene.add(expansionGroup, plotsGroup);

    let activeRingMesh: THREE.Mesh | null = null;
    let currentGuidedPos: { x: number; z: number } | null = null;
    const ambientAudio = new WorldAmbientAudio();
    ambientAudio.setLevel(levelRef.current);
    ambientAudio.setTrack(audioTrack);
    ambientAudio.setMuted(muted);
    audioRef.current = ambientAudio;

    const rotors: THREE.Object3D[] = [];
    const biomeRotors: THREE.Object3D[] = [];
    const clickableProxies: THREE.Object3D[] = [tapestryHit];
    const risingPlots: Array<{ group: THREE.Group; targetY: number }> = [];
    let knownEntryIds = new Set<string>();
    let lastLevelBuilt = 0;
    let lastDarkBuilt = darkMode;

    // Ambient Fireflies / Blossom Motes (InstancedMesh)
    const moteCount = 34;
    const moteMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    });
    const motes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.052, 8, 8), moteMat, moteCount);
    motes.frustumCulled = false;
    const moteSeeds = Array.from({ length: moteCount }, (_, i) => ({
      angle: (i / moteCount) * Math.PI * 2,
      radius: 2.2 + ((i * 37) % 100) / 8,
      baseY: 0.55 + ((i * 53) % 100) / 48,
      speed: 0.3 + ((i * 23) % 100) / 140,
    }));
    scene.add(motes);

    // Expansion Celebration Particles (rise smoothly when world levels up)
    const burstCount = 40;
    const burstMat = new THREE.MeshStandardMaterial({
      color: 0x7cd4c0,
      emissive: 0x34d399,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    const burstMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.09, 0), burstMat, burstCount);
    burstMesh.frustumCulled = false;
    burstMesh.visible = false;
    scene.add(burstMesh);
    let celebrationTimer = 0;

    // Walkable Customizable Avatar
    let avatar: AvatarRig = buildCustomizableAvatar(effectiveAvatarLook);
    let lastAvatarSig = JSON.stringify(effectiveAvatarLook);
    const playerPos = new THREE.Vector3(0, groundHeightAt(0, 1.9, levelRef.current), 1.9);
    avatar.root.position.copy(playerPos);
    scene.add(avatar.root);

    const rebuildExpansionBiome = (lvl: number, isDark = darkMode) => {
      biomeRotors.length = 0;
      while (expansionGroup.children.length > 0) {
        const child = expansionGroup.children.pop()!;
        expansionGroup.remove(child);
      }
      updateTerrainHeights(lvl);
      hearthGroup.position.y = groundHeightAt(0, 0, lvl);
      tapestryGroup.position.y = groundHeightAt(0, -2.15, lvl);
      tapestryGroup.visible = true;

      // Stage 1 (lvl === 1) starts cleanly with the campfire + Shared Canvas Board (+ user prompt landmarks)!
      // Level 1 completed (lvl >= 2): Expands land + adds Trailhead Arch, Large Meadow Windmill & wildflowers
      if (lvl >= 2) {
        const arch = buildTrailheadArch();
        arch.position.set(0.4, groundHeightAt(0.4, 1.9, lvl), 1.9);
        expansionGroup.add(arch);

        const largeWindmill = buildLargeWindmill(biomeRotors);
        largeWindmill.position.set(-3.8, groundHeightAt(-3.8, -3.2, lvl), -3.2);
        largeWindmill.rotation.y = 0.58;
        expansionGroup.add(largeWindmill);

        const treeCount = 6 + Math.min(18, lvl * 3);
        const ringR = getPlayableRadius(lvl) - 0.85;
        for (let i = 0; i < treeCount; i++) {
          const ang = (i / treeCount) * Math.PI * 2 + 0.18;
          const tx = Math.cos(ang) * ringR;
          const tz = Math.sin(ang) * ringR;
          const ty = groundHeightAt(tx, tz, lvl);
          if (ty < -0.22) continue;
          if (lvl >= 3 && Math.hypot(tx - 6.2, tz - 0.4) < 3.0) continue;
          const style = i % 3 === 0 ? 'blossom' : i % 2 === 0 ? 'pine' : 'birch';
          const tree = buildCompositeTree(style, 0.88 + (i % 3) * 0.14);
          tree.position.set(tx, ty, tz);
          expansionGroup.add(tree);
        }

        const flowerGeo = new THREE.CylinderGeometry(0.09, 0.03, 0.14, 6);
        const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
        const flowerCount = 44;
        const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
        const palette = [0xf7c6cf, 0xfbe774, 0x9bd8ec, 0xc1b1db];
        let placedFlowers = 0;
        for (let i = 0; i < flowerCount; i++) {
          const ang = (i / flowerCount) * Math.PI * 2 * 3;
          const r = 3.0 + ((i * 29) % 100) / 24;
          const fx = Math.cos(ang) * r;
          const fz = Math.sin(ang) * r;
          if (lvl >= 3 && Math.hypot(fx - 6.2, fz - 0.4) < 2.95) continue;
          const fy = groundHeightAt(fx, fz, lvl) + 0.07;
          _scratchPos.set(fx, fy, fz);
          _scratchEuler.set(0, ang, 0);
          _scratchQuat.setFromEuler(_scratchEuler);
          _scratchScale.setScalar(0.85 + (i % 4) * 0.15);
          _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
          flowers.setMatrixAt(placedFlowers, _scratchMatrix);
          flowers.setColorAt(placedFlowers, new THREE.Color(palette[i % palette.length]));
          placedFlowers++;
        }
        flowers.count = placedFlowers;
        flowers.instanceMatrix.needsUpdate = true;
        if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
        flowers.computeBoundingSphere();
        expansionGroup.add(flowers);
      }

      // Level 2 completed (lvl >= 3): Expands land + carves Crystal Lake with Arched Timber Bridge across it
      if (lvl >= 3) {
        const lakeAndBridge = buildLakeWithBridge(isDark);
        expansionGroup.add(lakeAndBridge);
      }

      // Level 3 completed (lvl >= 4): Expands land + Seed Cottage, Botanical Glass Greenhouse & Lakeside Tea Pavilion
      if (lvl >= 4) {
        const cottage = buildSeedCottage();
        cottage.position.set(-6.8, groundHeightAt(-6.8, 3.6, lvl), 3.6);
        cottage.rotation.y = 0.85;
        expansionGroup.add(cottage);

        const greenhouse = buildGlassGreenhouse();
        greenhouse.position.set(4.4, groundHeightAt(4.4, -7.8, lvl), -7.8);
        greenhouse.rotation.y = -0.35;
        expansionGroup.add(greenhouse);

        const teaPavilion = buildTeaPavilion();
        teaPavilion.position.set(7.4, groundHeightAt(7.4, 5.8, lvl), 5.8);
        teaPavilion.rotation.y = -0.6;
        expansionGroup.add(teaPavilion);
      }

      // Level 4 completed (lvl >= 5): Expands land + Harbor Boathouse, Long Timber Pier, Rowboat & Coastal Lighthouse
      if (lvl >= 5) {
        const boathouse = buildHarborBoathouse();
        boathouse.position.set(0.2, groundHeightAt(0.2, 13.8, lvl), 13.8);
        boathouse.rotation.y = Math.PI;
        expansionGroup.add(boathouse);

        const lighthouse = buildCoastalLighthouse();
        lighthouse.position.set(-10.8, groundHeightAt(-10.8, 9.2, lvl), 9.2);
        lighthouse.rotation.y = 0.7;
        expansionGroup.add(lighthouse);

        const pierGroup = new THREE.Group();
        const pierWood = new THREE.MeshStandardMaterial({ color: 0x855a3b, roughness: 0.85 });
        const lanternGlow = new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.9,
        });
        const pierZStart = getPlayableRadius(lvl) - 0.9;
        for (let i = 0; i < 6; i++) {
          const pz = pierZStart + i * 0.72;
          const plank = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.62), pierWood);
          plank.position.set(0, 0.28, pz);
          plank.castShadow = true;
          pierGroup.add(plank);
          if (i % 2 === 1) {
            [-0.76, 0.76].forEach((px) => {
              const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.3, 8), pierWood);
              piling.position.set(px, -0.1, pz);
              pierGroup.add(piling);
            });
          }
        }
        const beaconPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.3, 8), pierWood);
        beaconPost.position.set(0.75, 0.9, pierZStart + 3.6);
        const beaconLamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lanternGlow);
        beaconLamp.position.set(0.75, 1.56, pierZStart + 3.6);
        pierGroup.add(beaconPost, beaconLamp);

        const boat = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.34, 0.72), pierWood);
        hull.position.y = 0.05;
        const seat = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.06, 0.64),
          new THREE.MeshStandardMaterial({ color: 0xc2956b, roughness: 0.8 }),
        );
        seat.position.y = 0.22;
        const prow = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.55, 4), pierWood);
        prow.rotation.z = -Math.PI / 2;
        prow.rotation.x = Math.PI / 4;
        prow.position.set(0.88, 0.08, 0);
        boat.add(hull, seat, prow);
        boat.position.set(-1.6, -0.45, pierZStart + 3.4);
        boat.rotation.y = 0.4;
        pierGroup.add(boat);
        expansionGroup.add(pierGroup);
      }

      // Level 5+ completed (lvl >= 6): Elevated Highland Ridge & Copper-Domed Sky Observatory Gazebo
      if (lvl >= 6) {
        const observatory = buildObservatoryGazebo();
        observatory.position.set(-4.8, groundHeightAt(-4.8, -14.8, lvl), -14.8);
        expansionGroup.add(observatory);
      }

      // Guided stepping-stone trail & frontier milestone signpost
      const stops = getGuidedPathStops(lvl);
      const upcoming = getNextLockedFrontier(lvl);
      const { group: trailGroup, activeRing } = buildGuidedTrailMeshes(stops, lvl, isDark, upcoming);
      activeRingMesh = activeRing;
      if (currentGuidedPos) {
        activeRing.visible = true;
        activeRing.position.set(
          currentGuidedPos.x,
          walkSurfaceHeightAt(currentGuidedPos.x, currentGuidedPos.z, lvl) + 0.2,
          currentGuidedPos.z,
        );
      }
      expansionGroup.add(trailGroup);
    };

    const syncWorld = (
      nextEntries: JournalEntry[],
      nextStrokes: CanvasStroke[],
      nextLevel: number,
      nextChapter: number,
      nextDark: boolean,
      nextAvatarLook: AvatarCustomization,
    ) => {
      // 1. Update Theme & Lighting
      const targetSky = new THREE.Color(nextDark ? '#1A2444' : '#CBE8FA');
      scene.background = targetSky;
      scene.fog = new THREE.FogExp2(targetSky.getHex(), nextDark ? 0.022 : 0.016);
      hemi.color.setHex(nextDark ? 0x6c88c4 : 0xdbeafe);
      hemi.groundColor.setHex(nextDark ? 0x2a2438 : 0x6b4f35);
      hemi.intensity = nextDark ? 0.65 : 0.85;
      keyLight.color.setHex(nextDark ? 0xc7d8ff : 0xfff1d6);
      keyLight.intensity = nextDark ? 1.15 : 1.55;
      seaMat.color.setHex(nextDark ? 0x264873 : 0x5ca8d6);
      horizonMat.color.setHex(nextDark ? 0x25385c : 0x7cb992);

      const newGroundTex = createMeadowTexture(nextDark);
      newGroundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      groundMat.map = newGroundTex;
      groundMat.needsUpdate = true;
      currentGroundTex.dispose();
      currentGroundTex = newGroundTex;

      const newTapTex = createTapestryTexture(nextStrokes, nextDark, nextChapter);
      newTapTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tapestryMat.map = newTapTex;
      tapestryMat.needsUpdate = true;
      currentTapestryTex.dispose();
      currentTapestryTex = newTapTex;

      // Sync customizable 3D avatar look seamlessly without resetting position
      const nextSig = JSON.stringify(nextAvatarLook);
      if (nextSig !== lastAvatarSig) {
        lastAvatarSig = nextSig;
        const prevRotY = avatar.root.rotation.y;
        scene.remove(avatar.root);
        disposeAvatarGroup(avatar.root);
        avatar = buildCustomizableAvatar(nextAvatarLook);
        avatar.root.position.copy(playerPos);
        avatar.root.rotation.y = prevRotY;
        scene.add(avatar.root);
      }

      // 2. Rebuild biome structures, buildings, and trail if level or theme changed
      if (nextLevel !== lastLevelBuilt || nextDark !== lastDarkBuilt) {
        lastLevelBuilt = nextLevel;
        lastDarkBuilt = nextDark;
        rebuildExpansionBiome(nextLevel, nextDark);
      }
      tapestryGroup.visible = true;

      // Clamp avatar safely within the active stage's island boundary
      const safeWalkR = Math.max(1.5, getPlayableRadius(nextLevel) - 0.65);
      const currR = Math.hypot(playerPos.x, playerPos.z);
      if (currR > safeWalkR) {
        const scale = safeWalkR / currR;
        playerPos.x *= scale;
        playerPos.z *= scale;
        playerPos.y = walkSurfaceHeightAt(playerPos.x, playerPos.z, nextLevel);
        avatar.root.position.copy(playerPos);
        walkTargetRef.current = null;
      }

      // 3. Reconcile user prompt landmarks incrementally at ALL levels (Stage 1 starts with campfire + canvas board; each prompt answer adds a landmark!)
      const landmarkEntries = nextEntries.filter((e) => !e.isDemo);
      const incomingIds = new Set(landmarkEntries.map((e) => e.id));
      const needsFullPlotRebuild =
        Array.from(knownEntryIds).some((id) => !incomingIds.has(id)) ||
        (landmarkEntries.length > 0 && plotsGroup.children.length === 0);

      if (needsFullPlotRebuild) {
        while (plotsGroup.children.length > 0) {
          plotsGroup.remove(plotsGroup.children.pop()!);
        }
        knownEntryIds = new Set();
        clickableProxies.length = 0;
        clickableProxies.push(tapestryHit);
        rotors.length = 0;
        risingPlots.length = 0;
      }

      landmarkEntries.forEach((entry, idx) => {
        if (knownEntryIds.has(entry.id)) return;
        knownEntryIds.add(entry.id);
        const { x, z } = getPlotCoordinate(idx, nextLevel);
        const targetY = groundHeightAt(x, z, nextLevel);
        const { group: plotGroup, hitBox } = buildEntryPlotMesh(entry, rotors);
        plotGroup.position.set(x, needsFullPlotRebuild ? targetY : targetY - 2.2, z);
        plotGroup.lookAt(0, plotGroup.position.y, 0);
        plotsGroup.add(plotGroup);
        clickableProxies.push(hitBox);
        if (!needsFullPlotRebuild) {
          risingPlots.push({ group: plotGroup, targetY });
        }
      });
    };

    sceneSyncRef.current = {
      syncWorld,
      triggerCelebration: () => {
        celebrationTimer = 3.2;
        burstMesh.visible = true;
      },
      setGuidedMarker: (stop, lvl) => {
        currentGuidedPos = stop;
        if (!activeRingMesh) return;
        if (!stop) {
          activeRingMesh.visible = false;
        } else {
          activeRingMesh.visible = true;
          activeRingMesh.position.set(
            stop.x,
            walkSurfaceHeightAt(stop.x, stop.z, lvl) + 0.22,
            stop.z,
          );
        }
      },
    };

    // Initial scene population
    syncWorld(entries, strokes, level, activeChapter, darkMode, effectiveAvatarLook);

    if (!isSoftwareGl) renderer.compile(scene, camera);

    // Input & Raycast state
    let yaw = 0;
    let pitch = 0.42;
    let dragging = false;
    let dragStart = { x: 0, y: 0 };
    let lastPointer = { x: 0, y: 0 };

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const groundRaycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
      ambientAudio.unlock();
      dragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      lastPointer = { x: e.clientX, y: e.clientY };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      lastPointer = { x: e.clientX, y: e.clientY };
      yaw -= dx * 0.006;
      pitch = Math.max(0.18, Math.min(1.12, pitch + dy * 0.005));
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 7) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);
      const plotHits = raycaster.intersectObjects(clickableProxies, false);
      if (plotHits.length > 0) {
        const hitObj = plotHits[0].object;
        if (hitObj.userData.openCanvas) {
          onOpenStudioRef.current?.();
          return;
        }
        if (hitObj.userData.entry) {
          setInspectedEntry(hitObj.userData.entry);
          return;
        }
      }

      groundRaycaster.setFromCamera(pointerNdc, camera);
      const gHits = groundRaycaster.intersectObject(ground, false);
      const maxWalkR = getPlayableRadius(levelRef.current) - 0.5;
      if (gHits.length > 0 && Math.hypot(gHits[0].point.x, gHits[0].point.z) < maxWalkR) {
        walkTargetRef.current = gHits[0].point.clone();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      ambientAudio.unlock();
      keysRef.current[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        walkTargetRef.current = null;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    const onBlur = () => {
      keysRef.current = {};
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    let frameId = 0;
    let disposed = false;
    let walkPhase = 0;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      const keys = keysRef.current;
      const activeLvl = levelRef.current;

      if (keys['KeyQ']) yaw += dt * 1.8;
      if (keys['KeyE']) yaw -= dt * 1.8;

      const fwdIn = Number(Boolean(keys['KeyW'] || keys['ArrowUp'])) - Number(Boolean(keys['KeyS'] || keys['ArrowDown']));
      const strIn = Number(Boolean(keys['KeyD'] || keys['ArrowRight'])) - Number(Boolean(keys['KeyA'] || keys['ArrowLeft']));

      _move.set(0, 0, 0);
      if (fwdIn !== 0 || strIn !== 0) {
        _fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
        _move.addScaledVector(_fwd, fwdIn).addScaledVector(_right, strIn).normalize();
      } else if (walkTargetRef.current) {
        const dx = walkTargetRef.current.x - playerPos.x;
        const dz = walkTargetRef.current.z - playerPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.25) _move.set(dx / dist, 0, dz / dist);
        else walkTargetRef.current = null;
      }

      let isMoving = false;
      const maxWalkR = getPlayableRadius(activeLvl) - 0.5;
      if (_move.lengthSq() > 0.01) {
        isMoving = true;
        const nx = playerPos.x + _move.x * 4.2 * dt;
        const nz = playerPos.z + _move.z * 4.2 * dt;
        if (Math.hypot(nx, nz) < maxWalkR) {
          playerPos.x = nx;
          playerPos.z = nz;
        }
        avatar.root.rotation.y = Math.atan2(_move.x, _move.z);
      }

      playerPos.y = walkSurfaceHeightAt(playerPos.x, playerPos.z, activeLvl);
      avatar.root.position.copy(playerPos);

      if (isMoving && !prefersReducedMotion) {
        walkPhase += dt * 9.0;
        const swing = Math.sin(walkPhase) * 0.55;
        avatar.leftLeg.rotation.x = swing;
        avatar.rightLeg.rotation.x = -swing;
      } else {
        avatar.leftLeg.rotation.x *= 0.85;
        avatar.rightLeg.rotation.x *= 0.85;
      }

      // Smoothly rise newly placed landmarks
      for (let i = risingPlots.length - 1; i >= 0; i--) {
        const item = risingPlots[i];
        item.group.position.y = THREE.MathUtils.damp(item.group.position.y, item.targetY, 6, dt);
        if (Math.abs(item.group.position.y - item.targetY) < 0.01) {
          item.group.position.y = item.targetY;
          risingPlots.splice(i, 1);
        }
      }

      if (!prefersReducedMotion) {
        rotors.forEach((r) => {
          r.rotation.z += dt * 1.15;
        });
        biomeRotors.forEach((r) => {
          r.rotation.z += dt * 1.05;
        });
        flame.scale.y = 0.92 + Math.sin(elapsed * 5.2) * 0.12;
        if (activeRingMesh && activeRingMesh.visible && currentGuidedPos) {
          activeRingMesh.position.y =
            walkSurfaceHeightAt(currentGuidedPos.x, currentGuidedPos.z, activeLvl) +
            0.22 +
            Math.sin(elapsed * 3.0) * 0.06;
        }
      }

      // Ambient motes
      for (let i = 0; i < moteCount; i++) {
        const s = moteSeeds[i];
        const ang = prefersReducedMotion ? s.angle : s.angle + elapsed * s.speed * 0.25;
        const py = prefersReducedMotion ? s.baseY : s.baseY + Math.sin(elapsed * s.speed + i) * 0.22;
        _scratchPos.set(Math.cos(ang) * s.radius, py, Math.sin(ang) * s.radius);
        _scratchEuler.set(0, ang, 0);
        _scratchQuat.setFromEuler(_scratchEuler);
        _scratchScale.setScalar(0.85);
        _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
        motes.setMatrixAt(i, _scratchMatrix);
      }
      motes.instanceMatrix.needsUpdate = true;

      // Celebration burst particles on world expansion
      if (celebrationTimer > 0) {
        celebrationTimer = Math.max(0, celebrationTimer - dt);
        const progress = 1 - celebrationTimer / 3.2;
        for (let i = 0; i < burstCount; i++) {
          const ang = (i / burstCount) * Math.PI * 2 + progress * 1.5;
          const r = 1.5 + progress * 10;
          const by = 0.6 + progress * 5.5 + Math.sin(i + elapsed * 4) * 0.35;
          _scratchPos.set(Math.cos(ang) * r, by, Math.sin(ang) * r);
          _scratchEuler.set(elapsed * 2, ang, 0);
          _scratchQuat.setFromEuler(_scratchEuler);
          _scratchScale.setScalar(Math.max(0.01, (1 - progress) * 1.15));
          _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
          burstMesh.setMatrixAt(i, _scratchMatrix);
        }
        burstMesh.instanceMatrix.needsUpdate = true;
        if (celebrationTimer <= 0) burstMesh.visible = false;
      }

      // Exponentially damped camera modes
      const damp = 1 - Math.exp(-7.5 * dt);
      if (camModeRef.current === 'first') {
        avatar.root.visible = false;
        _camTarget.set(playerPos.x, playerPos.y + 1.05, playerPos.z);
        camera.position.lerp(_camTarget, damp);
        _lookAt.set(
          playerPos.x - Math.sin(yaw) * 4,
          playerPos.y + 1.05 - Math.sin(pitch - 0.35) * 2.5,
          playerPos.z - Math.cos(yaw) * 4,
        );
        camera.lookAt(_lookAt);
      } else if (camModeRef.current === 'aerial') {
        avatar.root.visible = true;
        const dist = activeLvl === 1 ? 8.5 : 11.5 + activeLvl * 2.1;
        const aYaw = prefersReducedMotion ? yaw : yaw + elapsed * 0.04;
        _camTarget.set(
          Math.sin(aYaw) * dist,
          activeLvl === 1 ? 5.6 : 7.2 + activeLvl * 1.25,
          Math.cos(aYaw) * dist,
        );
        camera.position.lerp(_camTarget, damp);
        _lookAt.set(0, 0.8, 0);
        camera.lookAt(_lookAt);
      } else {
        avatar.root.visible = true;
        const dist = 6.2;
        _camTarget.set(
          playerPos.x + Math.sin(yaw) * Math.cos(pitch) * dist,
          playerPos.y + 1.15 + Math.sin(pitch) * dist,
          playerPos.z + Math.cos(yaw) * Math.cos(pitch) * dist,
        );
        camera.position.lerp(_camTarget, damp);
        _lookAt.set(playerPos.x, playerPos.y + 0.85, playerPos.z);
        camera.lookAt(_lookAt);
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || 560;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      sceneSyncRef.current = null;
      audioRef.current = null;
      ambientAudio.dispose();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      currentGroundTex.dispose();
      currentTapestryTex.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync dynamic world state without resetting WebGLRenderer or player position
  useEffect(() => {
    sceneSyncRef.current?.syncWorld(entries, strokes, level, activeChapter, darkMode, effectiveAvatarLook);
  }, [entries, strokes, level, activeChapter, darkMode, effectiveAvatarLook]);

  // Sync mute state & selected Lo-Fi track to ambient Web Audio soundscape
  useEffect(() => {
    audioRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    audioRef.current?.setTrack(audioTrack);
  }, [audioTrack]);

  // Sync guided tour marker ring & auto-walk target
  useEffect(() => {
    if (!tourOpen || pathStops.length === 0) {
      sceneSyncRef.current?.setGuidedMarker(null, level);
      return;
    }
    const clampedIdx = Math.min(tourIndex, pathStops.length - 1);
    const stop = pathStops[clampedIdx];
    sceneSyncRef.current?.setGuidedMarker({ x: stop.x, z: stop.z }, level);
    walkTargetRef.current = new THREE.Vector3(stop.x, walkSurfaceHeightAt(stop.x, stop.z, level), stop.z);
  }, [tourOpen, tourIndex, pathStops, level]);

  // Trigger expansion chime & particles when a chapter completes
  useEffect(() => {
    if (justExpandedQuest) {
      sceneSyncRef.current?.triggerCelebration();
      audioRef.current?.playExpansionChime();
    }
  }, [justExpandedQuest]);

  const walkToStop = (idx: number) => {
    if (pathStops.length === 0) return;
    const wrapped = (idx + pathStops.length) % pathStops.length;
    setTourIndex(wrapped);
    setTourOpen(true);
    audioRef.current?.unlock();
  };

  const activeTourStop = tourOpen && pathStops.length > 0 ? pathStops[Math.min(tourIndex, pathStops.length - 1)] : null;
  const soundscapeLabel = getSoundscapeLabel(level, muted, audioTrack);

  const setVirtualKey = (code: string, pressed: boolean) => {
    keysRef.current[code] = pressed;
    if (pressed) walkTargetRef.current = null;
  };

  const activeQuest = progression?.activeQuest;
  const progressTarget = activeQuest
    ? Math.max(activeQuest.targetAnswers, activeQuest.targetStrokes, 1)
    : 2;
  const progressCount = activeQuest
    ? Math.min(progressTarget, Math.min(activeQuest.currentAnswers, activeQuest.currentStrokes))
    : 0;

  const cameraOrder: Array<'follow' | 'aerial' | 'first'> = ['follow', 'aerial', 'first'];
  const cycleCamera = () => {
    const idx = cameraOrder.indexOf(camMode);
    setCamMode(cameraOrder[(idx + 1) % cameraOrder.length]);
  };
  const camLabel =
    camMode === 'follow' ? 'Follow Avatar' : camMode === 'aerial' ? 'Island Aerial' : '1st-Person';

  const containerHeightClass = embedded ? 'h-[560px] rounded-3xl' : 'h-[calc(100vh-3.5rem)] min-h-[560px]';

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#CBE8FA] dark:bg-[#1A2444] ${containerHeightClass}`}
      aria-label={`Interactive expanding 3D World for ${roomName}`}
    >
      {/* Isolated WebGL Mount Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {contextLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#F8F4EA] dark:bg-[#1C2541] p-6 text-center">
          <div className="max-w-md space-y-2">
            <h2 className="text-xl font-semibold font-display text-[#1F2A3C] dark:text-white">{roomName}</h2>
            <p className="text-sm text-[#4C5568] dark:text-[#CBD5EB]">
              WebGL context paused. Reload or re-enter the room to resume walking the 3D island.
            </p>
          </div>
        </div>
      )}

      {/* Top-Left Progression & Active Chapter HUD (solid/rgba surface, zero backdrop-blur) */}
      <div className="pointer-events-none absolute top-4 left-4 right-4 z-10 flex flex-wrap items-start justify-between gap-3">
        <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-[#F8F4EA]/95 dark:bg-[#222A4C]/95 border border-[#DDD4BC] dark:border-[#3D4978] p-4 shadow-md space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-[#555E72] dark:text-[#BDC7E3] font-medium flex flex-wrap items-center gap-1.5">
                <span className="font-mono-tabular font-semibold text-[#2E7D5B] dark:text-[#7CD4C0]">
                  Stage {level}
                </span>
                <span aria-hidden="true">·</span>
                <span>{progression?.stageName || 'Seed Clearing'}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-mono-tabular">
                  <Users className="w-3.5 h-3.5" aria-hidden="true" />
                  {Math.max(1, presenceCount)}
                </span>
              </div>
              <h1 className="text-lg font-semibold font-display text-[#1F2A3C] dark:text-white leading-snug mt-0.5">
                {roomName}
              </h1>
            </div>

            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                aria-label={darkMode ? 'Switch to daylight world' : 'Switch to twilight world'}
                className="min-w-[40px] min-h-[40px] rounded-full bg-white dark:bg-[#19203E] border border-[#DDD4BC] dark:border-[#49578D] text-[#D99B1E] dark:text-[#F8E166] flex items-center justify-center shrink-0"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-[#242E47]" />}
              </button>
            )}
          </div>

          {activeQuest && (
            <div className="space-y-2.5 pt-2 border-t border-[#E5DEC9] dark:border-[#3D4978]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-[#1F2A3C] dark:text-slate-100 truncate">
                  Next Expansion: {activeQuest.title}
                </div>
                <button
                  type="button"
                  data-testid="quest-progress-minimize-btn"
                  onClick={() => setQuestBarMinimized((m) => !m)}
                  aria-expanded={!questBarMinimized}
                  aria-label={questBarMinimized ? 'Expand quest progression bar' : 'Minimize quest progression bar'}
                  title={questBarMinimized ? 'Expand quest progression bar' : 'Minimize quest progression bar'}
                  className="min-w-[30px] min-h-[30px] rounded-full bg-white/90 dark:bg-[#19203E] border border-[#DDD4BC] dark:border-[#49578D] text-[#4C5568] dark:text-[#CBD5EB] hover:text-[#1F2A3C] dark:hover:text-white flex items-center justify-center shrink-0 transition-colors"
                >
                  {questBarMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>

              {!questBarMinimized && (
                <div className="space-y-1">
                  <p className="text-xs text-[#2B374E] dark:text-[#E2EAFD] leading-snug">
                    “{activeQuest.questionPrompt}”
                  </p>
                  <p className="text-[11px] text-[#4C5568] dark:text-[#CBD5EB] leading-snug">
                    Draw together: <span className="font-semibold">{activeQuest.drawingPrompt}</span>
                  </p>
                </div>
              )}

              {/* Single Unified Expansion Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#4C5568] dark:text-[#CBD5EB]">
                  <span>{questBarMinimized ? 'Expansion progress' : 'Word-strokes toward expansion'}</span>
                  <span className="font-mono-tabular font-semibold">
                    {progressCount} / {progressTarget} answer-strokes
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#E5DEC9] dark:bg-[#18203D] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#2E7D5B] dark:bg-[#7CD4C0] transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round((progressCount / Math.max(1, progressTarget)) * 100))}%` }}
                  />
                </div>
              </div>

              {!questBarMinimized && (
                <div className="flex items-center gap-2 pt-0.5">
                  {onOpenStudio && (
                    <button
                      type="button"
                      data-testid="world-expand-studio-btn"
                      onClick={() => onOpenStudio()}
                      className="min-h-[40px] flex-1 px-3.5 py-1.5 rounded-full bg-[#F7C6CF] hover:bg-[#F2B1BE] dark:bg-[#F8E166] dark:hover:bg-[#F2D544] text-[#43202A] dark:text-[#242E47] text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Answer &amp; Draw</span>
                    </button>
                  )}
                  {onOpenMosaic && (
                    <button
                      type="button"
                      onClick={onOpenMosaic}
                      className="min-h-[40px] px-3 py-1.5 rounded-full bg-white dark:bg-[#19203E] border border-[#DDD4BC] dark:border-[#49578D] text-[#1F2A3C] dark:text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Grid2x2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span className="font-mono-tabular">{entries.length}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* World Expansion Celebration Toast */}
        {justExpandedQuest && (
          <div
            role="status"
            className="pointer-events-auto max-w-sm rounded-2xl bg-[#2E7D5B] dark:bg-[#F8E166] text-white dark:text-[#242E47] px-4 py-3 shadow-lg flex items-start justify-between gap-3"
          >
            <div className="space-y-0.5">
              <div className="text-xs font-mono-tabular uppercase tracking-wide opacity-90">
                World Expanded · Stage {level}
              </div>
              <div className="text-sm font-bold leading-snug">
                {justExpandedQuest.title} unlocked!
              </div>
              <p className="text-xs opacity-90">
                New island terrain and landmarks have risen into {roomName}.
              </p>
            </div>
            {onDismissExpansionBanner && (
              <button
                type="button"
                onClick={onDismissExpansionBanner}
                aria-label="Dismiss expansion notice"
                className="min-w-[32px] min-h-[32px] rounded-full flex items-center justify-center hover:bg-black/10"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inspected Landmark Card (appears when user clicks a 3D plot in the world) */}
      {inspectedEntry && (
        <div className="pointer-events-auto absolute top-4 right-4 z-20 w-full max-w-xs rounded-2xl bg-[#F8F4EA]/95 dark:bg-[#222A4C]/95 border border-[#DDD4BC] dark:border-[#3D4978] p-4 shadow-lg space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs text-[#555E72] dark:text-[#BDC7E3] flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: inspectedEntry.authorAvatarColor || inspectedEntry.strokeJson.color }}
                aria-hidden="true"
              />
              <span className="font-semibold text-[#1F2A3C] dark:text-white">
                {inspectedEntry.authorDisplayName || 'quiet-sprout'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{inspectedEntry.worldSpec.label}</span>
            </div>
            <button
              type="button"
              onClick={() => setInspectedEntry(null)}
              aria-label="Close landmark card"
              className="min-w-[32px] min-h-[32px] rounded-full flex items-center justify-center text-[#555E72] dark:text-[#CBD5EB] hover:bg-black/5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm font-medium text-[#1F2A3C] dark:text-white leading-snug">
            “{inspectedEntry.sentence}”
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                const target = inspectedEntry;
                setInspectedEntry(null);
                onSelectEntryRef.current(target);
              }}
              className="min-h-[38px] flex-1 px-3 py-1.5 rounded-full bg-[#2E7D5B] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Walk Clearing</span>
            </button>
            {onOpenMinigame && (
              <button
                type="button"
                onClick={() => {
                  const target = inspectedEntry;
                  setInspectedEntry(null);
                  onOpenMinigame(target);
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-full bg-[#2B7CB3] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Gamepad2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Play</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Touch D-Pad */}
      <div className="pointer-events-auto sm:hidden absolute bottom-20 left-4 z-10 grid grid-cols-3 gap-1 w-[132px]">
        <div />
        <button
          type="button"
          aria-label="Walk forward"
          onPointerDown={() => setVirtualKey('KeyW', true)}
          onPointerUp={() => setVirtualKey('KeyW', false)}
          onPointerLeave={() => setVirtualKey('KeyW', false)}
          className="min-w-[42px] min-h-[42px] rounded-xl bg-[#F8F4EA]/95 dark:bg-[#222A4C]/95 border border-[#DDD4BC] dark:border-[#3D4978] flex items-center justify-center text-[#1F2A3C] dark:text-white"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        <div />
        <button
          type="button"
          aria-label="Walk left"
          onPointerDown={() => setVirtualKey('KeyA', true)}
          onPointerUp={() => setVirtualKey('KeyA', false)}
          onPointerLeave={() => setVirtualKey('KeyA', false)}
          className="min-w-[42px] min-h-[42px] rounded-xl bg-[#F8F4EA]/95 dark:bg-[#222A4C]/95 border border-[#DDD4BC] dark:border-[#3D4978] flex items-center justify-center text-[#1F2A3C] dark:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Walk backward"
          onPointerDown={() => setVirtualKey('KeyS', true)}
          onPointerUp={() => setVirtualKey('KeyS', false)}
          onPointerLeave={() => setVirtualKey('KeyS', false)}
          className="min-w-[42px] min-h-[42px] rounded-xl bg-[#F8F4EA]/95 dark:bg-[#222A4C]/95 border border-[#DDD4BC] dark:border-[#3D4978] flex items-center justify-center text-[#1F2A3C] dark:text-white"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Walk right"
          onPointerDown={() => setVirtualKey('KeyD', true)}
          onPointerUp={() => setVirtualKey('KeyD', false)}
          onPointerLeave={() => setVirtualKey('KeyD', false)}
          className="min-w-[42px] min-h-[42px] rounded-xl bg-[#F8F4EA]/95 dark:bg-[#222A4C]/95 border border-[#DDD4BC] dark:border-[#3D4978] flex items-center justify-center text-[#1F2A3C] dark:text-white"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center max-w-[94vw] gap-1.5">
        {activeTourStop && !hudCollapsed && (
          <div
            data-testid="world-guided-path-card"
            className="pointer-events-auto w-full max-w-md rounded-2xl bg-[#F8F4EA]/95 dark:bg-[#222A4C]/95 border border-[#DDD4BC] dark:border-[#3D4978] px-4 py-3 shadow-lg space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-mono-tabular font-semibold text-[#2E7D5B] dark:text-[#7CD4C0]">
                  Guided Path · Stop {Math.min(tourIndex, pathStops.length - 1) + 1} of {pathStops.length}
                </div>
                <div className="text-sm font-semibold text-[#1F2A3C] dark:text-white truncate">
                  {activeTourStop.title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTourOpen(false)}
                aria-label="Exit guided path"
                className="min-w-[32px] min-h-[32px] rounded-full flex items-center justify-center text-[#555E72] dark:text-[#CBD5EB] hover:bg-black/5 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#4C5568] dark:text-[#CBD5EB] leading-snug">
              {activeTourStop.caption}
            </p>
            {nextFrontier && (
              <p className="text-[11px] font-mono-tabular text-[#555E72] dark:text-[#A9B5D6]">
                Next path unlock at Stage {nextFrontier.minLevel}: {nextFrontier.title}
              </p>
            )}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => walkToStop(tourIndex - 1)}
                className="min-h-[36px] px-3 py-1 rounded-xl bg-white dark:bg-[#19203E] border border-[#DDD4BC] dark:border-[#49578D] text-xs font-semibold text-[#1F2A3C] dark:text-slate-100 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={() => walkToStop(tourIndex + 1)}
                className="min-h-[36px] px-3.5 py-1 rounded-xl bg-[#2E7D5B] hover:bg-[#25674A] text-white text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>Next Stop</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {audioMenuOpen && !hudCollapsed && (
          <div
            data-testid="world-lofi-menu"
            className="pointer-events-auto w-full max-w-sm rounded-2xl bg-[#F8F4EA]/95 dark:bg-[#222A4C]/95 border border-[#DDD4BC] dark:border-[#3D4978] p-2.5 shadow-lg space-y-1.5"
          >
            <div className="flex items-center justify-between px-1.5 pb-1 border-b border-[#E5DEC9] dark:border-[#3D4978]">
              <span className="text-xs font-bold text-[#1F2A3C] dark:text-white inline-flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-[#2E7D5B] dark:text-[#7CD4C0]" aria-hidden="true" />
                <span>Ambient Lo-Fi &amp; Island Audio</span>
              </span>
              <button
                type="button"
                onClick={() => setAudioMenuOpen(false)}
                aria-label="Close audio selector"
                className="min-w-[28px] min-h-[28px] rounded-full flex items-center justify-center text-[#555E72] dark:text-[#CBD5EB] hover:bg-black/5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              {AMBIENT_AUDIO_TRACKS.map((opt) => {
                const selected = audioTrack === opt.id && !muted;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`lofi-track-${opt.id}`}
                    onClick={() => {
                      setAudioTrack(opt.id);
                      if (muted) setMuted(false);
                      audioRef.current?.unlock();
                      setAudioMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${
                      selected
                        ? 'bg-[#2E7D5B] border-[#2E7D5B] text-white'
                        : 'bg-white dark:bg-[#19203E] border-[#DDD4BC] dark:border-[#49578D] text-[#1F2A3C] dark:text-slate-100 hover:border-[#2E7D5B]'
                    }`}
                  >
                    <div className="text-xs font-bold leading-tight">{opt.label}</div>
                    <div
                      className={`text-[11px] leading-snug mt-0.5 ${
                        selected ? 'text-white/90' : 'text-[#555E72] dark:text-[#BDC7E3]'
                      }`}
                    >
                      {opt.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setHudCollapsed((c) => !c)}
          className="pointer-events-auto min-h-[34px] px-3.5 py-1 rounded-full bg-[#F8F4EA]/95 dark:bg-[#222A4C]/95 border border-[#DDD4BC] dark:border-[#3D4978] text-xs font-semibold text-[#1F2A3C] dark:text-slate-100 inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap"
        >
          {hudCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{hudCollapsed ? 'Show World Controls' : 'Hide Controls'}</span>
        </button>

        {!hudCollapsed && (
          <div className="pointer-events-auto rounded-2xl bg-[#F8F4EA]/95 dark:bg-[#222A4C]/95 border border-[#DDD4BC] dark:border-[#3D4978] px-3 py-2 shadow-lg flex flex-wrap items-center justify-center gap-2">
            {onOpenStudio && (
              <button
                type="button"
                onClick={() => onOpenStudio()}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#2E7D5B] hover:bg-[#25674A] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Answer &amp; Draw</span>
              </button>
            )}

            {onOpenCustomizer && (
              <button
                type="button"
                data-testid="world-customize-btn"
                onClick={() => onOpenCustomizer()}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#19203E] border border-[#DDD4BC] dark:border-[#49578D] hover:border-[#2E7D5B] text-xs font-semibold text-[#1F2A3C] dark:text-slate-100 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <UserCircle2 className="w-3.5 h-3.5 text-[#D98245] dark:text-[#F8E166]" aria-hidden="true" />
                <span>Character</span>
              </button>
            )}

            <button
              type="button"
              data-testid="world-guided-path-btn"
              onClick={() => {
                if (tourOpen) setTourOpen(false);
                else walkToStop(tourIndex);
              }}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${
                tourOpen
                  ? 'bg-[#2B7CB3] border-[#2B7CB3] text-white'
                  : 'bg-white dark:bg-[#19203E] border-[#DDD4BC] dark:border-[#49578D] text-[#1F2A3C] dark:text-slate-100'
              }`}
            >
              <Route className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tourOpen ? 'Exit Path' : 'Guided Path'}</span>
            </button>

            <button
              type="button"
              onClick={cycleCamera}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#19203E] border border-[#DDD4BC] dark:border-[#49578D] text-xs font-semibold text-[#1F2A3C] dark:text-slate-100 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{camLabel}</span>
            </button>

            <div className="inline-flex items-center rounded-xl border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#19203E] overflow-hidden">
              <button
                type="button"
                data-testid="world-audio-toggle-btn"
                onClick={() => {
                  const nextMuted = !muted;
                  setMuted(nextMuted);
                  if (!nextMuted) audioRef.current?.unlock();
                }}
                aria-label={muted ? 'Enable ambient lo-fi audio' : `Mute audio (${soundscapeLabel})`}
                className="min-h-[40px] px-2.5 py-1.5 text-xs font-semibold text-[#1F2A3C] dark:text-slate-100 hover:bg-[#F8F4EA] dark:hover:bg-[#222A4C] inline-flex items-center justify-center"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-[#8C95AA]" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#2E7D5B] dark:text-[#7CD4C0]" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                data-testid="world-lofi-picker-btn"
                onClick={() => {
                  setAudioMenuOpen((o) => !o);
                  audioRef.current?.unlock();
                }}
                className="min-h-[40px] pr-3 pl-1.5 py-1.5 border-l border-[#E5DEC9] dark:border-[#3D4978] text-xs font-semibold text-[#1F2A3C] dark:text-slate-100 hover:bg-[#F8F4EA] dark:hover:bg-[#222A4C] inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Music className="w-3.5 h-3.5 text-[#2E7D5B] dark:text-[#7CD4C0]" aria-hidden="true" />
                <span>{soundscapeLabel}</span>
              </button>
            </div>

            <span className="hidden lg:inline text-[11px] text-[#555E72] dark:text-[#BDC7E3] px-1 whitespace-nowrap">
              WASD / Click ground to walk · Click board to draw
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
