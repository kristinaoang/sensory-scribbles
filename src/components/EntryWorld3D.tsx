import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Eye,
  Gamepad2,
  X,
} from 'lucide-react';
import type { JournalEntry } from '../types';

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

function groundHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const hill = Math.sin(x * 0.35) * Math.cos(z * 0.35) * 0.16;
  const shoreDip = r > 6.8 ? -Math.min(0.8, (r - 6.8) * 0.4) : 0;
  return hill + shoreDip;
}

function createGroundTexture(primaryHex: string, secondaryHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = primaryHex;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 750; i++) {
    const px = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1) * 256;
    const py = Math.abs((Math.sin(i * 78.233) * 43758.5453) % 1) * 256;
    ctx.fillStyle = i % 3 === 0 ? secondaryHex : 'rgba(255,255,255,0.16)';
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(px, py, 1.5 + (i % 2), 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function buildNaturalHeroFromText(entry: JournalEntry): { group: THREE.Group; animatedParts: THREE.Object3D[] } {
  const group = new THREE.Group();
  const animatedParts: THREE.Object3D[] = [];
  const spec = entry.worldSpec;
  const mood = new THREE.Color(spec.moodColor || '#3B845E');
  const accent = new THREE.Color(spec.secondaryColor || '#F2C572');
  const landmark = spec.landmark || (spec.elementType === 'windmill' ? 'windmill' : spec.elementType === 'pond' ? 'stepping_pond' : spec.elementType === 'loom' ? 'weaver_loom' : spec.elementType === 'lantern' ? 'stone_lantern' : 'wooden_cabin');

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c5338, roughness: 0.85, metalness: 0.04 });
  const moodMat = new THREE.MeshStandardMaterial({ color: mood, roughness: 0.55, metalness: 0.08 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35, metalness: 0.25 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.85, metalness: 0.05 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xf4ece0, roughness: 0.86 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.75,
    roughness: 0.2,
  });

  if (landmark === 'wooden_cabin') {
    const walls = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.1, 1.45), creamMat);
    walls.position.y = 0.55;
    walls.castShadow = true;
    walls.receiveShadow = true;
    group.add(walls);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.42, 0.92, 4), moodMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.54;
    roof.castShadow = true;
    group.add(roof);

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.66, 0.08), woodMat);
    door.position.set(0, 0.33, 0.74);
    group.add(door);

    const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.08), glowMat);
    windowMesh.position.set(0.48, 0.65, 0.74);
    group.add(windowMesh);

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.26), stoneMat);
    chimney.position.set(-0.5, 1.56, -0.32);
    chimney.castShadow = true;
    group.add(chimney);
  } else if (landmark === 'windmill') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.66, 1.55, 10), creamMat);
    base.position.y = 0.77;
    base.castShadow = true;
    group.add(base);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.62, 10), moodMat);
    cap.position.y = 1.84;
    cap.castShadow = true;
    group.add(cap);

    const rotor = new THREE.Group();
    rotor.position.set(0, 1.38, 0.54);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Group();
      b.rotation.z = (i * Math.PI) / 2;
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.04), woodMat);
      spar.position.y = 0.44;
      const sail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.02), accentMat);
      sail.position.set(0.14, 0.5, 0.01);
      b.add(spar, sail);
      rotor.add(b);
    }
    group.add(rotor);
    animatedParts.push(rotor);
  } else if (landmark === 'stepping_pond') {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.18, 10, 24), stoneMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.09;
    group.add(rim);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(1.28, 1.28, 0.08, 24),
      new THREE.MeshPhysicalMaterial({ color: 0x5ea9d6, roughness: 0.08, clearcoat: 1 }),
    );
    water.position.y = 0.07;
    group.add(water);

    const lily = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 14), new THREE.MeshStandardMaterial({ color: 0x4d9e58 }));
    lily.position.set(-0.34, 0.14, 0.24);
    group.add(lily);

    const lotus = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), accentMat);
    lotus.position.set(-0.34, 0.24, 0.24);
    group.add(lotus);
    animatedParts.push(lotus);
  } else if (landmark === 'tea_pavilion') {
    for (const [px, pz] of [[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.25, 8), woodMat);
      post.position.set(px, 0.62, pz);
      post.castShadow = true;
      group.add(post);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.32, 0.68, 4), moodMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.56;
    roof.castShadow = true;
    group.add(roof);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14), woodMat);
    table.position.y = 0.16;
    group.add(table);
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), glowMat);
    pot.position.y = 0.42;
    group.add(pot);
    animatedParts.push(pot);
  } else if (landmark === 'weaver_loom') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.72), woodMat);
    base.position.y = 0.06;
    group.add(base);
    [-0.5, 0.5].forEach((x) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.4, 0.12), woodMat);
      post.position.set(x, 0.74, 0);
      post.castShadow = true;
      group.add(post);
    });
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.94, 0.06), moodMat);
    cloth.position.y = 0.82;
    group.add(cloth);
    const shuttle = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.25, 4, 8), accentMat);
    shuttle.rotation.z = Math.PI / 2;
    shuttle.position.set(0, 0.82, 0.1);
    group.add(shuttle);
    animatedParts.push(shuttle);
  } else {
    // stone_lantern
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.26, 6), stoneMat);
    base.position.y = 0.13;
    group.add(base);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.95, 6), stoneMat);
    col.position.y = 0.72;
    col.castShadow = true;
    group.add(col);
    const lanternCore = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), glowMat);
    lanternCore.position.y = 1.36;
    group.add(lanternCore);
    animatedParts.push(lanternCore);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.42, 6), stoneMat);
    cap.position.y = 1.72;
    cap.castShadow = true;
    group.add(cap);
  }

  return { group, animatedParts };
}

function createAvatar(colorHex: string) {
  const root = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf6d5b8, roughness: 0.7 });
  const tunicMat = new THREE.MeshStandardMaterial({ color: colorHex || '#2E7D5B', roughness: 0.65 });
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xe6b85c, roughness: 0.75 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85 });

  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.18, 4, 8), bootMat);
  leftLeg.position.set(-0.1, 0.16, 0);
  const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.18, 4, 8), bootMat);
  rightLeg.position.set(0.1, 0.16, 0);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.44, 12), tunicMat);
  torso.position.y = 0.48;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), skinMat);
  head.position.y = 0.88;
  head.castShadow = true;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.31, 0.04, 14), hatMat);
  brim.position.y = 1.02;
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hatMat);
  crown.position.y = 1.02;

  root.add(leftLeg, rightLeg, torso, head, brim, crown);
  return { root, leftLeg, rightLeg };
}

interface EntryWorld3DProps {
  entry: JournalEntry;
  onClose: () => void;
  onOpenMinigame: (entry: JournalEntry) => void;
}

export const EntryWorld3D: React.FC<EntryWorld3DProps> = ({ entry, onClose, onOpenMinigame }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const walkTargetRef = useRef<THREE.Vector3 | null>(null);
  const camModeRef = useRef<'third' | 'first'>('third');

  const [camMode, setCamMode] = useState<'third' | 'first'>('third');
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    camModeRef.current = camMode;
  }, [camMode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSoftwareGl = detectSoftwareGl();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
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
    const skyColor = new THREE.Color(entry.worldSpec.skyTint || '#DCEEF8');
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(skyColor.getHex(), 0.025);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);

    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x6b4f35, 0.8);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.5);
    keyLight.position.set(8, 12, 7);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    // Walkable natural meadow island (NO strokes in 3D!)
    const groundTex = createGroundTexture('#72B96D', entry.worldSpec.secondaryColor || '#97D48C');
    groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const groundGeo = new THREE.PlaneGeometry(17, 17, 30, 30);
    groundGeo.rotateX(-Math.PI / 2);
    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, groundHeightAt(vx, vz));
    }
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.9, metalness: 0.02 }),
    );
    ground.receiveShadow = true;
    scene.add(ground);

    const sea = new THREE.Mesh(
      new THREE.CylinderGeometry(42, 42, 0.25, 36),
      new THREE.MeshPhysicalMaterial({ color: 0x5ea9d6, roughness: 0.14, clearcoat: 0.85 }),
    );
    sea.position.y = -0.58;
    scene.add(sea);

    // Natural perimeter trees (composite pine/peach trees framing the clearing)
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x3b845e, roughness: 0.8 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c5338, roughness: 0.88 });
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const rad = 5.4 + (i % 2) * 0.8;
      const tx = Math.cos(ang) * rad;
      const tz = Math.sin(ang) * rad;
      const ty = groundHeightAt(tx, tz);
      const tg = new THREE.Group();
      tg.position.set(tx, ty, tz);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.9, 8), trunkMat);
      trunk.position.y = 0.45;
      trunk.castShadow = true;
      const crown = new THREE.Mesh(
        entry.worldSpec.flora === 'pine_trees' ? new THREE.ConeGeometry(0.62, 1.35, 8) : new THREE.IcosahedronGeometry(0.58, 1),
        treeMat,
      );
      crown.position.y = 1.25;
      crown.castShadow = true;
      tg.add(trunk, crown);
      scene.add(tg);
    }

    // Hero text-interpreted landmark
    const { group: heroGroup, animatedParts } = buildNaturalHeroFromText(entry);
    heroGroup.position.set(0, groundHeightAt(0, -1.2), -1.2);
    scene.add(heroGroup);

    // Cozy log beside the path
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.35, 10), trunkMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = 0.3;
    log.position.set(1.75, groundHeightAt(1.75, 1.2) + 0.15, 1.2);
    log.castShadow = true;
    scene.add(log);

    // Ambient nature motes (fireflies / sunbeams / mist)
    const particleCount = 26;
    const particles = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.042, 8, 8),
      new THREE.MeshStandardMaterial({
        color: entry.worldSpec.secondaryColor || '#FDE68A',
        emissive: entry.worldSpec.secondaryColor || '#FDE68A',
        emissiveIntensity: 0.8,
      }),
      particleCount,
    );
    particles.frustumCulled = false;
    const seeds = Array.from({ length: particleCount }, (_, i) => ({
      angle: (i / particleCount) * Math.PI * 2,
      radius: 1.2 + ((i * 29) % 100) / 28,
      baseY: 0.45 + ((i * 47) % 100) / 55,
      speed: 0.35 + ((i * 19) % 100) / 150,
    }));
    scene.add(particles);

    // Walkable Avatar
    const avatar = createAvatar(entry.authorAvatarColor || '#2E7D5B');
    const playerPos = new THREE.Vector3(0, groundHeightAt(0, 2.8), 2.8);
    avatar.root.position.copy(playerPos);
    scene.add(avatar.root);

    if (!isSoftwareGl) renderer.compile(scene, camera);

    let yaw = 0;
    let pitch = 0.38;
    let dragging = false;
    let dragStart = { x: 0, y: 0 };
    let lastPointer = { x: 0, y: 0 };

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
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
      pitch = Math.max(0.16, Math.min(1.0, pitch + dy * 0.005));
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 7) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObject(ground, false);
      if (hits.length > 0 && Math.hypot(hits[0].point.x, hits[0].point.z) < 6.4) {
        walkTargetRef.current = hits[0].point.clone();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const onKeyDown = (e: KeyboardEvent) => {
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
        if (dist > 0.22) _move.set(dx / dist, 0, dz / dist);
        else walkTargetRef.current = null;
      }

      let isMoving = false;
      if (_move.lengthSq() > 0.01) {
        isMoving = true;
        const nx = playerPos.x + _move.x * 3.5 * dt;
        const nz = playerPos.z + _move.z * 3.5 * dt;
        if (Math.hypot(nx, nz) < 6.4) {
          playerPos.x = nx;
          playerPos.z = nz;
        }
        avatar.root.rotation.y = Math.atan2(_move.x, _move.z);
      }

      playerPos.y = groundHeightAt(playerPos.x, playerPos.z);
      avatar.root.position.copy(playerPos);

      if (isMoving && !prefersReducedMotion) {
        walkPhase += dt * 8.5;
        const swing = Math.sin(walkPhase) * 0.55;
        avatar.leftLeg.rotation.x = swing;
        avatar.rightLeg.rotation.x = -swing;
      } else {
        avatar.leftLeg.rotation.x *= 0.85;
        avatar.rightLeg.rotation.x *= 0.85;
      }

      if (!prefersReducedMotion) {
        animatedParts.forEach((p, idx) => {
          if (entry.worldSpec.landmark === 'windmill' || entry.worldSpec.elementType === 'windmill') {
            p.rotation.z += dt * 1.1;
          } else {
            p.rotation.y += dt * (0.5 + idx * 0.2);
          }
        });
      }

      for (let i = 0; i < particleCount; i++) {
        const s = seeds[i];
        const ang = prefersReducedMotion ? s.angle : s.angle + elapsed * s.speed * 0.35;
        const py = prefersReducedMotion ? s.baseY : s.baseY + Math.sin(elapsed * s.speed + i) * 0.16;
        _scratchPos.set(Math.cos(ang) * s.radius, py, Math.sin(ang) * s.radius);
        _scratchEuler.set(0, ang, 0);
        _scratchQuat.setFromEuler(_scratchEuler);
        _scratchScale.setScalar(0.8);
        _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
        particles.setMatrixAt(i, _scratchMatrix);
      }
      particles.instanceMatrix.needsUpdate = true;

      const damp = 1 - Math.exp(-8 * dt);
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
      } else {
        avatar.root.visible = true;
        const dist = 4.6;
        _camTarget.set(
          playerPos.x + Math.sin(yaw) * Math.cos(pitch) * dist,
          playerPos.y + 0.95 + Math.sin(pitch) * dist,
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
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
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
      groundTex.dispose();
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
  }, [entry]);

  const setVirtualKey = (code: string, pressed: boolean) => {
    keysRef.current[code] = pressed;
    if (pressed) walkTargetRef.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#DCEEF8] dark:bg-slate-950 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Walkable 3D World for ${entry.authorDisplayName || 'anonymous reflection'}`}
    >
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100/95 dark:bg-slate-900/95 p-6 text-center z-20">
          <div className="max-w-md space-y-3">
            <h3 className="text-xl font-semibold text-stone-900 dark:text-white">{entry.worldSpec.label}</h3>
            <p className="text-sm text-stone-600 dark:text-slate-300">“{entry.sentence}”</p>
          </div>
        </div>
      )}

      {/* Top Story Card & Close */}
      <div className="relative z-10 pointer-events-none flex items-start justify-between p-4 sm:p-6 gap-4">
        <div className="pointer-events-auto max-w-md rounded-2xl bg-[#FCFBF7]/95 dark:bg-slate-900/95 border border-stone-200 dark:border-slate-700 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.authorAvatarColor || '#2E7D5B' }}
              aria-hidden="true"
            />
            <span className="font-medium text-stone-800 dark:text-slate-200">
              {entry.authorDisplayName || 'quiet-sprout'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{entry.worldSpec.label}</span>
          </div>
          <p className="mt-1.5 text-sm sm:text-base font-medium text-stone-900 dark:text-white leading-snug">
            “{entry.sentence}”
          </p>
          {entry.worldSpec.poeticSummary && (
            <p className="mt-1 text-xs text-stone-600 dark:text-slate-300">
              {entry.worldSpec.poeticSummary}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close walkable 3D world"
          className="pointer-events-auto min-w-[44px] min-h-[44px] rounded-xl bg-[#FCFBF7]/95 dark:bg-slate-900/95 border border-stone-200 dark:border-slate-700 text-stone-800 dark:text-slate-100 flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 shadow-sm"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Touch D-Pad for walking on mobile */}
      <div className="pointer-events-auto fixed bottom-4 left-4 z-20 grid grid-cols-3 gap-1 w-[138px]">
        <div />
        <button
          type="button"
          aria-label="Walk forward"
          onPointerDown={() => setVirtualKey('KeyW', true)}
          onPointerUp={() => setVirtualKey('KeyW', false)}
          onPointerLeave={() => setVirtualKey('KeyW', false)}
          className="min-w-[44px] min-h-[44px] rounded-xl bg-[#FCFBF7]/95 dark:bg-slate-900/95 border border-stone-200 dark:border-slate-700 flex items-center justify-center text-stone-800 dark:text-slate-100"
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
          className="min-w-[44px] min-h-[44px] rounded-xl bg-[#FCFBF7]/95 dark:bg-slate-900/95 border border-stone-200 dark:border-slate-700 flex items-center justify-center text-stone-800 dark:text-slate-100"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Walk backward"
          onPointerDown={() => setVirtualKey('KeyS', true)}
          onPointerUp={() => setVirtualKey('KeyS', false)}
          onPointerLeave={() => setVirtualKey('KeyS', false)}
          className="min-w-[44px] min-h-[44px] rounded-xl bg-[#FCFBF7]/95 dark:bg-slate-900/95 border border-stone-200 dark:border-slate-700 flex items-center justify-center text-stone-800 dark:text-slate-100"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Walk right"
          onPointerDown={() => setVirtualKey('KeyD', true)}
          onPointerUp={() => setVirtualKey('KeyD', false)}
          onPointerLeave={() => setVirtualKey('KeyD', false)}
          className="min-w-[44px] min-h-[44px] rounded-xl bg-[#FCFBF7]/95 dark:bg-slate-900/95 border border-stone-200 dark:border-slate-700 flex items-center justify-center text-stone-800 dark:text-slate-100"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Collapsible Bottom Dock */}
      <div className="pointer-events-none fixed bottom-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto z-20 flex flex-col items-end sm:items-center">
        <button
          type="button"
          onClick={() => setHudCollapsed((c) => !c)}
          className="pointer-events-auto mb-1.5 min-h-[36px] px-3 py-1 rounded-lg bg-[#FCFBF7] dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-xs font-medium text-stone-700 dark:text-slate-200 inline-flex items-center gap-1 shadow-xs"
        >
          {hudCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{hudCollapsed ? 'Controls' : 'Hide'}</span>
        </button>

        {!hudCollapsed && (
          <div className="pointer-events-auto rounded-2xl bg-[#FCFBF7] dark:bg-slate-900 border border-stone-200 dark:border-slate-700 px-3 py-2 shadow-md flex flex-wrap items-center gap-2">
            <span className="hidden md:inline text-xs text-stone-500 dark:text-slate-400 px-1">
              WASD / Drag / Tap ground to walk
            </span>
            <button
              type="button"
              onClick={() => setCamMode((m) => (m === 'third' ? 'first' : 'third'))}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-slate-800 text-xs font-medium text-stone-800 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{camMode === 'third' ? '3rd-Person' : '1st-Person'}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenMinigame(entry)}
              className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#2B7CB3] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>Play Minigame</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
