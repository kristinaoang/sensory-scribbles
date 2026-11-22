import fs from 'fs';
import net from 'net';
import path from 'path';
import tls from 'tls';
import { buildCampusView, parseCampusCatalog } from '../campus/unlockState';
import { getCampusWanderChoice, getUserRoomStreak, latestEntrySentence, listUserQuestIds } from './db';

export function mailSettings() {
  const host = process.env.SMTP_HOST?.trim() || '';
  const port = Number(process.env.SMTP_PORT || '');
  const user = process.env.SMTP_USER?.trim() || '';
  const pass = process.env.SMTP_PASS ?? '';
  const from = process.env.MAIL_FROM?.trim() || '';
  const to = process.env.PARENT_EMAIL?.trim() || '';
  const configured = Boolean(host && Number.isFinite(port) && port > 0 && user && pass && from && to);
  return { host, port, user, pass, from, to, configured };
}

function readCatalog() {
  const file = path.resolve(process.cwd(), 'content/area-unlocks.json');
  const parsed = parseCampusCatalog(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (!parsed) throw new Error('Campus catalog is missing.');
  return parsed;
}

export async function buildParentRecap(userId: string, roomId: string): Promise<string> {
  const catalog = readCatalog();
  const [questIds, choice, streak, lastSentence] = await Promise.all([
    listUserQuestIds(roomId, userId),
    getCampusWanderChoice(roomId, userId),
    getUserRoomStreak(userId, roomId),
    latestEntrySentence(userId, roomId),
  ]);
  const view = buildCampusView(catalog, questIds, choice);
  const days = streak.currentStreak;
  const dayWord = days === 1 ? 'day' : 'days';
  const areas = view.openAreaNames.length > 0 ? view.openAreaNames.join(', ') : 'Arrival Green';
  const lastPrompt = lastSentence?.trim() || view.prompt || 'The campus is open.';
  return [
    'Practice recap',
    `Streak: ${days} ${dayWord}.`,
    `Areas: ${areas}.`,
    `Last prompt: ${lastPrompt}`,
  ].join('\n');
}

function smtpCommand(socket: net.Socket | tls.TLSSocket, line: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const onData = (buf: Buffer) => {
      chunks.push(buf);
      const text = Buffer.concat(chunks).toString('utf8');
      if (/^\d{3} /.m.test(text)) {
        socket.off('data', onData);
        socket.off('error', onError);
        resolve(text.trim());
      }
    };
    const onError = (err: Error) => {
      socket.off('data', onData);
      reject(err);
    };
    socket.on('data', onData);
    socket.on('error', onError);
    socket.write(`${line}\r\n`);
  });
}

export async function sendParentRecap(body: string): Promise<{ sent: boolean; configured: boolean; message: string }> {
  const mail = mailSettings();
  if (!mail.configured) {
    return { sent: false, configured: false, message: 'mail is not configured' };
  }
  const socket = await new Promise<net.Socket | tls.TLSSocket>((resolve, reject) => {
    const onError = (err: Error) => reject(err);
    if (mail.port === 465) {
      const secure = tls.connect({ host: mail.host, port: mail.port, servername: mail.host }, () => resolve(secure));
      secure.once('error', onError);
      return;
    }
    const plain = net.connect({ host: mail.host, port: mail.port }, () => resolve(plain));
    plain.once('error', onError);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('data', () => resolve());
      socket.once('error', reject);
    });
    await smtpCommand(socket, `EHLO sensory-scribbles`);
    const auth = Buffer.from('\0' + mail.user + '\0' + mail.pass).toString('base64');
    await smtpCommand(socket, `AUTH PLAIN ${auth}`);
    await smtpCommand(socket, `MAIL FROM:<${mail.from}>`);
    await smtpCommand(socket, `RCPT TO:<${mail.to}>`);
    await smtpCommand(socket, 'DATA');
    const message = [
      `From: ${mail.from}`,
      `To: ${mail.to}`,
      'Subject: Practice recap',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
      '.',
    ].join('\r\n');
    const accepted = await smtpCommand(socket, message);
    await smtpCommand(socket, 'QUIT');
    if (!accepted.startsWith('250')) {
      return { sent: false, configured: true, message: 'The mail server did not accept the recap.' };
    }
    return { sent: true, configured: true, message: 'The recap was sent.' };
  } finally {
    socket.end();
  }
}
