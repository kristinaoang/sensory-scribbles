import React, { useState } from 'react';
import {
  BarChart3,
  Check,
  Compass,
  Copy,
  Grid2x2,
  Moon,
  Palette,
  PenLine,
  Shield,
  Sun,
  Ticket,
  UserCircle2,
} from 'lucide-react';
import { SENSORY_PALETTE } from './StrokeCanvas';
import type { AnonymousUser, Room } from '../types';

export type LauncherDestination = 'canvas' | 'mosaic-grid' | 'mosaic-world' | 'stats' | 'admin';

interface CommunityNookHeroProps {
  user: AnonymousUser;
  room: Room;
  darkMode: boolean;
  activeDestination: LauncherDestination;
  todayEntryCount: number;
  onToggleDarkMode: () => void;
  onNavigate: (dest: LauncherDestination) => void;
  onOpenInvite: () => void;
  onUpdateProfile: (displayName: string, avatarColor: string) => Promise<void>;
}

const DAYLIGHT_BANNER = '/src/assets/images/daylight_blossom_clearing_1795302402001.jpg';
const TWILIGHT_BANNER = '/src/assets/images/twilight_pine_clearing_1795302401397.jpg';

export const CommunityNookHero: React.FC<CommunityNookHeroProps> = ({
  user,
  room,
  darkMode,
  activeDestination,
  todayEntryCount,
  onToggleDarkMode,
  onNavigate,
  onOpenInvite,
  onUpdateProfile,
}) => {
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user.displayName);
  const [profileColor, setProfileColor] = useState(user.avatarColor);
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      onOpenInvite();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;
    setSaving(true);
    try {
      await onUpdateProfile(profileName.trim(), profileColor);
      setEditingProfile(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="Community room card and workspace launcher" className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Card: Daylight / Twilight Clearing + Curved Notch + Yellow Ribbon Nameplate */}
        <div className="lg:col-span-5 rounded-3xl bg-[#F8F4EA] dark:bg-[#2A335A] border border-[#E5DEC9] dark:border-[#3D4978] shadow-md overflow-hidden flex flex-col justify-between">
          {/* Illustrated Clearing Scene Banner with Stylized Gradient Fallback */}
          <div className="relative h-40 sm:h-44 overflow-hidden bg-gradient-to-b from-sky-300 via-emerald-200 to-emerald-300 dark:from-[#141B38] dark:via-[#1F2C56] dark:to-[#223547]">
            <img
              src={darkMode ? TWILIGHT_BANNER : DAYLIGHT_BANNER}
              alt={darkMode ? 'Twilight starry pine forest clearing' : 'Daylight cherry blossom meadow clearing'}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/25 to-transparent"
            />

            {/* Daylight / Twilight Theme Toggle Button */}
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? 'Switch to daylight canvas theme' : 'Switch to twilight canvas theme'}
              title={darkMode ? 'Switch to Daylight theme' : 'Switch to Twilight theme'}
              className="absolute top-3 right-3 min-w-[44px] min-h-[44px] rounded-full bg-[#F8F4EA]/95 dark:bg-[#2A335A]/95 border border-[#E5DEC9] dark:border-[#49578D] text-[#D99B1E] dark:text-[#F8E166] shadow-sm flex items-center justify-center hover:scale-105 transition-transform"
            >
              {darkMode ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5 text-[#2E3C66]" aria-hidden="true" />}
            </button>

            {/* Curved Cream/Indigo Cutout Arch overlapping scene bottom */}
            <div
              aria-hidden="true"
              className="absolute -bottom-7 left-1/2 -translate-x-1/2 w-32 h-14 rounded-t-full bg-[#F8F4EA] dark:bg-[#2A335A]"
            />
          </div>

          {/* Persona Body below arch */}
          <div className="relative px-5 pb-5 pt-0 flex-1 flex flex-col items-center text-center justify-between gap-3">
            {/* Avatar Medallion sitting inside the curved arch */}
            <div className="-mt-10 relative z-10 flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  setProfileName(user.displayName);
                  setProfileColor(user.avatarColor);
                  setEditingProfile((v) => !v);
                }}
                aria-label="Edit anonymous alias and avatar color"
                className="w-16 h-16 rounded-full border-4 border-[#F8F4EA] dark:border-[#2A335A] shadow-md flex items-center justify-center text-white font-display text-xl font-bold hover:scale-105 transition-transform"
                style={{ backgroundColor: user.avatarColor }}
              >
                {user.displayName.slice(0, 2).toUpperCase()}
              </button>

              {/* Signature Yellow Folded Ribbon Banner */}
              <div className="relative z-10 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setProfileName(user.displayName);
                    setProfileColor(user.avatarColor);
                    setEditingProfile((v) => !v);
                  }}
                  className="nook-ribbon min-h-[38px] px-7 py-1.5 rounded-md font-display font-bold text-base tracking-tight inline-flex items-center gap-1.5 hover:brightness-95 transition"
                >
                  <span>{user.displayName}</span>
                  <UserCircle2 className="w-4 h-4 opacity-70" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Clean Unboxed Room & Invite Code Metadata */}
            <div className="space-y-1 text-xs text-[#4C5568] dark:text-[#CBD5EB]">
              <div className="font-semibold text-[#1F2A3C] dark:text-white text-sm">
                {room.name}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-mono-tabular">
                <span>{room.code}</span>
                <span aria-hidden="true">·</span>
                <span>Invite: {room.inviteCode}</span>
              </div>
            </div>

            {/* Quick Invite / Switch Actions */}
            <div className="w-full flex items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleCopyInvite}
                className="min-h-[44px] flex-1 px-4 py-2 rounded-full bg-[#F7C6CF] hover:bg-[#F2B5C1] dark:bg-[#F8E166] dark:hover:bg-[#F2D544] text-[#43202A] dark:text-[#242E47] text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                {copiedCode ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                <span>{copiedCode ? 'Copied Code' : 'Copy Invite'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenInvite}
                className="min-h-[44px] flex-1 px-4 py-2 rounded-full bg-white dark:bg-[#1F2647] hover:bg-[#F0EAD8] dark:hover:bg-[#354070] border border-[#DDD4BC] dark:border-[#46538A] text-[#1F2A3C] dark:text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Ticket className="w-4 h-4" aria-hidden="true" />
                <span>Switch Room</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Card: 4+1 Tactile Pastel App Tiles (NookPhone Community Grid) */}
        <div className="lg:col-span-7 rounded-3xl bg-[#F8F4EA] dark:bg-[#2A335A] border border-[#E5DEC9] dark:border-[#3D4978] shadow-md p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="grid grid-cols-2 gap-3 flex-1">
            {/* Tile 1: Sky Blue — Today's Canvas */}
            <button
              type="button"
              onClick={() => onNavigate('canvas')}
              className={`relative overflow-hidden rounded-2xl p-4 text-left flex flex-col justify-between min-h-[108px] transition-transform hover:-translate-y-0.5 bg-[#A5C4EB] dark:bg-[#273B75] text-[#182436] dark:text-white ${
                activeDestination === 'canvas' ? 'ring-2 ring-[#242E47] dark:ring-[#F8E166] ring-offset-2 ring-offset-[#F8F4EA] dark:ring-offset-[#2A335A]' : ''
              }`}
            >
              <PenLine
                className="w-16 h-16 absolute -right-2 -bottom-2 opacity-15 pointer-events-none"
                aria-hidden="true"
              />
              <div className="w-10 h-10 rounded-xl bg-white/60 dark:bg-white/15 flex items-center justify-center">
                <PenLine className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <div className="font-bold text-sm sm:text-base leading-tight">Today&apos;s Canvas</div>
                <div className="text-xs opacity-85 mt-0.5 font-mono-tabular">
                  {todayEntryCount} {todayEntryCount === 1 ? 'tile' : 'tiles'} placed today
                </div>
              </div>
            </button>

            {/* Tile 2: Blossom Rose — Room Mosaic */}
            <button
              type="button"
              onClick={() => onNavigate('mosaic-grid')}
              className={`relative overflow-hidden rounded-2xl p-4 text-left flex flex-col justify-between min-h-[108px] transition-transform hover:-translate-y-0.5 bg-[#E3B6C1] dark:bg-[#875871] text-[#2A1820] dark:text-white ${
                activeDestination === 'mosaic-grid' ? 'ring-2 ring-[#242E47] dark:ring-[#F8E166] ring-offset-2 ring-offset-[#F8F4EA] dark:ring-offset-[#2A335A]' : ''
              }`}
            >
              <Grid2x2
                className="w-16 h-16 absolute -right-2 -bottom-2 opacity-15 pointer-events-none"
                aria-hidden="true"
              />
              <div className="w-10 h-10 rounded-xl bg-white/60 dark:bg-white/15 flex items-center justify-center">
                <Grid2x2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <div className="font-bold text-sm sm:text-base leading-tight">Room Mosaic</div>
                <div className="text-xs opacity-85 mt-0.5">
                  Tiles, history &amp; minigames
                </div>
              </div>
            </button>

            {/* Tile 3: Warm Honey Ochre — 3D Room World */}
            <button
              type="button"
              onClick={() => onNavigate('mosaic-world')}
              className={`relative overflow-hidden rounded-2xl p-4 text-left flex flex-col justify-between min-h-[108px] transition-transform hover:-translate-y-0.5 bg-[#D8AA72] dark:bg-[#8A6136] text-[#2B1D0E] dark:text-white ${
                activeDestination === 'mosaic-world' ? 'ring-2 ring-[#242E47] dark:ring-[#F8E166] ring-offset-2 ring-offset-[#F8F4EA] dark:ring-offset-[#2A335A]' : ''
              }`}
            >
              <Compass
                className="w-16 h-16 absolute -right-2 -bottom-2 opacity-15 pointer-events-none"
                aria-hidden="true"
              />
              <div className="w-10 h-10 rounded-xl bg-white/60 dark:bg-white/15 flex items-center justify-center">
                <Compass className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <div className="font-bold text-sm sm:text-base leading-tight">3D Room World</div>
                <div className="text-xs opacity-85 mt-0.5">
                  Walk shared sensory plots
                </div>
              </div>
            </button>

            {/* Tile 4: Mint Seafoam Teal — Stats & Accuracy */}
            <button
              type="button"
              onClick={() => onNavigate('stats')}
              className={`relative overflow-hidden rounded-2xl p-4 text-left flex flex-col justify-between min-h-[108px] transition-transform hover:-translate-y-0.5 bg-[#7CD4C0] dark:bg-[#2B7D6E] text-[#112A24] dark:text-white ${
                activeDestination === 'stats' ? 'ring-2 ring-[#242E47] dark:ring-[#F8E166] ring-offset-2 ring-offset-[#F8F4EA] dark:ring-offset-[#2A335A]' : ''
              }`}
            >
              <BarChart3
                className="w-16 h-16 absolute -right-2 -bottom-2 opacity-15 pointer-events-none"
                aria-hidden="true"
              />
              <div className="w-10 h-10 rounded-xl bg-white/60 dark:bg-white/15 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <div className="font-bold text-sm sm:text-base leading-tight">Stats &amp; Accuracy</div>
                <div className="text-xs opacity-85 mt-0.5">
                  Weekly perception trends
                </div>
              </div>
            </button>
          </div>

          {/* Tile 5: Wide Lavender Strip — Nightly Activity & Admin */}
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className={`relative overflow-hidden rounded-2xl px-4 py-3.5 text-left flex items-center justify-between gap-3 min-h-[60px] transition-transform hover:-translate-y-0.5 bg-[#C1B1DB] dark:bg-[#615285] text-[#221A33] dark:text-white ${
              activeDestination === 'admin' ? 'ring-2 ring-[#242E47] dark:ring-[#F8E166] ring-offset-2 ring-offset-[#F8F4EA] dark:ring-offset-[#2A335A]' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/60 dark:bg-white/15 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <div className="font-bold text-sm leading-tight">Nightly Activity &amp; Admin</div>
                <div className="text-xs opacity-85">
                  Moderation, tomorrow&apos;s prompt &amp; Mastra summary
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold whitespace-nowrap shrink-0 underline-offset-2 hover:underline">
              Open →
            </span>
          </button>
        </div>
      </div>

      {/* Inline Alias & Avatar Customizer Drawer (triggered by clicking nameplate/avatar) */}
      {editingProfile && (
        <form
          onSubmit={handleSave}
          className="rounded-3xl border border-[#E5DEC9] dark:border-[#3D4978] bg-[#F8F4EA] dark:bg-[#2A335A] p-4 sm:p-5 flex flex-wrap items-end gap-4 shadow-sm"
        >
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="alias-input" className="block text-xs font-semibold text-[#4C5568] dark:text-[#CBD5EB] mb-1">
              Anonymous Alias (no real names)
            </label>
            <input
              id="alias-input"
              type="text"
              maxLength={28}
              required
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#1F2647] text-sm text-[#1F2A3C] dark:text-white"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-[#4C5568] dark:text-[#CBD5EB] mb-1">
              Avatar Badge Color
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {SENSORY_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  aria-label={c.name}
                  onClick={() => setProfileColor(c.hex)}
                  className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-transform ${
                    profileColor.toLowerCase() === c.hex.toLowerCase()
                      ? 'ring-2 ring-[#242E47] dark:ring-[#F8E166] bg-white dark:bg-[#1F2647] scale-105'
                      : 'hover:scale-105'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full border border-black/15" style={{ backgroundColor: c.hex }} />
                </button>
              ))}
              <label
                title={`Choose custom avatar badge color (${profileColor})`}
                className={`relative min-h-[44px] px-2.5 rounded-xl border inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-transform ${
                  !SENSORY_PALETTE.some((c) => c.hex.toLowerCase() === profileColor.toLowerCase())
                    ? 'ring-2 ring-[#242E47] dark:ring-[#F8E166] border-[#242E47] dark:border-[#F8E166] bg-white dark:bg-[#1F2647] text-[#1F2A3C] dark:text-white'
                    : 'border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#1F2647] text-[#1F2A3C] dark:text-slate-100 hover:scale-105'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                  style={{ backgroundColor: profileColor }}
                />
                <Palette className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Custom</span>
                <input
                  type="color"
                  data-testid="custom-profile-color-input"
                  aria-label="Choose custom avatar badge color"
                  value={/^#[0-9a-fA-F]{6}$/.test(profileColor) ? profileColor : '#2E7D5B'}
                  onChange={(e) => setProfileColor(e.target.value.toUpperCase())}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-5 py-2 rounded-full bg-[#2E7D5B] hover:bg-[#246649] text-white text-xs font-bold whitespace-nowrap"
            >
              {saving ? 'Saving…' : 'Save Alias'}
            </button>
            <button
              type="button"
              onClick={() => setEditingProfile(false)}
              className="min-h-[44px] px-4 py-2 rounded-full border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#1F2647] text-xs font-semibold text-[#1F2A3C] dark:text-white whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
