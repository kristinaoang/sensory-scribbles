import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const CANNED_IDEAS = [
  'Draw one soft shape you noticed.',
  'Write three quiet words.',
  'Sketch the color of the afternoon.',
];

interface CampusPromptCardProps {
  roomName: string;
  level: number;
  stageName?: string;
  prompt: string;
  drawingPrompt?: string;
  progressCount: number;
  progressTarget: number;
  expandedTitle?: string | null;
  onDismissExpansion?: () => void;
  onAnswer?: () => void;
}

/**
 * One paper card over the Wellesley campus. Empty slots stay for quest popups,
 * tap-to-enter, the minimap, and help when those features arrive.
 */
export const CampusPromptCard: React.FC<CampusPromptCardProps> = ({
  roomName,
  level,
  stageName,
  prompt,
  drawingPrompt,
  progressCount,
  progressTarget,
  expandedTitle,
  onDismissExpansion,
  onAnswer,
}) => {
  const [ideas, setIdeas] = useState<string[]>(CANNED_IDEAS);
  const [tucked, setTucked] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('ss-quest-tucked') === '1';
    } catch {
      return false;
    }
  });
  const safeTarget = Math.max(1, progressTarget);
  const shown = Math.max(0, Math.min(safeTarget, progressCount));

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 2600);
    fetch('/api/child/draw-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: ctrl.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const next = Array.isArray(data?.ideas) ? data.ideas.filter((item: unknown) => typeof item === 'string') : [];
        if (next.length === 3) setIdeas(next.slice(0, 3));
      })
      .catch(() => {
        setIdeas(CANNED_IDEAS);
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [prompt]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        className="pointer-events-none absolute left-3 top-3 flex max-w-[min(22rem,calc(100%-10.5rem))] flex-col gap-2 sm:left-4 sm:top-4"
        data-feature-host="campus-journal"
      >
        <button
          type="button"
          data-testid="quest-tab"
          aria-expanded={!tucked}
          onClick={() => {
            setTucked((prev) => {
              const next = !prev;
              try {
                window.localStorage.setItem('ss-quest-tucked', next ? '1' : '0');
              } catch {
                /* the tab still works for this visit */
              }
              return next;
            });
          }}
          className="pointer-events-auto inline-flex min-h-[44px] w-fit cursor-pointer items-center rounded-full border border-[#E5DEC9] bg-[#F8F4EA] px-4 font-sans text-sm font-bold text-[#1F2A3C] shadow-md"
        >
          {tucked ? 'Quest' : 'Hide quest'}
        </button>
        {!tucked ? (
        <section
          className="pointer-events-auto rounded-3xl border border-[#E5DEC9] bg-[#F8F4EA]/95 p-4 text-[#1F2A3C] shadow-md dark:border-[#3D4978] dark:bg-[#222A4C]/95 dark:text-slate-100"
          aria-label={`${roomName} prompt`}
        >
          <p className="text-xs font-medium text-[#555E72] dark:text-[#BDC7E3]">
            <span className="font-semibold text-[#2E7D5B] dark:text-[#7CD4C0]">Stage {level}</span>
            {stageName ? <span> · {stageName}</span> : null}
          </p>
          <h2 className="mt-0.5 font-display text-lg font-semibold leading-snug text-[#1F2A3C] dark:text-white">
            {roomName}
          </h2>
          <p data-testid="campus-prompt" className="mt-2 font-sans text-sm leading-snug text-[#2B374E] dark:text-[#E2EAFD]">“{prompt}”</p>
          {drawingPrompt ? (
            <p className="mt-1 text-[11px] leading-snug text-[#4C5568] dark:text-[#CBD5EB]">
              Draw together: <span className="font-semibold">{drawingPrompt}</span>
            </p>
          ) : null}
          <ul className="mt-2 space-y-0.5 text-[11px] leading-snug text-[#4C5568] dark:text-[#CBD5EB]">
            {ideas.map((idea) => (
              <li key={idea}>{idea}</li>
            ))}
          </ul>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5DEC9] dark:bg-[#18203D]">
            <div
              className="h-full rounded-full bg-[#F7C6CF] dark:bg-[#F8E166]"
              style={{ width: `${Math.min(100, Math.round((shown / safeTarget) * 100))}%` }}
            />
          </div>
          {onAnswer ? (
            <button
              type="button"
              onClick={onAnswer}
              className="mt-3 inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#F7C6CF] px-3.5 py-1.5 font-sans text-xs font-bold text-[#43202A] hover:bg-[#F2B1BE] dark:bg-[#F8E166] dark:text-[#242E47] dark:hover:bg-[#F2D544]"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Answer &amp; Draw
            </button>
          ) : null}
        </section>
        ) : null}

        {expandedTitle ? (
          <div
            role="status"
            className="pointer-events-auto flex items-start justify-between gap-3 rounded-3xl border border-[#E5DEC9] bg-[#F8F4EA] px-4 py-3 text-[#1F2A3C] shadow-md dark:border-[#3D4978] dark:bg-[#222A4C] dark:text-slate-100"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2E7D5B] dark:text-[#7CD4C0]">
                World expanded · Stage {level}
              </p>
              <p className="text-sm font-semibold">{expandedTitle} unlocked</p>
            </div>
            {onDismissExpansion ? (
              <button
                type="button"
                onClick={onDismissExpansion}
                aria-label="Dismiss expansion notice"
                className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-full hover:bg-black/5"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div data-feature-slot="quest-popup" hidden />
      <div data-feature-slot="tap-enter" hidden />
      <div data-feature-slot="minimap" hidden />
      <div data-feature-slot="help" hidden />
    </div>
  );
};
