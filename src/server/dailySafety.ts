import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { containsBanned } from './guideSafety';
import { latestSafetyRecap, listTodayDemoSentences, saveSafetyRecap } from './db';

const EXTRA_CLINICAL = ['delay', 'at risk', 'benchmark', 'screening'];
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/;
const ADDRESS =
  /\b\d{1,5}\s+[A-Za-z0-9.'\s]{2,40}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl)\b/i;
const SCHOOL = /\b(?:school|preschool|kindergarten|elementary|classroom|homeroom)\b/i;
const AGE = /\b(?:\d{1,2}\s*[- ]?years?\s+old|years?\s+old|year[- ]old|age\s*(?:is|:)\s*\d{1,2}|i(?:'m| am)\s+\d{1,2})\b/i;
const NAME = /\b(?:my name is|i am named|i'm named)\s+[A-Za-z][a-z]{1,24}\b/;

function phraseHits(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

export function textHasClinicalLanguage(text: string): boolean {
  if (containsBanned(text)) return true;
  return EXTRA_CLINICAL.some((phrase) => phraseHits(text, phrase));
}

export function noteHasPersonalData(text: string): boolean {
  return EMAIL.test(text) || PHONE.test(text) || ADDRESS.test(text) || SCHOOL.test(text) || AGE.test(text) || NAME.test(text);
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

function reasonLine(pageProblem: boolean, noteProblem: boolean): string {
  if (!pageProblem && !noteProblem) return 'Pass. Public pages and today\'s demo notes are clear.';
  if (pageProblem && noteProblem) return 'Fail. A public page needs a rewrite, and a demo note needs to come out.';
  if (pageProblem) return 'Fail. A public page needs a rewrite.';
  return 'Fail. A demo note needs to come out.';
}

export async function runDailySafetyCheck(day = new Date().toISOString().slice(0, 10)): Promise<{
  passed: boolean;
  summary: string;
  runDate: string;
}> {
  const notes = await listTodayDemoSentences(day);
  const pages = readPublicCopy();
  const pageProblem = pages.some((text) => textHasClinicalLanguage(text));
  const noteProblem = notes.some((text) => textHasClinicalLanguage(text) || noteHasPersonalData(text));
  const passed = !pageProblem && !noteProblem;
  const summary = reasonLine(pageProblem, noteProblem);
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
