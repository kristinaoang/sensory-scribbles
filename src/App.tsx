import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Compass,
  Grid2x2,
  PenLine,
  Shield,
  Ticket,
} from 'lucide-react';
import { AdminPage } from './components/AdminPage';
import { CharacterCustomizerModal } from './components/CharacterCustomizerModal';
import { CommunityNookHero, type LauncherDestination } from './components/CommunityNookHero';
import { EntryWorld3D } from './components/EntryWorld3D';
import { MinigameModal } from './components/MinigameModal';
import { MosaicGrid } from './components/MosaicGrid';
import { RoomInviteModal } from './components/RoomInviteModal';
import { RoomWorld3D } from './components/RoomWorld3D';
import { SharedReflectionCanvas, type WorldProgressEventPayload } from './components/SharedReflectionCanvas';
import { SENSORY_PALETTE } from './components/StrokeCanvas';
import { StatsView } from './components/StatsView';
import { WorldStudioDrawer } from './components/WorldStudioDrawer';
import { loadSavedAvatarLook, saveAvatarLook } from './components/avatarBuilder';
import type {
  AnonymousUser,
  AvatarCustomization,
  JournalEntry,
  MosaicResponse,
  Room,
  RoomQuest,
  TamedAnimalRecord,
  WorldStateResponse,
} from './types';

type ActiveTab = 'world' | 'canvas' | 'mosaic' | 'stats' | 'admin';

const AVATAR_NAMES = [
  'moss-fox',
  'rain-owl',
  'amber-wren',
  'linen-hare',
  'cedar-moth',
  'tide-seal',
  'clay-deer',
];

function getInitialTab(): ActiveTab {
  if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
    return 'admin';
  }
  return 'world';
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialTab);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('ss_theme') === 'dark';
  });

  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoomCode, setCurrentRoomCode] = useState<string>(() => {
    if (typeof window === 'undefined') return 'CEDAR-402';
    return window.localStorage.getItem('ss_room_code') || 'CEDAR-402';
  });
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [worldData, setWorldData] = useState<WorldStateResponse | null>(null);
  const [mosaicData, setMosaicData] = useState<MosaicResponse | null>(null);
  const [user, setUser] = useState<AnonymousUser | null>(null);

  // Overlays & live state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [avatarLook, setAvatarLook] = useState<AvatarCustomization>(() => loadSavedAvatarLook());
  const [worldEntry, setWorldEntry] = useState<JournalEntry | null>(null);
  const [minigameEntry, setMinigameEntry] = useState<JournalEntry | null>(null);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [inviteBanner, setInviteBanner] = useState<string | null>(null);
  const [mosaicViewMode, setMosaicViewMode] = useState<'grid' | 'world'>('grid');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [presenceCount, setPresenceCount] = useState<number>(1);
  const [justExpandedQuest, setJustExpandedQuest] = useState<RoomQuest | null>(null);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    window.localStorage.setItem('ss_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Sync URL path for /admin without full-page reload
  const navigateTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    const targetPath = tab === 'admin' ? '/admin' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  useEffect(() => {
    const onPop = () => {
      setActiveTab(window.location.pathname === '/admin' ? 'admin' : 'world');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Initialize anonymous user + handle ?invite= query parameter
  useEffect(() => {
    const initIdentityAndInvite = async () => {
      try {
        const savedUserId = window.localStorage.getItem('ss_user_id');
        const randomAlias = AVATAR_NAMES[Math.floor(Math.random() * AVATAR_NAMES.length)];
        const randomColor = SENSORY_PALETTE[Math.floor(Math.random() * SENSORY_PALETTE.length)].hex;

        const userRes = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: savedUserId || undefined,
            displayName: randomAlias,
            avatarColor: randomColor,
          }),
        });
        if (userRes.ok) {
          const userJson = await userRes.json();
          if (userJson.user) {
            setUser(userJson.user);
            setAvatarLook(loadSavedAvatarLook(userJson.user.avatarColor));
            window.localStorage.setItem('ss_user_id', userJson.user.id);
          }
        }

        const roomsRes = await fetch('/api/rooms');
        if (roomsRes.ok) {
          const roomsJson = await roomsRes.json();
          if (Array.isArray(roomsJson.rooms)) {
            setRooms(roomsJson.rooms);
          }
        }

        const params = new URLSearchParams(window.location.search);
        const inviteParam = params.get('invite');
        if (inviteParam) {
          const joinRes = await fetch('/api/rooms/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inviteCode: inviteParam, createIfMissing: false }),
          });
          const joinData = await joinRes.json();
          if (joinRes.ok && joinData.room) {
            setCurrentRoomCode(joinData.room.code);
            window.localStorage.setItem('ss_room_code', joinData.room.code);
            setInviteBanner(`Joined ${joinData.room.name} via invite code ${joinData.room.inviteCode}.`);
            window.history.replaceState({}, '', window.location.pathname);
          } else {
            setInviteBanner(joinData.error || 'That invite link is invalid.');
          }
        }
      } catch {
        setLoadError('Could not connect to the Sensory Scribbles server. Please retry.');
      }
    };

    initIdentityAndInvite();
  }, []);

  const fetchWorldState = useCallback(async () => {
    setLoadError(null);
    try {
      const qs = new URLSearchParams({
        roomCode: currentRoomCode,
        userId: user?.id || '',
      });
      const res = await fetch(`/api/world?${qs.toString()}`);
      if (res.status === 404 && currentRoomCode !== 'CEDAR-402') {
        window.localStorage.removeItem('ss_room_code');
        setCurrentRoomCode('CEDAR-402');
        return;
      }
      if (res.ok) {
        const data: WorldStateResponse = await res.json();
        setWorldData(data);
        if (typeof data.userPoints === 'number') {
          setUser((u) => (u ? { ...u, affectionPoints: data.userPoints! } : u));
        }
      } else {
        setLoadError('Could not load 3D room world right now.');
      }
    } catch {
      setLoadError('Network error while loading 3D room world.');
    }
  }, [currentRoomCode, user?.id]);

  const fetchMosaic = useCallback(async (overrideDate?: string) => {
    try {
      const qs = new URLSearchParams({
        roomCode: currentRoomCode,
        date: overrideDate || selectedDate,
        userId: user?.id || '',
      });
      const res = await fetch(`/api/mosaic?${qs.toString()}`);
      if (res.status === 404 && currentRoomCode !== 'CEDAR-402') {
        return;
      }
      if (res.ok) {
        const data: MosaicResponse = await res.json();
        setMosaicData(data);
      }
    } catch {
      // Handled by world loader
    }
  }, [currentRoomCode, selectedDate, user?.id]);

  useEffect(() => {
    fetchWorldState();
    fetchMosaic();
  }, [fetchWorldState, fetchMosaic]);

  const handleWorldProgressed = useCallback((payload: WorldProgressEventPayload) => {
    setWorldData((prev) => {
      if (!prev) return prev;
      let nextEntries = prev.entries;
      let nextTodayEntries = prev.todayEntries;
      if (payload.entry && !prev.entries.some((e) => e.id === payload.entry!.id)) {
        nextEntries = [...prev.entries, payload.entry];
        if (payload.entry.entryDate === prev.todayDate) {
          nextTodayEntries = [payload.entry, ...prev.todayEntries];
        }
      }
      let nextStrokes = prev.strokes;
      if (payload.stroke && !prev.strokes.some((s) => s.id === payload.stroke!.id)) {
        nextStrokes = [...prev.strokes, payload.stroke];
      }
      return {
        ...prev,
        entries: nextEntries,
        todayEntries: nextTodayEntries,
        strokes: nextStrokes,
        progression: payload.progression,
      };
    });

    if (typeof payload.affectionPoints === 'number') {
      setUser((u) => (u ? { ...u, affectionPoints: payload.affectionPoints! } : u));
    }
    if (payload.justExpanded) {
      setJustExpandedQuest(payload.justExpanded);
    }
    if (payload.entry || payload.stroke) {
      setStatsRefreshKey((k) => k + 1);
    }
  }, []);

  // Live room WebSocket listener so the 3D World stays synced in real time across collaborators
  useEffect(() => {
    if (!user) return;
    let active = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (!active) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const qs = new URLSearchParams({
        roomCode: currentRoomCode,
        userId: user.id,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
      });
      ws = new WebSocket(`${proto}//${window.location.host}/ws/canvas?${qs.toString()}`);

      ws.onmessage = (event) => {
        if (!active) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'presence:update' && Array.isArray(msg.users)) {
            setPresenceCount(Math.max(1, msg.users.length));
          } else if (msg.type === 'stroke:created' && msg.stroke) {
            setWorldData((prev) => {
              if (!prev) return prev;
              if (prev.strokes.some((s) => s.id === msg.stroke.id)) return prev;
              return { ...prev, strokes: [...prev.strokes, msg.stroke] };
            });
          } else if (msg.type === 'world:progressed' && msg.progression) {
            handleWorldProgressed({
              progression: msg.progression,
              justExpanded: msg.justExpanded ?? null,
              entry: msg.entry,
              stroke: msg.stroke,
            });
          } else if (msg.type === 'animal:tamed' && msg.tamedAnimal) {
            const incoming = msg.tamedAnimal as TamedAnimalRecord;
            setWorldData((prev) => {
              if (!prev) return prev;
              const existing = prev.tamedAnimals ?? [];
              const filtered = existing.filter((t) => t.animalKey !== incoming.animalKey);
              return { ...prev, tamedAnimals: [...filtered, incoming] };
            });
          } else if (msg.type === 'animal:petted' && msg.animalKey && typeof msg.animalAffection === 'number') {
            setWorldData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                animalAffections: {
                  ...(prev.animalAffections ?? {}),
                  [msg.animalKey]: msg.animalAffection,
                },
              };
            });
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (!active) return;
        reconnectTimer = window.setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [currentRoomCode, user, handleWorldProgressed]);

  const handleRoomJoined = async (room: Room) => {
    setJustExpandedQuest(null);
    setCurrentRoomCode(room.code);
    window.localStorage.setItem('ss_room_code', room.code);
    setSelectedDate(todayIso());
    const roomsRes = await fetch('/api/rooms');
    const roomsJson = await roomsRes.json();
    if (Array.isArray(roomsJson.rooms)) setRooms(roomsJson.rooms);
  };

  const handleUpdateProfile = async (displayName: string, avatarColor: string) => {
    if (!user) return;
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: user.id,
        displayName,
        avatarColor,
        update: true,
      }),
    });
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
      setAvatarLook((prev) => {
        const next = { ...prev, tunicColor: data.user.avatarColor };
        saveAvatarLook(next);
        return next;
      });
      await Promise.all([fetchWorldState(), fetchMosaic()]);
    }
  };

  const handleSaveCharacter = async (displayName: string, nextLook: AvatarCustomization) => {
    saveAvatarLook(nextLook);
    setAvatarLook(nextLook);
    await handleUpdateProfile(displayName, nextLook.tunicColor);
  };

  const handleLauncherNavigate = (dest: LauncherDestination) => {
    if (dest === 'canvas') {
      navigateTab('canvas');
    } else if (dest === 'mosaic-grid') {
      setMosaicViewMode('grid');
      navigateTab('mosaic');
    } else if (dest === 'mosaic-world') {
      navigateTab('world');
    } else if (dest === 'stats') {
      navigateTab('stats');
    } else if (dest === 'admin') {
      navigateTab('admin');
    }
  };

  const activeLauncherDest: LauncherDestination =
    activeTab === 'world'
      ? 'mosaic-world'
      : activeTab === 'canvas'
        ? 'canvas'
        : activeTab === 'mosaic'
          ? mosaicViewMode === 'world'
            ? 'mosaic-world'
            : 'mosaic-grid'
          : activeTab === 'stats'
            ? 'stats'
            : 'admin';

  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'world', label: '3D World' },
    { id: 'canvas', label: 'Shared Canvas' },
    { id: 'mosaic', label: 'Mosaic' },
    { id: 'stats', label: 'Stats' },
    { id: 'admin', label: 'Admin' },
  ];

  const activeRoom = worldData?.room || mosaicData?.room || null;
  const activePrompt = worldData?.prompt ?? mosaicData?.prompt ?? null;
  const userSubmittedToday = worldData?.userSubmittedToday ?? mosaicData?.userSubmittedToday ?? false;
  const progression = worldData?.progression ?? mosaicData?.progression ?? null;

  return (
    <div className="min-h-screen bg-nook-meadow text-[#1F2A3C] dark:text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract + Sunny Diagonal Awning Accent */}
      <header className="sticky top-0 z-30 nook-sunny-awning border-b border-[#E7C955] dark:border-[#39487A] shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
          {/* Zone 1: Single-line Wordmark */}
          <button
            type="button"
            onClick={() => navigateTab('world')}
            className="text-xl font-bold font-display tracking-tight text-[#242E47] dark:text-[#F8E166] whitespace-nowrap shrink-0 text-left"
          >
            Sensory Scribbles
          </button>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold" aria-label="Primary navigation">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTab(item.id)}
                  className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-[#242E47] dark:border-[#F8E166] text-[#1A2236] dark:text-white'
                      : 'border-transparent text-[#3D475E] dark:text-[#C5D0EC] hover:text-[#1A2236] dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="shrink-0">
            <button
              type="button"
              data-testid="open-room-invite-btn"
              onClick={() => setInviteModalOpen(true)}
              className="min-h-[40px] px-4 py-1.5 rounded-full bg-[#F7C6CF] hover:bg-[#F2B1BE] dark:bg-[#F8E166] dark:hover:bg-[#F2D544] text-[#43202A] dark:text-[#242E47] text-xs sm:text-sm font-bold shadow-xs transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Ticket className="w-4 h-4" aria-hidden="true" />
              <span>{activeRoom?.code || currentRoomCode}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {activeTab === 'world' ? (
        <main className="flex-1 flex flex-col relative pb-14 md:pb-0">
          {inviteBanner && (
            <div
              role="status"
              className="z-20 bg-[#EBF6FC] dark:bg-[#24325C] border-b border-[#8FC1E6] dark:border-[#4969A8] px-4 py-2 text-xs sm:text-sm text-[#1D3557] dark:text-[#E2EEFF] flex items-center justify-between"
            >
              <span>{inviteBanner}</span>
              <button
                type="button"
                onClick={() => setInviteBanner(null)}
                className="text-xs font-bold underline ml-4 whitespace-nowrap"
              >
                Dismiss
              </button>
            </div>
          )}

          {loadError && (
            <div
              role="alert"
              className="z-20 bg-rose-50 dark:bg-rose-950/90 border-b border-rose-300 dark:border-rose-700 px-4 py-2.5 text-sm text-rose-900 dark:text-rose-100 flex items-center justify-between gap-3"
            >
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => fetchWorldState()}
                className="min-h-[34px] px-4 py-1 rounded-full bg-rose-700 text-white text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          )}

          {worldData && user ? (
            <RoomWorld3D
              roomId={worldData.room.id}
              roomName={worldData.room.name}
              roomCode={worldData.room.code}
              userId={user.id}
              entries={worldData.entries}
              strokes={worldData.strokes}
              progression={worldData.progression}
              tamedAnimals={worldData.tamedAnimals ?? []}
              animalAffections={worldData.animalAffections ?? {}}
              userPoints={user.affectionPoints ?? 0}
              darkMode={darkMode}
              presenceCount={presenceCount}
              userAvatarColor={user.avatarColor}
              avatarLook={avatarLook}
              justExpandedQuest={justExpandedQuest}
              onDismissExpansionBanner={() => setJustExpandedQuest(null)}
              onSelectEntry={(entry) => setWorldEntry(entry)}
              onOpenMinigame={(entry) => setMinigameEntry(entry)}
              onOpenStudio={() => setStudioOpen(true)}
              onOpenMosaic={() => navigateTab('mosaic')}
              onOpenCustomizer={() => setCustomizerOpen(true)}
              onToggleDarkMode={() => setDarkMode((d) => !d)}
              onUserPointsChange={(pts) => {
                setUser((u) => (u ? { ...u, affectionPoints: pts } : u));
              }}
              onAnimalAffectionChange={(animalKey, affection) => {
                setWorldData((prev) =>
                  prev
                    ? { ...prev, animalAffections: { ...(prev.animalAffections ?? {}), [animalKey]: affection } }
                    : prev,
                );
              }}
              onAnimalTamed={(record) => {
                setWorldData((prev) => {
                  if (!prev) return prev;
                  const filtered = (prev.tamedAnimals ?? []).filter((t) => t.animalKey !== record.animalKey);
                  return { ...prev, tamedAnimals: [...filtered, record] };
                });
              }}
            />
          ) : !loadError ? (
            <div className="flex-1 flex items-center justify-center p-12 text-center text-sm text-[#4C5568] dark:text-[#CBD5EB]">
              Sculpting your room&apos;s expanding 3D island…
            </div>
          ) : null}
        </main>
      ) : (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
          {inviteBanner && (
            <div
              role="status"
              className="rounded-2xl border border-[#8FC1E6] dark:border-[#4969A8] bg-[#EBF6FC] dark:bg-[#24325C] px-4 py-3 text-xs sm:text-sm text-[#1D3557] dark:text-[#E2EEFF] flex items-center justify-between shadow-xs"
            >
              <span>{inviteBanner}</span>
              <button
                type="button"
                onClick={() => setInviteBanner(null)}
                className="text-xs font-bold underline ml-4 whitespace-nowrap"
              >
                Dismiss
              </button>
            </div>
          )}

          {loadError && activeTab !== 'admin' && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/60 px-4 py-3 text-sm text-rose-900 dark:text-rose-100 flex flex-wrap items-center justify-between gap-3"
            >
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => {
                  fetchWorldState();
                  fetchMosaic();
                }}
                className="min-h-[36px] px-4 py-1 rounded-full bg-rose-700 text-white text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          )}

          {activeTab === 'canvas' && (
            activeRoom && user ? (
              <SharedReflectionCanvas
                room={activeRoom}
                user={user}
                prompt={activePrompt}
                todayDate={todayIso()}
                todayEntryCount={worldData?.todayEntries.length ?? mosaicData?.entries.length ?? 0}
                userSubmittedToday={userSubmittedToday}
                progression={progression}
                darkMode={darkMode}
                onOpenWorld={(entry) => setWorldEntry(entry)}
                onOpenRoomWorld={() => navigateTab('world')}
                onOpenInvite={() => setInviteModalOpen(true)}
                onDailyEntrySubmitted={async (today) => {
                  setSelectedDate(today);
                  setStatsRefreshKey((k) => k + 1);
                  await Promise.all([fetchWorldState(), fetchMosaic(today)]);
                }}
                onWorldProgressed={handleWorldProgressed}
              />
            ) : !loadError ? (
              <div className="rounded-3xl border border-[#E5DEC9] dark:border-[#3D4978] bg-[#F8F4EA] dark:bg-[#2A335A] p-12 text-center text-sm text-[#4C5568] dark:text-[#CBD5EB] shadow-md">
                Opening your room&apos;s collaborative canvas…
              </div>
            ) : null
          )}

          {activeTab === 'mosaic' && (
            <div className="space-y-8">
              {activeRoom && user && (
                <CommunityNookHero
                  user={user}
                  room={activeRoom}
                  darkMode={darkMode}
                  activeDestination={activeLauncherDest}
                  todayEntryCount={mosaicData?.entries.length ?? 0}
                  onToggleDarkMode={() => setDarkMode((d) => !d)}
                  onNavigate={handleLauncherNavigate}
                  onOpenInvite={() => setInviteModalOpen(true)}
                  onUpdateProfile={handleUpdateProfile}
                />
              )}

              {mosaicData && (
                <div className="rounded-3xl bg-[#F8F4EA] dark:bg-[#2A335A] border border-[#E5DEC9] dark:border-[#3D4978] p-5 sm:p-6 shadow-md space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-1 p-1 rounded-full bg-[#ECE5D3] dark:bg-[#1E2547]">
                      <button
                        type="button"
                        onClick={() => setMosaicViewMode('grid')}
                        className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                          mosaicViewMode === 'grid'
                            ? 'bg-white dark:bg-[#3A467A] text-[#1F2A3C] dark:text-white shadow-xs'
                            : 'text-[#555E72] dark:text-[#BDC7E3]'
                        }`}
                      >
                        Tile Mosaic
                      </button>
                      <button
                        type="button"
                        onClick={() => setMosaicViewMode('world')}
                        className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                          mosaicViewMode === 'world'
                            ? 'bg-white dark:bg-[#3A467A] text-[#1F2A3C] dark:text-white shadow-xs'
                            : 'text-[#555E72] dark:text-[#BDC7E3]'
                        }`}
                      >
                        3D Island Preview
                      </button>
                    </div>
                    <span className="text-xs font-mono-tabular text-[#4C5568] dark:text-[#CBD5EB]">
                      {mosaicData.date}
                    </span>
                  </div>

                  {mosaicViewMode === 'grid' ? (
                    <MosaicGrid
                      date={mosaicData.date}
                      availableDates={mosaicData.availableDates}
                      prompt={mosaicData.prompt}
                      entries={mosaicData.entries}
                      caption={mosaicData.caption}
                      darkMode={darkMode}
                      onDateChange={(d) => setSelectedDate(d)}
                      onOpenWorld={(entry) => setWorldEntry(entry)}
                      onOpenMinigame={(entry) => setMinigameEntry(entry)}
                    />
                  ) : (
                    <RoomWorld3D
                      roomId={mosaicData.room.id}
                      roomName={mosaicData.room.name}
                      roomCode={mosaicData.room.code}
                      userId={user?.id}
                      entries={worldData?.entries ?? mosaicData.entries}
                      strokes={worldData?.strokes ?? []}
                      progression={worldData?.progression ?? mosaicData.progression}
                      tamedAnimals={worldData?.tamedAnimals ?? []}
                      animalAffections={worldData?.animalAffections ?? {}}
                      userPoints={user?.affectionPoints ?? 0}
                      darkMode={darkMode}
                      presenceCount={presenceCount}
                      userAvatarColor={user?.avatarColor}
                      avatarLook={avatarLook}
                      embedded
                      onSelectEntry={(entry) => setWorldEntry(entry)}
                      onOpenMinigame={(entry) => setMinigameEntry(entry)}
                      onOpenStudio={() => setStudioOpen(true)}
                      onOpenCustomizer={() => setCustomizerOpen(true)}
                      onUserPointsChange={(pts) => {
                        setUser((u) => (u ? { ...u, affectionPoints: pts } : u));
                      }}
                      onAnimalAffectionChange={(animalKey, affection) => {
                        setWorldData((prev) =>
                          prev
                            ? { ...prev, animalAffections: { ...(prev.animalAffections ?? {}), [animalKey]: affection } }
                            : prev,
                        );
                      }}
                      onAnimalTamed={(record) => {
                        setWorldData((prev) => {
                          if (!prev) return prev;
                          const filtered = (prev.tamedAnimals ?? []).filter((t) => t.animalKey !== record.animalKey);
                          return { ...prev, tamedAnimals: [...filtered, record] };
                        });
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && user && (
            <div className="rounded-3xl bg-[#F8F4EA] dark:bg-[#2A335A] border border-[#E5DEC9] dark:border-[#3D4978] p-5 sm:p-6 shadow-md">
              <StatsView
                userId={user.id}
                roomCode={currentRoomCode}
                refreshKey={statsRefreshKey}
              />
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="rounded-3xl bg-[#F8F4EA] dark:bg-[#2A335A] border border-[#E5DEC9] dark:border-[#3D4978] p-5 sm:p-6 shadow-md">
              <AdminPage
                onPromptUpdated={() => {
                  fetchWorldState();
                  fetchMosaic();
                }}
              />
            </div>
          )}
        </main>
      )}

      {/* Cozy Ocean-Wave Footer (shown on scrolled pages, omitted on full-bleed 3D World) */}
      {activeTab !== 'world' && (
        <footer className="nook-ocean-footer border-t border-[#7EC3DC] dark:border-[#24325B] py-5 pb-20 md:pb-6 mt-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[#1B3A4B] dark:text-[#B9CAE8]">
            <span className="font-semibold font-display text-sm">Sensory Scribbles</span>
            <span>Expanding 3D worlds · Question prompts · Shared collaborative canvas</span>
          </div>
        </footer>
      )}

      {/* Mobile Bottom Navigation (solid surface without backdrop-blur over WebGL, >= 44px touch targets) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-[#F8F4EA] dark:bg-[#222A4C] border-t border-[#E5DEC9] dark:border-[#3D4978] grid grid-cols-5"
      >
        {[
          { id: 'world' as const, label: '3D World', Icon: Compass },
          { id: 'canvas' as const, label: 'Canvas', Icon: PenLine },
          { id: 'mosaic' as const, label: 'Mosaic', Icon: Grid2x2 },
          { id: 'stats' as const, label: 'Stats', Icon: BarChart3 },
          { id: 'admin' as const, label: 'Admin', Icon: Shield },
        ].map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => navigateTab(id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                active ? 'text-[#2E7D5B] dark:text-[#F8E166]' : 'text-[#5A647B] dark:text-[#A9B5D6]'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Slide-over Prompt & Collaborative Drawing Studio Drawer over the 3D World */}
      {activeRoom && user && (
        <WorldStudioDrawer
          open={studioOpen}
          room={activeRoom}
          user={user}
          prompt={activePrompt}
          todayDate={todayIso()}
          todayEntryCount={worldData?.todayEntries.length ?? mosaicData?.entries.length ?? 0}
          userSubmittedToday={userSubmittedToday}
          progression={progression}
          darkMode={darkMode}
          onClose={() => setStudioOpen(false)}
          onOpenWorld={(entry) => setWorldEntry(entry)}
          onOpenInvite={() => {
            setStudioOpen(false);
            setInviteModalOpen(true);
          }}
          onDailyEntrySubmitted={async (today) => {
            setSelectedDate(today);
            setStatsRefreshKey((k) => k + 1);
            await Promise.all([fetchWorldState(), fetchMosaic(today)]);
          }}
          onWorldProgressed={handleWorldProgressed}
        />
      )}

      {/* Room Invitation Modal */}
      {inviteModalOpen && activeRoom && (
        <RoomInviteModal
          currentRoom={activeRoom}
          availableRooms={rooms}
          onClose={() => setInviteModalOpen(false)}
          onRoomJoined={handleRoomJoined}
        />
      )}

      {/* Unique 3D Sensory World per Entry */}
      {worldEntry && (
        <EntryWorld3D
          entry={worldEntry}
          onClose={() => setWorldEntry(null)}
          onOpenMinigame={(entry) => {
            setWorldEntry(null);
            setMinigameEntry(entry);
          }}
        />
      )}

      {/* Minigames Modal */}
      {minigameEntry && user && (
        <MinigameModal
          focusEntry={minigameEntry}
          roomCode={currentRoomCode}
          userId={user.id}
          darkMode={darkMode}
          onClose={() => setMinigameEntry(null)}
          onResultRecorded={() => setStatsRefreshKey((k) => k + 1)}
        />
      )}

      {/* 3D Character Customization Window */}
      {user && (
        <CharacterCustomizerModal
          open={customizerOpen}
          user={user}
          initialLook={avatarLook}
          darkMode={darkMode}
          onClose={() => setCustomizerOpen(false)}
          onSave={handleSaveCharacter}
        />
      )}
    </div>
  );
}
