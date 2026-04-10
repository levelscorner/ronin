import { useEffect, useState } from 'react';
import { getDb } from '../background/storage/db';
import type { Application } from '../shared/types';
import { scoreBand } from '../shared/constants';

interface PopupStats {
  total: number;
  avg: number;
  latest: Application | null;
}

export default function Popup() {
  const [stats, setStats] = useState<PopupStats>({
    total: 0,
    avg: 0,
    latest: null,
  });

  useEffect(() => {
    void (async () => {
      const all = await getDb().applications.toArray();
      const sum = all.reduce((a, b) => a + b.score, 0);
      const sorted = [...all].sort((a, b) => b.updatedAt - a.updatedAt);
      setStats({
        total: all.length,
        avg: all.length ? sum / all.length : 0,
        latest: sorted[0] ?? null,
      });
    })();
  }, []);

  const avgBand = stats.avg ? scoreBand(stats.avg) : null;
  const avgColor = avgBand
    ? { strong: 'var(--color-success)', good: 'var(--color-accent)', borderline: 'var(--color-warning)', weak: 'var(--color-danger)' }[avgBand]
    : 'var(--color-ink-faint)';

  return (
    <div
      className="w-[320px] p-5 font-[var(--font-sans)]"
      style={{ background: 'var(--color-surface)', color: 'var(--color-ink)', colorScheme: 'dark' }}
    >
      {/* header */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ background: 'var(--color-accent)', boxShadow: '0 0 12px var(--color-accent)' }}
        />
        <span
          className="font-[var(--font-display)] font-semibold tracking-tight text-[var(--text-lg)]"
          style={{
            background: 'linear-gradient(135deg, var(--color-accent), var(--color-ink))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Trishula
        </span>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-2 text-[var(--text-sm)]">
        <div
          className="p-3 rounded-[var(--radius-md)] border"
          style={{
            background: 'var(--color-glass)',
            borderColor: 'var(--color-glass-border)',
            backdropFilter: 'blur(var(--blur-sm))',
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-ink-faint)' }}>
            Applications
          </div>
          <div className="font-[var(--font-display)] text-[var(--text-xl)] font-semibold tabular-nums">
            {stats.total}
          </div>
        </div>
        <div
          className="p-3 rounded-[var(--radius-md)] border"
          style={{
            background: 'var(--color-glass)',
            borderColor: 'var(--color-glass-border)',
            backdropFilter: 'blur(var(--blur-sm))',
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-ink-faint)' }}>
            Avg Score
          </div>
          <div
            className="font-[var(--font-display)] text-[var(--text-xl)] font-semibold tabular-nums"
            style={{ color: avgColor }}
          >
            {stats.avg ? stats.avg.toFixed(1) : '\u2014'}
          </div>
        </div>
      </div>

      {/* latest application */}
      {stats.latest && (
        <div
          className="mt-3 p-3 rounded-[var(--radius-md)] border text-[var(--text-xs)]"
          style={{
            background: 'var(--color-glass)',
            borderColor: 'var(--color-glass-border)',
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--color-ink-faint)' }}>
            Most recent
          </div>
          <div className="truncate font-medium" style={{ color: 'var(--color-ink)' }}>
            {stats.latest.role}
          </div>
          <div className="truncate" style={{ color: 'var(--color-ink-soft)' }}>
            {stats.latest.company}
          </div>
        </div>
      )}

      {/* open side panel */}
      <button
        onClick={() => {
          if (chrome.sidePanel) {
            chrome.sidePanel.open({ windowId: chrome.windows?.WINDOW_ID_CURRENT }).catch(() => undefined);
          }
        }}
        className="w-full mt-4 h-10 rounded-[var(--radius-md)] text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] transition-all active:scale-[0.97]"
        style={{
          background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-strong))',
          color: 'var(--color-surface)',
          boxShadow: 'var(--shadow-accent)',
        }}
      >
        Open side panel
      </button>
    </div>
  );
}
