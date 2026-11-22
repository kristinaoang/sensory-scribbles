import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { StreakCounter } from './StreakCounter';
import type { DailyRoomCountBucket, UserRoomStreak, WeeklyAccuracyBucket } from '../types';

interface StatsViewProps {
  userId: string;
  roomCode: string;
  refreshKey: number;
}

export const StatsView: React.FC<StatsViewProps> = ({ userId, roomCode, refreshKey }) => {
  const [weeklyAccuracy, setWeeklyAccuracy] = useState<WeeklyAccuracyBucket[]>([]);
  const [dailyCounts, setDailyCounts] = useState<DailyRoomCountBucket[]>([]);
  const [streak, setStreak] = useState<UserRoomStreak | null>(null);
  const [helpLine, setHelpLine] = useState('Help has not been used yet.');
  const [engineLabel, setEngineLabel] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/stats?userId=${encodeURIComponent(userId)}&roomCode=${encodeURIComponent(roomCode)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setWeeklyAccuracy(Array.isArray(data.weeklyAccuracy) ? data.weeklyAccuracy : []);
        setDailyCounts(Array.isArray(data.dailyRoomCounts) ? data.dailyRoomCounts : []);
        setStreak(data.streak ?? null);
        setHelpLine(typeof data.helpUsage?.line === 'string' ? data.helpUsage.line : 'Help has not been used yet.');
        setEngineLabel(data.databaseEngine || '');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, roomCode, refreshKey]);

  const totalAttempts = weeklyAccuracy.reduce((acc, b) => acc + b.totalAttempts, 0);
  const totalCorrect = weeklyAccuracy.reduce((acc, b) => acc + b.correctCount, 0);
  const overallPct = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  return (
    <section className="space-y-6" aria-labelledby="stats-heading">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#E5DEC9] dark:border-[#3D4978] pb-4">
        <div>
          <h2 id="stats-heading" className="text-2xl font-semibold text-[#1F2A3C] dark:text-white tracking-tight">
            Reflection &amp; Perception Stats
          </h2>
          <p className="text-sm text-[#4C5568] dark:text-[#CBD5EB]">
            Consecutive room contribution streak, weekly minigame accuracy, and daily room entries.
          </p>
        </div>
        {engineLabel && (
          <span className="text-xs font-mono-tabular text-[#555E72] dark:text-[#BDC7E3]">
            {engineLabel}
          </span>
        )}
      </div>

      {/* Room Contribution Streak Counter */}
      <StreakCounter streak={streak} roomCode={roomCode} loading={loading} />

      <p
        data-testid="help-usage-line"
        className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] px-4 py-3 text-sm text-[#1F2A3C] dark:text-slate-100"
      >
        {helpLine}
      </p>

      {loading ? (
        <p className="text-sm text-[#555E72] dark:text-[#BDC7E3] py-8">Loading weekly aggregates…</p>
      ) : weeklyAccuracy.length === 0 ? (
        <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-10 text-center space-y-2">
          <BarChart3 className="w-7 h-7 mx-auto text-[#7CD4C0]" aria-hidden="true" />
          <p className="text-base font-medium text-[#1F2A3C] dark:text-slate-100">
            No minigame rounds played yet under your current anonymous profile.
          </p>
          <p className="text-sm text-[#555E72] dark:text-[#BDC7E3]">
            Click any tile in the Mosaic to play &ldquo;Guess the Prompt&rdquo; or &ldquo;Whose Is It?&rdquo; and build your weekly accuracy chart.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly Accuracy Chart */}
          <div className="lg:col-span-2 rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-5">
            <div className="flex items-baseline justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#1F2A3C] dark:text-white">
                  Minigame Accuracy by Week
                </h3>
                <p className="text-xs text-[#555E72] dark:text-[#BDC7E3] mt-0.5">
                  time_bucket(&apos;7 days&apos;, created_at)
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono-tabular text-[#2E7D5B] dark:text-[#7CD4C0]">
                  {overallPct}%
                </div>
                <div className="text-xs font-mono-tabular text-[#555E72] dark:text-[#BDC7E3]">
                  {totalCorrect}/{totalAttempts} correct
                </div>
              </div>
            </div>

            {/* Accessible Bar Chart */}
            <div className="pt-2">
              <div className="h-52 flex items-end gap-4 border-b border-[#E5DEC9] dark:border-[#3D4978] pb-2 px-2">
                {weeklyAccuracy.map((bucket) => (
                  <div key={bucket.weekStart} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <span className="text-xs font-mono-tabular font-semibold text-[#1F2A3C] dark:text-slate-200">
                      {bucket.accuracyPct}%
                    </span>
                    <div className="w-full max-w-[56px] bg-[#F8F4EA] dark:bg-[#19203E] rounded-t-xl h-36 flex items-end overflow-hidden">
                      <div
                        className="w-full bg-[#2B7CB3] dark:bg-[#7CD4C0] rounded-t-xl transition-all"
                        style={{ height: `${Math.max(8, bucket.accuracyPct)}%` }}
                        aria-label={`Week of ${bucket.weekStart}: ${bucket.accuracyPct}% accuracy`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 px-2 pt-2">
                {weeklyAccuracy.map((bucket) => (
                  <div key={bucket.weekStart} className="flex-1 text-center text-[11px] font-mono-tabular text-[#555E72] dark:text-[#BDC7E3] truncate">
                    {bucket.weekStart}
                  </div>
                ))}
              </div>
            </div>

            {/* Tabular Breakdown */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5DEC9] dark:border-[#3D4978] text-[#555E72] dark:text-[#BDC7E3]">
                    <th className="py-2 font-medium">Week Starting</th>
                    <th className="py-2 font-medium">Correct</th>
                    <th className="py-2 font-medium">Attempts</th>
                    <th className="py-2 font-medium text-right">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE9D8] dark:divide-[#333F6E]">
                  {weeklyAccuracy.map((b) => (
                    <tr key={b.weekStart} className="font-mono-tabular text-[#1F2A3C] dark:text-slate-200">
                      <td className="py-2">{b.weekStart}</td>
                      <td className="py-2">{b.correctCount}</td>
                      <td className="py-2">{b.totalAttempts}</td>
                      <td className="py-2 text-right font-semibold">{b.accuracyPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Room Daily Activity Continuous Aggregate */}
          <div className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-[#1F2A3C] dark:text-white">
                Room Daily Entries
              </h3>
              <p className="text-xs text-[#555E72] dark:text-[#BDC7E3] mt-0.5">
                time_bucket(&apos;1 day&apos;, created_at) · {roomCode}
              </p>
            </div>

            {dailyCounts.length === 0 ? (
              <p className="text-sm text-[#555E72] dark:text-[#BDC7E3]">No entries recorded yet.</p>
            ) : (
              <ul className="divide-y divide-[#EFE9D8] dark:divide-[#333F6E]">
                {dailyCounts.map((d) => (
                  <li key={d.day} className="py-2.5 flex items-center justify-between text-xs font-mono-tabular">
                    <span className="text-[#4C5568] dark:text-[#CBD5EB]">{d.day}</span>
                    <span className="font-semibold text-[#1F2A3C] dark:text-white">
                      {d.entryCount} {d.entryCount === 1 ? 'tile' : 'tiles'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
