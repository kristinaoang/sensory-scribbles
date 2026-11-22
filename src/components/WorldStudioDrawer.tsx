import React, { useEffect } from 'react';
import { Compass, X } from 'lucide-react';
import { SharedReflectionCanvas, type WorldProgressEventPayload } from './SharedReflectionCanvas';
import type { AnonymousUser, JournalEntry, Prompt, Room, WorldProgressionState } from '../types';

interface WorldStudioDrawerProps {
  open: boolean;
  room: Room;
  user: AnonymousUser;
  prompt: Prompt | null;
  todayDate: string;
  todayEntryCount: number;
  userSubmittedToday: boolean;
  progression: WorldProgressionState | null;
  darkMode: boolean;
  onClose: () => void;
  onOpenWorld: (entry: JournalEntry) => void;
  onOpenInvite: () => void;
  onDailyEntrySubmitted: (todayIso: string) => Promise<void> | void;
  onWorldProgressed: (payload: WorldProgressEventPayload) => void;
}

export const WorldStudioDrawer: React.FC<WorldStudioDrawerProps> = ({
  open,
  room,
  user,
  prompt,
  todayDate,
  todayEntryCount,
  userSubmittedToday,
  progression,
  darkMode,
  onClose,
  onOpenWorld,
  onOpenInvite,
  onDailyEntrySubmitted,
  onWorldProgressed,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Prompt and Shared Drawing Studio"
    >
      {/* Solid translucent scrim (no backdrop-blur over WebGL canvas) */}
      <button
        type="button"
        aria-label="Close studio drawer"
        onClick={onClose}
        className="flex-1 bg-black/35 cursor-default"
      />

      <div className="relative w-full max-w-2xl h-full overflow-y-auto bg-[#F8F4EA] dark:bg-[#222A4C] border-l border-[#DDD4BC] dark:border-[#3D4978] shadow-2xl flex flex-col">
        <div className="sticky top-0 z-10 bg-[#F8F4EA] dark:bg-[#222A4C] border-b border-[#E5DEC9] dark:border-[#3D4978] px-5 py-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-mono-tabular text-[#2E7D5B] dark:text-[#7CD4C0]">
              Stage {progression?.level ?? 1} · {progression?.stageName || 'Seed Clearing'}
            </div>
            <h2 className="text-base sm:text-lg font-semibold font-display text-[#1F2A3C] dark:text-white truncate">
              Expand {room.name} Together
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-white dark:bg-[#19203E] border border-[#DDD4BC] dark:border-[#49578D] text-xs font-semibold text-[#1F2A3C] dark:text-slate-100 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              <span>View 3D World</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close studio"
              className="min-w-[40px] min-h-[40px] rounded-full bg-white dark:bg-[#19203E] border border-[#DDD4BC] dark:border-[#49578D] text-[#4C5568] dark:text-[#CBD5EB] flex items-center justify-center hover:bg-black/5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 flex-1">
          <SharedReflectionCanvas
            room={room}
            user={user}
            prompt={prompt}
            todayDate={todayDate}
            todayEntryCount={todayEntryCount}
            userSubmittedToday={userSubmittedToday}
            progression={progression}
            compact
            darkMode={darkMode}
            onOpenWorld={(entry) => {
              onClose();
              onOpenWorld(entry);
            }}
            onOpenRoomWorld={onClose}
            onOpenInvite={onOpenInvite}
            onDailyEntrySubmitted={onDailyEntrySubmitted}
            onWorldProgressed={onWorldProgressed}
          />
        </div>
      </div>
    </div>
  );
};
