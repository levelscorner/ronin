import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEvaluateStore } from '../stores/evaluate';
import { PageTransition } from '../components/ui/PageTransition';
import { EmptyState } from '../components/ui/EmptyState';
import { ScoreDial } from '../components/ui/ScoreDial';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ToggleSection } from '../components/ui/ToggleSection';
import { DIMENSION_KEYS, DIMENSION_LABELS } from '../../shared/constants';
import { sendToBackground } from '../../shared/messages';
import { getDb } from '../../background/storage/db';
import { saveCustomization } from '../../background/storage/profile';
import type { OutputToggles } from '../../shared/types';

const DEFAULT_TOGGLES: OutputToggles = {
  gaps: true,
  keywords: true,
  dealBreakers: true,
  rawOutput: false,
  salary: false,
  interviewTips: false,
};

const PROGRESS_STEPS = [
  { key: 'archetype', label: 'Identifying archetype' },
  { key: 'dimensions', label: 'Scoring dimensions' },
  { key: 'matchCv', label: 'Matching CV' },
  { key: 'northStar', label: 'Career alignment' },
  { key: 'comp', label: 'Compensation' },
  { key: 'cultural', label: 'Cultural fit' },
  { key: 'redFlags', label: 'Red flags' },
  { key: 'globalScore', label: 'Final score' },
  { key: 'verdict', label: 'Verdict' },
  { key: 'gaps', label: 'Gap analysis' },
  { key: 'keywords', label: 'ATS keywords' },
] as const;

export function Evaluate() {
  const { status, buffer, result, error, reset } = useEvaluateStore();
  const navigate = useNavigate();
  const [pasted, setPasted] = useState('');
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    if (status !== 'idle') setSubmitting(false);
  }, [status]);

  useEffect(() => {
    if (status === 'done' && result) {
      // Auto-navigate once the eval completes.
      const t = setTimeout(() => navigate(`/report/${result.application.id}`), 1200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [status, result, navigate]);

  if (status === 'idle') {
    return (
      <PageTransition>
        <EmptyState
          title="Ready to evaluate"
          description="Open a job posting in another tab and click the Trishula badge — or paste a JD below."
        >
          <Card className="w-full max-w-md p-4 space-y-3 text-left">
            {/* floating label textarea */}
            <div className="relative">
              <label
                className="absolute left-3 top-2 text-[10px] font-medium uppercase tracking-[0.08em] pointer-events-none"
                style={{ color: 'var(--color-ink-faint)' }}
              >
                Paste JD (markdown or plain text)
              </label>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="Paste the full job description here..."
                className="w-full min-h-[160px] p-3 pt-7 rounded-[var(--radius-md)] border text-[var(--text-sm)] resize-y"
                style={{
                  borderColor: 'var(--color-glass-border)',
                  background: 'var(--color-surface-sunk)',
                  color: 'var(--color-ink)',
                }}
              />
              <span
                className="absolute right-3 bottom-3 text-[10px] tabular-nums"
                style={{ color: 'var(--color-ink-faint)' }}
              >
                {pasted.length.toLocaleString()} chars
              </span>
            </div>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Source URL (optional)"
              className="w-full h-9 px-3 rounded-[var(--radius-md)] border text-[var(--text-sm)]"
              style={{
                borderColor: 'var(--color-glass-border)',
                background: 'var(--color-surface-sunk)',
                color: 'var(--color-ink)',
              }}
            />
            <div className="flex justify-end">
              <Button
                intent="accent"
                disabled={pasted.trim().length < 80 || submitting}
                onClick={() => {
                  setSubmitting(true);
                  void sendToBackground({
                    type: 'ui:evaluatePastedJd',
                    jd: pasted.trim(),
                    url: url.trim() || null,
                  });
                }}
              >
                {submitting ? 'Evaluating\u2026' : 'Evaluate'}
              </Button>
            </div>
          </Card>
        </EmptyState>
      </PageTransition>
    );
  }

  if (status === 'error') {
    return (
      <PageTransition>
        <EmptyState title="Evaluation failed" description={error ?? 'Unknown error'}>
          <Button intent="ghost" onClick={reset}>
            Try again
          </Button>
        </EmptyState>
      </PageTransition>
    );
  }

  // streaming or done — show live buffer and dial
  const streamProgress = status === 'streaming' ? parseStreamProgress(buffer) : null;

  // Determine which progress steps are completed
  const completedSteps = new Set<string>();
  if (streamProgress) {
    for (const s of PROGRESS_STEPS) {
      if (buffer.includes(`"${s.key}"`)) {
        completedSteps.add(s.key);
      }
    }
  }

  return (
    <PageTransition>
      <div className="px-5 pt-5 pb-3 flex flex-col items-center gap-4">
        {/* larger dial during streaming */}
        <ScoreDial
          score={result?.evaluation.globalScore ?? estimateScoreFromBuffer(buffer)}
          size={status === 'streaming' ? 120 : 96}
          streaming={status === 'streaming'}
        />
        <div className="text-center min-w-0">
          <h2
            className="font-[var(--font-display)] text-[var(--text-xl)] font-medium tracking-tight"
            style={{ color: 'var(--color-ink)' }}
          >
            {result?.application.role ?? 'Evaluating...'}
          </h2>
          <p className="text-[var(--text-sm)] truncate" style={{ color: 'var(--color-ink-soft)' }}>
            {result?.application.company ?? streamProgress?.step ?? 'Analyzing job description...'}
          </p>
        </div>
      </div>

      {/* vertical timeline during streaming */}
      {status === 'streaming' && (
        <div className="px-6 pb-4">
          <div className="flex flex-col gap-0">
            {PROGRESS_STEPS.map((s, i) => {
              const done = completedSteps.has(s.key);
              const isLast = i === PROGRESS_STEPS.length - 1;
              return (
                <div key={s.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <motion.div
                      animate={{
                        background: done ? 'var(--color-accent)' : 'var(--color-border)',
                        scale: done ? 1 : 0.7,
                      }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        boxShadow: done ? '0 0 8px oklch(72% 0.18 55 / 0.4)' : 'none',
                      }}
                    />
                    {!isLast && (
                      <div
                        className="w-[1px] h-3"
                        style={{
                          background: done ? 'var(--color-accent)' : 'var(--color-border)',
                          opacity: done ? 0.5 : 0.2,
                        }}
                      />
                    )}
                  </div>
                  <span
                    className="text-[var(--text-xs)] -mt-0.5 pb-1"
                    style={{
                      color: done ? 'var(--color-ink-soft)' : 'var(--color-ink-faint)',
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result && (
        <div className="px-5 pb-3 grid grid-cols-2 gap-2">
          {DIMENSION_KEYS.map((key, i) => {
            const dim = result.evaluation.dimensions[key];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  ease: [0.16, 1, 0.3, 1],
                  delay: i * 0.08,
                }}
                className="p-3 rounded-[var(--radius-md)] border text-[var(--text-xs)]"
                style={{
                  background: 'var(--color-glass)',
                  borderColor: 'var(--color-glass-border)',
                  backdropFilter: 'blur(var(--blur-sm))',
                  WebkitBackdropFilter: 'blur(var(--blur-sm))',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="uppercase tracking-[0.08em]"
                    style={{ color: 'var(--color-ink-faint)' }}
                  >
                    {DIMENSION_LABELS[key]}
                  </span>
                  <span className="tabular-nums font-[var(--font-display)] font-semibold" style={{ color: 'var(--color-ink)' }}>
                    {dim?.score?.toFixed(1) ?? '\u2014'}
                  </span>
                </div>
                <p style={{ color: 'var(--color-ink-soft)' }}>{dim?.rationale ?? ''}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {status === 'done' && result && (
        <div className="px-5 pb-3 space-y-2">
          <ToggleSection
            label="Gaps Analysis"
            enabled={toggles.gaps}
            onToggle={(next) => handleToggle('gaps', next)}
          >
            {result.evaluation.gaps.length > 0 ? (
              <ul className="space-y-2">
                {result.evaluation.gaps.map((gap, i) => (
                  <li
                    key={i}
                    className="text-[var(--text-xs)] p-2 rounded-[var(--radius-sm)] border"
                    style={{
                      borderColor: 'var(--color-glass-border)',
                      background: 'var(--color-surface-sunk)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[0.06em] font-semibold"
                        style={{
                          background:
                            gap.severity === 'blocker'
                              ? 'var(--color-danger-soft)'
                              : gap.severity === 'significant'
                                ? 'var(--color-accent-soft)'
                                : 'var(--color-surface-raised)',
                          color:
                            gap.severity === 'blocker'
                              ? 'var(--color-danger)'
                              : gap.severity === 'significant'
                                ? 'var(--color-accent-strong)'
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

          <ToggleSection
            label="ATS Keywords"
            enabled={toggles.keywords}
            onToggle={(next) => handleToggle('keywords', next)}
          >
            {result.evaluation.keywords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {result.evaluation.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-block px-2 py-1 rounded-[var(--radius-sm)] text-[var(--text-xs)] font-medium"
                    style={{
                      background: 'var(--color-accent-soft)',
                      color: 'var(--color-accent-strong)',
                    }}
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

          {result.evaluation.dealBreakers.length > 0 && (
            <ToggleSection
              label="Deal Breakers"
              enabled={toggles.dealBreakers}
              onToggle={(next) => handleToggle('dealBreakers', next)}
            >
              <ul className="space-y-1">
                {result.evaluation.dealBreakers.map((db, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[var(--text-xs)]"
                    style={{ color: 'var(--color-danger)' }}
                  >
                    <span className="shrink-0 mt-0.5">&#x2715;</span>
                    <span>{db}</span>
                  </li>
                ))}
              </ul>
            </ToggleSection>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
        <ToggleSection
          label="Raw Output"
          enabled={toggles.rawOutput}
          onToggle={(next) => handleToggle('rawOutput', next)}
        >
          <pre
            className="whitespace-pre-wrap font-[var(--font-mono)] text-[var(--text-xs)] leading-relaxed p-4 rounded-[var(--radius-md)] border"
            style={{
              background: 'var(--color-surface-sunk)',
              borderColor: 'var(--color-glass-border)',
              color: 'var(--color-ink-soft)',
            }}
          >
            {buffer || '\u2026'}
          </pre>
        </ToggleSection>
      </div>
    </PageTransition>
  );
}

function estimateScoreFromBuffer(buffer: string): number {
  const m = buffer.match(/"globalScore"\s*:\s*(\d(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

/** Parse partial JSON stream to show progress to the user. */
function parseStreamProgress(buffer: string): {
  step: string;
  verdict: string | null;
  tldr: string | null;
} {
  // Detect which fields have appeared in the stream so far
  const hasArchetype = buffer.includes('"archetype"');
  const hasDimensions = buffer.includes('"dimensions"');
  const hasMatchCv = buffer.includes('"matchCv"');
  const hasNorthStar = buffer.includes('"northStar"');
  const hasComp = buffer.includes('"comp"');
  const hasCultural = buffer.includes('"cultural"');
  const hasRedFlags = buffer.includes('"redFlags"');
  const hasGlobalScore = buffer.includes('"globalScore"');
  const hasVerdict = buffer.includes('"verdict"');
  const hasTldr = buffer.includes('"tldr"');
  const hasGaps = buffer.includes('"gaps"');
  const hasKeywords = buffer.includes('"keywords"');

  // Extract verdict and tldr if available
  const verdictMatch = buffer.match(/"verdict"\s*:\s*"(strong|good|borderline|weak)"/);
  const tldrMatch = buffer.match(/"tldr"\s*:\s*"([^"]+)"/);

  let step = 'Starting evaluation...';
  if (hasKeywords) step = 'Extracting ATS keywords...';
  else if (hasGaps) step = 'Identifying gaps...';
  else if (hasTldr) step = 'Writing summary...';
  else if (hasVerdict) step = 'Determining verdict...';
  else if (hasGlobalScore) step = 'Computing overall score...';
  else if (hasRedFlags) step = 'Checking red flags...';
  else if (hasCultural) step = 'Assessing cultural fit...';
  else if (hasComp) step = 'Analyzing compensation...';
  else if (hasNorthStar) step = 'Evaluating career alignment...';
  else if (hasMatchCv) step = 'Matching against CV...';
  else if (hasDimensions) step = 'Scoring dimensions...';
  else if (hasArchetype) step = 'Identifying role archetype...';

  return {
    step,
    verdict: verdictMatch?.[1] ?? null,
    tldr: tldrMatch?.[1] ?? null,
  };
}
