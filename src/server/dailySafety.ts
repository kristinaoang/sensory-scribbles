import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { containsBanned } from './guideSafety';
import { latestSafetyRecap, listTodayEntrySentences, saveSafetyRecap } from './db';

const EXTRA_BANNED = ['delay', 'at risk', 'benchmark', 'screening'];
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/;
const PERSONAL_NOTE =
  /\b(my name is|i am \d{1,2}|years old|my address|i live at|my school|phone number|my email)\b/i;

function hasBlockedLanguage(text: string): boolean {
  if (containsBanned(text)) return true;
  const lower = text.toLowerCase();
  return EXTRA_BANNED.some((phrase) => lower.includes(phrase));
}

function hasPersonalData(text: string): boolean {
  return EMAIL.test(text) || PHONE.test(text) || PERSONAL_NOTE.test(text);
}

function readPublicCopy(): string[] {
  const chunks: string[] = [];
  const indexFile = path.resolve(process.cwd(), 'index.html');
  if (fs.existsSync(indexFile)) chunks.push(fs.readFileSync(indexFile, 'utf8'));
  const publicDir = path.resolve(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    for (const name of fs.readdirSync(publicDir)) {
      if (!name.endsWith('.html')) continue;
      chunks.push(fs.readFileSync(path.join(publicDir, name), 'utf8'));
    }
  }
  const contentDir = path.resolve(process.cwd(), 'content');
  if (fs.existsSync(contentDir)) {
    for (const name of fs.readdirSync(contentDir)) {
      if (!name.endsWith('.json')) continue;
      chunks.push(fs.readFileSync(path.join(contentDir, name), 'utf8'));
    }
  }
  return chunks;
}

export async function runDailySafetyCheck(day = new Date().toISOString().slice(0, 10)): Promise<{
  passed: boolean;
  summary: string;
  runDate: string;
}> {
  const notes = await listTodayEntrySentences(day);
  const pages = readPublicCopy();
  const pageProblem = pages.some((text) => hasBlockedLanguage(text));
  const noteProblem = notes.some((text) => hasBlockedLanguage(text) || hasPersonalData(text));
  const passed = !pageProblem && !noteProblem;
  const summary = passed
    ? `Pass. Public pages and ${notes.length} note${notes.length === 1 ? '' : 's'} from ${day} stayed clear.`
    : `Fail. ${pageProblem ? 'A public page needs a rewrite. ' : ''}${noteProblem ? 'A note from today needs to come out.' : ''}`.trim();
  await saveSafetyRecap({
    id: crypto.randomUUID(),
    runDate: day,
    passed,
    summary,
    createdAt: new Date().toISOString(),
  });
  return { passed, summary, runDate: day };
}

export async function readLatestSafetyRecap() {
  return latestSafetyRecap();
}
