import React, { useEffect, useRef, useState } from 'react';
import { PenLine, Send } from 'lucide-react';
import { publishCampusUnlocks } from '../campus/publishUnlocks';
import {
  buildCampusView,
  parseCampusCatalog,
  type CampusCatalog,
  type CampusView,
} from '../campus/unlockState';
import type { StrokeData, StrokePoint } from '../types';

interface CampusAreaJournalProps {
  userId: string;
  roomId: string;
  savedNonce?: number;
  frameRef: React.RefObject<HTMLIFrameElement | null>;
  onOpenStudio: (quest: { id: string; title: string; prompt: string; type?: string }) => void;
  onSaved?: () => void;
}

const INK = '#C86D3B';

function wordsToStroke(sentence: string): StrokeData {
  const points: StrokePoint[] = [];
  const wobble = sentence.length % 5;
  for (let i = 0; i <= 10; i += 1) {
    const t = i / 10;
    points.push({
      x: 0.14 + t * 0.72,
      y: 0.58 - Math.sin(t * Math.PI) * (0.16 + wobble * 0.01),
    });
  }
  return { points, color: INK, width: 5, paletteName: 'Amber Clay' };
}

function drawPoints(canvas: HTMLCanvasElement, points: StrokePoint[]) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (points.length < 2) return;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = point.x * rect.width;
    const y = point.y * rect.height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

export const CampusAreaJournal: React.FC<CampusAreaJournalProps> = ({
  userId,
  roomId,
  savedNonce = 0,
  frameRef,
  onOpenStudio,
  onSaved,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [catalog, setCatalog] = useState<CampusCatalog | null>(null);
  const [view, setView] = useState<CampusView | null>(null);
  const [promptText, setPromptText] = useState('');
  const [sentence, setSentence] = useState('');
  const [points, setPoints] = useState<StrokePoint[]>([]);
  const [hidden, setHidden] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(`ss_area_journal_hidden:${roomId}:${userId}`) === '1';
  });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [pickingAgain, setPickingAgain] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/content/area-unlocks.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        const parsed = parseCampusCatalog(raw);
        if (active && parsed) setCatalog(parsed);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!catalog) return;
    let active = true;
    const fallback = buildCampusView(catalog, [], null);
    fetch(`/api/campus/unlocks?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data && Array.isArray(data.areas) && typeof data.parentLine === 'string') {
          setView(data as CampusView);
        } else {
          setView(fallback);
        }
      })
      .catch(() => {
        if (active) setView(fallback);
      });
    return () => {
      active = false;
    };
  }, [catalog, roomId, userId, savedNonce]);

  useEffect(() => {
    if (!view) return;
    publishCampusUnlocks(view, frameRef.current);
    setPromptText(view.prompt);
    const areaId = view.currentAreaId;
    if (!areaId) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 2500);
    fetch(`/api/campus/prompt?areaId=${encodeURIComponent(areaId)}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (typeof data?.prompt === 'string' && data.prompt.trim()) setPromptText(data.prompt.trim());
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [view, frameRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawPoints(canvas, points);
  }, [points, hidden, view?.currentAreaId]);

  const current = view?.areas.find((area) => area.id === view.currentAreaId) ?? null;

  const decline = () => {
    window.sessionStorage.setItem(`ss_area_journal_hidden:${roomId}:${userId}`, '1');
    setHidden(true);
    setNote(null);
  };

  const reopen = () => {
    window.sessionStorage.removeItem(`ss_area_journal_hidden:${roomId}:${userId}`);
    setHidden(false);
  };

  const pointerPoint = (event: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height))),
    };
  };

  const save = async () => {
    if (!current || saving) return;
    const trimmed = sentence.trim().slice(0, 140);
    if (!trimmed && points.length < 2) return;
    const stroke = points.length >= 2 ? { points, color: INK, width: 5, paletteName: 'Amber Clay' } : wordsToStroke(trimmed);
    const text = trimmed || 'A drawing.';
    setSaving(true);
    setNote(null);
    try {
      const body = {
        roomId,
        userId,
        sentence: text,
        strokeJson: stroke,
        publishToCanvas: true,
        questId: current.id,
      };
      let res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        res = await fetch('/api/world/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(data.flagged ? 'Let’s try a different few words.' : 'That page stayed here. You can try again when you want.');
        return;
      }
      const nextRes = await fetch(`/api/campus/unlocks?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}`);
      if (nextRes.ok) {
        const next = (await nextRes.json()) as CampusView;
        setView(next);
        publishCampusUnlocks(next, frameRef.current);
      }
      setSentence('');
      setPoints([]);
      onSaved?.();
    } catch {
      setNote('That page stayed here. You can try again when you want.');
    } finally {
      setSaving(false);
    }
  };

  const choose = async (placeId: string) => {
    if (choosing) return;
    setChoosing(true);
    setNote(null);
    try {
      const res = await fetch('/api/campus/wander', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId, placeId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && typeof data.parentLine === 'string') {
        setPickingAgain(false);
        setView(data as CampusView);
        publishCampusUnlocks(data as CampusView, frameRef.current);
      } else {
        setNote('That choice can wait. The campus is still open.');
      }
    } catch {
      setNote('That choice can wait. The campus is still open.');
    } finally {
      setChoosing(false);
    }
  };

  if (!view) {
    return (
      <div className="pointer-events-none absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
        <section className="pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-[#E5DEC9] bg-[#F8F4EA]/95 p-4 text-sm text-[#4C5568] shadow-md">
          Opening the green…
        </section>
      </div>
    );
  }

  const showChooser = view.allAreasOpen && (!view.nextPlaceId || pickingAgain);
  const showPrompt = !hidden && Boolean(current) && !view.allAreasOpen;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-none absolute left-3 top-3 flex w-[min(22rem,calc(100%-1.5rem))] flex-col gap-2 sm:left-4 sm:top-4">
        <section
          data-testid="campus-area-journal"
          className="pointer-events-auto max-h-[min(78vh,640px)] overflow-y-auto rounded-3xl border border-[#E5DEC9] bg-[#F8F4EA]/95 p-4 text-[#1F2A3C] shadow-md dark:border-[#3D4978] dark:bg-[#222A4C]/95 dark:text-slate-100"
          aria-label="Campus journal"
        >
          {showPrompt && current ? (
            <div className="space-y-3">
              <div>
                <p data-testid="campus-current-area" className="font-display text-lg font-semibold leading-snug">
                  {current.name}
                </p>
                <p data-testid="campus-welcome" className="mt-1 text-xs leading-snug text-[#2E7D5B] dark:text-[#7CD4C0]">
                  {view.welcome}
                </p>
                <p data-testid="campus-prompt" className="mt-2 text-sm leading-snug">
                  “{promptText || current.prompt}”
                </p>
                <p className="mt-1 text-[11px] leading-snug text-[#4C5568] dark:text-[#CBD5EB]">
                  Look, draw, or write a few words. A minute is plenty.
                </p>
              </div>
              <canvas
                ref={canvasRef}
                data-testid="campus-draw-canvas"
                className="h-28 w-full touch-none rounded-2xl border border-[#E5DEC9] bg-white dark:border-[#3D4978] dark:bg-[#19203E]"
                aria-label="Draw a few lines"
                onPointerDown={(event) => {
                  drawing.current = true;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setPoints((prev) => [...prev, pointerPoint(event)]);
                }}
                onPointerMove={(event) => {
                  if (!drawing.current) return;
                  setPoints((prev) => [...prev, pointerPoint(event)]);
                }}
                onPointerUp={() => {
                  drawing.current = false;
                }}
                onPointerCancel={() => {
                  drawing.current = false;
                }}
              />
              <label className="block text-[11px] font-semibold text-[#555E72] dark:text-[#BDC7E3]" htmlFor="campus-sentence-input">
                A few words, if you want
              </label>
              <input
                id="campus-sentence-input"
                data-testid="campus-sentence-input"
                value={sentence}
                maxLength={140}
                onChange={(event) => setSentence(event.target.value)}
                placeholder="Blue, gold, and quiet"
                className="min-h-[44px] w-full rounded-2xl border border-[#DDD4BC] bg-white px-3 text-sm dark:border-[#49578D] dark:bg-[#19203E]"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="campus-save-btn"
                  onClick={save}
                  disabled={saving || (sentence.trim().length === 0 && points.length < 2)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-[#F7C6CF] px-4 text-sm font-bold text-[#43202A] hover:bg-[#F2B1BE] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {saving ? 'Keeping…' : 'Keep this'}
                </button>
                <button
                  type="button"
                  data-testid="campus-decline-btn"
                  onClick={decline}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#DDD4BC] bg-white px-4 text-sm font-semibold text-[#1F2A3C] dark:border-[#49578D] dark:bg-[#19203E] dark:text-slate-100"
                >
                  Not now
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  onOpenStudio({
                    id: current.id,
                    title: current.name,
                    prompt: promptText || current.prompt,
                    type: 'area',
                  })
                }
                className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-semibold text-[#2B7CB3] dark:text-[#9BD8EC]"
              >
                <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                Draw on the big page
              </button>
            </div>
          ) : null}

          {hidden && !showChooser ? (
            <button
              type="button"
              data-testid="campus-journal-reopen"
              onClick={reopen}
              className="inline-flex min-h-[40px] items-center rounded-full bg-[#F7C6CF] px-4 text-xs font-bold text-[#43202A] hover:bg-[#F2B1BE]"
            >
              Journal
            </button>
          ) : null}

          {showChooser ? (
            <div data-testid="campus-chooser" className="space-y-3">
              <p data-testid="campus-welcome" className="text-xs leading-snug text-[#2E7D5B] dark:text-[#7CD4C0]">
                {view.welcome}
              </p>
              <h2 className="font-display text-lg font-semibold leading-snug">
                You opened the whole campus. Where should we wander next?
              </h2>
              {current ? (
                <p className="text-xs leading-snug text-[#4C5568] dark:text-[#CBD5EB]">
                  If you want to notice {current.name}: “{promptText || current.prompt}”
                </p>
              ) : null}
              <div className="space-y-2">
                {view.nextPlaces.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    data-testid={`campus-choice-${place.id}`}
                    disabled={choosing}
                    onClick={() => choose(place.id)}
                    className="block w-full rounded-2xl border border-[#E5DEC9] bg-white px-3 py-2 text-left hover:border-[#F2B1BE] disabled:opacity-50 dark:border-[#3D4978] dark:bg-[#19203E]"
                  >
                    <span className="block text-sm font-semibold">{place.label}</span>
                    <span className="block text-[11px] text-[#555E72] dark:text-[#BDC7E3]">{place.note}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {view.nextPlaceId && view.nextPlaceWelcome && !pickingAgain ? (
            <div className="space-y-2">
              <p data-testid="campus-choice-welcome" className="text-sm leading-snug">
                {view.nextPlaceWelcome}
              </p>
              <button
                type="button"
                onClick={() => setPickingAgain(true)}
                className="text-xs font-semibold text-[#2B7CB3] underline dark:text-[#9BD8EC]"
              >
                A different wander
              </button>
            </div>
          ) : null}

          {note ? (
            <p className="mt-2 text-xs leading-snug text-[#4C5568] dark:text-[#CBD5EB]" role="status">
              {note}
            </p>
          ) : null}

          <p data-testid="campus-open-areas" className="mt-3 text-[11px] leading-snug text-[#4C5568] dark:text-[#CBD5EB]">
            {view.parentLine}
            {view.aheadAreaNames.length > 0 ? ` Still ahead: ${view.aheadAreaNames.join(', ')}.` : ''}
          </p>
        </section>
      </div>
    </div>
  );
};
