import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const root = process.cwd();
const narrationPath = path.join(root, 'content', 'narration.json');
const audioDir = path.join(root, 'public', 'audio');
const copyDir = path.resolve(root, '../wellesley-land/public/audio');

function writeWav(file: string, samples: Int16Array, sampleRate: number) {
  const header = Buffer.alloc(44);
  const data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

function writeAmbientLoop() {
  const sampleRate = 22050;
  const seconds = 16;
  const total = sampleRate * seconds;
  const samples = new Int16Array(total);
  const notes = [261.63, 329.63, 392.0, 523.25];
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    let sample = 0;
    notes.forEach((freq, index) => {
      const trem = 0.82 + 0.18 * Math.sin((Math.PI * 2 * t) / 8 + index);
      sample += Math.sin(Math.PI * 2 * freq * t) * trem * 0.08;
    });
    const pluckAt = (t % 4) / 4;
    const pluck = Math.sin(Math.PI * 2 * 523.25 * t) * Math.exp(-pluckAt * 6) * 0.12;
    sample += pluck;
    samples[i] = Math.max(-32767, Math.min(32767, Math.round(sample * 32767)));
  }
  fs.mkdirSync(audioDir, { recursive: true });
  writeWav(path.join(audioDir, 'ambient-lofi.wav'), samples, sampleRate);
  console.log('narration: wrote ambient-lofi.wav');
}

function pcmToWav(bytes: Buffer, sampleRate: number) {
  const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 2));
  const copy = new Int16Array(samples.length);
  copy.set(samples);
  const file = path.join(audioDir, 'tmp.wav');
  writeWav(file, copy, sampleRate);
  return fs.readFileSync(file);
}

async function synthesize(text: string, model: string, voice: string): Promise<Buffer | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || !model) return null;
  const ai = new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: { apiVersion: 'v1beta' },
  });
  const interaction = await ai.interactions.create({
    model,
    input: [
      {
        type: 'user_input',
        content: [
          {
            type: 'text',
            text,
            annotations: [{ type: 'speech_metadata', style: 'warm and friendly' }],
          },
        ],
      },
    ],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice }] },
  } as never);
  const audio = interaction.output_audio;
  if (!audio?.data) return null;
  const bytes = Buffer.from(audio.data, 'base64');
  if (bytes.slice(0, 4).toString('ascii') === 'RIFF') return bytes;
  const rate = audio.sample_rate || 24000;
  return pcmToWav(bytes, rate);
}

function copyAudio() {
  if (!fs.existsSync(copyDir)) return;
  for (const file of fs.readdirSync(audioDir)) {
    if (!file.endsWith('.wav')) continue;
    fs.copyFileSync(path.join(audioDir, file), path.join(copyDir, file));
  }
}

async function main() {
  writeAmbientLoop();
  const narration = JSON.parse(fs.readFileSync(narrationPath, 'utf8')) as { lines: Array<{ id: string; text: string }> };
  const model = process.env.GEMINI_TTS_MODEL?.trim() || '';
  const voice = process.env.GEMINI_TTS_VOICE?.trim() || '';
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || !model || !voice) {
    console.log('narration: text left in place, audio files not required to enter');
    copyAudio();
    return;
  }
  for (const line of narration.lines) {
    try {
      const wav = await synthesize(line.text, model, voice);
      if (!wav) {
        console.log(`narration: skipped ${line.id}`);
        continue;
      }
      fs.writeFileSync(path.join(audioDir, `${line.id}.wav`), wav);
      console.log(`narration: wrote ${line.id}.wav`);
    } catch {
      console.log(`narration: skipped ${line.id}`);
    }
  }
  try {
    fs.unlinkSync(path.join(audioDir, 'tmp.wav'));
  } catch {
    // no temp file
  }
  copyAudio();
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(0));
