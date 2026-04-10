import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { getDb } from '../../background/storage/db';
import { saveCustomization } from '../../background/storage/profile';
import { PageTransition } from '../components/ui/PageTransition';
import { EmptyState } from '../components/ui/EmptyState';
import { ScoreDial } from '../components/ui/ScoreDial';
import { Button } from '../components/ui/Button';
import { ToggleSection } from '../components/ui/ToggleSection';
import { useApplication } from '../hooks/useApplications';
import { sendToBackground } from '../../shared/messages';
import {
  scoreBand,
  STATUS_LABELS,
  SCORE_BAND_LABELS,
  DIMENSION_KEYS,
  DIMENSION_LABELS,
} from '../../shared/constants';
import type { DimensionKey } from '../../shared/constants';
import type { OutputToggles } from '../../shared/types';

const DEFAULT_TOGGLES: OutputToggles = {
  gaps: true,
  keywords: true,
  dealBreakers: true,
  rawOutput: false,
  salary: false,
  interviewTips: false,
};

/** Map dimension keys to semantic section labels */
const SECTION_ICONS: Record<DimensionKey, string> = {
  matchCv: '\u2714',      // checkmark
  northStar: '\u2728',    // sparkle
  comp: '\u2696',         // balance
  cultural: '\u{1F91D}',  // handshake
  redFlags: '\u26A0',     // warning
};

const BAND_COLORS: Record<'strong' | 'good' | 'borderline' | 'weak', { bg: string; text: string; glow: string }> = {
  strong: { bg: 'var(--color-success-soft)', text: 'var(--color-success)', glow: 'var(--glow-success)' },
  good: { bg: 'var(--color-accent-soft)', text: 'var(--color-accent)', glow: 'var(--glow-accent)' },
  borderline: { bg: 'var(--color-accent-soft)', text: 'var(--color-warning)', glow: 'none' },
  weak: { bg: 'var(--color-danger-soft)', text: 'var(--color-danger)', glow: 'var(--glow-danger)' },
};

export function Report() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const application = useApplication(id);
  const reports = useLiveQuery(async () => {
    if (!id) return [];
    return getDb().reports.where('applicationId').equals(id).sortBy('version');
  }, [id]);
  const latest = (reports ?? []).at(-1);

  const customization = useLiveQuery(() => getDb().customization.get('singleton'), []);
  const toggles: OutputToggles = {
    ...DEFAULT_TOGGLES,
    ...customization?.outputToggles,
  };

  const handleToggle = useCallback(
    (key: keyof OutputToggles, next: boolean) => {
      void saveCustomization({
        outputToggles: { ...toggles, [key]: next },
      });
    },
    [toggles],
  );

  // Loading state for race condition (eval just completed, Dexie syncing)
  const [waitedForData, setWaitedForData] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaitedForData(true), 3000);
    return () => clearTimeout(t);
  }, [id]);
  useEffect(() => {
    if (application && latest) setWaitedForData(true);
  }, [application, latest]);

  if (!waitedForData && (!application || !latest)) {
    return (
      <PageTransition>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div
              className="inline-block w-8 h-8 border-2 rounded-full animate-spin mb-3"
              style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }}
            />
            <p className="text-[var(--text-sm)]" style={{ color: 'var(--color-ink-faint)' }}>
              Loading report...
            </p>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!application || !latest) {
    return (
      <PageTransition>
        <EmptyState
          title="Report not found"
          description="This application has no report yet, or it was deleted."
        />
      </PageTransition>
    );
  }

  const band = scoreBand(application.score);
  const bandColor = BAND_COLORS[band];
  const eval_ = latest.evaluation;

  // Separate strengths (score >= 4) from concerns (score < 3)
  const strengths = DIMENSION_KEYS.filter((k) => (eval_.dimensions[k]?.score ?? 0) >= 4);
  const concerns = DIMENSION_KEYS.filter((k) => (eval_.dimensions[k]?.score ?? 0) < 3);

  // Render the full analysis markdown
  const reportHtml = DOMPurify.sanitize(
    marked.parse(latest.markdown, { async: false }) as string,
  );

  return (
    <PageTransition>
      <div className="pb-8 space-y-4">
        {/* ---- HEADER: Score + Verdict + Actions ---- */}
        <div className="flex flex-col items-center gap-3 px-5 pt-5">
          <ScoreDial score={application.score} size={96} />
          <span
            className="inline-block px-4 py-1.5 rounded-[var(--radius-full)] text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em]"
            style={{ background: bandColor.bg, color: bandColor.text, boxShadow: bandColor.glow }}
          >
            {SCORE_BAND_LABELS[band]}
          </span>
          <div className="text-center w-full">
            <h1
              className="font-[var(--font-display)] text-[var(--text-xl)] font-medium tracking-tight"
              style={{ color: 'var(--color-ink)' }}
            >
              {application.role}
            </h1>
            <p className="text-[var(--text-sm)] truncate" style={{ color: 'var(--color-ink-soft)' }}>
              {application.company}
            </p>
            <p className="text-[var(--text-xs)] mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>
              {STATUS_LABELS[application.status]} {'\u00B7'} {application.date}
            </p>
          </div>
          <div className="flex gap-2 mt-1">
            <Button intent="accent" size="sm" onClick={() => {
              void sendToBackground({ type: 'ui:generatePdf', applicationId: application.id });
            }}>
              Generate CV PDF
            </Button>
            <a href={application.url} target="_blank" rel="noreferrer">
              <Button intent="ghost" size="sm">Open posting</Button>
            </a>
          </div>
        </div>

        {/* ---- TLDR summary ---- */}
        {eval_.tldr && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-5 p-4 rounded-[var(--radius-lg)] border text-[var(--text-sm)]"
            style={{
              background: 'var(--color-glass)',
              borderColor: 'var(--color-glass-border)',
              backdropFilter: 'blur(var(--blur-sm))',
              WebkitBackdropFilter: 'blur(var(--blur-sm))',
              color: 'var(--color-ink)',
            }}
          >
            {eval_.tldr}
          </motion.div>
        )}

        {/* ---- DIMENSION SCORES (always visible) ---- */}
        <div className="px-5">
          <h2
            className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.1em] mb-2"
            style={{ color: 'var(--color-ink-faint)' }}
          >
            Dimension Scores
          </h2>
          <div className="space-y-2">
            {DIMENSION_KEYS.map((key, i) => {
              const dim = eval_.dimensions[key];
              if (!dim) return null;
              const pct = Math.max(0, Math.min(100, (dim.score / 5) * 100));
              const barColor = dim.score >= 4
                ? 'var(--color-success)'
                : dim.score >= 3
                  ? 'var(--color-accent)'
                  : dim.score >= 2
                    ? 'var(--color-warning)'
                    : 'var(--color-danger)';
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="p-3 rounded-[var(--radius-md)] border"
                  style={{
                    background: 'var(--color-glass)',
                    borderColor: 'var(--color-glass-border)',
                    backdropFilter: 'blur(var(--blur-sm))',
                    WebkitBackdropFilter: 'blur(var(--blur-sm))',
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2">
                      <span>{SECTION_ICONS[key]}</span>
                      <span
                        className="text-[var(--text-xs)] font-medium uppercase tracking-[0.06em]"
                        style={{ color: 'var(--color-ink-soft)' }}
                      >
                        {DIMENSION_LABELS[key]}
                      </span>
                    </span>
                    <span
                      className="text-[var(--text-sm)] font-[var(--font-display)] font-semibold tabular-nums"
                      style={{ color: barColor }}
                    >
                      {dim.score.toFixed(1)}
                    </span>
                  </div>
                  {/* score bar */}
                  <div
                    className="h-1 rounded-full mb-2 overflow-hidden"
                    style={{ background: 'var(--color-surface-sunk)' }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.06 + 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full"
                      style={{ background: barColor }}
                    />
                  </div>
                  <p className="text-[var(--text-xs)] leading-relaxed" style={{ color: 'var(--color-ink-soft)' }}>
                    {dim.rationale}
                  </p>
                  {dim.evidence.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {dim.evidence.map((e, j) => (
                        <li
                          key={j}
                          className="text-[10px] pl-3 border-l-2"
                          style={{ borderColor: barColor, color: 'var(--color-ink-faint)' }}
                        >
                          {e}
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ---- STRENGTHS (if any scored 4+) ---- */}
        {strengths.length > 0 && (
          <ToggleSection label={`Strengths (${strengths.length})`} enabled onToggle={() => undefined}>
            <div className="space-y-2">
              {strengths.map((key) => {
                const dim = eval_.dimensions[key];
                return (
                  <div key={key} className="flex items-start gap-2 text-[var(--text-xs)]">
                    <span style={{ color: 'var(--color-success)' }}>{SECTION_ICONS[key]}</span>
                    <div>
                      <span className="font-medium" style={{ color: 'var(--color-ink)' }}>
                        {DIMENSION_LABELS[key]} ({dim?.score.toFixed(1)})
                      </span>
                      <p style={{ color: 'var(--color-ink-soft)' }}>{dim?.rationale}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ToggleSection>
        )}

        {/* ---- CONCERNS (if any scored <3) ---- */}
        {concerns.length > 0 && (
          <ToggleSection label={`Concerns (${concerns.length})`} enabled onToggle={() => undefined}>
            <div className="space-y-2">
              {concerns.map((key) => {
                const dim = eval_.dimensions[key];
                return (
                  <div key={key} className="flex items-start gap-2 text-[var(--text-xs)]">
                    <span style={{ color: 'var(--color-danger)' }}>{SECTION_ICONS[key]}</span>
                    <div>
                      <span className="font-medium" style={{ color: 'var(--color-ink)' }}>
                        {DIMENSION_LABELS[key]} ({dim?.score.toFixed(1)})
                      </span>
                      <p style={{ color: 'var(--color-ink-soft)' }}>{dim?.rationale}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ToggleSection>
        )}

        {/* ---- GAPS ANALYSIS (togglable) ---- */}
        <ToggleSection
          label="Gaps Analysis"
          enabled={toggles.gaps}
          onToggle={(next) => handleToggle('gaps', next)}
        >
          {eval_.gaps.length > 0 ? (
            <ul className="space-y-2">
              {eval_.gaps.map((gap, i) => (
                <li
                  key={i}
                  className="text-[var(--text-xs)] p-2.5 rounded-[var(--radius-md)] border"
                  style={{
                    borderColor: 'var(--color-glass-border)',
                    background: 'var(--color-surface-sunk)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[0.06em] font-semibold"
                      style={{
                        background: gap.severity === 'blocker' ? 'var(--color-danger-soft)'
                          : gap.severity === 'significant' ? 'var(--color-accent-soft)'
                          : 'var(--color-surface-raised)',
                        color: gap.severity === 'blocker' ? 'var(--color-danger)'
                          : gap.severity === 'significant' ? 'var(--color-accent-strong)'
                          : 'var(--color-ink-faint)',
                      }}
                    >
                      {gap.severity}
                    </span>
                    <span style={{ color: 'var(--color-ink)' }}>{gap.requirement}</span>
                  </div>
                  <p style={{ color: 'var(--color-ink-soft)' }}>{gap.mitigation}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[var(--text-xs)]" style={{ color: 'var(--color-ink-faint)' }}>
              No gaps identified.
            </p>
          )}
        </ToggleSection>

        {/* ---- DEAL BREAKERS (togglable, only if present) ---- */}
        {eval_.dealBreakers.length > 0 && (
          <ToggleSection
            label={`Deal Breakers (${eval_.dealBreakers.length})`}
            enabled={toggles.dealBreakers}
            onToggle={(next) => handleToggle('dealBreakers', next)}
          >
            <ul className="space-y-1.5">
              {eval_.dealBreakers.map((db, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-[var(--text-xs)]"
                  style={{ color: 'var(--color-danger)' }}
                >
                  <span className="shrink-0 mt-0.5">{'\u2715'}</span>
                  <span>{db}</span>
                </li>
              ))}
            </ul>
          </ToggleSection>
        )}

        {/* ---- ATS KEYWORDS (togglable) ---- */}
        <ToggleSection
          label="ATS Keywords"
          enabled={toggles.keywords}
          onToggle={(next) => handleToggle('keywords', next)}
        >
          {eval_.keywords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {eval_.keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-block px-2 py-1 rounded-[var(--radius-sm)] text-[var(--text-xs)] font-medium"
                  style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-strong)' }}
                >
                  {kw}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[var(--text-xs)]" style={{ color: 'var(--color-ink-faint)' }}>
              No keywords extracted.
            </p>
          )}
        </ToggleSection>

        {/* ---- FULL ANALYSIS (togglable, collapsed by default) ---- */}
        <ToggleSection
          label="Full Analysis"
          enabled={toggles.rawOutput}
          onToggle={(next) => handleToggle('rawOutput', next)}
        >
          <article
            className="prose prose-sm prose-invert max-w-none"
            style={{ color: 'var(--color-ink)' }}
            dangerouslySetInnerHTML={{ __html: reportHtml }}
          />
        </ToggleSection>

        {/* ---- BACK TO TRACKER ---- */}
        <div className="px-5 pt-2">
          <Button intent="ghost" size="sm" className="w-full" onClick={() => navigate('/tracker')}>
            {'\u2190'} Back to Tracker
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
