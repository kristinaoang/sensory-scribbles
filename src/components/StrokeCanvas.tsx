import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Palette, Sparkles } from 'lucide-react';
import type { StrokeData, StrokePoint } from '../types';

export const SENSORY_PALETTE = [
  { name: 'Sage Leaf', hex: '#1F8A4C' },
  { name: 'River Sky', hex: '#2B7CB3' },
  { name: 'Amber Clay', hex: '#C86D3B' },
  { name: 'Denim Indigo', hex: '#3B5998' },
  { name: 'Warm Cedar', hex: '#8B5E3C' },
  { name: 'Plum Ink', hex: '#8A308C' },
];

const DARK_INK_MAP: Record<string, string> = {
  '#1F8A4C': '#4ADE80',
  '#2E7D5B': '#4ADE80',
  '#2B7CB3': '#38BDF8',
  '#C86D3B': '#FB923C',
  '#3B5998': '#93C5FD',
  '#8B5E3C': '#E2B488',
  '#8A308C': '#E879F9',
  '#7A4E7D': '#E879F9',
};

function resolveInkColor(hex: string, darkMode: boolean): string {
  if (!darkMode) return hex;
  const upper = hex.toUpperCase();
  if (DARK_INK_MAP[upper]) return DARK_INK_MAP[upper];
  if (DARK_INK_MAP[hex]) return DARK_INK_MAP[hex];

  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return '#F3F4F6';
  const r = parseInt(match[1].slice(0, 2), 16);
  const g = parseInt(match[1].slice(2, 4), 16);
  const b = parseInt(match[1].slice(4, 6), 16);
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (brightness >= 0.44) return hex;

  // Lift dark custom colors toward bright pastel tint so they remain legible and colorful on dark paper
  const lift = Math.min(0.72, Math.max(0.28, (0.52 - brightness) * 1.55));
  const lr = Math.round(r + (255 - r) * lift);
  const lg = Math.round(g + (255 - g) * lift);
  const lb = Math.round(b + (255 - b) * lift);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

interface PxPoint {
  x: number;
  y: number;
}

/**
 * Generates a dense, smooth Catmull-Rom polyline from raw pointer points.
 */
export function buildSmoothSpline(rawPts: PxPoint[], subdivisions = 8): PxPoint[] {
  // Deduplicate near-identical consecutive points so tangents stay stable
  const pts: PxPoint[] = [];
  for (const p of rawPts) {
    const prev = pts[pts.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) >= 1.5) {
      pts.push(p);
    }
  }
  if (pts.length < 2) return pts;

  if (pts.length === 2) {
    const out: PxPoint[] = [];
    const steps = 12;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      out.push({
        x: pts[0].x + (pts[1].x - pts[0].x) * t,
        y: pts[0].y + (pts[1].y - pts[0].y) * t,
      });
    }
    return out;
  }

  const out: PxPoint[] = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];

    const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(4, Math.min(16, Math.round(segDist / 6) || subdivisions));

    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      out.push({ x, y });
    }
  }
  out.push(pts[n - 1]);
  return out;
}

/**
 * Draws a continuous stroke on a 2D canvas using pure words flowing along the smoothed spline.
 * When no reflection text is entered yet, renders a subtle dotted guide line so the path stays visible.
 */
export function renderWordStrokeToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stroke: StrokeData,
  sentence: string,
  darkMode = false,
) {
  ctx.clearRect(0, 0, width, height);

  const pts = stroke.points;
  if (!pts || pts.length < 2) return;

  const rawPx = pts.map((p) => ({ x: p.x * width, y: p.y * height }));
  const pxPts = buildSmoothSpline(rawPx);
  if (pxPts.length < 2) return;

  const inkColor = resolveInkColor(stroke.color, darkMode);
  const cleanSentence = sentence.trim();

  // If no reflection text is present yet, show a clean dotted ink guide path
  if (!cleanSentence) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = inkColor;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = Math.max(2, width / 260);
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.moveTo(pxPts[0].x, pxPts[0].y);
    for (let i = 1; i < pxPts.length; i++) {
      ctx.lineTo(pxPts[i].x, pxPts[i].y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Compute cumulative arc length along the smoothed spline
  const lengths: number[] = [0];
  let totalLength = 0;
  for (let i = 1; i < pxPts.length; i++) {
    totalLength += Math.hypot(pxPts[i].x - pxPts[i - 1].x, pxPts[i].y - pxPts[i - 1].y);
    lengths.push(totalLength);
  }
  if (totalLength < 14) return;

  const pointAtDistance = (d: number): PxPoint => {
    const clamped = Math.max(0, Math.min(totalLength, d));
    let lo = 0;
    let hi = lengths.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid] <= clamped) lo = mid;
      else hi = mid;
    }
    const segLen = Math.max(0.0001, lengths[hi] - lengths[lo]);
    const t = (clamped - lengths[lo]) / segLen;
    return {
      x: pxPts[lo].x + (pxPts[hi].x - pxPts[lo].x) * t,
      y: pxPts[lo].y + (pxPts[hi].y - pxPts[lo].y) * t,
    };
  };

  const sampleAtDistance = (d: number, tangentHalfWin = 6) => {
    const center = pointAtDistance(d);
    const back = pointAtDistance(d - tangentHalfWin);
    const ahead = pointAtDistance(d + tangentHalfWin);
    const angle = Math.atan2(ahead.y - back.y, ahead.x - back.x);
    return { x: center.x, y: center.y, angle };
  };

  ctx.save();
  ctx.fillStyle = inkColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // Choose base font size balanced for canvas scale (larger shared canvas vs. compact tile preview)
  const baseFont = width >= 520 ? Math.min(20, Math.max(15, Math.round(width * 0.021))) : Math.min(15, Math.max(12, Math.round(width * 0.052)));
  const minFont = width >= 520 ? 10 : 9.5;
  const tracking = 0.6;
  const chars = Array.from(cleanSentence);

  const measureChars = (fontPx: number) => {
    ctx.font = `500 ${fontPx}px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif`;
    const widths = chars.map((ch) => (ch === ' ' ? fontPx * 0.34 : ctx.measureText(ch).width) + tracking);
    const sum = widths.reduce((acc, w) => acc + w, 0);
    return { widths, sum };
  };

  let fontSize = baseFont;
  let measured = measureChars(fontSize);
  const usableSpan = totalLength * 0.94;

  if (measured.sum > usableSpan && usableSpan > 40) {
    const scaled = Math.max(minFont, Math.floor((fontSize * usableSpan) / measured.sum * 10) / 10);
    if (scaled < fontSize) {
      fontSize = scaled;
      measured = measureChars(fontSize);
    }
  }

  const repeatGap = Math.max(10, fontSize * 0.95);
  const shouldRepeat = totalLength > measured.sum + repeatGap + fontSize * 0.8;

  if (shouldRepeat) {
    let cursor = Math.max(6, totalLength * 0.015);
    while (cursor < totalLength - 4) {
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const adv = measured.widths[i];
        const charMid = cursor + adv * 0.5;
        if (charMid > totalLength - 4) {
          cursor = totalLength;
          break;
        }

        if (ch !== ' ') {
          const { x, y, angle } = sampleAtDistance(charMid, Math.max(4, fontSize * 0.35));
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.fillText(ch, 0, 0);
          ctx.restore();
        }
        cursor += adv;
      }
      cursor += repeatGap;
    }
  } else {
    // Center the single typographic ribbon when it closely matches the stroke length
    let cursor = measured.sum < totalLength ? (totalLength - measured.sum) / 2 : Math.max(6, totalLength * 0.02);

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const adv = measured.widths[i];
      const charMid = cursor + adv * 0.5;
      if (charMid > totalLength - 3) break;

      if (ch !== ' ') {
        const { x, y, angle } = sampleAtDistance(charMid, Math.max(4, fontSize * 0.35));
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
      cursor += adv;
    }
  }

  ctx.restore();
}

interface StrokePreviewProps {
  stroke: StrokeData;
  sentence: string;
  className?: string;
  darkMode?: boolean;
}

export const StrokePreview: React.FC<StrokePreviewProps> = ({
  stroke,
  sentence,
  className = '',
  darkMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(160, Math.round(rect.width || 240));
    const h = Math.max(110, Math.round(rect.height || 140));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    renderWordStrokeToCanvas(ctx, w, h, stroke, sentence, darkMode);
  }, [stroke, sentence, darkMode]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={`Word stroke illustration for: ${sentence}`}
      className={`w-full h-full block ${className}`}
    />
  );
};

interface StrokeCanvasProps {
  value: StrokeData | null;
  sentence: string;
  onChange: (stroke: StrokeData | null) => void;
  darkMode?: boolean;
}

export const StrokeCanvas: React.FC<StrokeCanvasProps> = ({
  value,
  sentence,
  onChange,
  darkMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>(value?.color || SENSORY_PALETTE[0].hex);
  const [isDrawing, setIsDrawing] = useState(false);
  const pointsRef = useRef<StrokePoint[]>(value?.points || []);

  const draw = useCallback(
    (pts: StrokePoint[], color: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(240, Math.round(rect.width));
      const h = Math.max(180, Math.round(rect.height));
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderWordStrokeToCanvas(ctx, w, h, { points: pts, color, width: 4 }, sentence, darkMode);
    },
    [sentence, darkMode],
  );

  useEffect(() => {
    draw(value?.points || pointsRef.current, selectedColor);
  }, [value, selectedColor, draw]);

  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0.03, Math.min(0.97, (e.clientX - rect.left) / Math.max(1, rect.width)));
    const y = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / Math.max(1, rect.height)));
    return { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getNormalizedPoint(e);
    pointsRef.current = [pt];
    setIsDrawing(true);
    draw(pointsRef.current, selectedColor);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pt = getNormalizedPoint(e);
    const prev = pointsRef.current[pointsRef.current.length - 1];
    if (prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) < 0.012) return;
    if (pointsRef.current.length >= 360) return;
    pointsRef.current = [...pointsRef.current, pt];
    draw(pointsRef.current, selectedColor);
  };

  const finishStroke = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (pointsRef.current.length >= 2) {
      const paletteEntry = SENSORY_PALETTE.find((p) => p.hex === selectedColor);
      onChange({
        points: pointsRef.current,
        color: selectedColor,
        width: 4,
        paletteName: paletteEntry?.name,
      });
    } else {
      pointsRef.current = [];
      onChange(null);
    }
  };

  const handleColorPick = (hex: string) => {
    setSelectedColor(hex);
    if (pointsRef.current.length >= 2) {
      const paletteEntry = SENSORY_PALETTE.find((p) => p.hex === hex);
      onChange({
        points: pointsRef.current,
        color: hex,
        width: 4,
        paletteName: paletteEntry?.name,
      });
    }
  };

  const handleClear = () => {
    pointsRef.current = [];
    onChange(null);
    draw([], selectedColor);
  };

  const handleKeyboardWave = () => {
    const pts: StrokePoint[] = [];
    for (let i = 0; i < 28; i++) {
      const t = i / 27;
      pts.push({
        x: Number((0.1 + t * 0.8).toFixed(4)),
        y: Number((0.52 - Math.sin(t * Math.PI * 1.5) * 0.22).toFixed(4)),
      });
    }
    pointsRef.current = pts;
    const paletteEntry = SENSORY_PALETTE.find((p) => p.hex === selectedColor);
    onChange({
      points: pts,
      color: selectedColor,
      width: 4,
      paletteName: paletteEntry?.name,
    });
    draw(pts, selectedColor);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Stroke ink palette">
          {SENSORY_PALETTE.map((swatch) => {
            const active = selectedColor.toLowerCase() === swatch.hex.toLowerCase();
            return (
              <button
                key={swatch.hex}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={swatch.name}
                title={swatch.name}
                onClick={() => handleColorPick(swatch.hex)}
                className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B7CB3] ${
                  active
                    ? 'ring-2 ring-offset-2 ring-[#1F2937] dark:ring-[#F3F4F6] scale-105 bg-white dark:bg-slate-800'
                    : 'bg-white/60 dark:bg-slate-800/60 hover:scale-105'
                }`}
              >
                <span
                  className="w-6 h-6 rounded-full border border-black/15"
                  style={{ backgroundColor: swatch.hex }}
                />
              </button>
            );
          })}

          <label
            title="Choose custom ink color"
            className={`relative min-h-[44px] px-2.5 rounded-xl border inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-transform ${
              !SENSORY_PALETTE.some((s) => s.hex.toLowerCase() === selectedColor.toLowerCase())
                ? 'ring-2 ring-offset-2 ring-[#1F2937] dark:ring-[#F3F4F6] border-[#1F2937] dark:border-[#F3F4F6] bg-white dark:bg-slate-800 text-[#1F2A3C] dark:text-white'
                : 'border-stone-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-stone-700 dark:text-slate-200 hover:scale-105'
            }`}
          >
            <span
              className="w-5 h-5 rounded-full border border-black/20 shrink-0"
              style={{ backgroundColor: selectedColor }}
            />
            <Palette className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Custom</span>
            <input
              type="color"
              aria-label="Custom stroke ink color"
              value={/^#[0-9a-fA-F]{6}$/.test(selectedColor) ? selectedColor : '#1F8A4C'}
              onChange={(e) => handleColorPick(e.target.value.toUpperCase())}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleKeyboardWave}
            className="min-h-[44px] px-3 py-2 text-xs font-medium rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>Auto-curve</span>
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="min-h-[44px] px-3 py-2 text-xs font-medium rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Eraser className="w-4 h-4" aria-hidden="true" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      <div className="relative rounded-2xl border border-stone-300/90 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-hidden shadow-xs">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          className="w-full h-52 sm:h-60 touch-none cursor-crosshair block"
          aria-label="Continuous single stroke drawing canvas"
        />
        {(!value || value.points.length < 2) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <p className="text-sm font-medium text-stone-500 dark:text-slate-400">
              Draw one continuous line with your finger or mouse
            </p>
            <p className="text-xs text-stone-400 dark:text-slate-500 mt-1">
              Your journal words will weave along the curve you draw.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
