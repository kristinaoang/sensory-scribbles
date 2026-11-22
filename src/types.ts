export interface StrokePoint {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
}

export interface StrokeData {
  points: StrokePoint[];
  color: string;
  width: number;
  paletteName?: string;
}

export interface SensoryWorldSpec {
  theme: 'silk_meadow' | 'velvet_grove' | 'denim_coast' | 'amber_hearth' | 'glass_rain' | 'moss_stone';
  moodColor: string;
  secondaryColor: string;
  skyTint: string;
  elementType: 'lantern' | 'tree' | 'crystal' | 'loom' | 'pond' | 'windmill';
  weather: 'sunbeams' | 'mist' | 'fireflies' | 'breeze';
  label: string;
  biome?: 'meadow' | 'pine_forest' | 'coastal_cove' | 'rain_garden' | 'amber_grove' | 'stone_ridge';
  flora?: 'peach_trees' | 'pine_trees' | 'birch_grove' | 'reeds_and_lilies' | 'wildflowers' | 'mossy_boulders';
  landmark?: 'wooden_cabin' | 'stone_lantern' | 'windmill' | 'tea_pavilion' | 'weaver_loom' | 'stepping_pond';
  timeOfDay?: 'morning' | 'afternoon' | 'golden_hour' | 'twilight';
  poeticSummary?: string;
}

export interface Room {
  id: string;
  code: string;
  inviteCode: string;
  name: string;
  solanaEnabled: boolean;
  createdAt: string;
}

export type AvatarHatStyle = 'explorer' | 'beanie' | 'wizard' | 'flower_crown' | 'none';
export type AvatarAccessory = 'scarf' | 'satchel' | 'cape' | 'none';

export interface AvatarCustomization {
  skinTone: string;
  tunicColor: string;
  hatStyle: AvatarHatStyle;
  hatColor: string;
  accessory: AvatarAccessory;
}

export interface AnonymousUser {
  id: string;
  displayName: string;
  avatarColor: string;
  createdAt: string;
}

export interface Prompt {
  id: string;
  promptDate: string; // YYYY-MM-DD
  text: string;
  sensoryFocus: string;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  roomId: string;
  userId: string;
  promptId: string;
  sentence: string;
  strokeJson: StrokeData;
  worldSpec: SensoryWorldSpec;
  createdAt: string;
  entryDate: string;
  flagged: boolean;
  moderationReason?: string | null;
  isDemo: boolean;
  solanaTx?: string | null;
  solanaHash?: string | null;
  questId?: string | null;
  // Joined fields for UI display
  authorDisplayName?: string;
  authorAvatarColor?: string;
  promptText?: string;
}

export interface NightlyCaption {
  id: string;
  roomId: string;
  captionDate: string;
  caption: string;
  entryCount: number;
  validated: boolean;
  createdAt: string;
}

export interface MinigameQuestion {
  id: string;
  roomId: string;
  entryId: string;
  questionDate: string;
  gameType: 'guess_prompt' | 'whose_is_it';
  questionText: string;
  options: string[];
  correctAnswer: string;
  isDemo: boolean;
  createdAt: string;
}

export interface MinigameEvent {
  id: string;
  userId: string;
  entryId: string;
  gameType: 'guess_prompt' | 'whose_is_it';
  correct: boolean;
  createdAt: string;
}

export interface WeeklyAccuracyBucket {
  weekStart: string;
  totalAttempts: number;
  correctCount: number;
  accuracyPct: number;
}

export interface DailyRoomCountBucket {
  day: string;
  roomId: string;
  entryCount: number;
}

export interface StreakDayStatus {
  date: string;
  active: boolean;
}

export interface UserRoomStreak {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  contributedToday: boolean;
  lastContributionDate: string | null;
  recentDays: StreakDayStatus[];
}


export interface CanvasStroke {
  id: string;
  roomId: string;
  userId: string;
  authorDisplayName: string;
  authorAvatarColor: string;
  reflection: string;
  strokeJson: StrokeData;
  worldSpec: SensoryWorldSpec;
  chapterNumber: number;
  flagged: boolean;
  isDemo: boolean;
  createdAt: string;
}

export interface CanvasPresenceUser {
  userId: string;
  displayName: string;
  avatarColor: string;
}

export interface RoomQuest {
  id: string;
  roomId: string;
  chapterNumber: number;
  title: string;
  questionPrompt: string;
  drawingPrompt: string;
  targetAnswers: number;
  targetStrokes: number;
  currentAnswers: number;
  currentStrokes: number;
  status: 'active' | 'completed';
  unlockedBiome: string;
  createdAt: string;
  completedAt: string | null;
}

export interface WorldProgressionState {
  level: number;
  stageName: string;
  unlockedBiomes: string[];
  activeQuest: RoomQuest;
  completedQuests: RoomQuest[];
  totalEntries: number;
  totalStrokes: number;
  lastExpandedAt: string | null;
}

export interface MosaicResponse {
  room: Room;
  date: string;
  prompt: Prompt | null;
  entries: JournalEntry[];
  caption: NightlyCaption | null;
  availableDates: string[];
  userSubmittedToday: boolean;
  progression?: WorldProgressionState;
}

export interface WorldStateResponse {
  room: Room;
  todayDate: string;
  prompt: Prompt | null;
  entries: JournalEntry[];
  todayEntries: JournalEntry[];
  strokes: CanvasStroke[];
  progression: WorldProgressionState;
  userSubmittedToday: boolean;
}

