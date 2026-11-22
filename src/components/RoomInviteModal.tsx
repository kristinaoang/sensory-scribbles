import React, { useState } from 'react';
import { Check, Copy, Link2, Plus, Share2, Ticket, X } from 'lucide-react';
import type { Room } from '../types';

interface RoomInviteModalProps {
  currentRoom: Room;
  availableRooms: Room[];
  onClose: () => void;
  onRoomJoined: (room: Room) => void;
}

export const RoomInviteModal: React.FC<RoomInviteModalProps> = ({
  currentRoom,
  availableRooms,
  onClose,
  onRoomJoined,
}) => {
  const [tab, setTab] = useState<'share' | 'join' | 'create'>('share');
  const [inviteInput, setInviteInput] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCode, setNewRoomCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);

  const shareUrl = `${window.location.origin}/?invite=${encodeURIComponent(currentRoom.inviteCode)}`;

  const handleCopy = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 1800);
    } catch {
      // Fallback selection ignored
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${currentRoom.name} on Sensory Scribbles`,
          text: `Use invite code ${currentRoom.inviteCode} to join our Sensory Scribbles room!`,
          url: shareUrl,
        });
      } catch {
        // User cancelled share sheet
      }
    } else {
      await handleCopy(shareUrl, 'link');
    }
  };

  const handleJoinByInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteInput.trim(), createIfMissing: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not find a room with that invite code.');
        return;
      }
      onRoomJoined(data.room);
      onClose();
    } catch {
      setError('Network error while checking invite code.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoomName.trim(),
          code: newRoomCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create room.');
        return;
      }
      onRoomJoined(data.room);
      setTab('share');
      setNewRoomName('');
      setNewRoomCode('');
    } catch {
      setError('Network error while creating room.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Room Invitation & Switching"
    >
      <div className="w-full max-w-lg rounded-3xl bg-[#F8F4EA] dark:bg-[#2A335A] border border-[#E5DEC9] dark:border-[#3D4978] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DEC9] dark:border-[#3D4978]">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-[#2E7D5B] dark:text-[#F8E166]" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-[#1F2A3C] dark:text-white">
              Room Invitations
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close room invitation modal"
            className="min-w-[44px] min-h-[44px] rounded-full border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#21294A] flex items-center justify-center text-[#4C5568] dark:text-[#CBD5EB] hover:brightness-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-full bg-[#ECE5D3] dark:bg-[#1E2547]">
            <button
              type="button"
              onClick={() => {
                setTab('share');
                setError(null);
              }}
              className={`min-h-[40px] px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                tab === 'share'
                  ? 'bg-white dark:bg-[#3A467A] text-[#1F2A3C] dark:text-white shadow-xs'
                  : 'text-[#555E72] dark:text-[#BDC7E3]'
              }`}
            >
              Share Invite
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('join');
                setError(null);
              }}
              className={`min-h-[40px] px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                tab === 'join'
                  ? 'bg-white dark:bg-[#3A467A] text-[#1F2A3C] dark:text-white shadow-xs'
                  : 'text-[#555E72] dark:text-[#BDC7E3]'
              }`}
            >
              Join by Code
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('create');
                setError(null);
              }}
              className={`min-h-[40px] px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                tab === 'create'
                  ? 'bg-white dark:bg-[#3A467A] text-[#1F2A3C] dark:text-white shadow-xs'
                  : 'text-[#555E72] dark:text-[#BDC7E3]'
              }`}
            >
              Create Room
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {tab === 'share' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-4 space-y-3">
                <div className="text-xs text-[#555E72] dark:text-[#BDC7E3]">
                  Active Room · {currentRoom.name} ({currentRoom.code})
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F8F4EA] dark:bg-[#19203E] border border-[#E5DEC9] dark:border-[#3D4978] px-4 py-3">
                  <div>
                    <div className="text-[11px] text-[#555E72] dark:text-[#BDC7E3]">Unique Invite Code</div>
                    <div
                      data-testid="room-invite-code"
                      className="text-xl font-bold font-mono-tabular tracking-wider text-[#1F2A3C] dark:text-white"
                    >
                      {currentRoom.inviteCode}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(currentRoom.inviteCode, 'code')}
                    className="min-h-[44px] px-4 py-2 rounded-full bg-[#F7C6CF] hover:bg-[#F2B1BE] dark:bg-[#F8E166] dark:hover:bg-[#F2D544] text-[#43202A] dark:text-[#242E47] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {copiedType === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedType === 'code' ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(shareUrl, 'link')}
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-full border border-[#DDD4BC] dark:border-[#49578D] text-xs font-semibold text-[#1F2A3C] dark:text-slate-100 hover:bg-[#F8F4EA] dark:hover:bg-[#2E3868] inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Link2 className="w-4 h-4" />
                    <span>{copiedType === 'link' ? 'Invite Link Copied' : 'Copy Invite Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="min-h-[44px] px-4 py-2 rounded-full bg-[#2B7CB3] dark:bg-[#9BD8EC] text-white dark:text-[#182436] text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                </div>
              </div>

              {availableRooms.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#555E72] dark:text-[#BDC7E3]">
                    Quick Switch Rooms
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableRooms.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          onRoomJoined(r);
                          onClose();
                        }}
                        className={`min-h-[44px] px-3.5 py-2 rounded-2xl border text-left text-xs transition-colors ${
                          r.id === currentRoom.id
                            ? 'border-[#2E7D5B] dark:border-[#7CD4C0] bg-[#EFFAF3] dark:bg-[#1F3A4D] text-[#1F2A3C] dark:text-white font-bold'
                            : 'border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] text-[#3D475E] dark:text-[#CBD5EB] hover:border-[#B8AE94]'
                        }`}
                      >
                        <div className="truncate">{r.name}</div>
                        <div className="font-mono-tabular text-[11px] text-[#555E72] dark:text-[#BDC7E3]">
                          {r.inviteCode}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'join' && (
            <form onSubmit={handleJoinByInvite} className="space-y-4">
              <div>
                <label htmlFor="invite-code-input" className="block text-xs font-semibold text-[#3D475E] dark:text-[#CBD5EB] mb-1.5">
                  Enter Invite Code
                </label>
                <input
                  id="invite-code-input"
                  data-testid="invite-code-input"
                  type="text"
                  required
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                  placeholder="e.g. SS-CEDAR4"
                  className="w-full min-h-[48px] px-4 py-2 rounded-2xl border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#19203E] font-mono-tabular text-base tracking-wider text-[#1F2A3C] dark:text-white uppercase"
                />
                <p className="text-xs text-[#555E72] dark:text-[#BDC7E3] mt-1.5">
                  Ask a friend in your dorm, class, or group for their room&apos;s invite code.
                </p>
              </div>

              {error && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                data-testid="join-room-submit"
                className="w-full min-h-[48px] px-5 py-2.5 rounded-full bg-[#2E7D5B] dark:bg-[#F8E166] text-white dark:text-[#242E47] text-sm font-bold hover:brightness-95 disabled:opacity-50"
              >
                {busy ? 'Checking Invite Code…' : 'Join Room'}
              </button>
            </form>
          )}

          {tab === 'create' && (
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label htmlFor="new-room-name" className="block text-xs font-semibold text-[#3D475E] dark:text-[#CBD5EB] mb-1.5">
                  Room Name
                </label>
                <input
                  id="new-room-name"
                  data-testid="new-room-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={48}
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Maple Lounge Floor 3"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#19203E] text-sm text-[#1F2A3C] dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="new-room-code" className="block text-xs font-semibold text-[#3D475E] dark:text-[#CBD5EB] mb-1.5">
                  Short Room Label (optional)
                </label>
                <input
                  id="new-room-code"
                  type="text"
                  maxLength={20}
                  value={newRoomCode}
                  onChange={(e) => setNewRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. MAPLE-3"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#19203E] font-mono-tabular text-sm text-[#1F2A3C] dark:text-white uppercase"
                />
                <p className="text-xs text-[#555E72] dark:text-[#BDC7E3] mt-1.5">
                  A unique shareable invite code (like SS-7K4M9P) will be generated automatically.
                </p>
              </div>

              {error && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                data-testid="create-room-submit"
                className="w-full min-h-[48px] px-5 py-2.5 rounded-full bg-[#2B7CB3] dark:bg-[#9BD8EC] text-white dark:text-[#182436] text-sm font-bold hover:brightness-95 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{busy ? 'Creating Room…' : 'Create Room & Generate Invite Code'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
