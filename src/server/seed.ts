import type { StrokeData, StrokePoint } from '../types';
import {
  WORLD_CHAPTER_TEMPLATES,
  createRoom,
  createUser,
  getAllPrompts,
  getAllRooms,
  getEntriesForRoomAndDate,
  getRoomQuests,
  insertEntry,
  insertRoomQuest,
  recordMinigameEvent,
  resetDemoRoomQuestsIfUnplayed,
  saveMinigameQuestions,
  syncLegacyQuestsToTemplates,
  upsertDemoCanvasStroke,
  upsertNightlyCaption,
  upsertPrompt,
} from './db';
import { deriveSensoryWorldSpec } from './gemini';

function dateOffsetIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function makeWaveStroke(seed: number, color: string, style: 'arc' | 'loop' | 'ridge' | 'spiral'): StrokeData {
  const points: StrokePoint[] = [];
  const count = 28;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    let x = 0.1 + t * 0.8;
    let y = 0.5;
    if (style === 'arc') {
      y = 0.65 - Math.sin(t * Math.PI) * (0.28 + (seed % 3) * 0.06) + Math.sin(t * 9 + seed) * 0.03;
    } else if (style === 'loop') {
      const ang = t * Math.PI * 2.2 + seed;
      x = 0.5 + Math.cos(ang) * (0.26 + t * 0.1);
      y = 0.5 + Math.sin(ang) * 0.25;
    } else if (style === 'ridge') {
      y = 0.55 + Math.sin(t * Math.PI * 3 + seed) * 0.18;
    } else {
      const r = 0.06 + t * 0.34;
      const ang = t * Math.PI * 3.5 + seed;
      x = 0.5 + Math.cos(ang) * r;
      y = 0.5 + Math.sin(ang) * r;
    }
    points.push({
      x: Math.max(0.06, Math.min(0.94, Number(x.toFixed(3)))),
      y: Math.max(0.08, Math.min(0.92, Number(y.toFixed(3)))),
    });
  }
  return { points, color, width: 4 };
}

const SENSORY_PROMPTS = [
  {
    daysAgo: 0,
    focus: 'everyday rooms',
    text: 'If your day were a room, what would be inside it?',
  },
  {
    daysAgo: 1,
    focus: 'afternoon song',
    text: 'If your afternoon were a song, what would it be?',
  },
  {
    daysAgo: 2,
    focus: 'daily texture',
    text: 'Which part of your day was the most wrinkled?',
  },
  {
    daysAgo: 3,
    focus: 'lunch & color',
    text: 'What color was your lunch today?',
  },
  {
    daysAgo: 4,
    focus: 'pace & motion',
    text: 'Was your day more like floating, sinking, drifting, or running?',
  },
  {
    daysAgo: 5,
    focus: 'footsteps',
    text: 'If today were a pair of shoes, what kind would they be?',
  },
  {
    daysAgo: 6,
    focus: 'desk & table',
    text: 'What sat closest to your left hand all afternoon?',
  },
  {
    daysAgo: -1,
    focus: 'window light',
    text: 'What did the sky look like the last time you checked a window?',
  },
];

const LEGACY_DEMO_PROMPT_SNIPPETS = [
  'If today were a fabric resting against your wrist',
  'What everyday object near you holds the exact temperature',
  'Describe the smell of rain hitting something unexpected',
  'If your mood today were a stone in your pocket',
  'Where did sunlight bend through glass',
  'Which warm kitchen sound or flavor',
  'Watch one thing moving in the wind today',
  'If tomorrow morning were a ceramic mug',
];

const DEMO_USERS = [
  { id: 'demo_usr_1', name: 'moss-fox', color: '#2E7D5B' },
  { id: 'demo_usr_2', name: 'rain-owl', color: '#2B7CB3' },
  { id: 'demo_usr_3', name: 'amber-wren', color: '#C86D3B' },
  { id: 'demo_usr_4', name: 'indigo-seal', color: '#3B5998' },
  { id: 'demo_usr_5', name: 'clay-deer', color: '#8B5E3C' },
  { id: 'demo_usr_6', name: 'fern-moth', color: '#4A7C59' },
  { id: 'demo_usr_7', name: 'plum-jay', color: '#7A4E7D' },
];

const DEMO_SENTENCES_BY_DAY: string[][] = [
  // Day 0 (Today)
  [
    'Sun-warmed linen dried on a balcony line, crisp at the creases yet soft where the breeze keeps folding it.',
    'Heavy selvedge denim stiff from morning frost, loosening slowly as we walk across the courtyard.',
    'Deep forest velvet around a brass lantern, catching low amber light without making a sound.',
    'Cool raw silk slipping over wet river pebbles when the afternoon drizzle finally clears.',
    'Brushed wool from an attic cedar chest, carrying faint smoke and quiet library dust.',
    'Sea-salted canvas from a folded sail, sturdy enough to lean against the wind.',
  ],
  // Day 1
  [
    'A stoneware kettle ticking as it cools on the stove, holding steady warmth inside thick clay.',
    'The brass handrail outside the greenhouse, chilly on first touch before warming under my palm.',
    'A glass marble rolling across oak floorboards, humming softly against the afternoon light.',
    'Dry cedar shavings curled beside a workbench, smelling of resin and late sun.',
    'A damp wool scarf draped over a radiator, steaming lightly like quiet mist.',
    'An old ceramic bowl cradling warm tea leaves while rain taps the sill.',
  ],
  // Day 2
  [
    'Rain hitting hot slate steps outside the dorm, releasing a sharp mineral sigh.',
    'Wet pine needles crushed along the footpath, bright and resinous in cool mist.',
    'Drizzle on warm bicycle tires spinning home past blooming rosemary hedges.',
    'Rainwater pooling in a terracotta saucer, smelling faintly of clay and damp moss.',
    'Mist settling over drychalk sidewalk drawings until the colors blur into sea glass.',
    'Cool drizzle on an iron fire escape, metallic and clean after a crowded week.',
  ],
  // Day 3
  [
    'A flat river slate warmed by my thumb, steady and cool enough to anchor restless thoughts.',
    'Three small pebbles clinking softly inside a coat pocket like quiet chimes.',
    'Heavy sea glass worn frosted at every corner, smooth enough to turn endlessly.',
    'A palm-sized chunk of amber resin, light as dried honey and warm in late sun.',
    'A cool basalt pebble split down the middle, rough inside where no tide reached.',
    'A smooth wooden bead polished dark by years of nervous fingers.',
  ],
  // Day 4
  [
    'Golden light bending through a jar of steeped honey tea across the wooden table.',
    'Shadows of maple leaves flickering through frosted stairwell glass like moving water.',
    'Late sun catching a raindrop hung on a rosemary sprig, turning it into a tiny lantern.',
    'Reflected ripples from a courtyard puddle dancing across the brick archway.',
    'Pale morning sun slicing through dusty blinds onto an open notebook.',
    'Amber streetlamp glow refracting through a misted bus window on the ride back.',
  ],
  // Day 5
  [
    'Cardamom steam rising from a chipped porcelain cup while toast crackles in the pan.',
    'Cinnamon butter melting slowly into warm oats as the kettle whistles softly.',
    'Roasted barley tea cooling in a clay pitcher, nutty and unhurried.',
    'Sizzling olive oil and rosemary stems popping gently in a cast-iron skillet.',
    'Tart citrus peel twisted over hot ginger water before the hallway wakes up.',
    'Warm honey dripping off a wooden spoon into quiet morning light.',
  ],
  // Day 6
  [
    'A stray cotton ribbon caught on a garden gate, signalling which way the river breeze turns.',
    'Silver birch leaves flipping upside down in gusts, flashing pale undersides like lanterns.',
    'A paper kite tail fluttering above the quad, sketching unseen currents in the sky.',
    'Tall meadow grass bowing in slow waves as cool evening air rolls down the hill.',
    'Dry oak leaves skittering across stone tiles in a crisp spiral.',
    'Wind chimes of sea glass clinking softly on the porch before dusk.',
  ],
];

const PALETTE = ['#2E7D5B', '#2B7CB3', '#C86D3B', '#3B5998', '#8B5E3C', '#7A4E7D'];
const STYLES: Array<'arc' | 'loop' | 'ridge' | 'spiral'> = ['arc', 'loop', 'ridge', 'spiral'];

export async function seedDemoDataIfEmpty(force = false): Promise<{ seeded: boolean; count: number }> {
  const existingRooms = await getAllRooms();
  if (existingRooms.length > 0 && !force) {
    return { seeded: false, count: 0 };
  }

  const roomCedar = existingRooms.find((r) => r.code === 'CEDAR-402') || (await createRoom('CEDAR-402', 'Cedar Hall 402', true, 'SS-CEDAR4'));
  const roomStudio = existingRooms.find((r) => r.code === 'STUDIO-B') || (await createRoom('STUDIO-B', 'Printmaking Studio B', false, 'SS-STUDIO'));
  const roomGreenhouse = existingRooms.find((r) => r.code === 'GREENHOUSE') || (await createRoom('GREENHOUSE', 'Botany Greenhouse', true, 'SS-GREEN7'));

  const users = [];
  for (const u of DEMO_USERS) {
    users.push(await createUser(u.name, u.color, u.id));
  }

  const promptByDay = new Map<number, string>();
  for (const p of SENSORY_PROMPTS) {
    const saved = await upsertPrompt(dateOffsetIso(p.daysAgo), p.text, p.focus, `demo_prm_${p.daysAgo + 10}`);
    promptByDay.set(p.daysAgo, saved.id);
  }

  let totalInserted = 0;

  // Check if today already has entries in CEDAR-402
  const todayStr = dateOffsetIso(0);
  const existingToday = await getEntriesForRoomAndDate(roomCedar.id, todayStr, true);
  if (existingToday.length > 0 && !force) {
    return { seeded: false, count: 0 };
  }

  // 7 days x 6 entries = 42 demo entries across rooms (primary room CEDAR-402 gets 4-6 per day, STUDIO-B & GREENHOUSE get extra variety)
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const entryDate = dateOffsetIso(dayIdx);
    const promptId = promptByDay.get(dayIdx)!;
    const sentences = DEMO_SENTENCES_BY_DAY[dayIdx];

    for (let i = 0; i < sentences.length; i++) {
      const user = users[(i + dayIdx) % users.length];
      const room = i < 4 ? roomCedar : i === 4 ? roomStudio : roomGreenhouse;
      const color = PALETTE[(i + dayIdx) % PALETTE.length];
      const stroke = makeWaveStroke(dayIdx * 7 + i, color, STYLES[(i + dayIdx) % STYLES.length]);
      const worldSpec = deriveSensoryWorldSpec(sentences[i], color);
      const createdDate = new Date();
      createdDate.setDate(createdDate.getDate() - dayIdx);
      createdDate.setHours(9 + i, (i * 11) % 60, 0, 0);

      const entry = await insertEntry({
        id: `demo_ent_${dayIdx}_${i}`,
        roomId: room.id,
        userId: user.id,
        promptId,
        entryDate,
        sentence: sentences[i],
        strokeJson: stroke,
        worldSpec,
        flagged: false,
        isDemo: true,
        createdAt: createdDate.toISOString(),
      });
      totalInserted++;

      // Seed minigame events across past 3 weeks for stats chart
      if (i < 3) {
        const eventDate = new Date();
        eventDate.setDate(eventDate.getDate() - dayIdx * 3);
        await recordMinigameEvent({
          userId: users[0].id,
          entryId: entry.id,
          gameType: i % 2 === 0 ? 'guess_prompt' : 'whose_is_it',
          correct: (dayIdx + i) % 3 !== 0,
          createdAt: eventDate.toISOString(),
        });
      }
    }

    // Seed validated nightly captions for CEDAR-402 on past days
    if (dayIdx > 0) {
      await upsertNightlyCaption({
        roomId: roomCedar.id,
        captionDate: entryDate,
        caption:
          'Quiet textures of cool stone, warm clay, and shifting light shaped the room today. Together the strokes trace a patient, tactile afternoon.',
        entryCount: 4,
        validated: true,
      });
    }
  }

  // Seed 3 sample minigame questions for today in CEDAR-402
  await saveMinigameQuestions([
    {
      roomId: roomCedar.id,
      entryId: 'demo_ent_0_0',
      questionDate: todayStr,
      gameType: 'guess_prompt',
      questionText: 'Which sensory prompt inspired the warm linen and breeze stroke?',
      options: [
        SENSORY_PROMPTS[0].text,
        SENSORY_PROMPTS[1].text,
        SENSORY_PROMPTS[2].text,
        SENSORY_PROMPTS[3].text,
      ],
      correctAnswer: SENSORY_PROMPTS[0].text,
      isDemo: true,
    },
    {
      roomId: roomCedar.id,
      entryId: 'demo_ent_0_1',
      questionDate: todayStr,
      gameType: 'guess_prompt',
      questionText: 'Which prompt shaped the stiff frost denim walk?',
      options: [
        SENSORY_PROMPTS[0].text,
        SENSORY_PROMPTS[4].text,
        SENSORY_PROMPTS[5].text,
        SENSORY_PROMPTS[6].text,
      ],
      correctAnswer: SENSORY_PROMPTS[0].text,
      isDemo: true,
    },
    {
      roomId: roomCedar.id,
      entryId: 'demo_ent_0_2',
      questionDate: todayStr,
      gameType: 'guess_prompt',
      questionText: 'Which prompt did the forest velvet lantern answer?',
      options: [
        SENSORY_PROMPTS[0].text,
        SENSORY_PROMPTS[2].text,
        SENSORY_PROMPTS[3].text,
        SENSORY_PROMPTS[5].text,
      ],
      correctAnswer: SENSORY_PROMPTS[0].text,
      isDemo: true,
    },
  ]);

  await seedCanvasStrokesIfEmpty(roomGreenhouse.id, users);
  await seedQuestsIfEmpty();

  return { seeded: true, count: totalInserted };
}

export async function seedCanvasStrokesIfEmpty(roomId?: string, explicitUsers?: Array<{ id: string }>): Promise<void> {
  const rooms = await getAllRooms();
  const targetRoom = roomId ? rooms.find((r) => r.id === roomId) : rooms.find((r) => r.code === 'GREENHOUSE') || rooms[0];
  if (!targetRoom) return;

  const { getCanvasStrokesForRoom } = await import('./db');
  const existing = await getCanvasStrokesForRoom(targetRoom.id);
  const hasUserStrokes = existing.some((s) => !s.id.startsWith('demo_cs_'));
  const hasLegacyDemoStrokes = existing.some(
    (s) =>
      s.id.startsWith('demo_cs_') &&
      (s.reflection.includes('cool blueberries') || s.reflection.includes('warm yellow linen')),
  );
  const hasProperChapterDemo =
    existing.some((s) => s.id === 'demo_cs_1' && s.roomId === targetRoom.id && s.chapterNumber === 1) &&
    existing.some((s) => s.id === 'demo_cs_4' && s.roomId === targetRoom.id && s.chapterNumber === 2);
  if (
    !hasLegacyDemoStrokes &&
    (hasProperChapterDemo || (existing.length > 0 && hasUserStrokes && !existing.some((s) => s.id.startsWith('demo_cs_'))))
  ) {
    return;
  }

  const users =
    explicitUsers ||
    (await Promise.all(DEMO_USERS.slice(0, 4).map((u) => createUser(u.name, u.color, u.id))));

  const starterCanvasStrokes = [
    {
      id: 'demo_cs_1',
      user: users[0],
      reflection: 'a sunny bay window with a kettle, an open sketchbook, and stacked blankets',
      points: [
        { x: 0.24, y: 0.80 },
        { x: 0.25, y: 0.62 },
        { x: 0.27, y: 0.45 },
        { x: 0.16, y: 0.41 },
        { x: 0.15, y: 0.26 },
        { x: 0.28, y: 0.19 },
        { x: 0.42, y: 0.25 },
        { x: 0.43, y: 0.41 },
        { x: 0.31, y: 0.46 },
        { x: 0.32, y: 0.80 },
      ],
      color: '#2E7D5B',
    },
    {
      id: 'demo_cs_2',
      user: users[1 % users.length],
      reflection: 'a warm acoustic guitar song humming slowly while kettle steam rises',
      points: [
        { x: 0.48, y: 0.68 },
        { x: 0.58, y: 0.56 },
        { x: 0.70, y: 0.51 },
        { x: 0.82, y: 0.56 },
        { x: 0.90, y: 0.68 },
      ],
      color: '#C86D3B',
    },
    {
      id: 'demo_cs_3',
      user: users[2 % users.length],
      reflection: 'my wrinkled grocery list folded three times inside my coat pocket',
      points: [
        { x: 0.46, y: 0.79 },
        { x: 0.59, y: 0.72 },
        { x: 0.74, y: 0.78 },
        { x: 0.88, y: 0.74 },
      ],
      color: '#2B7CB3',
      chapterNumber: 1,
    },
    {
      id: 'demo_cs_4',
      user: users[3 % users.length],
      reflection: 'my wrinkled umbrella drying beside the wooden entryway bench',
      points: [
        { x: 0.28, y: 0.78 },
        { x: 0.28, y: 0.56 },
        { x: 0.22, y: 0.36 },
        { x: 0.30, y: 0.22 },
        { x: 0.42, y: 0.24 },
        { x: 0.44, y: 0.40 },
      ],
      color: '#8A308C',
      chapterNumber: 2,
    },
  ];

  for (const cs of starterCanvasStrokes) {
    await upsertDemoCanvasStroke({
      id: cs.id,
      roomId: targetRoom.id,
      userId: cs.user.id,
      reflection: cs.reflection,
      strokeJson: { points: cs.points, color: cs.color, width: 5 },
      worldSpec: deriveSensoryWorldSpec(cs.reflection, cs.color),
      chapterNumber: cs.chapterNumber ?? 1,
    });
  }
}

export async function seedQuestsIfEmpty(): Promise<void> {
  // Refresh legacy abstract demo prompts in-place so existing DBs get concrete everyday questions
  const existingPrompts = await getAllPrompts();
  for (const p of existingPrompts) {
    if (p.id.startsWith('demo_prm_') && LEGACY_DEMO_PROMPT_SNIPPETS.some((s) => p.text.includes(s))) {
      const idx = Number(p.id.replace('demo_prm_', '')) - 10;
      const replacement = SENSORY_PROMPTS.find((sp) => sp.daysAgo === idx);
      if (replacement) {
        await upsertPrompt(p.promptDate, replacement.text, replacement.focus, p.id);
      }
    }
  }

  // Also ensure today has one of the concrete prompts if none exists or if it's still a legacy demo snippet
  const todayStr = dateOffsetIso(0);
  const todayPrompt = existingPrompts.find((p) => p.promptDate === todayStr);
  if (!todayPrompt) {
    await upsertPrompt(todayStr, SENSORY_PROMPTS[0].text, SENSORY_PROMPTS[0].focus, 'demo_prm_10');
  } else if (LEGACY_DEMO_PROMPT_SNIPPETS.some((s) => todayPrompt.text.includes(s))) {
    await upsertPrompt(todayStr, SENSORY_PROMPTS[0].text, SENSORY_PROMPTS[0].focus, todayPrompt.id);
  }

  await syncLegacyQuestsToTemplates();

  const rooms = await getAllRooms();

  // Migrate unplayed default CEDAR-402 from old Stage 2 seed back to Stage 1 campfire start,
  // while placing the Stage 2 showcase (with Stage 1 drawing archived) in GREENHOUSE.
  const cedarRoom = rooms.find((r) => r.code === 'CEDAR-402');
  const greenhouseRoom = rooms.find((r) => r.code === 'GREENHOUSE');
  if (cedarRoom && greenhouseRoom) {
    const [cedarQuests, ghQuests] = await Promise.all([
      getRoomQuests(cedarRoom.id),
      getRoomQuests(greenhouseRoom.id),
    ]);
    const cedarIsOldSeed =
      cedarQuests.length === 2 &&
      cedarQuests[0]?.status === 'completed' &&
      cedarQuests[1]?.status === 'active' &&
      cedarQuests[1]?.currentAnswers === 1 &&
      cedarQuests[1]?.currentStrokes === 1;
    const ghIsFreshStage1 =
      ghQuests.length <= 1 && (ghQuests[0]?.currentAnswers ?? 0) === 0 && (ghQuests[0]?.currentStrokes ?? 0) === 0;
    if (cedarIsOldSeed && ghIsFreshStage1) {
      const resetCedar = await resetDemoRoomQuestsIfUnplayed(cedarRoom.id);
      if (resetCedar) {
        await resetDemoRoomQuestsIfUnplayed(greenhouseRoom.id);
      }
    }
  }

  for (const room of rooms) {
    const existing = await getRoomQuests(room.id);
    if (existing.length > 0) continue;

    if (room.code === 'GREENHOUSE') {
      const ch1 = WORLD_CHAPTER_TEMPLATES[0];
      const ch2 = WORLD_CHAPTER_TEMPLATES[1];
      await insertRoomQuest({
        roomId: room.id,
        chapterNumber: ch1.chapterNumber,
        title: ch1.title,
        questionPrompt: ch1.questionPrompt,
        drawingPrompt: ch1.drawingPrompt,
        targetAnswers: ch1.targetAnswers,
        targetStrokes: ch1.targetStrokes,
        currentAnswers: ch1.targetAnswers,
        currentStrokes: ch1.targetStrokes,
        status: 'completed',
        unlockedBiome: ch1.unlockedBiome,
        completedAt: new Date(Date.now() - 86400_000).toISOString(),
      });
      await insertRoomQuest({
        roomId: room.id,
        chapterNumber: ch2.chapterNumber,
        title: ch2.title,
        questionPrompt: ch2.questionPrompt,
        drawingPrompt: ch2.drawingPrompt,
        targetAnswers: ch2.targetAnswers,
        targetStrokes: ch2.targetStrokes,
        currentAnswers: 1,
        currentStrokes: 1,
        status: 'active',
        unlockedBiome: ch2.unlockedBiome,
      });
    } else {
      const ch1 = WORLD_CHAPTER_TEMPLATES[0];
      await insertRoomQuest({
        roomId: room.id,
        chapterNumber: ch1.chapterNumber,
        title: ch1.title,
        questionPrompt: ch1.questionPrompt,
        drawingPrompt: ch1.drawingPrompt,
        targetAnswers: ch1.targetAnswers,
        targetStrokes: ch1.targetStrokes,
        currentAnswers: 0,
        currentStrokes: 0,
        status: 'active',
        unlockedBiome: ch1.unlockedBiome,
      });
    }
  }

  if (greenhouseRoom) {
    await seedCanvasStrokesIfEmpty(greenhouseRoom.id);
  }
}

// Allow running directly via `npx tsx src/server/seed.ts`
const isDirectRun = process.argv[1] && process.argv[1].endsWith('seed.ts');
if (isDirectRun) {
  import('./db').then(async ({ initDatabase }) => {
    await initDatabase();
    const res = await seedDemoDataIfEmpty(true);
    console.log(`Seed complete: seeded=${res.seeded}, entries=${res.count}`);
    process.exit(0);
  });
}
