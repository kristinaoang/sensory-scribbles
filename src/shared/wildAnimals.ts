import type { WildAnimalSpec } from '../types';

export const POINTS_PER_PROMPT_ANSWER = 25;

export type PetToolId = 'pat' | 'scritch' | 'brush' | 'treat' | 'boop';

export interface PetToolSpec {
  id: PetToolId;
  label: string;
  reactionVerb: string;
  pointCost: number;
  blushBoost: number;
  affectionGain: number;
}

export const PET_TOOLS: PetToolSpec[] = [
  { id: 'pat', label: 'Pat Head', reactionVerb: 'leans happily into your gentle head pat', pointCost: 5, blushBoost: 0.42, affectionGain: 15 },
  { id: 'brush', label: 'Brush Coat', reactionVerb: 'relaxes into a cozy slow sway as you brush it', pointCost: 8, blushBoost: 0.55, affectionGain: 20 },
  { id: 'scritch', label: 'Ear Scritch', reactionVerb: 'tilts its head and wiggles with happy ear scritches', pointCost: 10, blushBoost: 0.65, affectionGain: 22 },
  { id: 'boop', label: 'Boop Nose', reactionVerb: 'gives a tiny startled bounce and blushes bright pink', pointCost: 12, blushBoost: 0.92, affectionGain: 24 },
  { id: 'treat', label: 'Give Treat', reactionVerb: 'hops excitedly for a warm berry & biscuit treat', pointCost: 15, blushBoost: 0.72, affectionGain: 25 },
];

export const WILD_ANIMALS_CATALOG: WildAnimalSpec[] = [
  // Wave 1: Level 3+
  {
    key: 'blue_crest_bird',
    species: 'bird',
    name: 'Skycrest Bluejay',
    unlockLevel: 3,
    visualSummary: 'A bright sky-blue songbird with a pointed blue head crest, snowy white chest, black collar band, and yellow beak.',
    visualTraits: [
      'bright sky-blue feathers and wings',
      'pointed blue crest on top of its head',
      'white belly/chest and black collar stripe',
      'warm yellow beak and dark tail tips',
    ],
    palette: {
      primary: '#3B82C6',
      secondary: '#F5F7FA',
      detail: '#1E293B',
      accent: '#F2B84B',
    },
    homePos: { x: 2.3, z: -4.4 },
  },
  {
    key: 'russet_squirrel',
    species: 'squirrel',
    name: 'Acorn Red Squirrel',
    unlockLevel: 3,
    visualSummary: 'A cinnamon-red squirrel with a cream belly, tufted ears, and a big curled fluffy tail, holding a brown acorn.',
    visualTraits: [
      'warm cinnamon-red / chestnut-orange fur',
      'cream-white belly',
      'big fluffy curled tail',
      'pointed tufted ears and small brown acorn',
    ],
    palette: {
      primary: '#C05A2B',
      secondary: '#F5E6CF',
      detail: '#6E3B1E',
      accent: '#D99B43',
    },
    homePos: { x: -5.4, z: 1.8 },
  },
  {
    key: 'bandit_raccoon',
    species: 'raccoon',
    name: 'Mask-Eyed Raccoon',
    unlockLevel: 3,
    visualSummary: 'A silvery-grey raccoon wearing a black bandit mask across its eyes, a white snout, and a fluffy dark-ringed tail.',
    visualTraits: [
      'silvery-grey fur coat',
      'black bandit mask across its eyes',
      'white snout and ear tips',
      'fluffy tail with dark black/brown stripes or rings',
    ],
    palette: {
      primary: '#7D8594',
      secondary: '#F2F4F8',
      detail: '#1F242D',
      accent: '#4B5260',
    },
    homePos: { x: 2.8, z: 4.5 },
  },

  // Wave 2: Level 6+
  {
    key: 'ginger_cat',
    species: 'cat',
    name: 'Marmalade Tabby Cat',
    unlockLevel: 6,
    visualSummary: 'An orange tabby cat with a cream chin, four white-dipped paws, triangular pink-lined ears, and a curved striped tail.',
    visualTraits: [
      'warm orange / ginger fur',
      'white-dipped paws and cream muzzle/chest',
      'upright triangular ears with pink inside',
      'curved striped tail',
    ],
    palette: {
      primary: '#E5883A',
      secondary: '#FFF5E6',
      detail: '#F4A6B8',
      accent: '#B4531A',
    },
    homePos: { x: -4.8, z: 5.4 },
  },
  {
    key: 'golden_dog',
    species: 'dog',
    name: 'Meadow Shepherd Dog',
    unlockLevel: 6,
    visualSummary: 'A golden-tan dog with floppy chocolate-brown ears, a cream chest patch, a red collar with a gold tag, and a wagging tail.',
    visualTraits: [
      'golden-tan / honey coat',
      'floppy chocolate-brown ears',
      'cream chest patch and wagging tail',
      'red collar with a gold tag',
    ],
    palette: {
      primary: '#D9A154',
      secondary: '#F9EED7',
      detail: '#5C3A21',
      accent: '#C94A4A',
    },
    homePos: { x: 3.4, z: -5.8 },
  },

  // Wave 3: Level 9+
  {
    key: 'crimson_cardinal',
    species: 'bird',
    name: 'Ruby Cardinal',
    unlockLevel: 9,
    visualSummary: 'A crimson-red bird with a tall pointed crest, black face mask around a golden-orange beak, and darker ruby wings.',
    visualTraits: [
      'bright crimson-red feathers',
      'tall pointed red crest',
      'black face mask around eyes and beak',
      'orange-gold beak',
    ],
    palette: {
      primary: '#C93636',
      secondary: '#8F1D22',
      detail: '#1E2430',
      accent: '#F59E0B',
    },
    homePos: { x: 8.8, z: 4.8 },
  },
  {
    key: 'spotted_pup',
    species: 'dog',
    name: 'Clover Spot Pup',
    unlockLevel: 9,
    visualSummary: 'A cream-white dog dotted with charcoal spots, floppy black ears, a bright teal collar, and an upright wagging tail.',
    visualTraits: [
      'cream-white coat with dark black/charcoal spots',
      'floppy black ears',
      'bright teal/turquoise collar',
      'upright wagging tail',
    ],
    palette: {
      primary: '#F4EFE4',
      secondary: '#262B34',
      detail: '#262B34',
      accent: '#2B9C8F',
    },
    homePos: { x: -8.6, z: 7.4 },
  },

  // Wave 4: Level 12+
  {
    key: 'calico_cat',
    species: 'cat',
    name: 'Patchwork Calico Cat',
    unlockLevel: 12,
    visualSummary: 'A snowy white cat with warm orange and dark charcoal patches, upright triangular ears, a pink nose, and a tipped tail.',
    visualTraits: [
      'white coat with orange and dark charcoal patches',
      'upright triangular ears',
      'little pink nose',
      'dark-and-orange tipped curved tail',
    ],
    palette: {
      primary: '#FAF7F0',
      secondary: '#E27D3B',
      detail: '#343A46',
      accent: '#F4A6B8',
    },
    homePos: { x: 1.6, z: 11.4 },
  },
  {
    key: 'silver_squirrel',
    species: 'squirrel',
    name: 'Mistwood Grey Squirrel',
    unlockLevel: 12,
    visualSummary: 'A soft slate-grey squirrel with a snowy white belly, dark button eyes, and an oversized plumed silver-grey tail.',
    visualTraits: [
      'soft slate-grey / silver fur',
      'snowy white underside/belly',
      'oversized plumed fluffy silver tail',
      'pointed ears and acorn snack',
    ],
    palette: {
      primary: '#8A94A3',
      secondary: '#F4F7FA',
      detail: '#464F5E',
      accent: '#C89B54',
    },
    homePos: { x: -6.8, z: -11.5 },
  },
  {
    key: 'rusty_raccoon',
    species: 'raccoon',
    name: 'Amber-Ring Raccoon',
    unlockLevel: 12,
    visualSummary: 'A warm taupe-brown raccoon with a dark mask across its eyes, pale cream cheeks, and an amber-and-charcoal ringed tail.',
    visualTraits: [
      'warm taupe-brown coat',
      'dark eye mask and pale cream cheeks',
      'dark charcoal-and-amber ringed tail',
      'upright rounded ears',
    ],
    palette: {
      primary: '#8B6F56',
      secondary: '#F5EBD9',
      detail: '#26211E',
      accent: '#C48B4A',
    },
    homePos: { x: 8.4, z: -9.6 },
  },
];

// Additional wildlife spawned 1-for-1 with every journal entry written by room members
export const JOURNAL_BONUS_ANIMALS: WildAnimalSpec[] = [
  {
    key: 'journal_canary_bird',
    species: 'bird',
    name: 'Sunbeam Canary',
    unlockLevel: 1,
    visualSummary: 'A cheerful butter-yellow bird with a snowy cream chest, tiny slate collar band, and bright orange beak.',
    visualTraits: [
      'bright butter-yellow feathers',
      'snowy cream chest',
      'tiny dark slate collar ring',
      'warm orange-gold beak',
    ],
    palette: {
      primary: '#F3C94B',
      secondary: '#FFF9E6',
      detail: '#334155',
      accent: '#EA7B2A',
    },
    homePos: { x: 1.8, z: 1.5 },
  },
  {
    key: 'journal_tuxedo_cat',
    species: 'cat',
    name: 'Velvet Tuxedo Cat',
    unlockLevel: 1,
    visualSummary: 'A sleek midnight-black cat with snowy white dipped paws, a crisp white chest bib, pink nose, and curved white-tipped tail.',
    visualTraits: [
      'midnight-black coat',
      'snowy white chest and white-dipped paws',
      'little pink nose and inner ears',
      'white-tipped curved tail',
    ],
    palette: {
      primary: '#2A2F3D',
      secondary: '#F8FAFC',
      detail: '#F4A6B8',
      accent: '#F4A6B8',
    },
    homePos: { x: -2.0, z: 1.2 },
  },
  {
    key: 'journal_cinnamon_pup',
    species: 'dog',
    name: 'Maple Corgi Pup',
    unlockLevel: 1,
    visualSummary: 'A warm honey-brown pup with a cream chest, floppy dark-caramel ears, and a leafy green collar with gold tag.',
    visualTraits: [
      'warm honey-brown / caramel coat',
      'cream chest patch',
      'floppy dark-caramel ears',
      'leafy green collar with gold tag',
    ],
    palette: {
      primary: '#C97A40',
      secondary: '#FAF0DC',
      detail: '#5B3418',
      accent: '#2E7D5B',
    },
    homePos: { x: 2.1, z: -1.3 },
  },
  {
    key: 'journal_chestnut_squirrel',
    species: 'squirrel',
    name: 'Hazelwood Squirrel',
    unlockLevel: 1,
    visualSummary: 'A warm hazelnut-brown squirrel with a pale vanilla belly, dark ear tufts, and a golden-brown acorn.',
    visualTraits: [
      'warm hazelnut-brown fur',
      'pale vanilla belly',
      'curled fluffy tail and tufted ears',
      'golden-brown acorn',
    ],
    palette: {
      primary: '#8E5836',
      secondary: '#F8EEDB',
      detail: '#3E2414',
      accent: '#D8A24A',
    },
    homePos: { x: -2.1, z: -1.6 },
  },
  {
    key: 'journal_moss_raccoon',
    species: 'raccoon',
    name: 'Pebble Mask Raccoon',
    unlockLevel: 1,
    visualSummary: 'A cool blue-grey raccoon with a dark mask across its eyes, white muzzle, and crisp striped tail rings.',
    visualTraits: [
      'cool blue-grey coat',
      'dark eye mask and white muzzle',
      'striped ringed tail',
      'dark rounded ears with pale tips',
    ],
    palette: {
      primary: '#6B7C93',
      secondary: '#F1F5F9',
      detail: '#1E2430',
      accent: '#475569',
    },
    homePos: { x: 0.4, z: 2.5 },
  },
  {
    key: 'journal_lavender_bird',
    species: 'bird',
    name: 'Lilac Starling',
    unlockLevel: 1,
    visualSummary: 'A soft lavender-plum songbird with a pearl-white chest, dark crest band, and golden beak.',
    visualTraits: [
      'soft lavender-plum feathers',
      'pearl-white chest',
      'pointed crest and dark collar stripe',
      'golden-yellow beak',
    ],
    palette: {
      primary: '#8B6BB7',
      secondary: '#F6F3FA',
      detail: '#2B2440',
      accent: '#F2B84B',
    },
    homePos: { x: -2.4, z: 0.2 },
  },
  {
    key: 'journal_cream_cat',
    species: 'cat',
    name: 'Chamomile Cream Cat',
    unlockLevel: 1,
    visualSummary: 'A soft buttercream cat with snowy white paws, rosy pink inner ears, and a gentle curved cream tail.',
    visualTraits: [
      'soft buttercream / pale beige fur',
      'snowy white paws and chest',
      'rosy pink inner ears',
      'curved cream-tipped tail',
    ],
    palette: {
      primary: '#E6CFA8',
      secondary: '#FFFDF8',
      detail: '#F4A6B8',
      accent: '#C49A6C',
    },
    homePos: { x: 2.4, z: 0.4 },
  },
  {
    key: 'journal_navy_dog',
    species: 'dog',
    name: 'Harbor Hound',
    unlockLevel: 1,
    visualSummary: 'A warm chocolate-sable dog with cream chest fur, deep espresso floppy ears, and a bright sky-blue collar.',
    visualTraits: [
      'chocolate-sable brown coat',
      'cream chest fur',
      'deep espresso floppy ears',
      'bright sky-blue collar with gold tag',
    ],
    palette: {
      primary: '#7D5135',
      secondary: '#F5EAD8',
      detail: '#2B1B12',
      accent: '#3B82C6',
    },
    homePos: { x: -1.4, z: 2.3 },
  },
];

const EXTRA_SPECIES_CYCLE: WildAnimalSpec['species'][] = ['bird', 'cat', 'dog', 'squirrel', 'raccoon'];
const EXTRA_ADJECTIVES = ['Meadow', 'Willow', 'Bramble', 'Pebble', 'Clover', 'Amber', 'Cedar', 'Heather'];
const EXTRA_PALETTES = [
  { name: 'warm terracotta', primary: '#C4684B', secondary: '#FAF2E4', detail: '#3D2620', accent: '#EAB308' },
  { name: 'soft sage-grey', primary: '#6B8B7B', secondary: '#F4F7F4', detail: '#24332C', accent: '#E07A5F' },
  { name: 'warm caramel', primary: '#B87D4B', secondary: '#FDF6E9', detail: '#452A17', accent: '#2B7CB3' },
  { name: 'slate-indigo', primary: '#5B6C8F', secondary: '#F2F5FA', detail: '#1E2538', accent: '#F2B84B' },
];

function buildExtraJournalAnimal(oneBasedIdx: number): WildAnimalSpec {
  const offset = oneBasedIdx - JOURNAL_BONUS_ANIMALS.length - 1;
  const species = EXTRA_SPECIES_CYCLE[offset % EXTRA_SPECIES_CYCLE.length];
  const adj = EXTRA_ADJECTIVES[offset % EXTRA_ADJECTIVES.length];
  const pal = EXTRA_PALETTES[Math.floor(offset / EXTRA_ADJECTIVES.length) % EXTRA_PALETTES.length];
  const angle = oneBasedIdx * 2.39996;
  const r = 2.0 + (offset % 6) * 0.75;
  const speciesTitle = species.charAt(0).toUpperCase() + species.slice(1);
  return {
    key: `journal_extra_${oneBasedIdx}`,
    species,
    name: `${adj} ${speciesTitle} #${oneBasedIdx}`,
    unlockLevel: 1,
    visualSummary: `A ${pal.name} ${species} with cream highlights, dark accents, and bright details.`,
    visualTraits: [
      `${pal.name} coat or feathers`,
      'cream chest/belly highlights',
      `distinctive ${species} ears/crest and tail`,
    ],
    palette: {
      primary: pal.primary,
      secondary: pal.secondary,
      detail: pal.detail,
      accent: pal.accent,
    },
    homePos: {
      x: Number((Math.cos(angle) * r).toFixed(2)),
      z: Number((Math.sin(angle) * r).toFixed(2)),
    },
  };
}

function buildExtraWaveAnimal(unlockLevel: number, slot: number): WildAnimalSpec {
  const waveNum = Math.floor(unlockLevel / 3);
  const idx = waveNum * 2 + slot;
  const species = EXTRA_SPECIES_CYCLE[idx % EXTRA_SPECIES_CYCLE.length];
  const adj = EXTRA_ADJECTIVES[(idx + waveNum) % EXTRA_ADJECTIVES.length];
  const pal = EXTRA_PALETTES[idx % EXTRA_PALETTES.length];
  const angle = unlockLevel * 1.3 + slot * 2.2;
  const r = 6.5 + waveNum * 1.8;
  const speciesTitle = species.charAt(0).toUpperCase() + species.slice(1);
  return {
    key: `wave_${unlockLevel}_${slot}`,
    species,
    name: `${adj} Horizon ${speciesTitle}`,
    unlockLevel,
    visualSummary: `A ${pal.name} ${species} with cream markings and bright ${species} accents.`,
    visualTraits: [
      `${pal.name} coat or feathers`,
      'cream chest/belly markings',
      `distinctive ${species} silhouette`,
    ],
    palette: {
      primary: pal.primary,
      secondary: pal.secondary,
      detail: pal.detail,
      accent: pal.accent,
    },
    homePos: {
      x: Number((Math.cos(angle) * r).toFixed(2)),
      z: Number((Math.sin(angle) * r).toFixed(2)),
    },
  };
}

export function getUnlockedWildAnimals(level: number, journalCount = 0): WildAnimalSpec[] {
  const safeLevel = Math.max(1, level);
  const waveAnimals = WILD_ANIMALS_CATALOG.filter((a) => safeLevel >= a.unlockLevel);
  const extraWaves: WildAnimalSpec[] = [];
  for (let lvl = 15; lvl <= safeLevel; lvl += 3) {
    extraWaves.push(buildExtraWaveAnimal(lvl, 0), buildExtraWaveAnimal(lvl, 1));
  }
  const safeJournals = Math.max(0, Math.floor(journalCount));
  const journalAnimals: WildAnimalSpec[] = [];
  for (let i = 1; i <= safeJournals; i++) {
    if (i <= JOURNAL_BONUS_ANIMALS.length) {
      journalAnimals.push(JOURNAL_BONUS_ANIMALS[i - 1]);
    } else {
      journalAnimals.push(buildExtraJournalAnimal(i));
    }
  }
  return [...journalAnimals, ...waveAnimals, ...extraWaves];
}

export function getJournalAnimalOrder(key: string): number | null {
  const idx = JOURNAL_BONUS_ANIMALS.findIndex((a) => a.key === key);
  if (idx >= 0) return idx + 1;
  const m = /^journal_extra_(\d+)$/.exec(key);
  if (m) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n > JOURNAL_BONUS_ANIMALS.length) return n;
  }
  return null;
}

export function getNextAnimalWaveLevel(level: number): number | null {
  const safeLevel = Math.max(1, level);
  const next = WILD_ANIMALS_CATALOG.find((a) => a.unlockLevel > safeLevel);
  if (next) return next.unlockLevel;
  return Math.floor(safeLevel / 3) * 3 + 3;
}

export function getWildAnimalByKey(key: string): WildAnimalSpec | undefined {
  const fromCatalog = WILD_ANIMALS_CATALOG.find((a) => a.key === key);
  if (fromCatalog) return fromCatalog;
  const fromJournal = JOURNAL_BONUS_ANIMALS.find((a) => a.key === key);
  if (fromJournal) return fromJournal;
  const m = /^journal_extra_(\d+)$/.exec(key);
  if (m) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n > JOURNAL_BONUS_ANIMALS.length) {
      return buildExtraJournalAnimal(n);
    }
  }
  const w = /^wave_(\d+)_(\d+)$/.exec(key);
  if (w) {
    const lvl = Number(w[1]);
    const slot = Number(w[2]);
    if (Number.isInteger(lvl) && lvl >= 15 && (slot === 0 || slot === 1)) {
      return buildExtraWaveAnimal(lvl, slot);
    }
  }
  return undefined;
}
