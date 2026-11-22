import React, { useCallback, useEffect, useState } from 'react';
import { Bot, Check, Flag, Lock, Play, ShieldAlert } from 'lucide-react';
import type { JournalEntry, Prompt, Room } from '../types';

interface AdminPageProps {
  onPromptUpdated: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onPromptUpdated }) => {
  // Hold admin bearer token in React memory only (never localStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [envManaged, setEnvManaged] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [todayDate, setTodayDate] = useState('');
  const [tomorrowDate, setTomorrowDate] = useState('');
  const [todayEntries, setTodayEntries] = useState<JournalEntry[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tomorrowPromptText, setTomorrowPromptText] = useState('');
  const [sensoryFocus, setSensoryFocus] = useState('tactile');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [workflowReport, setWorkflowReport] = useState<any>(null);
  const [selectedWorkflowRoom, setSelectedWorkflowRoom] = useState('');

  useEffect(() => {
    fetch('/api/admin/status')
      .then((r) => r.json())
      .then((data) => {
        setConfigured(Boolean(data.configured));
        setEnvManaged(Boolean(data.envManaged));
      })
      .catch(() => setConfigured(true));
  }, []);

  const loadDashboard = useCallback(async (token: string) => {
    const res = await fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      setAdminToken(null);
      return;
    }
    const data = await res.json();
    setTodayDate(data.todayDate || '');
    setTomorrowDate(data.tomorrowDate || '');
    setTodayEntries(Array.isArray(data.todayEntries) ? data.todayEntries : []);
    setPrompts(Array.isArray(data.prompts) ? data.prompts : []);
    setRooms(Array.isArray(data.rooms) ? data.rooms : []);
    if (data.tomorrowPrompt?.text) {
      setTomorrowPromptText(data.tomorrowPrompt.text);
      setSensoryFocus(data.tomorrowPrompt.sensoryFocus || 'tactile');
    }
    if (Array.isArray(data.rooms) && data.rooms.length > 0 && !selectedWorkflowRoom) {
      setSelectedWorkflowRoom(data.rooms[0].id);
    }
  }, [selectedWorkflowRoom]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const endpoint = configured ? '/api/admin/login' : '/api/admin/claim';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAuthError(data.error || 'Authentication failed.');
      return;
    }
    setAdminToken(data.token);
    setConfigured(true);
    setPasswordInput('');
    await loadDashboard(data.token);
  };

  const handleToggleFlag = async (entry: JournalEntry) => {
    if (!adminToken) return;
    setActionMessage(null);
    const res = await fetch('/api/admin/flag', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ entryId: entry.id, flagged: !entry.flagged }),
    });
    if (res.ok) {
      await loadDashboard(adminToken);
      onPromptUpdated();
      setActionMessage(!entry.flagged ? `Flagged entry ${entry.id}.` : `Approved entry ${entry.id}.`);
    }
  };

  const handleSaveTomorrowPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setActionMessage(null);
    const res = await fetch('/api/admin/prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        promptDate: tomorrowDate,
        text: tomorrowPromptText,
        sensoryFocus,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionMessage(data.error || 'Failed to save tomorrow prompt.');
      return;
    }
    await loadDashboard(adminToken);
    onPromptUpdated();
    setActionMessage(`Saved prompt for ${tomorrowDate}.`);
  };

  const handleRunNightlyWorkflow = async () => {
    if (!adminToken || !selectedWorkflowRoom) return;
    setActionMessage(null);
    setWorkflowReport(null);
    const res = await fetch('/api/admin/workflow/nightly', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        roomId: selectedWorkflowRoom,
        date: todayDate,
      }),
    });
    const data = await res.json();
    setWorkflowReport(data);
    onPromptUpdated();
  };

  const handleToggleSolana = async (room: Room) => {
    if (!adminToken) return;
    const res = await fetch('/api/admin/room-solana', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ roomId: room.id, solanaEnabled: !room.solanaEnabled }),
    });
    if (res.ok) {
      await loadDashboard(adminToken);
      setActionMessage(`Solana Devnet anchor ${!room.solanaEnabled ? 'enabled' : 'disabled'} for ${room.code}.`);
    }
  };

  if (!adminToken) {
    return (
      <section className="max-w-md mx-auto rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Lock className="w-5 h-5 text-[#2E7D5B] dark:text-[#7CD4C0]" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-[#1F2A3C] dark:text-white">
            {configured === false ? 'Set Up Admin Passcode' : 'Admin Sign-In'}
          </h2>
        </div>

        <p className="text-sm text-[#4C5568] dark:text-[#CBD5EB]">
          {configured === false
            ? 'No ADMIN_PASSWORD secret is configured yet. Create a one-time admin passcode to protect /admin moderation and prompt scheduling.'
            : envManaged
              ? 'Enter the server ADMIN_PASSWORD to moderate entries and schedule tomorrow’s prompt.'
              : 'Enter your admin passcode to manage moderation, prompts, and the Mastra workflow.'}
        </p>

        <form onSubmit={handleAuthSubmit} className="space-y-3">
          <div>
            <label htmlFor="admin-password-input" className="block text-xs font-semibold text-[#3D475E] dark:text-[#CBD5EB] mb-1">
              Admin Password
            </label>
            <input
              id="admin-password-input"
              data-testid="admin-password-input"
              type="password"
              required
              minLength={6}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder={configured === false ? 'Choose at least 6 characters' : 'Enter password'}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDD4BC] dark:border-[#49578D] bg-[#F8F4EA] dark:bg-[#19203E] text-sm text-[#1F2A3C] dark:text-white"
            />
          </div>

          {authError && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">
              {authError}
            </p>
          )}

          <button
            type="submit"
            data-testid="admin-login-submit"
            className="w-full min-h-[44px] px-4 py-2 rounded-full bg-[#2E7D5B] dark:bg-[#F8E166] text-white dark:text-[#242E47] text-sm font-bold hover:brightness-95 transition"
          >
            {configured === false ? 'Claim Admin Passcode' : 'Sign In to Admin'}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="space-y-8" aria-labelledby="admin-heading">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5DEC9] dark:border-[#3D4978] pb-4">
        <div>
          <h2 id="admin-heading" className="text-2xl font-semibold text-[#1F2A3C] dark:text-white">
            Room Administration
          </h2>
          <p className="text-sm text-[#4C5568] dark:text-[#CBD5EB]">
            Stable controls for entry moderation, tomorrow&apos;s prompt scheduling, Mastra nightly synthesis, and Solana opt-in.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAdminToken(null)}
          className="min-h-[44px] px-4 py-2 rounded-full border border-[#DDD4BC] dark:border-[#49578D] bg-white dark:bg-[#21294A] text-xs font-semibold text-[#1F2A3C] dark:text-slate-100"
        >
          Lock Admin
        </button>
      </div>

      {actionMessage && (
        <div role="status" className="rounded-xl border border-[#8AD2A7] dark:border-[#3D8B78] bg-[#EFFAF3] dark:bg-[#1B3A3A] px-4 py-3 text-sm text-[#1D5438] dark:text-[#B9F3DF]">
          {actionMessage}
        </div>
      )}

      {/* 1. Set Tomorrow's Prompt (Clear labeled form for automation bots & humans) */}
      <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-4">
        <h3 className="text-lg font-semibold text-[#1F2A3C] dark:text-white">
          Schedule Tomorrow&apos;s Prompt ({tomorrowDate})
        </h3>

        <form onSubmit={handleSaveTomorrowPrompt} className="space-y-3">
          <div>
            <label htmlFor="tomorrow-prompt-input" className="block text-xs font-semibold text-[#3D475E] dark:text-[#CBD5EB] mb-1">
              Tomorrow&apos;s Sensory Prompt
            </label>
            <textarea
              id="tomorrow-prompt-input"
              data-testid="tomorrow-prompt-input"
              required
              rows={2}
              value={tomorrowPromptText}
              onChange={(e) => setTomorrowPromptText(e.target.value)}
              placeholder="Write a sensory, tactile question that invites reflection..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDD4BC] dark:border-[#49578D] bg-[#F8F4EA] dark:bg-[#19203E] text-sm text-[#1F2A3C] dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="sensory-focus-input" className="block text-xs font-semibold text-[#3D475E] dark:text-[#CBD5EB] mb-1">
                Sensory Focus
              </label>
              <input
                id="sensory-focus-input"
                type="text"
                value={sensoryFocus}
                onChange={(e) => setSensoryFocus(e.target.value)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDD4BC] dark:border-[#49578D] bg-[#F8F4EA] dark:bg-[#19203E] text-sm text-[#1F2A3C] dark:text-white"
              />
            </div>

            <button
              type="submit"
              data-testid="save-tomorrow-prompt-btn"
              className="min-h-[44px] px-5 py-2 rounded-full bg-[#2E7D5B] dark:bg-[#F8E166] text-white dark:text-[#242E47] text-sm font-bold hover:brightness-95"
            >
              Save Tomorrow&apos;s Prompt
            </button>
          </div>
        </form>
      </div>

      {/* 2. Today's Entries Moderation List */}
      <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#1F2A3C] dark:text-white">
            Today&apos;s Entries ({todayDate})
          </h3>
          <span className="text-xs font-mono-tabular text-[#555E72] dark:text-[#BDC7E3]">
            {todayEntries.length} total
          </span>
        </div>

        {todayEntries.length === 0 ? (
          <p className="text-sm text-[#555E72] dark:text-[#BDC7E3]">No entries submitted today.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5DEC9] dark:border-[#3D4978] text-xs text-[#555E72] dark:text-[#BDC7E3]">
                  <th className="py-2 pr-4 font-medium">Entry ID</th>
                  <th className="py-2 pr-4 font-medium">Sentence</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Moderation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9D8] dark:divide-[#333F6E]">
                {todayEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-3 pr-4 font-mono-tabular text-xs text-[#555E72] dark:text-[#BDC7E3] whitespace-nowrap">
                      {entry.id}
                      {entry.isDemo ? ' · demo' : ''}
                    </td>
                    <td className="py-3 pr-4 text-[#1F2A3C] dark:text-slate-100">
                      {entry.sentence}
                      {entry.moderationReason && (
                        <div className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                          Reason: {entry.moderationReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-xs font-medium">
                      {entry.flagged ? (
                        <span className="text-rose-700 dark:text-rose-400 inline-flex items-center gap-1">
                          <ShieldAlert className="w-4 h-4" />
                          <span>Flagged</span>
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-[#7CD4C0] inline-flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          <span>Visible</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        data-testid={`flag-btn-${entry.id}`}
                        onClick={() => handleToggleFlag(entry)}
                        className={`min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                          entry.flagged
                            ? 'border border-emerald-600 text-emerald-700 dark:text-[#7CD4C0] hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                            : 'border border-rose-600 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                        }`}
                      >
                        <Flag className="w-3.5 h-3.5" />
                        <span>{entry.flagged ? 'Unflag Entry' : 'Flag Entry'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Mastra Nightly Workflow & Solana Opt-In Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#2B7CB3] dark:text-[#9BD8EC]" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-[#1F2A3C] dark:text-white">
              Mastra Nightly Workflow
            </h3>
          </div>
          <p className="text-xs text-[#4C5568] dark:text-[#CBD5EB]">
            Runs the 4-step workflow: fetch room entries, synthesize a 2-sentence caption &amp; 3 minigame questions via Gemini, validate zero names / max 5 quoted words, and persist.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Select room for workflow"
              value={selectedWorkflowRoom}
              onChange={(e) => setSelectedWorkflowRoom(e.target.value)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDD4BC] dark:border-[#49578D] bg-[#F8F4EA] dark:bg-[#19203E] text-sm text-[#1F2A3C] dark:text-white"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid="run-nightly-workflow-btn"
              onClick={handleRunNightlyWorkflow}
              className="min-h-[44px] px-4 py-2 rounded-full bg-[#2B7CB3] dark:bg-[#9BD8EC] text-white dark:text-[#182436] text-sm font-bold inline-flex items-center gap-1.5"
            >
              <Play className="w-4 h-4" />
              <span>Run Nightly Workflow</span>
            </button>
          </div>

          {workflowReport && (
            <div className="rounded-xl border border-[#E5DEC9] dark:border-[#3D4978] bg-[#F8F4EA] dark:bg-[#19203E] p-3 space-y-1.5 text-xs">
              {workflowReport.steps?.map((s: any) => (
                <div key={s.stepId} className="flex items-start gap-2">
                  <span className={s.status === 'passed' ? 'text-emerald-700 dark:text-[#7CD4C0] font-semibold' : 'text-rose-700 dark:text-rose-400 font-semibold'}>
                    {s.status.toUpperCase()}
                  </span>
                  <span className="font-mono-tabular text-[#555E72] dark:text-[#BDC7E3]">{s.stepId}:</span>
                  <span className="text-[#1F2A3C] dark:text-slate-100">{s.detail}</span>
                </div>
              ))}
              {workflowReport.error && (
                <p className="text-rose-700 dark:text-rose-400 font-medium pt-1">{workflowReport.error}</p>
              )}
            </div>
          )}
        </div>

        {/* Solana Devnet Opt-In Toggle per Room */}
        <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[#1F2A3C] dark:text-white">
            Solana Devnet Hash Layer (Opt-In)
          </h3>
          <p className="text-xs text-[#4C5568] dark:text-[#CBD5EB]">
            When enabled for a room, accepted entries anchor only a SHA-256 entry hash and coarse timestamp using the server sponsor wallet. Sentences, users, and rooms never go on-chain.
          </p>
          <ul className="divide-y divide-[#EFE9D8] dark:divide-[#333F6E]">
            {rooms.map((r) => (
              <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[#1F2A3C] dark:text-white">
                    {r.code} · {r.name}
                  </div>
                  <div className="text-xs font-mono-tabular text-[#555E72] dark:text-[#BDC7E3]">
                    Invite: {r.inviteCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSolana(r)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                    r.solanaEnabled
                      ? 'bg-[#2E7D5B] dark:bg-[#7CD4C0] text-white dark:text-[#112A24]'
                      : 'border border-[#DDD4BC] dark:border-[#49578D] text-[#3D475E] dark:text-slate-200'
                  }`}
                >
                  {r.solanaEnabled ? 'Devnet Enabled' : 'Enable Devnet'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 4. Read-Only List of Past Prompts */}
      <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-3">
        <h3 className="text-lg font-semibold text-[#1F2A3C] dark:text-white">
          Prompt Archive (Read-Only)
        </h3>
        <ul className="divide-y divide-[#EFE9D8] dark:divide-[#333F6E]">
          {prompts.map((p) => (
            <li key={p.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm">
              <span className="text-[#1F2A3C] dark:text-slate-100">{p.text}</span>
              <span className="text-xs font-mono-tabular text-[#555E72] dark:text-[#BDC7E3] shrink-0">
                {p.promptDate} · {p.sensoryFocus}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
