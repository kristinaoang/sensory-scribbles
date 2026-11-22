import crypto from 'crypto';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export interface SolanaAnchorResult {
  anchored: boolean;
  entryHash: string;
  txSignature: string | null;
  network: 'devnet';
  statusNote: string;
}

/**
 * Computes a privacy-preserving SHA-256 hash using ONLY the entry ID and a coarse hour-bucketed timestamp.
 * Never includes the sentence, user ID, display name, or room code.
 */
export function computePrivacyPreservingHash(entryId: string, createdAtIso: string): string {
  const hourBucket = createdAtIso.slice(0, 13); // e.g. "2026-11-21T13"
  return crypto.createHash('sha256').update(`ss:v1:${entryId}:${hourBucket}`).digest('hex');
}

async function loadSponsorKeypair(): Promise<Keypair | null> {
  const raw = process.env.SOLANA_SPONSOR_SECRET?.trim();
  if (!raw) return null;
  try {
    if (raw.startsWith('[')) {
      const bytes = Uint8Array.from(JSON.parse(raw));
      return await Keypair.fromSecretKey(bytes);
    }
    const bytes = Uint8Array.from(Buffer.from(raw, 'base64'));
    if (bytes.length === 64) return await Keypair.fromSecretKey(bytes);
  } catch {
    return null;
  }
  return null;
}

export async function getSolanaConfigStatus() {
  const sponsor = await loadSponsorKeypair();
  return {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    sponsorConfigured: Boolean(sponsor),
    sponsorPublicKey: sponsor ? sponsor.publicKey.toBase58() : null,
  };
}

export async function anchorEntryToSolanaDevnet(
  entryId: string,
  createdAtIso: string,
): Promise<SolanaAnchorResult> {
  const entryHash = computePrivacyPreservingHash(entryId, createdAtIso);
  const sponsor = await loadSponsorKeypair();

  if (!sponsor) {
    return {
      anchored: false,
      entryHash,
      txSignature: null,
      network: 'devnet',
      statusNote: 'Hash prepared; configure SOLANA_SPONSOR_SECRET to broadcast sponsored Devnet memo transactions.',
    };
  }

  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    const hourBucket = createdAtIso.slice(0, 13) + ':00Z';
    // On-chain memo stores ONLY the opaque hash and coarse timestamp
    const memoPayload = JSON.stringify({ v: 1, h: entryHash, t: hourBucket });

    const ix = new TransactionInstruction({
      keys: [{ pubkey: sponsor.publicKey, isSigner: true, isWritable: true }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoPayload, 'utf8'),
    });

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [sponsor], {
      commitment: 'confirmed',
    });

    return {
      anchored: true,
      entryHash,
      txSignature: sig,
      network: 'devnet',
      statusNote: 'Anchored privacy-preserving hash to Solana Devnet (server-sponsored).',
    };
  } catch (err: any) {
    return {
      anchored: false,
      entryHash,
      txSignature: null,
      network: 'devnet',
      statusNote: `Devnet broadcast skipped: ${err?.message || 'RPC unavailable'}`,
    };
  }
}
