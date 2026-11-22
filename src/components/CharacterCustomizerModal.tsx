import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Check, Palette, Sparkles, X } from 'lucide-react';
import type { AnonymousUser, AvatarCustomization } from '../types';
import {
  ACCESSORY_OPTIONS,
  HAT_COLORS,
  HAT_STYLES,
  SKIN_TONES,
  TUNIC_COLORS,
  buildCustomizableAvatar,
  disposeAvatarGroup,
} from './avatarBuilder';

function detectSoftwareWebGL(): boolean {
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

interface CharacterCustomizerModalProps {
  open: boolean;
  user: AnonymousUser;
  initialLook: AvatarCustomization;
  darkMode?: boolean;
  onClose: () => void;
  onSave: (displayName: string, look: AvatarCustomization) => Promise<void>;
}

export const CharacterCustomizerModal: React.FC<CharacterCustomizerModalProps> = ({
  open,
  user,
  initialLook,
  darkMode = false,
  onClose,
  onSave,
}) => {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [look, setLook] = useState<AvatarCustomization>(initialLook);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewMountRef = useRef<HTMLDivElement | null>(null);
  const previewSyncRef = useRef<((nextLook: AvatarCustomization, isDark: boolean) => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    setDisplayName(user.displayName);
    setLook(initialLook);
    setError(null);
  }, [open, user.displayName, initialLook]);

  // Mount isolated on-demand Three.js 3D Avatar Preview stage
  useEffect(() => {
    if (!open) return;
    const container = previewMountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || 260;
    const height = container.clientHeight || 280;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(darkMode ? '#1A2444' : '#DCEFFC');

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 30);
    camera.position.set(0, 1.05, 2.55);
    camera.lookAt(0, 0.65, 0);

    const hemi = new THREE.HemisphereLight(darkMode ? 0x7089c4 : 0xdbeafe, darkMode ? 0x241d35 : 0x73bc6e, 0.85);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff1d6, 1.45);
    key.position.set(2.4, 3.8, 2.8);
    key.castShadow = !isSoftwareGl;
    scene.add(key);

    // Meadow pedestal under avatar
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.76, 0.14, 24),
      new THREE.MeshStandardMaterial({ color: darkMode ? 0x2e584f : 0x73bc6e, roughness: 0.85 }),
    );
    pedestal.position.y = -0.07;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const avatarHolder = new THREE.Group();
    scene.add(avatarHolder);
    let currentRig = buildCustomizableAvatar(initialLook);
    avatarHolder.add(currentRig.root);

    let yaw = 0.28;
    let dragging = false;
    let lastX = 0;
    let frameId = 0;
    let disposed = false;
    let renderBusy = false;
    let renderDirty = false;

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

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        avatarHolder.rotation.y = yaw;
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty && !disposed) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    requestRender();

    previewSyncRef.current = (nextLook, isDark) => {
      scene.background = new THREE.Color(isDark ? '#1A2444' : '#DCEFFC');
      avatarHolder.remove(currentRig.root);
      disposeAvatarGroup(currentRig.root);
      currentRig = buildCustomizableAvatar(nextLook);
      avatarHolder.add(currentRig.root);
      requestRender();
    };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      yaw += dx * 0.015;
      requestRender();
    };
    const onUp = () => {
      dragging = false;
    };

    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      disposed = true;
      previewSyncRef.current = null;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      disposeAvatarGroup(scene as unknown as THREE.Group);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [open]);

  // Sync live look changes into the 3D preview without recreating WebGL context
  useEffect(() => {
    if (!open) return;
    previewSyncRef.current?.(look, darkMode);
  }, [open, look, darkMode]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError('Enter an explorer nickname (up to 28 characters).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed, look);
      onClose();
    } catch {
      setError('Could not save character look. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D1324]/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="character-customizer-title"
      data-testid="character-customizer-modal"
    >
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#F8F4EA] dark:bg-[#222A4C] border border-[#DDD4BC] dark:border-[#3D4978] shadow-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-[#E5DEC9] dark:border-[#3D4978] pb-3.5">
          <div>
            <h2
              id="character-customizer-title"
              className="text-xl font-bold font-display text-[#1F2A3C] dark:text-white"
            >
              Customize Your Island Explorer
            </h2>
            <p className="text-xs text-[#4C5568] dark:text-[#CBD5EB] mt-0.5">
              Drag the 3D preview to spin your character and tailor your look for the room world.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close character customization window"
            className="min-w-[40px] min-h-[40px] rounded-full bg-white dark:bg-[#19203E] border border-[#DDD4BC] dark:border-[#49578D] text-[#4C5568] dark:text-[#CBD5EB] flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          {/* Left Column: Interactive Live 3D Avatar Preview */}
          <div className="md:col-span-5 flex flex-col justify-between rounded-2xl border border-[#DDD4BC] dark:border-[#3D4978] bg-[#DCEFFC] dark:bg-[#1A2444] overflow-hidden">
            <div
              ref={previewMountRef}
              className="w-full h-64 md:h-full min-h-[260px] cursor-grab active:cursor-grabbing"
              aria-label="Interactive 3D character preview"
            />
            <div className="px-3.5 py-2.5 bg-white/95 dark:bg-[#19203E]/95 border-t border-[#DDD4BC] dark:border-[#3D4978] flex items-center justify-between text-xs">
              <span className="font-semibold text-[#1F2A3C] dark:text-white truncate">
                {displayName.trim() || user.displayName}
              </span>
              <span className="text-[#555E72] dark:text-[#BDC7E3] whitespace-nowrap">Drag to spin</span>
            </div>
          </div>

          {/* Right Column: Controls */}
          <div className="md:col-span-7 space-y-4">
            <div>
              <label
                htmlFor="customizer-alias-input"
                className="block text-xs font-semibold text-[#4C5568] dark:text-[#CBD5EB] mb-1"
              >
                Explorer Alias
              </label>
              <input
                id="customizer-alias-input"
                type="text"
                maxLength={28}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="moss-fox"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#19203E] text-sm text-[#1F2A3C] dark:text-white"
              />
            </div>

            {/* Skin Tone */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#4C5568] dark:text-[#CBD5EB]">
                  Skin Tone
                </span>
                <span className="font-mono-tabular text-[11px] text-[#555E72] dark:text-[#BDC7E3]">
                  {look.skinTone.toUpperCase()}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {SKIN_TONES.map((tone) => {
                  const selected = look.skinTone.toLowerCase() === tone.hex.toLowerCase();
                  return (
                    <button
                      key={tone.hex}
                      type="button"
                      aria-label={tone.name}
                      title={tone.name}
                      onClick={() => setLook((prev) => ({ ...prev, skinTone: tone.hex }))}
                      className={`min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center border transition-transform ${
                        selected
                          ? 'border-[#242E47] dark:border-[#F8E166] ring-2 ring-[#242E47] dark:ring-[#F8E166] scale-105 bg-white dark:bg-[#19203E]'
                          : 'border-[#DDD4BC] dark:border-[#49578D] bg-white/80 dark:bg-[#19203E]/80 hover:scale-105'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full border border-black/15"
                        style={{ backgroundColor: tone.hex }}
                      />
                    </button>
                  );
                })}
                <label
                  title="Choose custom skin tone"
                  className={`relative min-h-[40px] px-2.5 rounded-xl border inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-transform ${
                    !SKIN_TONES.some((t) => t.hex.toLowerCase() === look.skinTone.toLowerCase())
                      ? 'border-[#242E47] dark:border-[#F8E166] ring-2 ring-[#242E47] dark:ring-[#F8E166] bg-white dark:bg-[#19203E] text-[#1F2A3C] dark:text-white'
                      : 'border-[#DDD4BC] dark:border-[#49578D] bg-white/80 dark:bg-[#19203E]/80 text-[#1F2A3C] dark:text-slate-100 hover:scale-105'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                    style={{ backgroundColor: look.skinTone }}
                  />
                  <Palette className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Custom</span>
                  <input
                    type="color"
                    data-testid="custom-skin-color-input"
                    aria-label="Choose custom skin tone color"
                    value={/^#[0-9a-fA-F]{6}$/.test(look.skinTone) ? look.skinTone : '#F6D5B8'}
                    onChange={(e) => setLook((prev) => ({ ...prev, skinTone: e.target.value.toUpperCase() }))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Tunic Color */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#4C5568] dark:text-[#CBD5EB]">
                  Tunic Color
                </span>
                <span className="font-mono-tabular text-[11px] text-[#555E72] dark:text-[#BDC7E3]">
                  {look.tunicColor.toUpperCase()}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {TUNIC_COLORS.map((color) => {
                  const selected = look.tunicColor.toLowerCase() === color.hex.toLowerCase();
                  return (
                    <button
                      key={color.hex}
                      type="button"
                      aria-label={color.name}
                      title={color.name}
                      onClick={() => setLook((prev) => ({ ...prev, tunicColor: color.hex }))}
                      className={`min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center border transition-transform ${
                        selected
                          ? 'border-[#242E47] dark:border-[#F8E166] ring-2 ring-[#242E47] dark:ring-[#F8E166] scale-105 bg-white dark:bg-[#19203E]'
                          : 'border-[#DDD4BC] dark:border-[#49578D] bg-white/80 dark:bg-[#19203E]/80 hover:scale-105'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full border border-black/15 flex items-center justify-center"
                        style={{ backgroundColor: color.hex }}
                      >
                        {selected && <Check className="w-3 h-3 text-white drop-shadow-xs" aria-hidden="true" />}
                      </span>
                    </button>
                  );
                })}
                <label
                  title="Choose custom tunic color"
                  className={`relative min-h-[40px] px-2.5 rounded-xl border inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-transform ${
                    !TUNIC_COLORS.some((c) => c.hex.toLowerCase() === look.tunicColor.toLowerCase())
                      ? 'border-[#242E47] dark:border-[#F8E166] ring-2 ring-[#242E47] dark:ring-[#F8E166] bg-white dark:bg-[#19203E] text-[#1F2A3C] dark:text-white'
                      : 'border-[#DDD4BC] dark:border-[#49578D] bg-white/80 dark:bg-[#19203E]/80 text-[#1F2A3C] dark:text-slate-100 hover:scale-105'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                    style={{ backgroundColor: look.tunicColor }}
                  />
                  <Palette className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Custom</span>
                  <input
                    type="color"
                    data-testid="custom-tunic-color-input"
                    aria-label="Choose custom tunic color"
                    value={/^#[0-9a-fA-F]{6}$/.test(look.tunicColor) ? look.tunicColor : '#2E7D5B'}
                    onChange={(e) => setLook((prev) => ({ ...prev, tunicColor: e.target.value.toUpperCase() }))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Hat Style & Hat Color */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-[#4C5568] dark:text-[#CBD5EB]">
                Hat &amp; Headwear
              </span>
              <div className="flex flex-wrap gap-1.5">
                {HAT_STYLES.map((opt) => {
                  const active = look.hatStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`hat-style-${opt.id}`}
                      onClick={() => setLook((prev) => ({ ...prev, hatStyle: opt.id }))}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-[#2E7D5B] border-[#2E7D5B] text-white'
                          : 'bg-white dark:bg-[#19203E] border-[#DDD4BC] dark:border-[#49578D] text-[#1F2A3C] dark:text-slate-100 hover:border-[#2E7D5B]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="text-[11px] text-[#555E72] dark:text-[#BDC7E3] mr-1">Accent color:</span>
                {HAT_COLORS.map((hc) => {
                  const selected = look.hatColor.toLowerCase() === hc.hex.toLowerCase();
                  return (
                    <button
                      key={hc.hex}
                      type="button"
                      aria-label={`Hat accent ${hc.name}`}
                      title={hc.name}
                      onClick={() => setLook((prev) => ({ ...prev, hatColor: hc.hex }))}
                      className={`min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center border transition-transform ${
                        selected
                          ? 'border-[#242E47] dark:border-[#F8E166] ring-2 ring-[#242E47] dark:ring-[#F8E166] scale-105 bg-white dark:bg-[#19203E]'
                          : 'border-[#DDD4BC] dark:border-[#49578D] bg-white/80 dark:bg-[#19203E]/80'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-black/15"
                        style={{ backgroundColor: hc.hex }}
                      />
                    </button>
                  );
                })}
                <label
                  title={`Choose custom hat or gear accent color (${look.hatColor})`}
                  className={`relative min-h-[34px] px-2.5 rounded-lg border inline-flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer transition-transform ${
                    !HAT_COLORS.some((hc) => hc.hex.toLowerCase() === look.hatColor.toLowerCase())
                      ? 'border-[#242E47] dark:border-[#F8E166] ring-2 ring-[#242E47] dark:ring-[#F8E166] bg-white dark:bg-[#19203E] text-[#1F2A3C] dark:text-white'
                      : 'border-[#DDD4BC] dark:border-[#49578D] bg-white/80 dark:bg-[#19203E]/80 text-[#1F2A3C] dark:text-slate-100 hover:scale-105'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                    style={{ backgroundColor: look.hatColor }}
                  />
                  <Palette className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>Custom</span>
                  <input
                    type="color"
                    data-testid="custom-hat-color-input"
                    aria-label="Choose custom hat or gear accent color"
                    value={/^#[0-9a-fA-F]{6}$/.test(look.hatColor) ? look.hatColor : '#E6B85C'}
                    onChange={(e) => setLook((prev) => ({ ...prev, hatColor: e.target.value.toUpperCase() }))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Accessory */}
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-[#4C5568] dark:text-[#CBD5EB]">
                Traveler Gear
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ACCESSORY_OPTIONS.map((acc) => {
                  const active = look.accessory === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      data-testid={`accessory-${acc.id}`}
                      onClick={() => setLook((prev) => ({ ...prev, accessory: acc.id }))}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-[#2B7CB3] border-[#2B7CB3] text-white'
                          : 'bg-white dark:bg-[#19203E] border-[#DDD4BC] dark:border-[#49578D] text-[#1F2A3C] dark:text-slate-100 hover:border-[#2B7CB3]'
                      }`}
                    >
                      {acc.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E5DEC9] dark:border-[#3D4978]">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 rounded-full border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#19203E] text-xs font-semibold text-[#1F2A3C] dark:text-white whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="save-character-btn"
                disabled={saving}
                className="min-h-[44px] px-5 py-2 rounded-full bg-[#2E7D5B] hover:bg-[#246649] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{saving ? 'Saving…' : 'Save Character'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
