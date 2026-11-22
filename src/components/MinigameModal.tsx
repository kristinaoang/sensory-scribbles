import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Gamepad2, RotateCcw, Volume2, VolumeX, X, XCircle } from 'lucide-react';
import type { JournalEntry, MinigameQuestion, Prompt } from '../types';
import { StrokePreview } from './StrokeCanvas';

type GameMode = 'menu' | 'guess_prompt' | 'whose_is_it';

function playGentleChime(correct: boolean, muted: boolean) {
  if (muted) return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const now = ctx.currentTime;
    if (correct) {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.14);
    } else {
      osc.frequency.setValueAtTime(293.66, now);
      osc.frequency.exponentialRampToValueAtTime(246.94, now + 0.16);
    }
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // Ignore audio context restrictions
  }
}

interface MinigameModalProps {
  focusEntry: JournalEntry;
  roomCode: string;
  userId: string;
  darkMode?: boolean;
  onClose: () => void;
  onResultRecorded: () => void;
  onOpenWorld?: (entry: JournalEntry) => void;
}

export const MinigameModal: React.FC<MinigameModalProps> = ({
  focusEntry,
  roomCode,
  userId,
  darkMode = false,
  onClose,
  onResultRecorded,
  onOpenWorld,
}) => {
  const [mode, setMode] = useState<GameMode>('menu');
  const [muted, setMuted] = useState(false);
  const [deckEntries, setDeckEntries] = useState<JournalEntry[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [storedQuestions, setStoredQuestions] = useState<MinigameQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Guess the prompt state
  const [selectedPromptOption, setSelectedPromptOption] = useState<string | null>(null);
  const [guessScore, setGuessScore] = useState<{ correct: boolean; answer: string } | null>(null);

  // Whose is it state (match 3 sentences to 3 strokes)
  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({}); // sentenceEntryId -> strokeEntryId
  const [whoseSubmitted, setWhoseSubmitted] = useState(false);
  const [roundSeed, setRoundSeed] = useState(0);

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/minigames/deck?roomCode=${encodeURIComponent(roomCode)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setDeckEntries(Array.isArray(data.entries) ? data.entries : []);
        setPrompts(Array.isArray(data.prompts) ? data.prompts : []);
        setStoredQuestions(Array.isArray(data.storedQuestions) ? data.storedQuestions : []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [roomCode]);

  const recordEvent = async (entryId: string, gameType: 'guess_prompt' | 'whose_is_it', correct: boolean) => {
    try {
      await fetch('/api/minigames/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, entryId, gameType, correct }),
      });
      onResultRecorded();
    } catch {
      // Non-fatal if offline
    }
  };

  // Build 4 options for Guess the Prompt
  const guessOptions = useMemo(() => {
    const storedForEntry = storedQuestions.find(
      (q) => q.entryId === focusEntry.id && q.gameType === 'guess_prompt' && q.options.length === 4,
    );
    if (storedForEntry) {
      return {
        correctAnswer: storedForEntry.correctAnswer,
        options: storedForEntry.options,
      };
    }

    const correctText =
      focusEntry.promptText ||
      prompts.find((p) => p.id === focusEntry.promptId)?.text ||
      'If today were a fabric resting against your wrist, would it be silk, denim, velvet, or something else—and why?';

    const distractors = prompts
      .map((p) => p.text)
      .filter((t) => t !== correctText)
      .slice(0, 3);

    const fallbackDistractors = [
      'What everyday object near you holds the exact temperature and sound of this afternoon?',
      'Describe the smell of rain hitting something unexpected in your neighborhood today.',
      'If your mood today were a stone in your pocket, how heavy, smooth, or warm would it feel?',
    ];

    while (distractors.length < 3) {
      const candidate = fallbackDistractors[distractors.length];
      if (candidate && candidate !== correctText && !distractors.includes(candidate)) {
        distractors.push(candidate);
      } else {
        distractors.push(`Sensory reflection prompt #${distractors.length + 1}`);
      }
    }

    const combined = [correctText, ...distractors];
    // Deterministic shuffle per entry + roundSeed
    return {
      correctAnswer: correctText,
      options: combined.sort((a, b) => ((a.length + roundSeed) % 7) - ((b.length + roundSeed) % 7)),
    };
  }, [focusEntry, prompts, storedQuestions, roundSeed]);

  // Build 3 distinct entries for Whose is it?
  const whoseTriplet = useMemo(() => {
    const pool = deckEntries.filter((e) => e.id !== focusEntry.id);
    const chosen = [focusEntry, ...pool.slice(0, 2)];
    if (chosen.length < 3) return null;
    const sentences = [...chosen].sort((a, b) => a.sentence.localeCompare(b.sentence));
    const strokes = [...chosen].sort((a, b) => ((a.id.charCodeAt(a.id.length - 1) + roundSeed) % 5) - ((b.id.charCodeAt(b.id.length - 1) + roundSeed) % 5));
    return { sentences, strokes };
  }, [deckEntries, focusEntry, roundSeed]);

  const handleGuessPick = async (option: string) => {
    if (guessScore) return;
    setSelectedPromptOption(option);
    const correct = option === guessOptions.correctAnswer;
    setGuessScore({ correct, answer: guessOptions.correctAnswer });
    playGentleChime(correct, muted);
    await recordEvent(focusEntry.id, 'guess_prompt', correct);
  };

  const handlePairStroke = (strokeEntryId: string) => {
    if (whoseSubmitted || !selectedSentenceId) return;
    setMatches((prev) => {
      const next = { ...prev };
      // Clear any previous sentence matched to this stroke
      for (const [k, v] of Object.entries(next)) {
        if (v === strokeEntryId) delete next[k];
      }
      next[selectedSentenceId] = strokeEntryId;
      return next;
    });
    setSelectedSentenceId(null);
  };

  const handleSubmitWhose = async () => {
    if (!whoseTriplet || whoseSubmitted) return;
    setWhoseSubmitted(true);
    let correctPairs = 0;
    for (const s of whoseTriplet.sentences) {
      const ok = matches[s.id] === s.id;
      if (ok) correctPairs++;
      await recordEvent(s.id, 'whose_is_it', ok);
    }
    playGentleChime(correctPairs === 3, muted);
  };

  const resetGames = () => {
    setSelectedPromptOption(null);
    setGuessScore(null);
    setSelectedSentenceId(null);
    setMatches({});
    setWhoseSubmitted(false);
    setRoundSeed((s) => s + 1);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Sensory Minigames"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-[#F8F4EA] dark:bg-[#2A335A] border border-[#E5DEC9] dark:border-[#3D4978] shadow-xl overflow-hidden">
        {/* Clean Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DEC9] dark:border-[#3D4978]">
          <div className="flex items-center gap-2.5">
            <Gamepad2 className="w-5 h-5 text-[#2B7CB3] dark:text-[#9BD8EC]" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-[#1F2A3C] dark:text-white leading-tight">
                Perception Minigames
              </h2>
              <p className="text-xs text-[#555E72] dark:text-[#BDC7E3]">
                Explore how others sensed the room prompt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute game chimes' : 'Mute game chimes'}
              className="min-w-[44px] min-h-[44px] rounded-full border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#21294A] flex items-center justify-center text-[#4C5568] dark:text-[#CBD5EB] hover:brightness-95"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              aria-label="Close minigame"
              className="min-w-[44px] min-h-[44px] rounded-full border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#21294A] flex items-center justify-center text-[#4C5568] dark:text-[#CBD5EB] hover:brightness-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <p className="text-sm text-[#555E72] dark:text-[#BDC7E3] py-8 text-center">
              Loading room reflections…
            </p>
          ) : mode === 'menu' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-4 flex flex-col sm:flex-row gap-4 items-center">
                <div className="w-full sm:w-44 h-28 rounded-2xl bg-white dark:bg-[#161D3A] border border-[#E5DEC9] dark:border-[#3D4978] overflow-hidden shrink-0">
                  <StrokePreview stroke={focusEntry.strokeJson} sentence={focusEntry.sentence} darkMode={darkMode} />
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-xs text-[#555E72] dark:text-[#BDC7E3]">
                    Selected tile · {focusEntry.authorDisplayName || 'quiet-sprout'} · {focusEntry.worldSpec.label}
                  </p>
                  <p className="text-sm font-medium text-[#1F2A3C] dark:text-white">
                    “{focusEntry.sentence}”
                  </p>
                  {focusEntry.worldSpec.poeticSummary && (
                    <p className="text-xs text-[#4C5568] dark:text-[#CBD5EB]">
                      {focusEntry.worldSpec.poeticSummary}
                    </p>
                  )}
                  {onOpenWorld && (
                    <button
                      type="button"
                      onClick={() => onOpenWorld(focusEntry)}
                      className="mt-1 inline-flex items-center text-xs font-bold text-[#2E7D5B] dark:text-[#7CD4C0] hover:underline"
                    >
                      Walk this entry&apos;s 3D clearing →
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetGames();
                    setMode('guess_prompt');
                  }}
                  className="min-h-[88px] p-4 rounded-2xl border border-[#88B1E2] dark:border-[#3A5296] bg-[#A5C4EB]/45 dark:bg-[#273B75] hover:brightness-95 text-left transition"
                >
                  <div className="text-sm font-bold text-[#182436] dark:text-white">
                    Guess the Prompt
                  </div>
                  <p className="text-xs text-[#314057] dark:text-[#D5E1FF] mt-1">
                    Read this stroke and pick which sensory prompt it answered from 4 options.
                  </p>
                </button>

                <button
                  type="button"
                  disabled={!whoseTriplet}
                  onClick={() => {
                    resetGames();
                    setMode('whose_is_it');
                  }}
                  className="min-h-[88px] p-4 rounded-2xl border border-[#65C4B0] dark:border-[#358879] bg-[#7CD4C0]/45 dark:bg-[#2B7D6E] hover:brightness-95 disabled:opacity-50 text-left transition"
                >
                  <div className="text-sm font-bold text-[#112A24] dark:text-white">
                    Whose Is It?
                  </div>
                  <p className="text-xs text-[#1D423A] dark:text-[#D5F7EE] mt-1">
                    {whoseTriplet
                      ? 'Match 3 sentences to the 3 word-strokes drawn by each person.'
                      : 'Needs at least 3 entries in this room to play.'}
                  </p>
                </button>
              </div>
            </div>
          ) : mode === 'guess_prompt' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMode('menu')}
                  className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-full border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#21294A] text-[#1F2A3C] dark:text-slate-100"
                >
                  Back to Games
                </button>
                <span className="text-xs text-[#555E72] dark:text-[#BDC7E3]">Guess the Prompt</span>
              </div>

              <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-4 space-y-3">
                <div className="h-32 rounded-2xl bg-white dark:bg-[#161D3A] border border-[#E5DEC9] dark:border-[#3D4978] overflow-hidden">
                  <StrokePreview stroke={focusEntry.strokeJson} sentence={focusEntry.sentence} darkMode={darkMode} />
                </div>
                <p className="text-sm font-medium text-[#1F2A3C] dark:text-white text-center">
                  “{focusEntry.sentence}”
                </p>
              </div>

              <div className="space-y-2" role="radiogroup" aria-label="Prompt choices">
                {guessOptions.options.map((opt) => {
                  const picked = selectedPromptOption === opt;
                  const isCorrectOpt = guessScore && opt === guessScore.answer;
                  const isWrongPick = guessScore && picked && !guessScore.correct;

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={Boolean(guessScore)}
                      onClick={() => handleGuessPick(opt)}
                      className={`w-full min-h-[48px] px-4 py-3 rounded-2xl border text-left text-sm transition-colors flex items-center justify-between gap-3 ${
                        isCorrectOpt
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
                          : isWrongPick
                            ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200'
                            : 'border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] text-[#1F2A3C] dark:text-slate-100 hover:border-[#2B7CB3]'
                      }`}
                    >
                      <span>{opt}</span>
                      {isCorrectOpt && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                      {isWrongPick && <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {guessScore && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm font-semibold text-[#1F2A3C] dark:text-slate-100">
                    {guessScore.correct
                      ? 'Matched! Saved to your stats.'
                      : 'Not quite — saved to your stats.'}
                  </p>
                  <button
                    type="button"
                    onClick={resetGames}
                    className="min-h-[44px] px-5 py-2 rounded-full bg-[#F7C6CF] dark:bg-[#F8E166] text-[#43202A] dark:text-[#242E47] text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Play Again</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMode('menu')}
                  className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-full border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#21294A] text-[#1F2A3C] dark:text-slate-100"
                >
                  Back to Games
                </button>
                <span className="text-xs text-[#555E72] dark:text-[#BDC7E3]">
                  Step 1: Select a sentence · Step 2: Tap its matching stroke
                </span>
              </div>

              {whoseTriplet && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-[#555E72] dark:text-[#BDC7E3]">Sentences</h3>
                    {whoseTriplet.sentences.map((entry, idx) => {
                      const isSelected = selectedSentenceId === entry.id;
                      const pairedStrokeId = matches[entry.id];
                      const strokeIdx = whoseTriplet.strokes.findIndex((s) => s.id === pairedStrokeId);
                      const isCorrect = whoseSubmitted && pairedStrokeId === entry.id;
                      const isWrong = whoseSubmitted && pairedStrokeId !== entry.id;

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          disabled={whoseSubmitted}
                          onClick={() => setSelectedSentenceId(entry.id)}
                          className={`w-full min-h-[64px] p-3 rounded-2xl border text-left text-xs leading-relaxed transition-colors ${
                            isCorrect
                              ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                              : isWrong
                                ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/40'
                                : isSelected
                                  ? 'border-[#2B7CB3] bg-sky-50 dark:bg-[#273B75]'
                                  : 'border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-mono-tabular font-semibold text-[#555E72] dark:text-[#BDC7E3]">
                              #{idx + 1}
                            </span>
                            {strokeIdx >= 0 && (
                              <span className="font-mono-tabular text-[11px] font-semibold text-[#2B7CB3] dark:text-[#9BD8EC]">
                                Paired with Stroke {String.fromCharCode(65 + strokeIdx)}
                              </span>
                            )}
                          </div>
                          <span className="text-[#1F2A3C] dark:text-slate-100">“{entry.sentence}”</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-[#555E72] dark:text-[#BDC7E3]">Drawn Strokes</h3>
                    {whoseTriplet.strokes.map((entry, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const pairedSentenceIdx = whoseTriplet.sentences.findIndex((s) => matches[s.id] === entry.id);

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          disabled={whoseSubmitted || !selectedSentenceId}
                          onClick={() => handlePairStroke(entry.id)}
                          className="w-full p-2.5 rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] hover:border-[#2E7D5B] disabled:opacity-80 text-left transition-colors"
                        >
                          <div className="flex items-center justify-between text-xs mb-1.5 px-1">
                            <span className="font-mono-tabular font-semibold text-[#1F2A3C] dark:text-slate-100">
                              Stroke {letter}
                            </span>
                            {pairedSentenceIdx >= 0 && (
                              <span className="font-mono-tabular text-[11px] text-[#2E7D5B] dark:text-[#7CD4C0] font-semibold">
                                Matched to #{pairedSentenceIdx + 1}
                              </span>
                            )}
                          </div>
                          <div className="h-20 rounded-xl bg-white dark:bg-[#161D3A] border border-[#EFE9D8] dark:border-[#333F6E] overflow-hidden">
                            {/* Hide sentence text inside stroke during matching so player matches shape & rhythm */}
                            <StrokePreview stroke={entry.strokeJson} sentence="" darkMode={darkMode} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                {!whoseSubmitted ? (
                  <button
                    type="button"
                    disabled={!whoseTriplet || Object.keys(matches).length < 3}
                    onClick={handleSubmitWhose}
                    className="min-h-[44px] px-5 py-2 rounded-full bg-[#2E7D5B] dark:bg-[#F8E166] text-white dark:text-[#242E47] text-sm font-bold disabled:opacity-45"
                  >
                    Check 3 Matches
                  </button>
                ) : (
                  <div className="w-full flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#1F2A3C] dark:text-white">
                      Score:{' '}
                      {whoseTriplet?.sentences.filter((s) => matches[s.id] === s.id).length ?? 0} / 3 matched
                    </p>
                    <button
                      type="button"
                      onClick={resetGames}
                      className="min-h-[44px] px-5 py-2 rounded-full bg-[#F7C6CF] dark:bg-[#F8E166] text-[#43202A] dark:text-[#242E47] text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Play Again</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
