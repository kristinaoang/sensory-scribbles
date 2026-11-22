import React from 'react';
import { Calendar, Compass, Gamepad2, ShieldCheck } from 'lucide-react';
import type { JournalEntry, NightlyCaption, Prompt } from '../types';
import { StrokePreview } from './StrokeCanvas';

interface MosaicGridProps {
  date: string;
  availableDates: string[];
  prompt: Prompt | null;
  entries: JournalEntry[];
  caption: NightlyCaption | null;
  darkMode?: boolean;
  onDateChange: (date: string) => void;
  onOpenWorld: (entry: JournalEntry) => void;
  onOpenMinigame: (entry: JournalEntry) => void;
}

export const MosaicGrid: React.FC<MosaicGridProps> = ({
  date,
  availableDates,
  prompt,
  entries,
  caption,
  darkMode = false,
  onDateChange,
  onOpenWorld,
  onOpenMinigame,
}) => {
  return (
    <section className="space-y-6" aria-labelledby="mosaic-heading">
      {/* Mosaic Header + Date Picker */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5DEC9] dark:border-[#3D4978] pb-4">
        <div className="space-y-1">
          <h2 id="mosaic-heading" className="text-2xl font-semibold text-[#1F2A3C] dark:text-white tracking-tight">
            Room Mosaic
          </h2>
          <p className="text-sm text-[#4C5568] dark:text-[#CBD5EB] max-w-2xl">
            {prompt ? prompt.text : 'No prompt was recorded for this date.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="mosaic-date-picker" className="text-xs font-semibold text-[#4C5568] dark:text-[#CBD5EB] inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4" aria-hidden="true" />
            <span>Date</span>
          </label>
          <input
            id="mosaic-date-picker"
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="min-h-[44px] px-3 py-2 rounded-full border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#21294A] text-sm font-mono-tabular text-[#1F2A3C] dark:text-slate-100"
          />
        </div>
      </div>

      {/* Quick past-day switcher */}
      {availableDates.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Past mosaic dates">
          {availableDates.slice(0, 8).map((d) => {
            const active = d === date;
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onDateChange(d)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-mono-tabular whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[#2E7D5B] dark:bg-[#F8E166] text-white dark:text-[#242E47] font-bold'
                    : 'bg-white dark:bg-[#21294A] border border-[#DDD4BC] dark:border-[#3D4978] text-[#3D475E] dark:text-[#CBD5EB] hover:bg-[#ECE5D3] dark:hover:bg-[#333F6E]'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      )}

      {/* Tiles Grid or Honest Empty State */}
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-10 text-center space-y-2">
          <p className="text-base font-medium text-[#1F2A3C] dark:text-slate-100">
            No tiles have been drawn for {date} yet.
          </p>
          <p className="text-sm text-[#555E72] dark:text-[#BDC7E3]">
            Share the first sentence and stroke on today&apos;s prompt or pick another date above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-3xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] overflow-hidden shadow-xs flex flex-col justify-between transition-transform hover:-translate-y-0.5"
            >
              {/* Clickable word-stroke canvas area opens unique 3D sensory world */}
              <button
                type="button"
                onClick={() => onOpenWorld(entry)}
                className="w-full text-left focus-visible:outline-2 focus-visible:outline-[#2B7CB3]"
              >
                <div className="h-36 bg-white dark:bg-[#161D3A] border-b border-[#E5DEC9] dark:border-[#3D4978] relative">
                  <StrokePreview stroke={entry.strokeJson} sentence={entry.sentence} darkMode={darkMode} />
                </div>

                <div className="p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-[#555E72] dark:text-[#BDC7E3]">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: entry.authorAvatarColor || entry.strokeJson.color }}
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-[#1F2A3C] dark:text-slate-100 truncate">
                      {entry.authorDisplayName || 'quiet-sprout'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{entry.worldSpec.label}</span>
                    {entry.isDemo && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular uppercase tracking-wide text-[11px] text-amber-700 dark:text-[#F8E166]">
                          demo
                        </span>
                      </>
                    )}
                  </div>

                  <p className="text-sm text-[#1F2A3C] dark:text-slate-100 leading-relaxed">
                    “{entry.sentence}”
                  </p>
                </div>
              </button>

              <div className="px-4 pb-3.5 pt-2 flex items-center justify-between gap-2 border-t border-[#EFE9D8] dark:border-[#333F6E]">
                <button
                  type="button"
                  onClick={() => onOpenWorld(entry)}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-bold text-[#1D5438] dark:text-[#7CD4C0] bg-[#E8F6EE] dark:bg-[#1E3B42] hover:brightness-95 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>3D World</span>
                </button>

                <div className="flex items-center gap-2">
                  {entry.solanaHash && (
                    <span
                      title={`Solana Devnet hash: ${entry.solanaHash}`}
                      className="text-[11px] font-mono-tabular text-[#555E72] dark:text-[#BDC7E3] inline-flex items-center gap-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#2B7CB3] dark:text-[#9BD8EC]" aria-hidden="true" />
                      <span>Anchored</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenMinigame(entry)}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-bold text-[#1E3D66] dark:text-white bg-[#DCEAF9] dark:bg-[#314A8B] hover:brightness-95 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Gamepad2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Minigame</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Caption Area Under Mosaic (Milestone 3 & 7) */}
      <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-5 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-[#555E72] dark:text-[#BDC7E3]">
          <span>Nightly Mosaic Caption</span>
          {caption && (
            <span className="font-mono-tabular">
              {caption.entryCount} {caption.entryCount === 1 ? 'entry' : 'entries'} synthesized
            </span>
          )}
        </div>
        {caption ? (
          <p className="text-base text-[#1F2A3C] dark:text-slate-100 leading-relaxed font-display">
            {caption.caption}
          </p>
        ) : (
          <p className="text-sm text-[#555E72] dark:text-[#BDC7E3]">
            Tonight&apos;s Mastra workflow will write a two-sentence reflection once the day closes (or an admin runs the nightly summary).
          </p>
        )}
      </div>
    </section>
  );
};
