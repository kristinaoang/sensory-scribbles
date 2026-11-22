import React from 'react';
import { Calendar, Check, Flame } from 'lucide-react';
import type { UserRoomStreak } from '../types';

interface StreakCounterProps {
  streak: UserRoomStreak | null;
  roomCode: string;
  loading?: boolean;
}

function formatShortWeekday(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

export const StreakCounter: React.FC<StreakCounterProps> = ({
  streak,
  roomCode,
  loading = false,
}) => {
  if (loading) {
    return (
      <div
        data-testid="streak-counter"
        className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6 space-y-4"
        aria-busy="true"
      >
        <div className="h-5 w-44 rounded bg-[#EFE9D8] dark:bg-[#2D3866]" />
        <div className="h-9 w-28 rounded bg-[#EFE9D8] dark:bg-[#2D3866]" />
      </div>
    );
  }

  const current = streak?.currentStreak ?? 0;
  const longest = streak?.longestStreak ?? 0;
  const totalDays = streak?.totalActiveDays ?? 0;
  const contributedToday = streak?.contributedToday ?? false;
  const recentDays = streak?.recentDays ?? [];

  const statusText = contributedToday
    ? 'Checked in today'
    : current > 0
      ? 'Contribute today to extend your streak'
      : 'Answer and draw today to begin your streak';

  return (
    <section
      data-testid="streak-counter"
      aria-labelledby="streak-counter-heading"
      className="rounded-2xl border border-[#E5DEC9] dark:border-[#3D4978] bg-white dark:bg-[#21294A] p-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Primary Consecutive Day Count + Context */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#555E72] dark:text-[#BDC7E3]">
            <Flame
              className={`w-4 h-4 shrink-0 ${
                current > 0
                  ? 'text-[#D97706] dark:text-[#F8E166]'
                  : 'text-[#8C95AA] dark:text-[#7F8DB2]'
              }`}
              aria-hidden="true"
            />
            <span id="streak-counter-heading" className="font-semibold text-[#1F2A3C] dark:text-slate-100">
              Room Contribution Streak
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{roomCode}</span>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span
              data-testid="streak-counter-value"
              className="text-3xl sm:text-4xl font-bold font-mono-tabular tracking-tight text-[#1F2A3C] dark:text-white"
            >
              {current} {current === 1 ? 'day' : 'days'}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                contributedToday
                  ? 'text-[#2E7D5B] dark:text-[#7CD4C0]'
                  : 'text-[#555E72] dark:text-[#CBD5EB]'
              }`}
            >
              {contributedToday && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
              <span>{statusText}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono-tabular text-[#555E72] dark:text-[#BDC7E3]">
            <span>Best streak: {longest} {longest === 1 ? 'day' : 'days'}</span>
            <span aria-hidden="true">·</span>
            <span>Total active days: {totalDays}</span>
          </div>
        </div>

        {/* Right: Last 7 Days Check-In Strip */}
        {recentDays.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-[#555E72] dark:text-[#BDC7E3]">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Past 7 days</span>
            </div>
            <div className="grid grid-cols-7 gap-2" role="list" aria-label="Past 7 days of room contributions">
              {recentDays.map((day, idx) => {
                const isToday = idx === recentDays.length - 1;
                const label = isToday ? 'Today' : formatShortWeekday(day.date);
                return (
                  <div
                    key={day.date}
                    role="listitem"
                    aria-label={`${day.date}: ${day.active ? 'contributed' : 'no contribution'}`}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center border text-xs font-semibold transition-colors ${
                        day.active
                          ? 'bg-[#2E7D5B] dark:bg-[#7CD4C0] border-[#2E7D5B] dark:border-[#7CD4C0] text-white dark:text-[#182140]'
                          : 'bg-[#FAF6EC] dark:bg-[#19203E] border-[#E5DEC9] dark:border-[#3D4978] text-[#8C95AA] dark:text-[#7F8DB2]'
                      }`}
                    >
                      {day.active ? (
                        <Check className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <span className="font-mono-tabular text-[11px]">{day.date.slice(8)}</span>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-mono-tabular ${
                        isToday
                          ? 'font-semibold text-[#1F2A3C] dark:text-white'
                          : 'text-[#555E72] dark:text-[#BDC7E3]'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
