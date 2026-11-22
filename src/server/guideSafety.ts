const BANNED = [
  'diagnosis',
  'diagnose',
  'deficit',
  'disorder',
  'autism',
  'adhd',
  'symptom',
  'therapy',
  'therapist',
  'assessment',
  'impairment',
  'disability',
  'trauma',
  'anxiety',
  'depression',
  'suicidal',
  'suicide',
  'self-harm',
  'abuse',
  'scary',
  'monster',
  'ghost',
  'nightmare',
  'blood',
  'kill',
  'killing',
  'death',
  'weapon',
  'gun',
  'stupid',
  'dumb',
  'idiot',
];

const PERSONAL =
  /\b(your name|how old|your age|where (do )?you live|your address|your school|phone number|send (me |a )?photo|take a (photo|picture)|what school)\b/i;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function containsBanned(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED.some((word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower));
}

export function asksPersonal(text: string): boolean {
  return PERSONAL.test(text);
}

export function acceptableChildLine(text: string, maxWords: number): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (wordCount(trimmed) > maxWords) return false;
  if (trimmed.length > 180) return false;
  if (containsBanned(trimmed) || asksPersonal(trimmed)) return false;
  return true;
}

export function helpUsageLine(thisWeek: number, earlierWeeks: number): string {
  if (thisWeek === 0 && earlierWeeks === 0) return 'Help has not been used yet.';
  const weekWord = thisWeek === 1 ? 'time' : 'times';
  const earlierWord = earlierWeeks === 1 ? 'time' : 'times';
  return `Help was used ${thisWeek} ${weekWord} this week. In earlier weeks, help was used ${earlierWeeks} ${earlierWord}.`;
}

export function cannedAnimalLine(kind: string): { reply: string; suggestDraw: boolean } {
  const lines: Record<string, string> = {
    dog: 'The campus dog wags a slow hello. Want to draw those soft ears?',
    duck: 'The duck glides in a bright line. Want to draw the water?',
    deer: 'The deer stands quiet in the grass. Want to draw it?',
    squirrel: 'The squirrel flicks a busy tail. Want to draw that?',
    rabbit: 'The rabbit sits soft and still. Want to draw it?',
    fox: 'The fox steps lightly on the path. Want to draw it?',
    raccoon: 'The raccoon peeks around a tree. Want to draw it?',
    bird: 'The bird draws a small loop in the sky. Want to draw it?',
  };
  const reply = lines[kind] || 'What a gentle friend to meet. Want to draw what you see?';
  return { reply, suggestDraw: true };
}
