import * as THREE from 'three';
import type { AvatarAccessory, AvatarCustomization, AvatarHatStyle } from '../types';

export const DEFAULT_AVATAR_LOOK: AvatarCustomization = {
  skinTone: '#F6D5B8',
  tunicColor: '#2E7D5B',
  hatStyle: 'explorer',
  hatColor: '#E6B85C',
  accessory: 'scarf',
};

export const SKIN_TONES = [
  { name: 'Peach Linen', hex: '#FCE4D0' },
  { name: 'Warm Sand', hex: '#F6D5B8' },
  { name: 'Honey Bisque', hex: '#E8B892' },
  { name: 'Toasted Almond', hex: '#C98E62' },
  { name: 'Roasted Chestnut', hex: '#8D5836' },
  { name: 'Deep Espresso', hex: '#5E3822' },
];

export const TUNIC_COLORS = [
  { name: 'Sage Moss', hex: '#2E7D5B' },
  { name: 'Amber Ochre', hex: '#D98245' },
  { name: 'Creek Teal', hex: '#2B7CB3' },
  { name: 'Blossom Rose', hex: '#C96A88' },
  { name: 'Twilight Plum', hex: '#6D5B97' },
  { name: 'Terracotta Clay', hex: '#C25942' },
  { name: 'Sunlit Butter', hex: '#D6A635' },
];

export const HAT_STYLES: Array<{ id: AvatarHatStyle; label: string }> = [
  { id: 'explorer', label: 'Explorer' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'wizard', label: 'Star Hat' },
  { id: 'flower_crown', label: 'Blossom' },
  { id: 'none', label: 'No Hat' },
];

export const HAT_COLORS = [
  { name: 'Straw Gold', hex: '#E6B85C' },
  { name: 'Forest Moss', hex: '#2E7D5B' },
  { name: 'Berry Red', hex: '#C24942' },
  { name: 'Indigo Night', hex: '#3C5A99' },
  { name: 'Blossom Pink', hex: '#E89AB0' },
  { name: 'Warm Walnut', hex: '#6B4423' },
];

export const ACCESSORY_OPTIONS: Array<{ id: AvatarAccessory; label: string }> = [
  { id: 'scarf', label: 'Scarf' },
  { id: 'satchel', label: 'Satchel' },
  { id: 'cape', label: 'Cape' },
  { id: 'none', label: 'None' },
];

export function loadSavedAvatarLook(fallbackTunicColor?: string): AvatarCustomization {
  if (typeof window === 'undefined') {
    return {
      ...DEFAULT_AVATAR_LOOK,
      tunicColor: fallbackTunicColor || DEFAULT_AVATAR_LOOK.tunicColor,
    };
  }
  try {
    const raw = window.localStorage.getItem('ss_avatar_look');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AvatarCustomization>;
      return {
        skinTone: typeof parsed.skinTone === 'string' ? parsed.skinTone : DEFAULT_AVATAR_LOOK.skinTone,
        tunicColor:
          fallbackTunicColor ||
          (typeof parsed.tunicColor === 'string' ? parsed.tunicColor : DEFAULT_AVATAR_LOOK.tunicColor),
        hatStyle: parsed.hatStyle || DEFAULT_AVATAR_LOOK.hatStyle,
        hatColor: typeof parsed.hatColor === 'string' ? parsed.hatColor : DEFAULT_AVATAR_LOOK.hatColor,
        accessory: parsed.accessory || DEFAULT_AVATAR_LOOK.accessory,
      };
    }
  } catch {
    // Fallback to default look
  }
  return {
    ...DEFAULT_AVATAR_LOOK,
    tunicColor: fallbackTunicColor || DEFAULT_AVATAR_LOOK.tunicColor,
  };
}

export function saveAvatarLook(look: AvatarCustomization) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('ss_avatar_look', JSON.stringify(look));
  } catch {
    // Ignore storage errors
  }
}

export interface AvatarRig {
  root: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  tunicMat: THREE.MeshStandardMaterial;
}

export function buildCustomizableAvatar(spec: AvatarCustomization): AvatarRig {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: spec.skinTone || '#F6D5B8', roughness: 0.72 });
  const tunicMat = new THREE.MeshStandardMaterial({ color: spec.tunicColor || '#2E7D5B', roughness: 0.62 });
  const hatMat = new THREE.MeshStandardMaterial({ color: spec.hatColor || '#E6B85C', roughness: 0.74 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.86 });
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x52341c, roughness: 0.82 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.28, metalness: 0.82 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1f2a3c, roughness: 0.35 });
  const blushMat = new THREE.MeshStandardMaterial({ color: 0xf29ca8, roughness: 0.68 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x4f3524, roughness: 0.84 });

  // Boots / Legs (grounded at y = 0)
  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.18, 4, 8), bootMat);
  leftLeg.position.set(-0.1, 0.16, 0);
  leftLeg.castShadow = true;

  const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.18, 4, 8), bootMat);
  rightLeg.position.set(0.1, 0.16, 0);
  rightLeg.castShadow = true;

  // Tunic Torso + Waist Belt
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.235, 0.45, 14), tunicMat);
  torso.position.y = 0.48;
  torso.castShadow = true;

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.222, 0.228, 0.065, 14), beltMat);
  belt.position.y = 0.38;

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.075, 0.04), brassMat);
  buckle.position.set(0, 0.38, 0.215);

  // Arms + Hands
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.2, 4, 8), tunicMat);
    arm.position.set(side * 0.24, 0.52, 0);
    arm.rotation.z = side * -0.22;
    arm.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), skinMat);
    hand.position.set(side * 0.28, 0.38, 0);
    root.add(arm, hand);
  });

  // Head + Expressive Eyes & Cheeks
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 16, 14), skinMat);
  head.position.y = 0.88;
  head.castShadow = true;

  [-0.068, 0.068].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), eyeMat);
    eye.position.set(ex, 0.9, 0.184);
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), blushMat);
    blush.scale.set(1.2, 0.65, 0.5);
    blush.position.set(ex * 1.48, 0.85, 0.172);
    root.add(eye, blush);
  });

  root.add(leftLeg, rightLeg, torso, belt, buckle, head);

  // Hat Styles (5 distinct multi-part silhouettes)
  if (spec.hatStyle === 'explorer') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.04, 16), hatMat);
    brim.position.y = 1.02;
    brim.castShadow = true;
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.185, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hatMat,
    );
    crown.position.y = 1.02;
    crown.castShadow = true;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.192, 0.045, 14), tunicMat);
    band.position.y = 1.05;
    root.add(brim, crown, band);
  } else if (spec.hatStyle === 'beanie') {
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.048, 8, 16), hatMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = 1.0;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.195, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hatMat,
    );
    dome.position.y = 1.0;
    dome.castShadow = true;
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfbf7ee, roughness: 0.85 }));
    pom.position.y = 1.22;
    root.add(cuff, dome, pom);
  } else if (spec.hatStyle === 'wizard') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.035, 16), hatMat);
    brim.position.y = 1.02;
    brim.castShadow = true;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.48, 14), hatMat);
    cone.position.set(0, 1.24, -0.02);
    cone.rotation.x = -0.14;
    cone.castShadow = true;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.188, 0.196, 0.05, 14), brassMat);
    band.position.y = 1.05;
    root.add(brim, cone, band);
  } else if (spec.hatStyle === 'flower_crown') {
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x3b7a4a, roughness: 0.78 });
    const petalPalette = [0xf7c6cf, 0xf8e166, 0x9bd8ec, 0xf2b5c4, 0xffffff];
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 8, 16), vineMat);
    wreath.rotation.x = Math.PI / 2;
    wreath.position.y = 1.03;
    root.add(wreath);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const flower = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.05, 0),
        new THREE.MeshStandardMaterial({ color: petalPalette[i % petalPalette.length], roughness: 0.52 }),
      );
      flower.position.set(Math.cos(a) * 0.2, 1.045, Math.sin(a) * 0.2);
      root.add(flower);
    }
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), hairMat);
    tuft.position.set(0, 0.99, -0.04);
    root.add(tuft);
  } else {
    // Cozy hair tuft when hatStyle === 'none'
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.208, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      hairMat,
    );
    hairCap.position.set(0, 0.9, -0.02);
    hairCap.rotation.x = -0.15;
    const curl = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), hairMat);
    curl.position.set(0.04, 1.08, 0.06);
    root.add(hairCap, curl);
  }

  // Back / Neck Accessories
  if (spec.accessory === 'scarf') {
    const scarfMat = new THREE.MeshStandardMaterial({ color: spec.hatColor || '#E6B85C', roughness: 0.78 });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.045, 8, 16), scarfMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.7;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.24, 0.04), scarfMat);
    tail.position.set(0.09, 0.56, 0.16);
    tail.rotation.z = -0.16;
    root.add(collar, tail);
  } else if (spec.accessory === 'satchel') {
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x8a5838, roughness: 0.82 });
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.14), bagMat);
    pack.position.set(0, 0.5, -0.22);
    pack.castShadow = true;
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.12, 0.15), beltMat);
    flap.position.set(0, 0.6, -0.225);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.03), brassMat);
    clasp.position.set(0, 0.54, -0.3);
    root.add(pack, flap, clasp);
  } else if (spec.accessory === 'cape') {
    const capeMat = new THREE.MeshStandardMaterial({
      color: spec.hatColor || '#E6B85C',
      roughness: 0.75,
      side: THREE.DoubleSide,
    });
    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.58, 8, 1, true, Math.PI * 0.65, Math.PI * 0.7), capeMat);
    cape.position.set(0, 0.44, -0.06);
    cape.rotation.x = 0.12;
    cape.castShadow = true;
    root.add(cape);
  }

  return { root, leftLeg, rightLeg, tunicMat };
}

export function disposeAvatarGroup(group: THREE.Group) {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      m.geometry.dispose();
      if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
      else m.material.dispose();
    }
  });
}
