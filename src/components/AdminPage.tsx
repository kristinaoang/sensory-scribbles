import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Check,
  Copy,
  Flag,
  Link2,
  Lock,
  Play,
  Plus,
  Search,
  ShieldAlert,
} from 'lucide-react';
import type { JournalEntry, Prompt, Room } from '../types';

interface AdminPageProps {
  onPromptUpdated: () => void;
}

type AdminSectionFilter = 'all' | 'parents' | 'solana' | 'mastra' | 'moderation';
type ParentChildId = 'maya' | 'leo' | 'room';
type TimeWindow = '7d' | '14d' | '30d';
type SolanaFilter = 'all' | 'prompt_answer' | 'animal_pet' | 'animal_tame' | 'world_stage';
type MastraWindow = '24h' | '7d' | '30d';

interface BehavioralPattern {
  id: string;
  title: string;
  signalType: 'Positive Trend' | 'Gentle Notice' | 'Comfort Routine' | 'Fluency Growth';
  frequency: string;
  observation: string;
  cueWords: string;
  suggestedPrompt: string;
}

interface ParentProfileMock {
  id: ParentChildId;
  label: string;
  meta: string;
  metricsByWindow: Record<
    TimeWindow,
    {
      reflections: number;
      reflectionsDelta: string;
      calmShare: string;
      calmLabel: string;
      careActions: number;
      pointsSpent: number;
      voiceShare: number;
      drawShare: number;
      sensoryBreakdown: Array<{ label: string; pct: number }>;
    }
  >;
  patterns: BehavioralPattern[];
}

const PARENT_PROFILES: ParentProfileMock[] = [
  {
    id: 'maya',
    label: 'Maya (Age 8)',
    meta: 'Room CEDAR-402 · Evening reflector',
    metricsByWindow: {
      '7d': {
        reflections: 7,
        reflectionsDelta: '+2 vs prior wk',
        calmShare: '76%',
        calmLabel: 'Grounded & Curious',
        careActions: 14,
        pointsSpent: 118,
        voiceShare: 43,
        drawShare: 57,
        sensoryBreakdown: [
          { label: 'Tactile Comfort', pct: 41 },
          { label: 'Nature & Animals', pct: 29 },
          { label: 'Auditory Calm', pct: 19 },
          { label: 'Social Belonging', pct: 11 },
        ],
      },
      '14d': {
        reflections: 15,
        reflectionsDelta: '+4 vs prior 14d',
        calmShare: '72%',
        calmLabel: 'Steady & Warm',
        careActions: 29,
        pointsSpent: 235,
        voiceShare: 38,
        drawShare: 62,
        sensoryBreakdown: [
          { label: 'Tactile Comfort', pct: 38 },
          { label: 'Nature & Animals', pct: 31 },
          { label: 'Auditory Calm', pct: 18 },
          { label: 'Social Belonging', pct: 13 },
        ],
      },
      '30d': {
        reflections: 28,
        reflectionsDelta: '+9 vs prior 30d',
        calmShare: '74%',
        calmLabel: 'Resilient & Expressive',
        careActions: 54,
        pointsSpent: 460,
        voiceShare: 35,
        drawShare: 65,
        sensoryBreakdown: [
          { label: 'Tactile Comfort', pct: 36 },
          { label: 'Nature & Animals', pct: 30 },
          { label: 'Auditory Calm', pct: 20 },
          { label: 'Social Belonging', pct: 14 },
        ],
      },
    },
    patterns: [
      {
        id: 'pat-1',
        title: 'Evening Wind-Down Shift',
        signalType: 'Positive Trend',
        frequency: '5 of last 7 evenings · after 6:30 PM',
        observation:
          'Sentences written in the evening favor softer tactile imagery and slower curved strokes in sage green and warm amber.',
        cueWords: 'warm blanket · campfire glow · quiet rain',
        suggestedPrompt: 'What sound or texture helped your shoulders relax before bedtime today?',
      },
      {
        id: 'pat-2',
        title: 'Mid-Week Auditory & Texture Sensitivity',
        signalType: 'Gentle Notice',
        frequency: 'Last 2 Wednesdays · 3:30–4:30 PM',
        observation:
          'After-school Wednesday check-ins mention loud classroom noise and scratchy clothing, paired with shorter bursts of drawing.',
        cueWords: 'loud bell · scratchy sweater · busy hall',
        suggestedPrompt: 'If you could build a quiet corner right after school, what soft thing would be inside it?',
      },
      {
        id: 'pat-3',
        title: 'Nurturing Animal Routine',
        signalType: 'Comfort Routine',
        frequency: '14 Care Actions · Acorn Red Squirrel & Sunbeam Canary',
        observation:
          'Consistently spends prompt Care Points on Brush Coat and Pat Head while Rainy Meadow Lo-Fi plays.',
        cueWords: 'fluffy tail · soft feathers · cozy perch',
        suggestedPrompt: 'Which animal friend in the meadow felt most like your mood today, and why?',
      },
      {
        id: 'pat-4',
        title: 'Spoken Reflection Fluency Growth',
        signalType: 'Fluency Growth',
        frequency: '6 words -> 19 words average via Mic',
        observation:
          'Voice-to-text answers grew more descriptive over the last two weeks, moving from single adjectives to full sensory stories.',
        cueWords: 'smelled like pine · felt cool on my hands',
        suggestedPrompt: 'Tell a quick three-word story about something kind you noticed with your eyes or ears today.',
      },
    ],
  },
  {
    id: 'leo',
    label: 'Leo (Age 10)',
    meta: 'Room CEDAR-402 · Morning explorer',
    metricsByWindow: {
      '7d': {
        reflections: 6,
        reflectionsDelta: '+1 vs prior wk',
        calmShare: '68%',
        calmLabel: 'Playful & Observational',
        careActions: 11,
        pointsSpent: 98,
        voiceShare: 24,
        drawShare: 76,
        sensoryBreakdown: [
          { label: 'Nature & Animals', pct: 39 },
          { label: 'Visual Details', pct: 27 },
          { label: 'Tactile Comfort', pct: 21 },
          { label: 'Auditory Calm', pct: 13 },
        ],
      },
      '14d': {
        reflections: 12,
        reflectionsDelta: '+3 vs prior 14d',
        calmShare: '70%',
        calmLabel: 'Curious & Focused',
        careActions: 23,
        pointsSpent: 194,
        voiceShare: 28,
        drawShare: 72,
        sensoryBreakdown: [
          { label: 'Nature & Animals', pct: 37 },
          { label: 'Visual Details', pct: 28 },
          { label: 'Tactile Comfort', pct: 20 },
          { label: 'Auditory Calm', pct: 15 },
        ],
      },
      '30d': {
        reflections: 24,
        reflectionsDelta: '+6 vs prior 30d',
        calmShare: '71%',
        calmLabel: 'Steady Explorer',
        careActions: 47,
        pointsSpent: 410,
        voiceShare: 26,
        drawShare: 74,
        sensoryBreakdown: [
          { label: 'Nature & Animals', pct: 35 },
          { label: 'Visual Details', pct: 29 },
          { label: 'Tactile Comfort', pct: 21 },
          { label: 'Auditory Calm', pct: 15 },
        ],
      },
    },
    patterns: [
      {
        id: 'leo-1',
        title: 'High Visual Detail in Animal Taming',
        signalType: 'Positive Trend',
        frequency: '4 animals tamed · accurate trait notes',
        observation:
          'Notices subtle markings (white-dipped paws, teal collar, banded tail) and draws wide looping paths around the lake.',
        cueWords: 'sky-blue crest · striped tail · shiny tag',
        suggestedPrompt: 'What tiny color or pattern did you spot today that someone else might walk right past?',
      },
      {
        id: 'leo-2',
        title: 'Quick Reset After Frustration',
        signalType: 'Comfort Routine',
        frequency: '3 afternoon sessions · 4–7 PM',
        observation:
          'Switches from fast high-pressure strokes to Boop Nose + Give Treat interactions with Meadow Shepherd Dog before writing calmer closing words.',
        cueWords: 'deep breath · cold water · wagging tail',
        suggestedPrompt: 'When something feels tricky at first, what helps your brain hit pause and reset?',
      },
      {
        id: 'leo-3',
        title: 'Prefers Drawing Over Typing on Busy Days',
        signalType: 'Gentle Notice',
        frequency: '76% canvas-first entries',
        observation:
          'On soccer practice days, completes the canvas line first and uses short 4–5 word captions; gentle voice prompts help capture extra context.',
        cueWords: 'fast wind · grass mud · bright sun',
        suggestedPrompt: 'Use one sentence to name the best five seconds of your day outside.',
      },
    ],
  },
  {
    id: 'room',
    label: 'All Room Members',
    meta: 'Room CEDAR-402 · Combined family overview',
    metricsByWindow: {
      '7d': {
        reflections: 13,
        reflectionsDelta: '+3 vs prior wk',
        calmShare: '72%',
        calmLabel: 'Cohesive & Supportive',
        careActions: 25,
        pointsSpent: 216,
        voiceShare: 34,
        drawShare: 66,
        sensoryBreakdown: [
          { label: 'Tactile Comfort', pct: 34 },
          { label: 'Nature & Animals', pct: 33 },
          { label: 'Auditory Calm', pct: 18 },
          { label: 'Social Belonging', pct: 15 },
        ],
      },
      '14d': {
        reflections: 27,
        reflectionsDelta: '+7 vs prior 14d',
        calmShare: '71%',
        calmLabel: 'Warm & Engaged',
        careActions: 52,
        pointsSpent: 429,
        voiceShare: 33,
        drawShare: 67,
        sensoryBreakdown: [
          { label: 'Tactile Comfort', pct: 33 },
          { label: 'Nature & Animals', pct: 34 },
          { label: 'Auditory Calm', pct: 17 },
          { label: 'Social Belonging', pct: 16 },
        ],
      },
      '30d': {
        reflections: 52,
        reflectionsDelta: '+15 vs prior 30d',
        calmShare: '73%',
        calmLabel: 'Consistent Daily Habit',
        careActions: 101,
        pointsSpent: 870,
        voiceShare: 31,
        drawShare: 69,
        sensoryBreakdown: [
          { label: 'Tactile Comfort', pct: 32 },
          { label: 'Nature & Animals', pct: 33 },
          { label: 'Auditory Calm', pct: 19 },
          { label: 'Social Belonging', pct: 16 },
        ],
      },
    },
    patterns: [
      {
        id: 'room-1',
        title: 'Shared Empathy Around Companion Care',
        signalType: 'Positive Trend',
        frequency: '25 shared pet actions this week',
        observation:
          'Siblings coordinate earning Care Points via prompt reflections to raise animal affection meters together.',
        cueWords: 'took turns · brushed coat · happy blush',
        suggestedPrompt: 'What is one small helpful thing you noticed someone in our home do today?',
      },
      {
        id: 'room-2',
        title: 'Mid-Week Energy Dip',
        signalType: 'Gentle Notice',
        frequency: 'Wednesdays · 34% shorter reflections',
        observation:
          'Both children write briefer responses mid-week with cooler slate/blue stroke palettes, recovering strongly by Friday.',
        cueWords: 'tired legs · rainy window · quiet couch',
        suggestedPrompt: 'If today were a cozy weather forecast, what kind of sky would match your energy?',
      },
    ],
  },
];

interface SolanaMockInteraction {
  id: string;
  signature: string;
  category: Exclude<SolanaFilter, 'all'>;
  actionLabel: string;
  actorAlias: string;
  memoHash: string;
  slot: number;
  feeSol: string;
  timestamp: string;
  status: 'Finalized' | 'Confirmed';
}

const INITIAL_SOLANA_INTERACTIONS: SolanaMockInteraction[] = [
  {
    id: 'sol-1',
    signature: '5xK9mR2vN8pQ4tL7wY3zB6cF1hJ9dS4gA8kM2uP7vP2qL',
    category: 'prompt_answer',
    actionLabel: 'Prompt Answer · +25 Care Points',
    actorAlias: 'quiet-sprout',
    memoHash: '8f3c2a19d40e71b6c5a90211ef430b8c9d7e61a24b3c8d9e0f1a2b3c4d591d0b',
    slot: 341892410,
    feeSol: '0.000005 SOL',
    timestamp: '2026-11-22 07:14:22',
    status: 'Finalized',
  },
  {
    id: 'sol-2',
    signature: '3mT7wP9qC4xL2nV6bR8yK1dF5hJ3sG7aE9uN4cZ8jW6pM',
    category: 'animal_pet',
    actionLabel: 'Pet: Boop Nose · Sunbeam Canary (-12 pts)',
    actorAlias: 'quiet-sprout',
    memoHash: '4d19e7c20b88f3a1927c445d881e0f3a992c7b114d5e6f7a8b9c0d1e2f37a84c',
    slot: 341892388,
    feeSol: '0.000005 SOL',
    timestamp: '2026-11-22 07:11:09',
    status: 'Finalized',
  },
  {
    id: 'sol-3',
    signature: '7pL4rK8vM2nB6xZ9cQ3tW5fH1jD7sG4aY8uC2eR9nX5bV',
    category: 'animal_tame',
    actionLabel: 'Tame Companion · Acorn Red Squirrel',
    actorAlias: 'meadow-otter',
    memoHash: 'c209f1e47a31b8d604e591c7f20a8b4d6e12c30495a6b7c8d9e0f1a2b3c14e90',
    slot: 341891940,
    feeSol: '0.000005 SOL',
    timestamp: '2026-11-22 06:58:44',
    status: 'Finalized',
  },
  {
    id: 'sol-4',
    signature: '2qN8vB5cX1mZ7kL3pW9rT4hF6jD2sG8aY5uC1eV7nM4xK',
    category: 'animal_pet',
    actionLabel: 'Pet: Brush Coat · Marmalade Tabby (-8 pts)',
    actorAlias: 'meadow-otter',
    memoHash: 'a71b4e90c3f28d5109b6e24a8c3f71d2905e4b6c7a8d9e0f1a2b3c4d5e69f213',
    slot: 341891512,
    feeSol: '0.000005 SOL',
    timestamp: '2026-11-22 06:42:17',
    status: 'Finalized',
  },
  {
    id: 'sol-5',
    signature: '9kW3tR7pL2mN8vB4cX6zQ1hF5jD9sG3aY7uC4eV2nM8xP',
    category: 'world_stage',
    actionLabel: 'Chapter Complete · Stage 2 Meadow Expansion',
    actorAlias: 'room-CEDAR-402',
    memoHash: 'e904d2c71b68a3f502c8e91d4b7a60f3182e5c7d9a0b1c2d3e4f5a6b7c88d3e4',
    slot: 341890875,
    feeSol: '0.000005 SOL',
    timestamp: '2026-11-22 06:19:03',
    status: 'Finalized',
  },
];

interface MastraLogEntry {
  id: string;
  workflowName: string;
  roomCode: string;
  stepsSummary: string;
  status: 'passed' | 'failed';
  tokensUsed: number;
  latencyMs: number;
  timestamp: string;
}

const MASTRA_STATS_BY_WINDOW: Record<
  MastraWindow,
  {
    totalRuns: number;
    passRate: string;
    avgLatency: string;
    totalTokens: string;
    estCost: string;
    workflows: Array<{
      name: string;
      purpose: string;
      runs: number;
      passRate: string;
      avgMs: number;
      tokens: number;
    }>;
  }
> = {
  '24h': {
    totalRuns: 24,
    passRate: '100.0%',
    avgLatency: '1,180 ms',
    totalTokens: '48,620',
    estCost: '$0.04',
    workflows: [
      {
        name: 'nightly-room-synthesis',
        purpose: '4-step grounded mosaic caption + 3 minigame questions with PII check',
        runs: 4,
        passRate: '100%',
        avgMs: 1640,
        tokens: 18400,
      },
      {
        name: 'parent-behavioral-pattern-agent',
        purpose: 'Clusters mood shifts, sensory cues, and animal-care comfort routines',
        runs: 6,
        passRate: '100%',
        avgMs: 1320,
        tokens: 15220,
      },
      {
        name: 'animal-trait-evaluator',
        purpose: 'Verifies child appearance descriptions against 3D companion traits',
        runs: 9,
        passRate: '100%',
        avgMs: 890,
        tokens: 9400,
      },
      {
        name: 'spoken-reflection-transcriber',
        purpose: 'Speech-to-text transcription and child-safe sentence validation',
        runs: 5,
        passRate: '100%',
        avgMs: 960,
        tokens: 5600,
      },
    ],
  },
  '7d': {
    totalRuns: 142,
    passRate: '98.6%',
    avgLatency: '1,240 ms',
    totalTokens: '294,850',
    estCost: '$0.27',
    workflows: [
      {
        name: 'nightly-room-synthesis',
        purpose: '4-step grounded mosaic caption + 3 minigame questions with PII check',
        runs: 28,
        passRate: '96.4%',
        avgMs: 1710,
        tokens: 112400,
      },
      {
        name: 'parent-behavioral-pattern-agent',
        purpose: 'Clusters mood shifts, sensory cues, and animal-care comfort routines',
        runs: 34,
        passRate: '100%',
        avgMs: 1390,
        tokens: 89200,
      },
      {
        name: 'animal-trait-evaluator',
        purpose: 'Verifies child appearance descriptions against 3D companion traits',
        runs: 46,
        passRate: '97.8%',
        avgMs: 920,
        tokens: 54150,
      },
      {
        name: 'spoken-reflection-transcriber',
        purpose: 'Speech-to-text transcription and child-safe sentence validation',
        runs: 34,
        passRate: '100%',
        avgMs: 1010,
        tokens: 39100,
      },
    ],
  },
  '30d': {
    totalRuns: 584,
    passRate: '98.3%',
    avgLatency: '1,290 ms',
    totalTokens: '1,182,400',
    estCost: '$1.09',
    workflows: [
      {
        name: 'nightly-room-synthesis',
        purpose: '4-step grounded mosaic caption + 3 minigame questions with PII check',
        runs: 116,
        passRate: '97.4%',
        avgMs: 1740,
        tokens: 462000,
      },
      {
        name: 'parent-behavioral-pattern-agent',
        purpose: 'Clusters mood shifts, sensory cues, and animal-care comfort routines',
        runs: 142,
        passRate: '99.3%',
        avgMs: 1410,
        tokens: 356400,
      },
      {
        name: 'animal-trait-evaluator',
        purpose: 'Verifies child appearance descriptions against 3D companion traits',
        runs: 194,
        passRate: '97.9%',
        avgMs: 950,
        tokens: 218000,
      },
      {
        name: 'spoken-reflection-transcriber',
        purpose: 'Speech-to-text transcription and child-safe sentence validation',
        runs: 132,
        passRate: '99.2%',
        avgMs: 1040,
        tokens: 146000,
      },
    ],
  },
};

const INITIAL_MASTRA_LOGS: MastraLogEntry[] = [
  {
    id: 'm-log-1',
    workflowName: 'parent-behavioral-pattern-agent',
    roomCode: 'CEDAR-402',
    stepsSummary: '3/3 steps passed · PII redaction verified',
    status: 'passed',
    tokensUsed: 2480,
    latencyMs: 1290,
    timestamp: '2026-11-22 07:15:04',
  },
  {
    id: 'm-log-2',
    workflowName: 'animal-trait-evaluator',
    roomCode: 'CEDAR-402',
    stepsSummary: '2/2 steps passed · matched butter-yellow canary',
    status: 'passed',
    tokensUsed: 1040,
    latencyMs: 840,
    timestamp: '2026-11-22 07:08:31',
  },
  {
    id: 'm-log-3',
    workflowName: 'nightly-room-synthesis',
    roomCode: 'CEDAR-402',
    stepsSummary: '4/4 steps passed · 2-sentence caption + 3 questions',
    status: 'passed',
    tokensUsed: 4190,
    latencyMs: 1620,
    timestamp: '2026-11-21 22:00:12',
  },
  {
    id: 'm-log-4',
    workflowName: 'spoken-reflection-transcriber',
    roomCode: 'CEDAR-402',
    stepsSummary: '2/2 steps passed · 19 words transcribed safely',
    status: 'passed',
    tokensUsed: 1120,
    latencyMs: 930,
    timestamp: '2026-11-21 19:41:55',
  },
];

function shortSig(sig: string): string {
  if (sig.length <= 14) return sig;
  return `${sig.slice(0, 6)}...${sig.slice(-6)}`;
}

function makeMockHash(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const part = (h >>> 0).toString(16).padStart(8, '0');
  return `${part}${part.split('').reverse().join('')}${part}9f3c2a1b4d8e7a06`.slice(0, 64);
}

export const AdminPage: React.FC<AdminPageProps> = ({ onPromptUpdated }) => {
  // Hold admin bearer token in React memory only (never localStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [envManaged, setEnvManaged] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [sectionFilter, setSectionFilter] = useState<AdminSectionFilter>('all');
  const [todayDate, setTodayDate] = useState('');
  const [tomorrowDate, setTomorrowDate] = useState('');
  const [todayEntries, setTodayEntries] = useState<JournalEntry[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tomorrowPromptText, setTomorrowPromptText] = useState('');
  const [sensoryFocus, setSensoryFocus] = useState('tactile');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [workflowReport, setWorkflowReport] = useState<any>(null);
  const [selectedWorkflowRoom, setSelectedWorkflowRoom] = useState('');

  // Parent Behavioral Insights mockup state
  const [selectedChild, setSelectedChild] = useState<ParentChildId>('maya');
  const [parentWindow, setParentWindow] = useState<TimeWindow>('14d');

  // Solana On-Chain Interaction Ledger mockup state
  const [solanaFilter, setSolanaFilter] = useState<SolanaFilter>('all');
  const [solanaSearch, setSolanaSearch] = useState('');
  const [simulatedTxs, setSimulatedTxs] = useState<SolanaMockInteraction[]>(INITIAL_SOLANA_INTERACTIONS);
  const [copiedSigId, setCopiedSigId] = useState<string | null>(null);

  // Mastra Usage mockup state
  const [mastraWindow, setMastraWindow] = useState<MastraWindow>('7d');
  const [mastraLogs, setMastraLogs] = useState<MastraLogEntry[]>(INITIAL_MASTRA_LOGS);

  useEffect(() => {
    fetch('/api/admin/status')
      .then((r) => r.json())
      .then((data) => {
        setConfigured(Boolean(data.configured));
        setEnvManaged(Boolean(data.envManaged));
      })
      .catch(() => setConfigured(true));
  }, []);

  const loadDashboard = useCallback(
    async (token: string) => {
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        setAdminToken(null);
        return;
      }
      const data = await res.json();
      setTodayDate(data.todayDate || '');
      setTomorrowDate(data.tomorrowDate || '');
      setTodayEntries(Array.isArray(data.todayEntries) ? data.todayEntries : []);
      setPrompts(Array.isArray(data.prompts) ? data.prompts : []);
      setRooms(Array.isArray(data.rooms) ? data.rooms : []);
      if (data.tomorrowPrompt?.text) {
        setTomorrowPromptText(data.tomorrowPrompt.text);
        setSensoryFocus(data.tomorrowPrompt.sensoryFocus || 'tactile');
      }
      if (Array.isArray(data.rooms) && data.rooms.length > 0 && !selectedWorkflowRoom) {
        setSelectedWorkflowRoom(data.rooms[0].id);
      }
    },
    [selectedWorkflowRoom],
  );

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const endpoint = configured ? '/api/admin/login' : '/api/admin/claim';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAuthError(data.error || 'Authentication failed.');
      return;
    }
    setAdminToken(data.token);
    setConfigured(true);
    setPasswordInput('');
    await loadDashboard(data.token);
  };

  const handleToggleFlag = async (entry: JournalEntry) => {
    if (!adminToken) return;
    setActionMessage(null);
    const res = await fetch('/api/admin/flag', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ entryId: entry.id, flagged: !entry.flagged }),
    });
    if (res.ok) {
      await loadDashboard(adminToken);
      onPromptUpdated();
      setActionMessage(!entry.flagged ? `Flagged entry ${entry.id}.` : `Approved entry ${entry.id}.`);
    }
  };

  const handleSaveTomorrowPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setActionMessage(null);
    const res = await fetch('/api/admin/prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        promptDate: tomorrowDate,
        text: tomorrowPromptText,
        sensoryFocus,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionMessage(data.error || 'Failed to save tomorrow prompt.');
      return;
    }
    await loadDashboard(adminToken);
    onPromptUpdated();
    setActionMessage(`Saved prompt for ${tomorrowDate}.`);
  };

  const handleRunNightlyWorkflow = async () => {
    if (!adminToken || !selectedWorkflowRoom) return;
    setActionMessage(null);
    setWorkflowReport(null);
    const startedAt = performance.now();
    const res = await fetch('/api/admin/workflow/nightly', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        roomId: selectedWorkflowRoom,
        date: todayDate,
      }),
    });
    const elapsedMs = Math.max(120, Math.round(performance.now() - startedAt));
    const data = await res.json();
    setWorkflowReport(data);

    const roomObj = rooms.find((r) => r.id === selectedWorkflowRoom);
    const passedCount = Array.isArray(data.steps)
      ? data.steps.filter((s: any) => s.status === 'passed').length
      : 0;
    const totalCount = Array.isArray(data.steps) ? data.steps.length : 1;
    setMastraLogs((prev) => [
      {
        id: `m-live-${Date.now()}`,
        workflowName: 'nightly-room-synthesis',
        roomCode: roomObj?.code || 'CEDAR-402',
        stepsSummary: data.ok
          ? `${passedCount}/${totalCount} steps passed · live trigger`
          : `${passedCount}/${totalCount} steps passed · halted safely`,
        status: data.ok ? 'passed' : 'failed',
        tokensUsed: data.ok ? 3840 : 420,
        latencyMs: elapsedMs,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      },
      ...prev,
    ]);
    onPromptUpdated();
  };

  const handleToggleSolana = async (room: Room) => {
    if (!adminToken) return;
    const res = await fetch('/api/admin/room-solana', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ roomId: room.id, solanaEnabled: !room.solanaEnabled }),
    });
    if (res.ok) {
      await loadDashboard(adminToken);
      setActionMessage(`Solana Devnet anchor ${!room.solanaEnabled ? 'enabled' : 'disabled'} for ${room.code}.`);
    }
  };

  const handleSimulateSolanaAnchor = () => {
    const sampleActions: Array<{ category: Exclude<SolanaFilter, 'all'>; actionLabel: string }> = [
      { category: 'animal_pet', actionLabel: 'Pet: Ear Scritch · Skycrest Bluejay (-10 pts)' },
      { category: 'prompt_answer', actionLabel: 'Prompt Answer · +25 Care Points' },
      { category: 'animal_tame', actionLabel: 'Tame Companion · Meadow Shepherd Dog' },
    ];
    const picked = sampleActions[simulatedTxs.length % sampleActions.length];
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const seed = `${picked.category}-${Date.now()}`;
    const sigBase = `4vP${Math.random().toString(36).slice(2, 8).toUpperCase()}nM9qR2tL7wY3zB6cF1hJ9dS4gA8kM2u`;
    const newTx: SolanaMockInteraction = {
      id: `sol-sim-${Date.now()}`,
      signature: sigBase.padEnd(44, 'x').slice(0, 44),
      category: picked.category,
      actionLabel: picked.actionLabel,
      actorAlias: 'quiet-sprout',
      memoHash: makeMockHash(seed),
      slot: (simulatedTxs[0]?.slot ?? 341892410) + Math.floor(4 + Math.random() * 14),
      feeSol: '0.000005 SOL',
      timestamp: stamp,
      status: 'Confirmed',
    };
    setSimulatedTxs((prev) => [newTx, ...prev]);
    setActionMessage(`Simulated Solana Devnet memo anchor for "${picked.actionLabel}".`);
  };

  const handleCopySig = (tx: SolanaMockInteraction) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(tx.signature).catch(() => {});
    }
    setCopiedSigId(tx.id);
    window.setTimeout(() => setCopiedSigId(null), 1600);
  };

  const activeParentProfile = useMemo(
    () => PARENT_PROFILES.find((p) => p.id === selectedChild) ?? PARENT_PROFILES[0],
    [selectedChild],
  );
  const activeParentMetrics = activeParentProfile.metricsByWindow[parentWindow];

  // Merge any real entries that have solanaHash with the interaction ledger mockup
  const combinedSolanaRows = useMemo(() => {
    const liveEntries: SolanaMockInteraction[] = todayEntries
      .filter((e) => Boolean(e.solanaHash))
      .map((e, idx) => ({
        id: `live-${e.id}`,
        signature:
          e.solanaTx && e.solanaTx !== 'hash-prepared'
            ? e.solanaTx
            : `devnetHashPrepared${e.id.slice(-8)}`,
        category: 'prompt_answer' as const,
        actionLabel: 'Live Prompt Entry · Privacy Anchor',
        actorAlias: e.authorDisplayName || 'room-member',
        memoHash: e.solanaHash || '',
        slot: 341892500 + idx,
        feeSol: e.solanaTx && e.solanaTx !== 'hash-prepared' ? '0.000005 SOL' : 'Prepared',
        timestamp: e.createdAt.replace('T', ' ').slice(0, 19),
        status: e.solanaTx && e.solanaTx !== 'hash-prepared' ? ('Finalized' as const) : ('Confirmed' as const),
      }));

    const all = [...liveEntries, ...simulatedTxs];
    return all.filter((row) => {
      if (solanaFilter !== 'all' && row.category !== solanaFilter) return false;
      if (solanaSearch.trim()) {
        const q = solanaSearch.trim().toLowerCase();
        return (
          row.actionLabel.toLowerCase().includes(q) ||
          row.signature.toLowerCase().includes(q) ||
          row.memoHash.toLowerCase().includes(q) ||
          row.actorAlias.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [todayEntries, simulatedTxs, solanaFilter, solanaSearch]);

  const activeMastraStats = MASTRA_STATS_BY_WINDOW[mastraWindow];

  if (!adminToken) {
    return (
      <section className="max-w-md mx-auto rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Lock className="w-5 h-5 text-[#2E7D5B] dark:text-[#7CD4C0]" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-[#1F2A3C] dark:text-white">
            {configured === false ? 'Set Up Admin Passcode' : 'Admin Sign-In'}
          </h2>
        </div>

        <p className="text-sm text-[#4C5568] dark:text-[#CBD5EB]">
          {configured === false
            ? 'No ADMIN_PASSWORD secret is configured yet. Create a one-time admin passcode to unlock parent insights, Solana logs, Mastra telemetry, and /admin moderation.'
            : envManaged
              ? 'Enter the server ADMIN_PASSWORD to view parent insights, Solana logs, Mastra telemetry, and moderation.'
              : 'Enter your admin passcode to manage parent insights, moderation, prompts, Solana logs, and Mastra workflows.'}
        </p>

        <form onSubmit={handleAuthSubmit} className="space-y-3">
          <div>
            <label htmlFor="admin-password-input" className="block text-xs font-semibold text-[#3D475E] dark:text-[#CBD5EB] mb-1">
              Admin Password
            </label>
            <input
              id="admin-password-input"
              data-testid="admin-password-input"
              type="password"
              required
              minLength={6}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder={configured === false ? 'Choose at least 6 characters' : 'Enter password'}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDD4BC] dark:border-[#49578D] bg-[#F8F4EA] dark:bg-[#19203E] text-sm text-[#1F2A3C] dark:text-white"
            />
          </div>

          {authError && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">
              {authError}
            </p>
          )}

          <button
            type="submit"
            data-testid="admin-login-submit"
            className="w-full min-h-[44px] px-4 py-2 rounded-full bg-[#2E7D5B] dark:bg-[#F8E166] text-white dark:text-[#242E47] text-sm font-bold hover:brightness-95 transition"
          >
            {configured === false ? 'Claim Admin Passcode' : 'Sign In to Admin'}
          </button>
        </form>
      </section>
    );
  }

  const showParents = sectionFilter === 'all' || sectionFilter === 'parents';
  const showSolana = sectionFilter === 'all' || sectionFilter === 'solana';
  const showMastra = sectionFilter === 'all' || sectionFilter === 'mastra';
  const showModeration = sectionFilter === 'all' || sectionFilter === 'moderation';

  return (
    <section className="space-y-6" aria-labelledby="admin-heading">
      {/* Top Bar Contract: Context & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5DEC9] dark:border-[#3D4978] pb-4">
        <div>
          <div className="text-xs text-[#555E72] dark:text-[#BDC7E3] flex flex-wrap items-center gap-2">
            <span>Room Administration</span>
            <span aria-hidden="true">/</span>
            <span>Parent Insights &amp; Chain Telemetry</span>
          </div>
          <h2 id="admin-heading" className="text-2xl font-semibold text-[#1F2A3C] dark:text-white mt-0.5">
            Family Care, Behavioral Insights &amp; Operations
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#ECE5D3] dark:bg-[#19203E]">
            {(
              [
                { id: 'all', label: 'All Views' },
                { id: 'parents', label: 'Parent Insights' },
                { id: 'solana', label: 'Solana On-Chain' },
                { id: 'mastra', label: 'Mastra Usage' },
                { id: 'moderation', label: 'Moderation & Prompts' },
              ] as const
            ).map((tab) => {
              const active = sectionFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`admin-tab-${tab.id}`}
                  onClick={() => setSectionFilter(tab.id)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white dark:bg-[#313D6E] text-[#1F2A3C] dark:text-white shadow-xs'
                      : 'text-[#555E72] dark:text-[#BDC7E3] hover:text-[#1F2A3C] dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setAdminToken(null)}
            className="min-h-[40px] px-4 py-2 rounded-lg border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#21294A] text-xs font-semibold text-[#1F2A3C] dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            Lock Admin
          </button>
        </div>
      </div>

      {actionMessage && (
        <div role="status" className="rounded-xl border border-[#8AD2A7] dark:border-[#3D8B78] bg-[#EFFAF3] dark:bg-[#1B3A3A] px-4 py-3 text-sm text-[#1D5438] dark:text-[#B9F3DF]">
          {actionMessage}
        </div>
      )}

      {/* SECTION A: PARENT BEHAVIORAL INSIGHTS MOCKUP */}
      {showParents && (
        <div
          data-testid="admin-parent-insights"
          className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EFE9D8] dark:divide-[#333F6E] dark:border-[#333F6E] pb-4">
            <div>
              <div className="text-xs text-[#555E72] dark:text-[#BDC7E3] flex flex-wrap items-center gap-2">
                <span>Parent Wellbeing Overview</span>
                <span aria-hidden="true">·</span>
                <span>Mockup Preview</span>
                <span aria-hidden="true">·</span>
                <span>{activeParentProfile.meta}</span>
              </div>
              <h3 className="text-xl font-semibold text-[#1F2A3C] dark:text-white mt-0.5">
                How Your Child Is Doing &amp; Behavioral Patterns
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F5F0E3] dark:bg-[#19203E]">
                {PARENT_PROFILES.map((prof) => (
                  <button
                    key={prof.id}
                    type="button"
                    data-testid={`parent-child-btn-${prof.id}`}
                    onClick={() => setSelectedChild(prof.id)}
                    className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      selectedChild === prof.id
                        ? 'bg-white dark:bg-[#313D6E] text-[#1F2A3C] dark:text-white shadow-xs'
                        : 'text-[#555E72] dark:text-[#BDC7E3] hover:text-[#1F2A3C] dark:hover:text-white'
                    }`}
                  >
                    {prof.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F5F0E3] dark:bg-[#19203E]">
                {(['7d', '14d', '30d'] as const).map((win) => (
                  <button
                    key={win}
                    type="button"
                    onClick={() => setParentWindow(win)}
                    className={`min-h-[34px] px-2.5 py-1 rounded-md text-xs font-mono-tabular font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      parentWindow === win
                        ? 'bg-white dark:bg-[#313D6E] text-[#1F2A3C] dark:text-white shadow-xs'
                        : 'text-[#555E72] dark:text-[#BDC7E3]'
                    }`}
                  >
                    {win === '7d' ? '7 Days' : win === '14d' ? '14 Days' : '30 Days'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4-Column Tabular KPI Strip (Hairline divided, single elevation) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EFE9D8] dark:divide-[#333F6E] border border-[#EFE9D8] dark:border-[#333F6E] rounded-xl">
            <div className="p-4 space-y-1">
              <div className="text-xs text-[#555E72] dark:text-[#BDC7E3]">Reflections Logged</div>
              <div className="text-2xl font-semibold font-mono-tabular text-[#1F2A3C] dark:text-white">
                {activeParentMetrics.reflections}
              </div>
              <div className="text-xs font-mono-tabular text-[#2E7D5B] dark:text-[#7CD4C0]">
                {activeParentMetrics.reflectionsDelta}
              </div>
            </div>

            <div className="p-4 space-y-1">
              <div className="text-xs text-[#555E72] dark:text-[#BDC7E3]">Calm Emotional Tone</div>
              <div className="text-2xl font-semibold font-mono-tabular text-[#1F2A3C] dark:text-white">
                {activeParentMetrics.calmShare}
              </div>
              <div className="text-xs text-[#4C5568] dark:text-[#CBD5EB]">
                {activeParentMetrics.calmLabel}
              </div>
            </div>

            <div className="p-4 space-y-1">
              <div className="text-xs text-[#555E72] dark:text-[#BDC7E3]">Animal Care &amp; Empathy</div>
              <div className="text-2xl font-semibold font-mono-tabular text-[#1F2A3C] dark:text-white">
                {activeParentMetrics.careActions} actions
              </div>
              <div className="text-xs font-mono-tabular text-[#4C5568] dark:text-[#CBD5EB]">
                {activeParentMetrics.pointsSpent} Care Points spent
              </div>
            </div>

            <div className="p-4 space-y-1">
              <div className="text-xs text-[#555E72] dark:text-[#BDC7E3]">Voice vs. Draw Mix</div>
              <div className="text-2xl font-semibold font-mono-tabular text-[#1F2A3C] dark:text-white">
                {activeParentMetrics.voiceShare}% / {activeParentMetrics.drawShare}%
              </div>
              <div className="text-xs text-[#4C5568] dark:text-[#CBD5EB]">
                Mic transcribed / Canvas first
              </div>
            </div>
          </div>

          {/* Noticeable Behavioral Patterns & Sensory Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-2">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold text-[#1F2A3C] dark:text-white">
                  Noticeable Behavioral Patterns
                </h4>
                <span className="text-xs font-mono-tabular text-[#555E72] dark:text-[#BDC7E3]">
                  {activeParentProfile.patterns.length} observations
                </span>
              </div>

              <div className="divide-y divide-[#EFE9D8] dark:divide-[#333F6E] border-t border-b border-[#EFE9D8] dark:border-[#333F6E]">
                {activeParentProfile.patterns.map((pattern) => {
                  const signalColor =
                    pattern.signalType === 'Gentle Notice'
                      ? 'text-amber-700 dark:text-amber-300'
                      : pattern.signalType === 'Positive Trend'
                        ? 'text-emerald-700 dark:text-[#7CD4C0]'
                        : 'text-[#2B7CB3] dark:text-[#9BD8EC]';

                  return (
                    <div key={pattern.id} className="py-4 space-y-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-sm font-semibold text-[#1F2A3C] dark:text-white">
                            {pattern.title}
                          </span>
                          <span aria-hidden="true" className="text-xs text-[#8C95AA]">·</span>
                          <span className={`text-xs font-semibold ${signalColor}`}>
                            {pattern.signalType}
                          </span>
                        </div>
                        <span className="text-xs font-mono-tabular text-[#555E72] dark:text-[#BDC7E3]">
                          {pattern.frequency}
                        </span>
                      </div>

                      <p className="text-sm text-[#4C5568] dark:text-[#CBD5EB] leading-relaxed">
                        {pattern.observation}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <span className="text-xs font-mono-tabular text-[#555E72] dark:text-[#A9B5D6]">
                          Recurring cues: {pattern.cueWords}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setTomorrowPromptText(pattern.suggestedPrompt);
                            setSectionFilter('all');
                            setActionMessage('Loaded suggested conversation prompt into Tomorrow’s Sensory Prompt below.');
                          }}
                          className="min-h-[34px] px-3 py-1 rounded-lg border border-[#DDD4BC] dark:border-[#49578D] text-xs font-semibold text-[#1F2A3C] dark:text-slate-100 hover:border-[#2E7D5B] whitespace-nowrap shrink-0"
                        >
                          Use as Tomorrow&apos;s Prompt
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right column: Sensory Themes & Care Summary */}
            <div className="space-y-4">
              <h4 className="text-base font-semibold text-[#1F2A3C] dark:text-white">
                Sensory Theme Distribution
              </h4>
              <div className="space-y-3 pt-1">
                {activeParentMetrics.sensoryBreakdown.map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#1F2A3C] dark:text-slate-100">{item.label}</span>
                      <span className="font-mono-tabular font-semibold text-[#555E72] dark:text-[#BDC7E3]">
                        {item.pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#EFE9D8] dark:bg-[#19203E] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#2E7D5B] dark:bg-[#7CD4C0]"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#EFE9D8] dark:border-[#333F6E] pt-4 space-y-2">
                <h5 className="text-xs font-semibold text-[#1F2A3C] dark:text-white">
                  Gentle Parent Takeaway
                </h5>
                <p className="text-xs text-[#4C5568] dark:text-[#CBD5EB] leading-relaxed">
                  Patterns are summarized strictly from sensory themes, drawing pace, and animal care actions so parents can start warm offline conversations without reading raw private diaries verbatim unless invited.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION B: SOLANA ON-CHAIN INTERACTION LEDGER MOCKUP */}
      {showSolana && (
        <div
          data-testid="admin-solana-ledger"
          className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-5"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EFE9D8] dark:border-[#333F6E] pb-4">
            <div>
              <div className="text-xs text-[#555E72] dark:text-[#BDC7E3] flex flex-wrap items-center gap-2">
                <span>Solana Devnet SPL Memo</span>
                <span aria-hidden="true">·</span>
                <span>Mockup Ledger + Live Hash Anchors</span>
                <span aria-hidden="true">·</span>
                <span>Zero Child PII On-Chain</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Link2 className="w-5 h-5 text-[#2E7D5B] dark:text-[#7CD4C0]" aria-hidden="true" />
                <h3 className="text-xl font-semibold text-[#1F2A3C] dark:text-white">
                  Solana On-Chain Interaction Ledger
                </h3>
              </div>
            </div>

            <button
              type="button"
              data-testid="simulate-solana-anchor-btn"
              onClick={handleSimulateSolanaAnchor}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-[#2E7D5B] dark:bg-[#7CD4C0] text-white dark:text-[#112A24] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:brightness-95"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Simulate On-Chain Interaction</span>
            </button>
          </div>

          {/* Search & Interaction Type Filter */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#F5F0E3] dark:bg-[#19203E]">
              {(
                [
                  { id: 'all', label: 'All Interactions' },
                  { id: 'prompt_answer', label: 'Prompt Answers' },
                  { id: 'animal_pet', label: 'Animal Pets' },
                  { id: 'animal_tame', label: 'Animal Taming' },
                  { id: 'world_stage', label: 'World Stages' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSolanaFilter(f.id)}
                  className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    solanaFilter === f.id
                      ? 'bg-white dark:bg-[#313D6E] text-[#1F2A3C] dark:text-white shadow-xs'
                      : 'text-[#555E72] dark:text-[#BDC7E3]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-[#8C95AA] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="search"
                value={solanaSearch}
                onChange={(e) => setSolanaSearch(e.target.value)}
                placeholder="Filter by signature, hash, or action..."
                aria-label="Filter Solana on-chain interactions"
                className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-lg border border-[#DDD4BC] dark:border-[#49578D] bg-[#F8F4EA] dark:bg-[#19203E] text-xs text-[#1F2A3C] dark:text-white"
              />
            </div>
          </div>

          {/* High-Density Tabular Ledger */}
          {combinedSolanaRows.length === 0 ? (
            <p className="text-sm text-[#555E72] dark:text-[#BDC7E3] py-4">
              No on-chain interactions match this filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5DEC9] dark:border-[#3D4978] text-[#555E72] dark:text-[#BDC7E3]">
                    <th className="py-2.5 pr-4 font-medium">Tx Signature</th>
                    <th className="py-2.5 pr-4 font-medium">Interaction Event</th>
                    <th className="py-2.5 pr-4 font-medium">Actor Alias</th>
                    <th className="py-2.5 pr-4 font-medium">Memo SHA-256 Hash</th>
                    <th className="py-2.5 pr-4 font-medium text-right">Slot</th>
                    <th className="py-2.5 pr-4 font-medium text-right">Fee</th>
                    <th className="py-2.5 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE9D8] dark:divide-[#333F6E]">
                  {combinedSolanaRows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FAF7F0] dark:hover:bg-[#1D2442]">
                      <td className="py-3 pr-4 font-mono-tabular whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-[#1F2A3C] dark:text-slate-100" title={row.signature}>
                            {shortSig(row.signature)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopySig(row)}
                            aria-label={`Copy transaction signature ${row.signature}`}
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-[#555E72] dark:text-[#BDC7E3]"
                          >
                            {copiedSigId === row.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-[#7CD4C0]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-[#1F2A3C] dark:text-slate-100 font-medium">
                        <div>{row.actionLabel}</div>
                        <div className="text-[11px] font-mono-tabular text-[#555E72] dark:text-[#A9B5D6]">
                          {row.timestamp} UTC
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-[#4C5568] dark:text-[#CBD5EB] whitespace-nowrap">
                        {row.actorAlias}
                      </td>
                      <td className="py-3 pr-4 font-mono-tabular text-[#555E72] dark:text-[#BDC7E3] whitespace-nowrap">
                        {row.memoHash.slice(0, 14)}...{row.memoHash.slice(-6)}
                      </td>
                      <td className="py-3 pr-4 font-mono-tabular text-right text-[#1F2A3C] dark:text-slate-100 whitespace-nowrap">
                        {row.slot.toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 font-mono-tabular text-right text-[#555E72] dark:text-[#BDC7E3] whitespace-nowrap">
                        {row.feeSol}
                      </td>
                      <td className="py-3 text-right font-semibold whitespace-nowrap text-emerald-700 dark:text-[#7CD4C0]">
                        {row.status} · Devnet
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Room Solana Opt-In Controls */}
          <div className="border-t border-[#EFE9D8] dark:border-[#333F6E] pt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-[#1F2A3C] dark:text-white">
                Room Devnet Opt-In Controls
              </h4>
              <span className="text-xs text-[#555E72] dark:text-[#BDC7E3]">
                Server sponsor wallet anchors SHA-256 hash + hour bucket only
              </span>
            </div>
            <ul className="divide-y divide-[#EFE9D8] dark:divide-[#333F6E]">
              {rooms.map((r) => (
                <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#1F2A3C] dark:text-white">
                      {r.code} · {r.name}
                    </div>
                    <div className="text-xs font-mono-tabular text-[#555E72] dark:text-[#BDC7E3]">
                      Invite: {r.inviteCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSolana(r)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                      r.solanaEnabled
                        ? 'bg-[#2E7D5B] dark:bg-[#7CD4C0] text-white dark:text-[#112A24]'
                        : 'border border-[#DDD4BC] dark:border-[#49578D] text-[#3D475E] dark:text-slate-200'
                    }`}
                  >
                    {r.solanaEnabled ? 'Devnet Enabled' : 'Enable Devnet'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* SECTION C: MASTRA USAGE & WORKFLOW TELEMETRY */}
      {showMastra && (
        <div
          data-testid="admin-mastra-usage"
          className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EFE9D8] dark:border-[#333F6E] pb-4">
            <div>
              <div className="text-xs text-[#555E72] dark:text-[#BDC7E3] flex flex-wrap items-center gap-2">
                <span>Mastra Agent &amp; Workflow Runtime</span>
                <span aria-hidden="true">·</span>
                <span>Usage Telemetry Mockup + Live Workflow Runner</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Bot className="w-5 h-5 text-[#2B7CB3] dark:text-[#9BD8EC]" aria-hidden="true" />
                <h3 className="text-xl font-semibold text-[#1F2A3C] dark:text-white">
                  Mastra Usage &amp; Guardrail Execution
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F5F0E3] dark:bg-[#19203E]">
              {(['24h', '7d', '30d'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setMastraWindow(w)}
                  className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-mono-tabular font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    mastraWindow === w
                      ? 'bg-white dark:bg-[#313D6E] text-[#1F2A3C] dark:text-white shadow-xs'
                      : 'text-[#555E72] dark:text-[#BDC7E3]'
                  }`}
                >
                  {w === '24h' ? '24 Hours' : w === '7d' ? '7 Days' : '30 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* 4-Column Mastra Usage KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EFE9D8] dark:divide-[#333F6E] border border-[#EFE9D8] dark:border-[#333F6E] rounded-xl">
            <div className="p-4 space-y-1">
              <div className="text-xs text-[#555E72] dark:text-[#BDC7E3]">Workflow &amp; Agent Runs</div>
              <div className="text-2xl font-semibold font-mono-tabular text-[#1F2A3C] dark:text-white">
                {activeMastraStats.totalRuns}
              </div>
              <div className="text-xs text-[#4C5568] dark:text-[#CBD5EB]">Across 4 pipelines</div>
            </div>

            <div className="p-4 space-y-1">
              <div className="text-xs text-[#555E72] dark:text-[#BDC7E3]">Guardrail Pass Rate</div>
              <div className="text-2xl font-semibold font-mono-tabular text-emerald-700 dark:text-[#7CD4C0]">
                {activeMastraStats.passRate}
              </div>
              <div className="text-xs text-[#4C5568] dark:text-[#CBD5EB]">Zero-PII &amp; quote limits</div>
            </div>

            <div className="p-4 space-y-1">
              <div className="text-xs text-[#555E72] dark:text-[#BDC7E3]">Avg Execution Latency</div>
              <div className="text-2xl font-semibold font-mono-tabular text-[#1F2A3C] dark:text-white">
                {activeMastraStats.avgLatency}
              </div>
              <div className="text-xs text-[#4C5568] dark:text-[#CBD5EB]">End-to-end step time</div>
            </div>

            <div className="p-4 space-y-1">
              <div className="text-xs text-[#555E72] dark:text-[#BDC7E3]">Model Token Footprint</div>
              <div className="text-2xl font-semibold font-mono-tabular text-[#1F2A3C] dark:text-white">
                {activeMastraStats.totalTokens}
              </div>
              <div className="text-xs font-mono-tabular text-[#4C5568] dark:text-[#CBD5EB]">
                Est. cost {activeMastraStats.estCost}
              </div>
            </div>
          </div>

          {/* Registered Mastra Workflows Table */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-[#1F2A3C] dark:text-white">
              Usage by Mastra Workflow &amp; Agent
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5DEC9] dark:border-[#3D4978] text-[#555E72] dark:text-[#BDC7E3]">
                    <th className="py-2 pr-4 font-medium">Workflow / Agent</th>
                    <th className="py-2 pr-4 font-medium">Role</th>
                    <th className="py-2 pr-4 font-medium text-right">Runs</th>
                    <th className="py-2 pr-4 font-medium text-right">Pass Rate</th>
                    <th className="py-2 pr-4 font-medium text-right">Avg Latency</th>
                    <th className="py-2 font-medium text-right">Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE9D8] dark:divide-[#333F6E]">
                  {activeMastraStats.workflows.map((wf) => (
                    <tr key={wf.name}>
                      <td className="py-3 pr-4 font-mono-tabular font-semibold text-[#1F2A3C] dark:text-white whitespace-nowrap">
                        {wf.name}
                      </td>
                      <td className="py-3 pr-4 text-[#4C5568] dark:text-[#CBD5EB]">{wf.purpose}</td>
                      <td className="py-3 pr-4 font-mono-tabular text-right text-[#1F2A3C] dark:text-slate-100">
                        {wf.runs}
                      </td>
                      <td className="py-3 pr-4 font-mono-tabular text-right text-emerald-700 dark:text-[#7CD4C0]">
                        {wf.passRate}
                      </td>
                      <td className="py-3 pr-4 font-mono-tabular text-right text-[#555E72] dark:text-[#BDC7E3]">
                        {wf.avgMs} ms
                      </td>
                      <td className="py-3 font-mono-tabular text-right text-[#1F2A3C] dark:text-slate-100">
                        {wf.tokens.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Mastra Nightly Workflow Trigger & Execution Log */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-[#EFE9D8] dark:border-[#333F6E] pt-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#2B7CB3] dark:text-[#9BD8EC]" aria-hidden="true" />
                <h4 className="text-sm font-semibold text-[#1F2A3C] dark:text-white">
                  Run Live Mastra Nightly Workflow
                </h4>
              </div>
              <p className="text-xs text-[#4C5568] dark:text-[#CBD5EB]">
                Executes the 4-step workflow: fetch room entries, synthesize a 2-sentence caption &amp; 3 minigame questions, validate zero names / max 5 quoted words, and persist.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  aria-label="Select room for workflow"
                  value={selectedWorkflowRoom}
                  onChange={(e) => setSelectedWorkflowRoom(e.target.value)}
                  className="min-h-[42px] px-3.5 py-2 rounded-lg border border-[#DDD4BC] dark:border-[#49578D] bg-[#F8F4EA] dark:bg-[#19203E] text-sm text-[#1F2A3C] dark:text-white"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  data-testid="run-nightly-workflow-btn"
                  onClick={handleRunNightlyWorkflow}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-[#2B7CB3] dark:bg-[#9BD8EC] text-white dark:text-[#182436] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Nightly Workflow</span>
                </button>
              </div>

              {workflowReport && (
                <div className="rounded-xl border border-[#E5DEC9] dark:border-[#3D4978] bg-[#F8F4EA] dark:bg-[#19203E] p-3 space-y-1.5 text-xs">
                  {workflowReport.steps?.map((s: any) => (
                    <div key={s.stepId} className="flex items-start gap-2">
                      <span
                        className={
                          s.status === 'passed'
                            ? 'text-emerald-700 dark:text-[#7CD4C0] font-semibold'
                            : 'text-rose-700 dark:text-rose-400 font-semibold'
                        }
                      >
                        {s.status.toUpperCase()}
                      </span>
                      <span className="font-mono-tabular text-[#555E72] dark:text-[#BDC7E3]">{s.stepId}:</span>
                      <span className="text-[#1F2A3C] dark:text-slate-100">{s.detail}</span>
                    </div>
                  ))}
                  {workflowReport.error && (
                    <p className="text-rose-700 dark:text-rose-400 font-medium pt-1">{workflowReport.error}</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-[#1F2A3C] dark:text-white">
                Recent Mastra Trace Log
              </h4>
              <div className="divide-y divide-[#EFE9D8] dark:divide-[#333F6E] border-t border-b border-[#EFE9D8] dark:border-[#333F6E]">
                {mastraLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-mono-tabular font-semibold text-[#1F2A3C] dark:text-white truncate">
                        {log.workflowName} · {log.roomCode}
                      </div>
                      <div className="text-[#4C5568] dark:text-[#CBD5EB] mt-0.5">{log.stepsSummary}</div>
                    </div>
                    <div className="text-right shrink-0 font-mono-tabular">
                      <div
                        className={
                          log.status === 'passed'
                            ? 'text-emerald-700 dark:text-[#7CD4C0] font-semibold'
                            : 'text-rose-700 dark:text-rose-400 font-semibold'
                        }
                      >
                        {log.status === 'passed' ? 'Passed' : 'Halted'} · {log.latencyMs}ms
                      </div>
                      <div className="text-[11px] text-[#555E72] dark:text-[#A9B5D6]">
                        {log.tokensUsed.toLocaleString()} tok · {log.timestamp.slice(11, 16)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION D: PROMPT SCHEDULING, MODERATION & ARCHIVE */}
      {showModeration && (
        <div className="space-y-6">
          {/* 1. Set Tomorrow's Prompt (Clear labeled form for automation bots & humans) */}
          <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-4">
            <h3 className="text-lg font-semibold text-[#1F2A3C] dark:text-white">
              Schedule Tomorrow&apos;s Prompt ({tomorrowDate})
            </h3>

            <form onSubmit={handleSaveTomorrowPrompt} className="space-y-3">
              <div>
                <label htmlFor="tomorrow-prompt-input" className="block text-xs font-semibold text-[#3D475E] dark:text-[#CBD5EB] mb-1">
                  Tomorrow&apos;s Sensory Prompt
                </label>
                <textarea
                  id="tomorrow-prompt-input"
                  data-testid="tomorrow-prompt-input"
                  required
                  rows={2}
                  value={tomorrowPromptText}
                  onChange={(e) => setTomorrowPromptText(e.target.value)}
                  placeholder="Write a sensory, tactile question that invites reflection..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDD4BC] dark:border-[#49578D] bg-[#F8F4EA] dark:bg-[#19203E] text-sm text-[#1F2A3C] dark:text-white"
                />
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="sensory-focus-input" className="block text-xs font-semibold text-[#3D475E] dark:text-[#CBD5EB] mb-1">
                    Sensory Focus
                  </label>
                  <input
                    id="sensory-focus-input"
                    type="text"
                    value={sensoryFocus}
                    onChange={(e) => setSensoryFocus(e.target.value)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDD4BC] dark:border-[#49578D] bg-[#F8F4EA] dark:bg-[#19203E] text-sm text-[#1F2A3C] dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  data-testid="save-tomorrow-prompt-btn"
                  className="min-h-[44px] px-5 py-2 rounded-lg bg-[#2E7D5B] dark:bg-[#F8E166] text-white dark:text-[#242E47] text-sm font-bold hover:brightness-95 whitespace-nowrap shrink-0"
                >
                  Save Tomorrow&apos;s Prompt
                </button>
              </div>
            </form>
          </div>

          {/* 2. Today's Entries Moderation List */}
          <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#1F2A3C] dark:text-white">
                Today&apos;s Entries ({todayDate})
              </h3>
              <span className="text-xs font-mono-tabular text-[#555E72] dark:text-[#BDC7E3]">
                {todayEntries.length} total
              </span>
            </div>

            {todayEntries.length === 0 ? (
              <p className="text-sm text-[#555E72] dark:text-[#BDC7E3]">No entries submitted today.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5DEC9] dark:border-[#3D4978] text-xs text-[#555E72] dark:text-[#BDC7E3]">
                      <th className="py-2 pr-4 font-medium">Entry ID</th>
                      <th className="py-2 pr-4 font-medium">Sentence</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 font-medium text-right">Moderation Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE9D8] dark:divide-[#333F6E]">
                    {todayEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="py-3 pr-4 font-mono-tabular text-xs text-[#555E72] dark:text-[#BDC7E3] whitespace-nowrap">
                          {entry.id}
                          {entry.isDemo ? ' · demo' : ''}
                        </td>
                        <td className="py-3 pr-4 text-[#1F2A3C] dark:text-slate-100">
                          {entry.sentence}
                          {entry.moderationReason && (
                            <div className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                              Reason: {entry.moderationReason}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-xs font-medium">
                          {entry.flagged ? (
                            <span className="text-rose-700 dark:text-rose-400 inline-flex items-center gap-1">
                              <ShieldAlert className="w-4 h-4" />
                              <span>Flagged</span>
                            </span>
                          ) : (
                            <span className="text-emerald-700 dark:text-[#7CD4C0] inline-flex items-center gap-1">
                              <Check className="w-4 h-4" />
                              <span>Visible</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            data-testid={`flag-btn-${entry.id}`}
                            onClick={() => handleToggleFlag(entry)}
                            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                              entry.flagged
                                ? 'border border-emerald-600 text-emerald-700 dark:text-[#7CD4C0] hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                : 'border border-rose-600 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                            }`}
                          >
                            <Flag className="w-3.5 h-3.5" />
                            <span>{entry.flagged ? 'Unflag Entry' : 'Flag Entry'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. Read-Only List of Past Prompts */}
          <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-3">
            <h3 className="text-lg font-semibold text-[#1F2A3C] dark:text-white">
              Prompt Archive (Read-Only)
            </h3>
            <ul className="divide-y divide-[#EFE9D8] dark:divide-[#333F6E]">
              {prompts.map((p) => (
                <li key={p.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm">
                  <span className="text-[#1F2A3C] dark:text-slate-100">{p.text}</span>
                  <span className="text-xs font-mono-tabular text-[#555E72] dark:text-[#BDC7E3] shrink-0">
                    {p.promptDate} · {p.sensoryFocus}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
