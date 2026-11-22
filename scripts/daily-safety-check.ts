import dotenv from 'dotenv';
import { noteHasPersonalData, runDailySafetyCheck, textHasClinicalLanguage } from '../src/server/dailySafety';
import { initDatabase } from '../src/server/db';

dotenv.config();

if (!textHasClinicalLanguage('please diagnose this')) {
  throw new Error('clinical check missed a blocked phrase');
}
if (!noteHasPersonalData('my name is Pat and I am 8')) {
  throw new Error('personal-data check missed a note');
}

await initDatabase();
const recap = await runDailySafetyCheck();
if (textHasClinicalLanguage(recap.summary) || noteHasPersonalData(recap.summary)) {
  throw new Error('stored recap used blocked wording');
}
process.stdout.write(`${recap.passed ? 'pass' : 'fail'}\n${recap.summary}\n${recap.runDate}\n`);
