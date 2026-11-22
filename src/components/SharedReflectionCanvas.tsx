import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Compass,
  Eraser,
  Eye,
  History,
  Loader2,
  Mic,
  Palette,
  PencilRuler,
  PenLine,
  Send,
  Sparkles,
  Square,
  Users,
} from 'lucide-react';
import type {
  AnonymousUser,
  CanvasPresenceUser,
  CanvasStroke,
  JournalEntry,
  Prompt,
  Room,
  RoomQuest,
  StrokeData,
  StrokePoint,
  WorldProgressionState,
} from '../types';
import { SENSORY_PALETTE, renderWordStrokeToCanvas } from './StrokeCanvas';

interface RemoteCursor {
  userId: string;
  displayName: string;
  avatarColor: string;
  x: number;
  y: number;
  updatedAt: number;
}

function drawTangibleGuideOutline(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  drawingPrompt: string,
  darkMode: boolean,
) {
  const lower = drawingPrompt.toLowerCase();
  ctx.save();
  ctx.strokeStyle = darkMode ? 'rgba(203, 213, 235, 0.20)' : 'rgba(61, 71, 94, 0.16)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const cx = w * 0.5;
  const cy = h * 0.54;
  const s = Math.min(w, h) * 0.34;

  if (lower.includes('windmill')) {
    // Tall windmill tower + conical roof + 4 angled sails on a gentle hill
    ctx.beginPath();
    // Gentle hill line
    ctx.moveTo(cx - s * 1.1, cy + s * 0.78);
    ctx.quadraticCurveTo(cx, cy + s * 0.56, cx + s * 1.1, cy + s * 0.78);
    // Tapered tower
    ctx.moveTo(cx - s * 0.34, cy + s * 0.66);
    ctx.lineTo(cx - s * 0.2, cy - s * 0.36);
    ctx.lineTo(cx + s * 0.2, cy - s * 0.36);
    ctx.lineTo(cx + s * 0.34, cy + s * 0.66);
    ctx.closePath();
    // Conical roof
    ctx.moveTo(cx - s * 0.25, cy - s * 0.36);
    ctx.lineTo(cx, cy - s * 0.68);
    ctx.lineTo(cx + s * 0.25, cy - s * 0.36);
    // Door
    ctx.rect(cx - s * 0.1, cy + s * 0.3, s * 0.2, s * 0.36);
    // Four diagonal windmill sail blades
    const hubX = cx;
    const hubY = cy - s * 0.2;
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const px = -dy;
      const py = dx;
      ctx.moveTo(hubX, hubY);
      ctx.lineTo(hubX + dx * s * 0.88, hubY + dy * s * 0.88);
      ctx.lineTo(hubX + dx * s * 0.88 + px * s * 0.16, hubY + dy * s * 0.88 + py * s * 0.16);
      ctx.lineTo(hubX + dx * s * 0.26 + px * s * 0.16, hubY + dy * s * 0.26 + py * s * 0.16);
      ctx.lineTo(hubX + dx * s * 0.26, hubY + dy * s * 0.26);
    }
    ctx.stroke();
  } else if (lower.includes('lake')) {
    // Shimmering lake oval + arched wooden bridge spanning bank-to-bank
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.26, s * 1.05, s * 0.48, 0, 0, Math.PI * 2);
    // Arched bridge deck + handrails crossing center of lake
    ctx.moveTo(cx - s * 0.92, cy + s * 0.1);
    ctx.quadraticCurveTo(cx, cy - s * 0.45, cx + s * 0.92, cy + s * 0.1);
    ctx.moveTo(cx - s * 0.92, cy - s * 0.08);
    ctx.quadraticCurveTo(cx, cy - s * 0.64, cx + s * 0.92, cy - s * 0.08);
    // Bridge posts
    [-0.86, -0.42, 0, 0.42, 0.86].forEach((ox) => {
      const t = (ox + 0.92) / 1.84;
      const arch = Math.sin(t * Math.PI) * s * 0.28;
      ctx.moveTo(cx + ox * s, cy + s * 0.08 - arch);
      ctx.lineTo(cx + ox * s, cy - s * 0.12 - arch);
    });
    // Water ripples
    ctx.moveTo(cx - s * 0.5, cy + s * 0.38);
    ctx.quadraticCurveTo(cx, cy + s * 0.46, cx + s * 0.5, cy + s * 0.38);
    ctx.stroke();
  } else if (lower.includes('house') || lower.includes('cabin') || lower.includes('cottage')) {
    // Cozy house with pitched roof, chimney, door, window, garden path
    ctx.beginPath();
    ctx.rect(cx - s * 0.72, cy - s * 0.12, s * 1.44, s * 0.92);
    ctx.moveTo(cx - s * 0.92, cy - s * 0.12);
    ctx.lineTo(cx, cy - s * 0.92);
    ctx.lineTo(cx + s * 0.92, cy - s * 0.12);
    // Chimney
    ctx.rect(cx + s * 0.38, cy - s * 0.85, s * 0.22, s * 0.44);
    // Door
    ctx.rect(cx - s * 0.16, cy + s * 0.26, s * 0.32, s * 0.54);
    // Window
    ctx.rect(cx - s * 0.54, cy + s * 0.14, s * 0.26, s * 0.26);
    // Garden path
    ctx.moveTo(cx, cy + s * 0.8);
    ctx.quadraticCurveTo(cx - s * 0.2, cy + s * 1.0, cx + s * 0.15, cy + s * 1.15);
    ctx.stroke();
  } else if (lower.includes('tree') || lower.includes('bridge')) {
    // Leafy tree + arched wooden bridge & creek
    ctx.beginPath();
    // Trunk
    ctx.moveTo(cx - s * 0.58, cy + s * 0.75);
    ctx.lineTo(cx - s * 0.52, cy - s * 0.05);
    ctx.moveTo(cx - s * 0.32, cy + s * 0.75);
    ctx.lineTo(cx - s * 0.38, cy - s * 0.05);
    // Canopy puffs
    ctx.moveTo(cx - s * 0.1, cy - s * 0.35);
    ctx.arc(cx - s * 0.45, cy - s * 0.35, s * 0.44, 0, Math.PI * 2);
    ctx.moveTo(cx - s * 0.42, cy - s * 0.65);
    ctx.arc(cx - s * 0.72, cy - s * 0.25, s * 0.32, 0, Math.PI * 2);
    ctx.moveTo(cx + s * 0.15, cy - s * 0.22);
    ctx.arc(cx - s * 0.16, cy - s * 0.22, s * 0.31, 0, Math.PI * 2);
    // Arched bridge & creek
    ctx.moveTo(cx + s * 0.05, cy + s * 0.55);
    ctx.quadraticCurveTo(cx + s * 0.52, cy + s * 0.2, cx + s * 0.98, cy + s * 0.55);
    ctx.moveTo(cx + s * 0.1, cy + s * 0.82);
    ctx.quadraticCurveTo(cx + s * 0.52, cy + s * 0.65, cx + s * 0.95, cy + s * 0.88);
    ctx.stroke();
  } else if (lower.includes('sailboat') || lower.includes('boat')) {
    // Sailboat + gentle waves
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.72, cy + s * 0.28);
    ctx.lineTo(cx + s * 0.72, cy + s * 0.28);
    ctx.lineTo(cx + s * 0.48, cy + s * 0.62);
    ctx.lineTo(cx - s * 0.48, cy + s * 0.62);
    ctx.closePath();
    // Mast & sails
    ctx.moveTo(cx, cy + s * 0.28);
    ctx.lineTo(cx, cy - s * 0.86);
    ctx.lineTo(cx + s * 0.56, cy + s * 0.16);
    ctx.lineTo(cx, cy + s * 0.16);
    ctx.moveTo(cx - s * 0.08, cy - s * 0.7);
    ctx.lineTo(cx - s * 0.52, cy + s * 0.16);
    ctx.lineTo(cx - s * 0.08, cy + s * 0.16);
    // Waves
    ctx.moveTo(cx - s * 1.1, cy + s * 0.8);
    ctx.quadraticCurveTo(cx - s * 0.55, cy + s * 0.68, cx, cy + s * 0.8);
    ctx.quadraticCurveTo(cx + s * 0.55, cy + s * 0.92, cx + s * 1.1, cy + s * 0.8);
    ctx.stroke();
  } else if (lower.includes('sunflower') || lower.includes('flower') || lower.includes('dais')) {
    // Cluster of blooming flowers
    const centers = [
      { fx: cx - s * 0.45, fy: cy - s * 0.15, r: s * 0.22 },
      { fx: cx + s * 0.35, fy: cy - s * 0.32, r: s * 0.26 },
    ];
    ctx.beginPath();
    for (const fl of centers) {
      ctx.moveTo(fl.fx + fl.r, fl.fy);
      ctx.arc(fl.fx, fl.fy, fl.r, 0, Math.PI * 2);
      for (let p = 0; p < 8; p++) {
        const a = (p / 8) * Math.PI * 2;
        const px = fl.fx + Math.cos(a) * fl.r * 1.65;
        const py = fl.fy + Math.sin(a) * fl.r * 1.65;
        ctx.moveTo(px + fl.r * 0.55, py);
        ctx.arc(px, py, fl.r * 0.55, 0, Math.PI * 2);
      }
      ctx.moveTo(fl.fx, fl.fy + fl.r);
      ctx.quadraticCurveTo(fl.fx - s * 0.08, cy + s * 0.55, fl.fx, cy + s * 0.92);
    }
    ctx.stroke();
  } else if (lower.includes('lighthouse')) {
    // Lighthouse & crescent moon
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.28, cy + s * 0.72);
    ctx.lineTo(cx - s * 0.18, cy - s * 0.46);
    ctx.lineTo(cx + s * 0.18, cy - s * 0.46);
    ctx.lineTo(cx + s * 0.28, cy + s * 0.72);
    ctx.closePath();
    ctx.rect(cx - s * 0.22, cy - s * 0.7, s * 0.44, s * 0.24);
    ctx.moveTo(cx - s * 0.26, cy - s * 0.7);
    ctx.lineTo(cx, cy - s * 0.95);
    ctx.lineTo(cx + s * 0.26, cy - s * 0.7);
    // Waves
    ctx.moveTo(cx - s * 1.0, cy + s * 0.78);
    ctx.quadraticCurveTo(cx, cy + s * 0.62, cx + s * 1.0, cy + s * 0.78);
    ctx.stroke();
  } else {
    // Steaming teacup & saucer
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.55, cy - s * 0.1);
    ctx.quadraticCurveTo(cx - s * 0.5, cy + s * 0.65, cx, cy + s * 0.65);
    ctx.quadraticCurveTo(cx + s * 0.5, cy + s * 0.65, cx + s * 0.55, cy - s * 0.1);
    ctx.closePath();
    ctx.moveTo(cx - s * 0.75, cy + s * 0.72);
    ctx.quadraticCurveTo(cx, cy + s * 0.9, cx + s * 0.75, cy + s * 0.72);
    ctx.moveTo(cx - s * 0.15, cy - s * 0.26);
    ctx.quadraticCurveTo(cx - s * 0.28, cy - s * 0.52, cx - s * 0.12, cy - s * 0.76);
    ctx.moveTo(cx + s * 0.15, cy - s * 0.26);
    ctx.quadraticCurveTo(cx + s * 0.28, cy - s * 0.52, cx + s * 0.12, cy - s * 0.76);
    ctx.stroke();
  }

  ctx.restore();
}

function distanceToSegment(p: StrokePoint, a: StrokePoint, b: StrokePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function findClosestStroke(pt: StrokePoint, strokes: CanvasStroke[]): CanvasStroke | null {
  let best: CanvasStroke | null = null;
  let bestDist = 0.055; // normalized ~5.5% canvas radius hit tolerance
  for (const s of strokes) {
    const pts = s.strokeJson.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distanceToSegment(pt, pts[i], pts[i + 1]);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
  }
  return best;
}

export interface WorldProgressEventPayload {
  progression: WorldProgressionState;
  justExpanded: RoomQuest | null;
  entry?: JournalEntry;
  stroke?: CanvasStroke;
  awardedPoints?: number;
  affectionPoints?: number;
}

interface SharedReflectionCanvasProps {
  room: Room;
  user: AnonymousUser;
  prompt: Prompt | null;
  todayDate: string;
  todayEntryCount: number;
  userSubmittedToday: boolean;
  progression?: WorldProgressionState | null;
  compact?: boolean;
  darkMode?: boolean;
  onOpenWorld: (entry: JournalEntry) => void;
  onOpenRoomWorld: () => void;
  onOpenInvite: () => void;
  onDailyEntrySubmitted: (todayIso: string) => Promise<void> | void;
  onWorldProgressed?: (payload: WorldProgressEventPayload) => void;
}

export const SharedReflectionCanvas: React.FC<SharedReflectionCanvasProps> = ({
  room,
  user,
  prompt,
  todayDate,
  todayEntryCount,
  userSubmittedToday,
  progression = null,
  compact = false,
  darkMode = false,
  onOpenWorld,
  onOpenRoomWorld,
  onOpenInvite,
  onDailyEntrySubmitted,
  onWorldProgressed,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastCursorSentRef = useRef<number>(0);
  const onWorldProgressedRef = useRef(onWorldProgressed);

  useEffect(() => {
    onWorldProgressedRef.current = onWorldProgressed;
  }, [onWorldProgressed]);

  const pointerDownClientRef = useRef<{ x: number; y: number } | null>(null);
  const [strokes, setStrokes] = useState<CanvasStroke[]>([]);
  const [fetchedProgression, setFetchedProgression] = useState<WorldProgressionState | null>(null);
  const [viewingChapter, setViewingChapter] = useState<number | null>(null);
  const [showEmptyArchiveHint, setShowEmptyArchiveHint] = useState(false);
  const [presence, setPresence] = useState<CanvasPresenceUser[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [loading, setLoading] = useState(true);

  const [showGuide, setShowGuide] = useState(true);
  const [toolMode, setToolMode] = useState<'draw' | 'inspect'>('draw');
  const [reflection, setReflection] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(user.avatarColor || SENSORY_PALETTE[0].hex);
  const [draftPoints, setDraftPoints] = useState<StrokePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedStroke, setSelectedStroke] = useState<CanvasStroke | null>(null);
  const [hoveredStrokeId, setHoveredStrokeId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Voice-to-text microphone recording & transcription state
  const [micState, setMicState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const reflectionInputRef = useRef<HTMLInputElement | null>(null);
  const reflectionRef = useRef(reflection);
  useEffect(() => {
    reflectionRef.current = reflection;
  }, [reflection]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelRafRef = useRef<number | null>(null);
  const abortTranscriptionRef = useRef(false);

  const cleanupMicResources = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (levelRafRef.current !== null) {
      window.cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setMicLevel(0);
  }, []);

  useEffect(() => {
    abortTranscriptionRef.current = false;
    return () => {
      abortTranscriptionRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore recorder stop errors during unmount
        }
      }
      mediaRecorderRef.current = null;
      cleanupMicResources();
    };
  }, [cleanupMicResources]);

  useEffect(() => {
    setViewingChapter(null);
    setShowEmptyArchiveHint(false);
    setSelectedStroke(null);
    setHoveredStrokeId(null);
  }, [room.code]);

  // Initial REST load + Live WebSocket connection with auto-reconnect
  useEffect(() => {
    let active = true;
    let reconnectTimer: number | null = null;

    const loadInitial = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/canvas-strokes?roomCode=${encodeURIComponent(room.code)}`);
        if (res.ok && active) {
          const data = await res.json();
          setStrokes(Array.isArray(data.strokes) ? data.strokes : []);
          if (data.progression) setFetchedProgression(data.progression);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    const connectWs = () => {
      if (!active) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const qs = new URLSearchParams({
        roomCode: room.code,
        userId: user.id,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
      });
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/canvas?${qs.toString()}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (!active) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'canvas:init' && Array.isArray(msg.strokes)) {
            setStrokes(msg.strokes);
            setLoading(false);
          } else if (msg.type === 'stroke:created' && msg.stroke) {
            setStrokes((prev) => {
              if (prev.some((s) => s.id === msg.stroke.id)) return prev;
              return [...prev, msg.stroke];
            });
          } else if (msg.type === 'world:progressed' && msg.progression) {
            if (msg.stroke) {
              setStrokes((prev) => {
                if (prev.some((s) => s.id === msg.stroke.id)) return prev;
                return [...prev, msg.stroke];
              });
            }
            onWorldProgressedRef.current?.({
              progression: msg.progression,
              justExpanded: msg.justExpanded ?? null,
              entry: msg.entry,
              stroke: msg.stroke,
            });
          } else if (msg.type === 'presence:update' && Array.isArray(msg.users)) {
            setPresence(msg.users);
          } else if (msg.type === 'cursor:moved' && msg.userId && msg.userId !== user.id) {
            setRemoteCursors((prev) => ({
              ...prev,
              [msg.userId]: {
                userId: msg.userId,
                displayName: msg.displayName,
                avatarColor: msg.avatarColor,
                x: msg.x,
                y: msg.y,
                updatedAt: Date.now(),
              },
            }));
          }
        } catch {
          // Ignore malformed WS frame
        }
      };

      ws.onclose = () => {
        if (!active) return;
        reconnectTimer = window.setTimeout(connectWs, 2500);
      };
    };

    loadInitial();
    connectWs();

    return () => {
      active = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [room.code, user.id, user.displayName, user.avatarColor]);

  // Prune stale remote cursors (>5s idle)
  useEffect(() => {
    const id = window.setInterval(() => {
      const cutoff = Date.now() - 5000;
      setRemoteCursors((prev) => {
        const next: Record<string, RemoteCursor> = {};
        let changed = false;
        for (const [k, v] of Object.entries(prev)) {
          if (v.updatedAt >= cutoff) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  const effectiveProgression = progression ?? fetchedProgression;
  const activeQuest = effectiveProgression?.activeQuest ?? null;
  const completedQuests = effectiveProgression?.completedQuests ?? [];
  const currentChapter = activeQuest?.chapterNumber ?? effectiveProgression?.level ?? 1;
  const displayedChapter =
    viewingChapter !== null && completedQuests.some((q) => q.chapterNumber === viewingChapter)
      ? viewingChapter
      : currentChapter;
  const isViewingPrevious = displayedChapter !== currentChapter;
  const displayedQuest = isViewingPrevious
    ? completedQuests.find((q) => q.chapterNumber === displayedChapter) ?? activeQuest
    : activeQuest;

  const displayedStrokes = strokes.filter((s) => (s.chapterNumber ?? 1) === displayedChapter);
  const drawingPromptText =
    displayedQuest?.drawingPrompt || 'A cozy house with a chimney, front door, and garden path';

  // Render subtle tangible guide outline + displayed chapter strokes + live draft stroke + remote cursors
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(300, Math.round(rect.width));
    const h = Math.max(300, Math.round(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (showGuide) {
      drawTangibleGuideOutline(ctx, w, h, drawingPromptText, darkMode);
    }

    // Offscreen scratch buffer so each stroke renders cleanly via renderWordStrokeToCanvas without clearing earlier strokes
    const offscreen = document.createElement('canvas');
    offscreen.width = w * dpr;
    offscreen.height = h * dpr;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    for (const item of displayedStrokes) {
      offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const isHighlighted = selectedStroke?.id === item.id || hoveredStrokeId === item.id;
      ctx.save();
      ctx.globalAlpha = selectedStroke && !isHighlighted ? 0.28 : 1;
      renderWordStrokeToCanvas(offCtx, w, h, item.strokeJson, item.reflection, darkMode);
      ctx.drawImage(offscreen, 0, 0, w, h);
      ctx.restore();
    }

    // Draw current user's active draft stroke on top when on the current level canvas
    if (!isViewingPrevious && draftPoints.length >= 2) {
      offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const draftStroke: StrokeData = { points: draftPoints, color: selectedColor, width: 5 };
      renderWordStrokeToCanvas(offCtx, w, h, draftStroke, reflection, darkMode);
      ctx.drawImage(offscreen, 0, 0, w, h);
    }

    // Draw remote collaborators' live cursors
    if (!isViewingPrevious) {
      Object.values(remoteCursors).forEach((cur) => {
        const cx = cur.x * w;
        const cy = cur.y * h;
        ctx.save();
        ctx.fillStyle = cur.avatarColor;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(cur.displayName, cx + 8, cy + 4);
        ctx.restore();
      });
    }
  }, [displayedStrokes, draftPoints, selectedColor, reflection, darkMode, selectedStroke, hoveredStrokeId, remoteCursors, showGuide, drawingPromptText, isViewingPrevious]);

  useEffect(() => {
    redrawCanvas();
    const onResize = () => redrawCanvas();
    window.addEventListener('resize', onResize);
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => redrawCanvas()).catch(() => {});
    }
    return () => window.removeEventListener('resize', onResize);
  }, [redrawCanvas]);

  const getNormPoint = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Number(Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / Math.max(1, rect.width))).toFixed(4)),
      y: Number(Math.max(0.03, Math.min(0.97, (e.clientY - rect.top) / Math.max(1, rect.height))).toFixed(4)),
    };
  };

  const emitCursor = (pt: StrokePoint) => {
    const now = Date.now();
    if (now - lastCursorSentRef.current < 60) return;
    lastCursorSentRef.current = now;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cursor:move', x: pt.x, y: pt.y }));
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getNormPoint(e);
    pointerDownClientRef.current = { x: e.clientX, y: e.clientY };
    if (isViewingPrevious || toolMode === 'inspect') {
      const hit = findClosestStroke(pt, displayedStrokes);
      setSelectedStroke(hit);
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedStroke(null);
    setDraftPoints([pt]);
    setIsDrawing(true);
    emitCursor(pt);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getNormPoint(e);
    if (!isViewingPrevious) emitCursor(pt);
    if (!isDrawing) {
      if (isViewingPrevious || toolMode === 'inspect') {
        const hit = findClosestStroke(pt, displayedStrokes);
        setHoveredStrokeId(hit ? hit.id : null);
      }
      return;
    }
    if (toolMode !== 'draw' || isViewingPrevious) return;
    setDraftPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 0.008) return prev;
      if (prev.length >= 360) return prev;
      return [...prev, pt];
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const downPos = pointerDownClientRef.current;
    pointerDownClientRef.current = null;
    // If user clicked/tapped without dragging, inspect whichever stroke is under the pointer
    if (downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) < 6) {
      const hit = findClosestStroke(getNormPoint(e), displayedStrokes);
      setDraftPoints([]);
      if (hit) {
        setSelectedStroke(hit);
      }
    }
  };

  const handleKeyboardWave = () => {
    if (isViewingPrevious) return;
    setToolMode('draw');
    const rowOffset = 0.22 + ((displayedStrokes.length % 4) * 0.17);
    const pts: StrokePoint[] = [];
    for (let i = 0; i < 28; i++) {
      const t = i / 27;
      pts.push({
        x: Number((0.12 + t * 0.76).toFixed(4)),
        y: Number((rowOffset - Math.sin(t * Math.PI * 1.4) * 0.1).toFixed(4)),
      });
    }
    setDraftPoints(pts);
  };

  const progressTarget = activeQuest ? Math.max(activeQuest.targetAnswers, activeQuest.targetStrokes) : 2;
  const progressCount = activeQuest
    ? Math.min(progressTarget, Math.min(activeQuest.currentAnswers, activeQuest.currentStrokes))
    : 0;

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        cleanupMicResources();
        setMicState('idle');
      }
    }
  }, [cleanupMicResources]);

  const transcribeAudioBlob = useCallback(async (blob: Blob, mimeType: string) => {
    if (abortTranscriptionRef.current) return;
    if (blob.size < 250) {
      setMicState('idle');
      setFeedback({ type: 'error', text: 'Recording was too short. Tap the mic and speak your answer clearly.' });
      return;
    }

    setMicState('transcribing');
    try {
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = typeof reader.result === 'string' ? reader.result : '';
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Could not read recorded audio.'));
        reader.readAsDataURL(blob);
      });

      if (abortTranscriptionRef.current) return;

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType,
        }),
      });
      const data = await res.json();
      if (abortTranscriptionRef.current) return;

      if (!res.ok) {
        setFeedback({
          type: 'error',
          text: data.error || 'Could not transcribe audio. Please try again or type your answer.',
        });
        return;
      }

      const transcript = String(data.transcript || '').trim();
      if (!transcript) {
        setFeedback({
          type: 'error',
          text: 'No speech was detected in that recording. Try speaking a bit closer to the microphone.',
        });
        return;
      }

      const trimmedPrev = reflectionRef.current.trimEnd();
      const combined = trimmedPrev ? `${trimmedPrev} ${transcript}` : transcript;
      const wasTruncated = combined.length > 500;
      const nextReflection = wasTruncated ? combined.slice(0, 500) : combined;
      setReflection(nextReflection);

      setFeedback({
        type: 'success',
        text: wasTruncated
          ? 'Spoken answer transcribed and fitted to the 500-character limit.'
          : 'Spoken answer transcribed into the text box—draw or edit before adding your stroke.',
      });
      reflectionInputRef.current?.focus();
    } catch {
      if (!abortTranscriptionRef.current) {
        setFeedback({ type: 'error', text: 'Network error while transcribing voice recording.' });
      }
    } finally {
      if (!abortTranscriptionRef.current) {
        setMicState('idle');
      }
    }
  }, []);

  const handleToggleMic = async () => {
    if (micState === 'transcribing' || submitting) return;
    if (micState === 'recording') {
      stopRecording();
      return;
    }

    setFeedback(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setFeedback({
        type: 'error',
        text: 'Microphone recording is not supported in this browser. Please type your answer instead.',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (abortTranscriptionRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ];
      const supportedMime =
        typeof MediaRecorder.isTypeSupported === 'function'
          ? preferredTypes.find((t) => MediaRecorder.isTypeSupported(t))
          : undefined;

      const recorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);
      const effectiveMime = recorder.mimeType || supportedMime || 'audio/webm';
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        cleanupMicResources();
        if (!abortTranscriptionRef.current) {
          setMicState('idle');
          setFeedback({ type: 'error', text: 'Microphone recording failed. Please try again.' });
        }
      };

      recorder.onstop = () => {
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        cleanupMicResources();
        if (abortTranscriptionRef.current) return;
        const blob = new Blob(chunks, { type: effectiveMime });
        void transcribeAudioBlob(blob, effectiveMime);
      };

      // Live audio volume meter via Web Audio AnalyserNode
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateMeter = () => {
            if (!audioCtxRef.current || abortTranscriptionRef.current) return;
            analyser.getByteTimeDomainData(dataArray);
            let sumSq = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const norm = (dataArray[i] - 128) / 128;
              sumSq += norm * norm;
            }
            const rms = Math.sqrt(sumSq / dataArray.length);
            setMicLevel(Math.min(1, rms * 4.5));
            levelRafRef.current = window.requestAnimationFrame(updateMeter);
          };
          levelRafRef.current = window.requestAnimationFrame(updateMeter);
        } catch {
          // AudioContext meter is optional visual feedback
        }
      }

      setRecordingSeconds(0);
      setMicState('recording');
      recorder.start(250);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= 30) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err: any) {
      cleanupMicResources();
      setMicState('idle');
      const errName = String(err?.name || '');
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setFeedback({
          type: 'error',
          text: 'Microphone access was denied. Enable microphone permission in your browser settings to speak your answer.',
        });
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setFeedback({
          type: 'error',
          text: 'No microphone was found on this device. You can still type your answer below.',
        });
      } else {
        setFeedback({
          type: 'error',
          text: 'Could not start microphone recording. Check browser audio permissions and try again.',
        });
      }
    }
  };

  const handlePublishStroke = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const trimmed = reflection.trim();
    if (!trimmed) {
      setFeedback({ type: 'error', text: 'Write your answer to the question (up to 500 characters) so it becomes your stroke.' });
      return;
    }
    if (draftPoints.length < 2) {
      setFeedback({ type: 'error', text: 'Draw a stroke on the shared canvas—your answer will curve right along your line.' });
      return;
    }

    setSubmitting(true);
    try {
      const strokePayload = {
        points: draftPoints,
        color: selectedColor,
        width: 5,
        paletteName:
          SENSORY_PALETTE.find((p) => p.hex.toLowerCase() === selectedColor.toLowerCase())?.name ?? 'Custom Ink',
      };

      if (!userSubmittedToday) {
        // First daily answer: places Daily Mosaic Tile + 3D World Landmark + draws answer-stroke on the Shared Canvas
        const res = await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: room.id,
            userId: user.id,
            sentence: trimmed,
            strokeJson: strokePayload,
            publishToCanvas: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFeedback({
            type: 'error',
            text: data.flagged ? `Held by safety review: ${data.reason}` : data.error || 'Could not publish your reflection.',
          });
          return;
        }

        if (data.canvasStroke) {
          setStrokes((prev) => (prev.some((s) => s.id === data.canvasStroke.id) ? prev : [...prev, data.canvasStroke]));
        }
        if (data.progression) {
          onWorldProgressedRef.current?.({
            progression: data.progression,
            justExpanded: data.justExpanded ?? null,
            entry: data.entry,
            stroke: data.canvasStroke,
            awardedPoints: data.awardedPoints,
            affectionPoints: data.affectionPoints,
          });
        }
        setReflection('');
        setDraftPoints([]);
        await onDailyEntrySubmitted(todayDate);
        const ptsText = `+${data.awardedPoints ?? 25} Care Points for animal affection!`;
        setFeedback({
          type: 'success',
          text: data.justExpanded
            ? `World expanded to Stage ${data.progression.level}! Unlocked ${data.justExpanded.title}. ${ptsText}`
            : data.solana?.anchored
              ? `Your answer-stroke was added to the drawing, 3D world, and Solana Devnet! ${ptsText}`
              : `Your answer-stroke was added and sculpted a 3D landmark! ${ptsText}`,
        });
      } else {
        // Additional unified contribution: draws answer-stroke on the Shared Canvas + sculpts 3D landmark
        const res = await fetch('/api/world/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: room.id,
            userId: user.id,
            displayName: user.displayName,
            avatarColor: user.avatarColor,
            sentence: trimmed,
            strokeJson: strokePayload,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFeedback({
            type: 'error',
            text: data.flagged ? `Held by safety review: ${data.reason}` : data.error || 'Could not submit answer-stroke.',
          });
          return;
        }

        if (data.canvasStroke) {
          setStrokes((prev) => (prev.some((s) => s.id === data.canvasStroke.id) ? prev : [...prev, data.canvasStroke]));
        }
        if (data.progression) {
          onWorldProgressedRef.current?.({
            progression: data.progression,
            justExpanded: data.justExpanded ?? null,
            entry: data.entry,
            stroke: data.canvasStroke,
            awardedPoints: data.awardedPoints,
            affectionPoints: data.affectionPoints,
          });
        }
        setReflection('');
        setDraftPoints([]);
        const ptsText = `+${data.awardedPoints ?? 25} Care Points for animal affection!`;
        setFeedback({
          type: 'success',
          text: data.justExpanded
            ? `World expanded to Stage ${data.progression.level}! Unlocked ${data.justExpanded.title}. ${ptsText}`
            : `Added your answer-stroke to the drawing and rose a new 3D landmark! ${ptsText}`,
        });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error while publishing your answer-stroke.' });
    } finally {
      setSubmitting(false);
    }
  };

  const openStrokeAsWorld = (cs: CanvasStroke) => {
    const entryLike: JournalEntry = {
      id: cs.id,
      roomId: cs.roomId,
      userId: cs.userId,
      promptId: 'shared-canvas',
      sentence: cs.reflection,
      strokeJson: cs.strokeJson,
      worldSpec: cs.worldSpec,
      createdAt: cs.createdAt,
      entryDate: cs.createdAt.slice(0, 10),
      flagged: false,
      isDemo: cs.isDemo,
      authorDisplayName: cs.authorDisplayName,
      authorAvatarColor: cs.authorAvatarColor,
    };
    onOpenWorld(entryLike);
  };

  const activeQuestionText = isViewingPrevious
    ? displayedQuest?.questionPrompt || 'Previous level sensory question'
    : activeQuest?.questionPrompt ||
      prompt?.text ||
      'If your day were a room, what would be inside it?';

  return (
    <section
      className={
        compact
          ? 'space-y-4'
          : 'rounded-3xl bg-[#F8F4EA] dark:bg-[#2A335A] border border-[#E5DEC9] dark:border-[#3D4978] p-5 sm:p-6 shadow-md space-y-5'
      }
      aria-labelledby="daily-prompt-heading"
    >
      {/* Level / Previous Drawings Archive Switcher */}
      <div
        className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] px-3.5 py-2.5 space-y-2"
        data-testid="canvas-level-switcher"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4C5568] dark:text-[#CBD5EB]">
            <History className="w-3.5 h-3.5 text-[#2E7D5B] dark:text-[#7CD4C0]" aria-hidden="true" />
            <span>Level Drawings</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {completedQuests.map((q) => {
              const selected = isViewingPrevious && displayedChapter === q.chapterNumber;
              const strokeCount = strokes.filter((s) => (s.chapterNumber ?? 1) === q.chapterNumber).length;
              return (
                <button
                  key={q.id}
                  type="button"
                  data-testid={`canvas-stage-tab-${q.chapterNumber}`}
                  onClick={() => {
                    setViewingChapter(q.chapterNumber);
                    setShowEmptyArchiveHint(false);
                    setSelectedStroke(null);
                    setHoveredStrokeId(null);
                  }}
                  className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
                    selected
                      ? 'bg-[#2B7CB3] border-[#2B7CB3] text-white'
                      : 'bg-[#F8F4EA] dark:bg-[#19203E] border-[#DDD4BC] dark:border-[#49578D] text-[#1F2A3C] dark:text-slate-100 hover:border-[#2B7CB3]'
                  }`}
                >
                  <span>Stage {q.chapterNumber}</span>
                  <span className="font-mono-tabular opacity-80">({strokeCount})</span>
                </button>
              );
            })}

            {completedQuests.length === 0 && (
              <button
                type="button"
                data-testid="canvas-previous-levels-btn"
                onClick={() => setShowEmptyArchiveHint((v) => !v)}
                className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
                  showEmptyArchiveHint
                    ? 'bg-[#2B7CB3] border-[#2B7CB3] text-white'
                    : 'bg-[#F8F4EA] dark:bg-[#19203E] border-[#DDD4BC] dark:border-[#49578D] text-[#4C5568] dark:text-[#CBD5EB] hover:border-[#2B7CB3]'
                }`}
              >
                <span>Previous Levels (0)</span>
              </button>
            )}

            <button
              type="button"
              data-testid={`canvas-stage-tab-${currentChapter}`}
              onClick={() => {
                setViewingChapter(null);
                setShowEmptyArchiveHint(false);
                setSelectedStroke(null);
                setHoveredStrokeId(null);
              }}
              className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
                !isViewingPrevious
                  ? 'bg-[#2E7D5B] border-[#2E7D5B] text-white'
                  : 'bg-[#F8F4EA] dark:bg-[#19203E] border-[#DDD4BC] dark:border-[#49578D] text-[#1F2A3C] dark:text-slate-100 hover:border-[#2E7D5B]'
              }`}
            >
              <span>Stage {currentChapter} (Current)</span>
            </button>
          </div>
        </div>

        {showEmptyArchiveHint && completedQuests.length === 0 && (
          <p className="text-xs text-[#4C5568] dark:text-[#CBD5EB] pt-1 border-t border-[#E5DEC9] dark:border-[#3D4978]">
            No completed levels yet in {room.name}. Once Stage 1 finishes, its completed drawing is archived here so you can revisit any past level&apos;s artwork anytime (you can also switch rooms to Botany Greenhouse to preview an archived Stage 1 drawing).
          </p>
        )}
      </div>

      {/* Unified Single-Canvas Question + Tangible Drawing Goal Card */}
      <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#555E72] dark:text-[#BDC7E3]">
          <span className="font-mono-tabular">
            {isViewingPrevious
              ? `Archived · Stage ${displayedChapter} (${displayedQuest?.title || 'Completed'})`
              : effectiveProgression
                ? `Stage ${effectiveProgression.level} · ${effectiveProgression.stageName}`
                : `Daily Room · ${todayDate}`}
          </span>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono-tabular text-[#1F2A3C] dark:text-slate-200">
              <Users className="w-4 h-4 text-[#2E7D5B] dark:text-[#7CD4C0]" aria-hidden="true" />
              <span>
                {Math.max(1, presence.length)} {Math.max(1, presence.length) === 1 ? 'person' : 'people'} here
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{todayEntryCount} today</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onOpenInvite}
              className="font-semibold text-[#2B7CB3] dark:text-[#9BD8EC] hover:underline whitespace-nowrap"
            >
              Invite ({room.inviteCode})
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div className="space-y-1.5 max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#555E72] dark:text-[#BDC7E3]">
              {isViewingPrevious
                ? `Stage ${displayedChapter} Question · Completed`
                : `Stage ${displayedChapter} · Question ${(activeQuest?.currentAnswers ?? 0) + 1}${activeQuest?.title ? ` · ${activeQuest.title}` : ''}`}
            </div>
            <h1
              id="daily-prompt-heading"
              className={`${compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'} font-semibold text-[#1F2A3C] dark:text-white leading-snug text-balance`}
            >
              {activeQuestionText}
            </h1>
          </div>

          {!compact && (
            <button
              type="button"
              onClick={onOpenRoomWorld}
              className="min-h-[44px] px-4 py-2 rounded-full border border-[#DDD4BC] dark:border-[#49578D] bg-[#F8F4EA] dark:bg-[#1A213F] hover:border-[#2E7D5B] dark:hover:border-[#7CD4C0] text-xs font-bold text-[#2E7D5B] dark:text-[#7CD4C0] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start lg:self-end"
            >
              <Compass className="w-4 h-4" aria-hidden="true" />
              <span>Return to 3D World</span>
            </button>
          )}
        </div>

        {/* Tangible Drawing Goal + Unified Expansion Bar */}
        <div className="rounded-xl border border-[#E5DEC9] dark:border-[#3D4978] bg-[#F8F4EA]/70 dark:bg-[#19203E]/80 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-[#1F2A3C] dark:text-white">
              {isViewingPrevious ? `Stage ${displayedChapter} Drawing:` : 'Draw Together:'}{' '}
              <span className="font-semibold text-[#2E7D5B] dark:text-[#7CD4C0]">{drawingPromptText}</span>
            </span>
            <span className="font-mono-tabular font-semibold text-[#4C5568] dark:text-[#CBD5EB]">
              {isViewingPrevious
                ? `Completed · ${displayedStrokes.length} strokes`
                : `${progressCount} / ${progressTarget} strokes to unlock ${activeQuest?.title || 'Next Biome'}`}
            </span>
          </div>
          {!isViewingPrevious && (
            <>
              <div className="h-2 rounded-full bg-[#E5DEC9] dark:bg-[#11162B] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#2E7D5B] dark:bg-[#F8E166] transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((progressCount / Math.max(1, progressTarget)) * 100))}%` }}
                />
              </div>
              <p className="text-xs text-[#4C5568] dark:text-[#CBD5EB]">
                Answer the question below and draw one stroke on this shared canvas—your response becomes the words along your stroke to build the drawing together.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Controls Bar: Mode Switch + Palette + Canvas Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isViewingPrevious ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setViewingChapter(null);
                setSelectedStroke(null);
              }}
              className="min-h-[40px] px-4 py-1.5 rounded-full bg-[#2E7D5B] hover:bg-[#25674A] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back to Current Stage (Stage {currentChapter})</span>
            </button>
            <span className="text-xs text-[#4C5568] dark:text-[#CBD5EB]">
              Tap any stroke on the archived drawing to read its reflection.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 p-1 rounded-full bg-[#ECE5D3] dark:bg-[#1E2547]">
            <button
              type="button"
              onClick={() => setToolMode('draw')}
              className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                toolMode === 'draw'
                  ? 'bg-white dark:bg-[#3A467A] text-[#1F2A3C] dark:text-white shadow-xs'
                  : 'text-[#555E72] dark:text-[#BDC7E3]'
              }`}
            >
              <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Draw Stroke</span>
            </button>
            <button
              type="button"
              onClick={() => setToolMode('inspect')}
              className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                toolMode === 'inspect'
                  ? 'bg-white dark:bg-[#3A467A] text-[#1F2A3C] dark:text-white shadow-xs'
                  : 'text-[#555E72] dark:text-[#BDC7E3]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Inspect Strokes</span>
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!isViewingPrevious && (
            <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Shared canvas ink color">
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
                    onClick={() => setSelectedColor(swatch.hex)}
                    className={`min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center transition-transform ${
                      active ? 'ring-2 ring-[#242E47] dark:ring-[#F8E166] bg-white dark:bg-[#21294A] scale-105' : ''
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full border border-black/15" style={{ backgroundColor: swatch.hex }} />
                  </button>
                );
              })}

              <label
                data-testid="custom-ink-color-btn"
                title={`Custom ink color (${selectedColor})`}
                className={`relative min-h-[40px] px-3 py-1 rounded-full border inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-transform ${
                  !SENSORY_PALETTE.some((s) => s.hex.toLowerCase() === selectedColor.toLowerCase())
                    ? 'ring-2 ring-[#242E47] dark:ring-[#F8E166] border-[#242E47] dark:border-[#F8E166] bg-white dark:bg-[#21294A] text-[#1F2A3C] dark:text-white'
                    : 'border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#21294A] text-[#1F2A3C] dark:text-slate-100 hover:border-[#2E7D5B]'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                  style={{ backgroundColor: selectedColor }}
                />
                <Palette className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Custom</span>
                <input
                  type="color"
                  data-testid="custom-ink-color-input"
                  aria-label="Choose custom ink color"
                  value={/^#[0-9a-fA-F]{6}$/.test(selectedColor) ? selectedColor : '#1F8A4C'}
                  onChange={(e) => setSelectedColor(e.target.value.toUpperCase())}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowGuide((g) => !g)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${
              showGuide
                ? 'border-[#2E7D5B] dark:border-[#7CD4C0] bg-[#EFFAF3] dark:bg-[#1B3A3A] text-[#1D5438] dark:text-[#B9F3DF]'
                : 'border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#21294A] text-[#1F2A3C] dark:text-slate-100'
            }`}
          >
            <PencilRuler className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{showGuide ? 'Guide: On' : 'Guide: Off'}</span>
          </button>

          {!isViewingPrevious && (
            <>
              <button
                type="button"
                onClick={handleKeyboardWave}
                className="min-h-[40px] px-3.5 py-1.5 rounded-full border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#21294A] text-xs font-semibold text-[#1F2A3C] dark:text-slate-100 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Auto-curve</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDraftPoints([]);
                  setSelectedStroke(null);
                }}
                className="min-h-[40px] px-3.5 py-1.5 rounded-full border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#21294A] text-xs font-semibold text-[#1F2A3C] dark:text-slate-100 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear Draft</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Communal Drawing Surface — crisp white typographic paper */}
      <div className="relative rounded-3xl border border-[#DDD4BC] dark:border-[#3D4978] bg-white dark:bg-[#161D3A] overflow-hidden shadow-xs">
        <canvas
          ref={canvasRef}
          data-testid="shared-reflection-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => setHoveredStrokeId(null)}
          className={`w-full touch-none block ${
            compact ? 'h-[300px] sm:h-[340px]' : 'h-[420px] sm:h-[500px]'
          } ${!isViewingPrevious && toolMode === 'draw' ? 'cursor-crosshair' : 'cursor-pointer'}`}
          aria-label="Shared collaborative reflection canvas"
        />

        {loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[#555E72] dark:text-[#BDC7E3]">
            Loading room strokes…
          </div>
        )}

        {!loading && !isViewingPrevious && draftPoints.length >= 2 && reflection.trim().length === 0 && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#242E47]/90 text-white px-4 py-1.5 text-xs shadow-sm whitespace-nowrap">
            Type your answer below to turn this dotted path into words
          </div>
        )}

        {!loading && displayedStrokes.length === 0 && (isViewingPrevious || draftPoints.length < 2) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="text-sm text-[#555E72] dark:text-[#BDC7E3]">
              {isViewingPrevious
                ? `No strokes were recorded in Stage ${displayedChapter}.`
                : `Stage ${displayedChapter}'s shared canvas is fresh. Answer the question below and draw the very first part of the drawing!`}
            </p>
          </div>
        )}
      </div>

      {/* Selected Stroke Inspector (when clicking a stroke in Inspect mode or from the list) */}
      {selectedStroke && (
        <div className="rounded-2xl border border-[#DDD4BC] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[#555E72] dark:text-[#BDC7E3]">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selectedStroke.authorAvatarColor }}
                aria-hidden="true"
              />
              <span className="font-semibold text-[#1F2A3C] dark:text-white">
                {selectedStroke.authorDisplayName}
              </span>
              <span aria-hidden="true">·</span>
              <span>{selectedStroke.worldSpec.label}</span>
              {selectedStroke.isDemo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular uppercase text-[11px] text-amber-700 dark:text-[#F8E166]">
                    demo
                  </span>
                </>
              )}
            </div>
            <p className="text-sm font-medium text-[#1F2A3C] dark:text-white">
              “{selectedStroke.reflection}”
            </p>
          </div>

          <button
            type="button"
            onClick={() => openStrokeAsWorld(selectedStroke)}
            className="min-h-[44px] px-4 py-2 rounded-full bg-[#2E7D5B] hover:bg-[#246649] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Compass className="w-4 h-4" aria-hidden="true" />
            <span>Walk Clearing</span>
          </button>
        </div>
      )}

      {/* Unified Question Answer + Drawing Stroke Composer Form (or Archive Return Banner) */}
      {isViewingPrevious ? (
        <div className="rounded-2xl border border-[#DDD4BC] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-[#1F2A3C] dark:text-white">
              Viewing Stage {displayedChapter} Drawing ({displayedQuest?.title || 'Completed'})
            </div>
            <p className="text-xs text-[#4C5568] dark:text-[#CBD5EB]">
              Archived drawings are read-only. Switch back to Stage {currentChapter} to add your next answer-stroke.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setViewingChapter(null);
              setSelectedStroke(null);
            }}
            className="min-h-[42px] px-4 py-2 rounded-full bg-[#F7C6CF] hover:bg-[#F2B1BE] dark:bg-[#F8E166] dark:hover:bg-[#F2D544] text-[#43202A] dark:text-[#242E47] text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Draw on Stage {currentChapter}</span>
          </button>
        </div>
      ) : (
        <form
          onSubmit={handlePublishStroke}
          className="rounded-2xl border border-[#DDD4BC] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-4 sm:p-5 space-y-3.5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label htmlFor="shared-reflection-input" className="text-xs font-bold text-[#3D475E] dark:text-[#CBD5EB]">
              Your Answer (curves along your brushstroke on the shared canvas &amp; grows the 3D world)
            </label>
            <span className="text-xs font-mono-tabular text-[#555E72] dark:text-[#BDC7E3]">
              {reflection.length}/500 · {draftPoints.length >= 2 ? 'Stroke ready' : 'Draw on canvas above'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 flex items-center gap-2">
              <input
                ref={reflectionInputRef}
                id="shared-reflection-input"
                data-testid="daily-sentence-input"
                type="text"
                maxLength={500}
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="Write or speak your answer (e.g. A yellow armchair and sun on the rug)..."
                className="flex-1 min-w-0 min-h-[48px] px-4 py-2.5 rounded-2xl border border-[#DDD4BC] dark:border-[#49578D] bg-[#F8F4EA] dark:bg-[#19203E] text-sm text-[#1F2A3C] dark:text-white"
              />

              <button
                type="button"
                data-testid="mic-record-btn"
                onClick={handleToggleMic}
                disabled={submitting || micState === 'transcribing'}
                aria-pressed={micState === 'recording'}
                aria-label={
                  micState === 'recording'
                    ? 'Stop voice recording'
                    : micState === 'transcribing'
                      ? 'Transcribing voice answer'
                      : 'Speak your answer with microphone'
                }
                title={micState === 'recording' ? 'Stop recording' : 'Speak answer'}
                className={`min-h-[48px] min-w-[48px] px-3.5 rounded-2xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  micState === 'recording'
                    ? 'bg-rose-600 hover:bg-rose-700 border-rose-600 text-white shadow-xs'
                    : micState === 'transcribing'
                      ? 'bg-[#ECE5D3] dark:bg-[#2A335A] border-[#DDD4BC] dark:border-[#49578D] text-[#4C5568] dark:text-[#CBD5EB] opacity-80'
                      : 'bg-[#F8F4EA] hover:bg-[#EFE8D5] dark:bg-[#19203E] dark:hover:bg-[#242E57] border-[#DDD4BC] dark:border-[#49578D] text-[#1F2A3C] dark:text-white'
                }`}
              >
                {micState === 'recording' ? (
                  <>
                    <Square className="w-4 h-4 fill-current" aria-hidden="true" />
                    <span>Stop</span>
                  </>
                ) : micState === 'transcribing' ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-[#2E7D5B] dark:text-[#7CD4C0]" aria-hidden="true" />
                    <span className="hidden sm:inline">Speak</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting || micState !== 'idle'}
              data-testid="submit-entry-btn"
              className="min-h-[48px] px-6 py-2.5 rounded-full bg-[#F7C6CF] hover:bg-[#F2B1BE] dark:bg-[#F8E166] dark:hover:bg-[#F2D544] disabled:opacity-50 text-[#43202A] dark:text-[#242E47] text-sm font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-xs"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>
                {submitting ? 'Adding to Drawing…' : 'Answer & Add Stroke'}
              </span>
            </button>
          </div>

          {micState !== 'idle' && (
            <div
              role="status"
              data-testid="mic-status-bar"
              className={`rounded-xl px-3.5 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border ${
                micState === 'recording'
                  ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100'
                  : 'border-[#8FC1E6] dark:border-[#4969A8] bg-[#EBF6FC] dark:bg-[#19203E] text-[#1D3557] dark:text-[#E2EEFF]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {micState === 'recording' ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse shrink-0" aria-hidden="true" />
                    <span className="font-semibold">Listening… speak your answer</span>
                    <div className="flex items-end gap-0.5 h-3.5" aria-hidden="true">
                      {[0.25, 0.45, 0.7, 0.5, 0.3].map((weight, idx) => {
                        const hPct = Math.max(25, Math.min(100, Math.round((0.2 + micLevel * weight * 1.4) * 100)));
                        return (
                          <span
                            key={idx}
                            className="w-1 rounded-full bg-rose-600 dark:bg-rose-400 transition-all duration-75"
                            style={{ height: `${hPct}%` }}
                          />
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
                    <span className="font-semibold">Transcribing your spoken answer into the text box…</span>
                  </>
                )}
              </div>

              {micState === 'recording' && (
                <span className="font-mono-tabular text-[11px] font-semibold">
                  0:{String(recordingSeconds).padStart(2, '0')} / 0:30
                </span>
              )}
            </div>
          )}

          {feedback && (
            <div
              role={feedback.type === 'error' ? 'alert' : 'status'}
              className={`rounded-xl px-4 py-2.5 text-xs sm:text-sm border ${
                feedback.type === 'error'
                  ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-100'
                  : 'border-[#8AD2A7] dark:border-[#3D8B78] bg-[#EFFAF3] dark:bg-[#1B3A3A] text-[#1D5438] dark:text-[#B9F3DF]'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </form>
      )}

      {/* Accessible List of Reflections on This Stage Canvas */}
      {!compact && displayedStrokes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-[#3D475E] dark:text-[#CBD5EB]">
            Reflections Drawn in Stage {displayedChapter} ({displayedStrokes.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedStrokes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedStroke(s);
                  setToolMode('inspect');
                }}
                className={`p-3.5 rounded-2xl border text-left transition-colors ${
                  selectedStroke?.id === s.id
                    ? 'border-[#2E7D5B] dark:border-[#7CD4C0] bg-[#EFFAF3] dark:bg-[#1F3A4D]'
                    : 'border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] hover:border-[#B8AE94]'
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-[#555E72] dark:text-[#BDC7E3] mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.strokeJson.color }}
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-[#1F2A3C] dark:text-slate-100 truncate">
                    {s.authorDisplayName}
                  </span>
                  {s.isDemo && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular uppercase text-[10px] text-amber-700 dark:text-[#F8E166]">
                        demo
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-[#1F2A3C] dark:text-slate-100 line-clamp-2">
                  “{s.reflection}”
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
