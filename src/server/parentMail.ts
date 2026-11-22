import fs from 'fs';
import net from 'net';
import path from 'path';
import tls from 'tls';
import { buildCampusView, parseCampusCatalog } from '../campus/unlockState';
import {
  getCampusWanderChoice,
  getRoomByCode,
  getUserRoomStreak,
  latestEntryPrompt,
  listUserQuestIds,
} from './db';

export const DEMO_CHILD_USER_ID = 'demo_usr_1';
export const DEMO_CHILD_ROOM_CODE = 'CEDAR-402';

export function mailSettings() {
  const host = process.env.SMTP_HOST?.trim() || '';
  const port = Number(process.env.SMTP_PORT || '');
  const user = process.env.SMTP_USER?.trim() || '';
  const pass = process.env.SMTP_PASS ?? '';
  const from = process.env.MAIL_FROM?.trim() || '';
  const to = process.env.PARENT_EMAIL?.trim() || '';
  const configured = Boolean(host && Number.isFinite(port) && port > 0 && user && pass.trim() && from && to);
  return { host, port, user, pass, from, to, configured };
}

function readCatalog() {
  const file = path.resolve(process.cwd(), 'content/area-unlocks.json');
  const parsed = parseCampusCatalog(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (!parsed) throw new Error('Campus catalog is missing.');
  return parsed;
}

export async function buildParentRecap(): Promise<string> {
  const catalog = readCatalog();
  const room = await getRoomByCode(DEMO_CHILD_ROOM_CODE);
  let openNames = catalog.areas.slice(0, 1).map((area) => area.name);
  let days = 0;
  let lastPrompt = catalog.areas[0]?.prompt || 'The campus is open.';
  if (room) {
    const [questIds, choice, streak, prompt] = await Promise.all([
      listUserQuestIds(room.id, DEMO_CHILD_USER_ID),
      getCampusWanderChoice(room.id, DEMO_CHILD_USER_ID),
      getUserRoomStreak(DEMO_CHILD_USER_ID, room.id),
      latestEntryPrompt(DEMO_CHILD_USER_ID, room.id),
    ]);
    const view = buildCampusView(catalog, questIds, choice);
    openNames = view.openAreaNames;
    days = streak.currentStreak;
    lastPrompt = prompt || view.prompt || lastPrompt;
  }
  const dayWord = days === 1 ? 'day' : 'days';
  const areas = openNames.length > 0 ? openNames.join(', ') : 'none yet';
  return ['Demo child', `Streak: ${days} ${dayWord}.`, `Open areas: ${areas}.`, `Last prompt: ${lastPrompt}`].join('\n');
}

class SmtpReader {
  private buffer = '';
  private waiters: Array<(value: string) => void> = [];

  constructor(private socket: net.Socket) {
    socket.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf8');
      this.flush();
    });
  }

  private flush() {
    while (this.waiters.length > 0) {
      const reply = takeReply(this.buffer);
      if (!reply) return;
      this.buffer = this.buffer.slice(reply.length);
      const resolve = this.waiters.shift();
      resolve?.(reply.trim());
    }
  }

  read(): Promise<string> {
    return new Promise((resolve, reject) => {
      const onError = () => {
        this.socket.off('error', onError);
        reject(new Error('smtp'));
      };
      this.socket.once('error', onError);
      this.waiters.push((value) => {
        this.socket.off('error', onError);
        resolve(value);
      });
      this.flush();
    });
  }

  async command(line: string): Promise<string> {
    this.socket.write(`${line}\r\n`);
    const reply = await this.read();
    if (!/^[123]\d{2}/.test(reply)) throw new Error('smtp');
    return reply;
  }
}

function takeReply(buffer: string): string | null {
  let offset = 0;
  while (offset < buffer.length) {
    const nextBreak = buffer.indexOf('\n', offset);
    if (nextBreak < 0) return null;
    const line = buffer.slice(offset, nextBreak).replace(/\r$/, '');
    const consumed = nextBreak + 1;
    if (/^\d{3} /.test(line)) return buffer.slice(0, consumed);
    if (line.length > 0 && !/^\d{3}-/.test(line)) return null;
    offset = consumed;
  }
  return null;
}

function connectSocket(host: string, port: number, secure: boolean): Promise<net.Socket | tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const onError = () => reject(new Error('smtp'));
    if (secure) {
      const socket = tls.connect({ host, port, servername: host }, () => resolve(socket));
      socket.once('error', onError);
      return;
    }
    const socket = net.connect({ host, port }, () => resolve(socket));
    socket.once('error', onError);
  });
}

function upgradeTls(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  socket.removeAllListeners('data');
  socket.removeAllListeners('error');
  return new Promise((resolve, reject) => {
    const secure = tls.connect({ socket, servername: host }, () => resolve(secure));
    secure.once('error', () => reject(new Error('smtp')));
  });
}

export async function sendParentRecap(body: string): Promise<{ sent: boolean; configured: boolean; message: string }> {
  const mail = mailSettings();
  if (!mail.configured) {
    return { sent: false, configured: false, message: 'mail is not configured' };
  }
  let socket: net.Socket | tls.TLSSocket | null = null;
  try {
    socket = await connectSocket(mail.host, mail.port, mail.port === 465);
    socket.setTimeout(10000, () => socket?.destroy());
    let reader = new SmtpReader(socket);
    await reader.read();
    const hello = await reader.command('EHLO sensory-scribbles');
    if (mail.port !== 465 && /STARTTLS/i.test(hello)) {
      await reader.command('STARTTLS');
      socket = await upgradeTls(socket as net.Socket, mail.host);
      socket.setTimeout(10000, () => socket?.destroy());
      reader = new SmtpReader(socket);
      await reader.command('EHLO sensory-scribbles');
    }
    const auth = Buffer.from(`\0${mail.user}\0${mail.pass}`).toString('base64');
    await reader.command(`AUTH PLAIN ${auth}`);
    await reader.command(`MAIL FROM:<${mail.from}>`);
    await reader.command(`RCPT TO:<${mail.to}>`);
    await reader.command('DATA');
    const accepted = await reader.command(
      [`From: ${mail.from}`, `To: ${mail.to}`, 'Subject: Practice recap', 'Content-Type: text/plain; charset=utf-8', '', body, '.'].join(
        '\r\n',
      ),
    );
    await reader.command('QUIT');
    if (!accepted.startsWith('250')) {
      return { sent: false, configured: true, message: 'The recap was not sent.' };
    }
    return { sent: true, configured: true, message: 'The recap was sent.' };
  } catch {
    return { sent: false, configured: true, message: 'The recap was not sent.' };
  } finally {
    socket?.end();
  }
}
