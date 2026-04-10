import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router';
import { useApplications } from '../hooks/useApplications';
import { PageTransition } from '../components/ui/PageTransition';
import { EmptyState } from '../components/ui/EmptyState';
import { STATUS_LABELS, scoreBand } from '../../shared/constants';
import { format } from 'date-fns/format';

export function Tracker() {
  const applications = useApplications();

  return (
    <PageTransition>
      <div className="flex items-baseline justify-between px-5 pt-5 pb-3">
        <h1
          className="font-[var(--font-display)] text-[var(--text-2xl)] font-medium tracking-tight"
          style={{
            background: 'linear-gradient(135deg, var(--color-ink), var(--color-ink-soft))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Tracker
        </h1>
        <span className="text-[var(--text-xs)]" style={{ color: 'var(--color-ink-faint)' }}>
          {applications.length} {applications.length === 1 ? 'application' : 'applications'}
        </span>
      </div>

      {applications.length === 0 ? (
        <EmptyState
          title="No evaluations yet"
          description="Open any LinkedIn, Greenhouse, Ashby or Lever posting. The Trishula badge will appear — one click to evaluate."
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-5 space-y-2">
          <AnimatePresence initial={false}>
            {applications.map((app, index) => {
              const band = scoreBand(app.score);
              const bandColor =
                band === 'strong'
                  ? 'var(--color-success)'
                  : band === 'good'
                    ? 'var(--color-accent-strong)'
                    : band === 'borderline'
                      ? 'var(--color-warning)'
                      : 'var(--color-danger)';
              const glowStyle =
                band === 'strong'
                  ? '0 0 16px oklch(65% 0.17 145 / 0.3)'
                  : band === 'good'
                    ? '0 0 16px oklch(72% 0.18 55 / 0.3)'
                    : band === 'borderline'
                      ? '0 0 16px oklch(78% 0.16 85 / 0.2)'
                      : '0 0 16px oklch(60% 0.22 28 / 0.2)';
              const scorePercent = Math.min(100, (app.score / 5) * 100);

              return (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{
                    duration: 0.3,
                    ease: [0.16, 1, 0.3, 1],
                    delay: index * 0.04,
                  }}
                >
                  <Link
                    to={`/report/${app.id}`}
                    className="group block rounded-[var(--radius-lg)] border p-4 transition-all duration-[260ms] hover:-translate-y-[2px] relative overflow-hidden"
                    style={{
                      borderColor: 'var(--color-glass-border)',
                      background: 'var(--color-glass)',
                      backdropFilter: 'blur(var(--blur-md))',
                      WebkitBackdropFilter: 'blur(var(--blur-md))',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = `var(--shadow-md), ${glowStyle}`;
                      e.currentTarget.style.borderColor = 'oklch(72% 0.18 55 / 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '';
                      e.currentTarget.style.borderColor = '';
                    }}
                  >
                    {/* thin score progress bar at top */}
                    <div
                      aria-hidden="true"
                      className="absolute top-0 left-0 h-[2px] transition-all duration-700"
                      style={{
                        width: `${scorePercent}%`,
                        background: `linear-gradient(90deg, ${bandColor}, transparent)`,
                        opacity: 0.6,
                      }}
                    />
                    <div className="flex items-start gap-4">
                      {/* score badge with glow halo */}
                      <div
                        className="flex-shrink-0 rounded-[var(--radius-md)] w-14 h-14 flex flex-col items-center justify-center font-[var(--font-display)] font-semibold relative"
                        style={{
                          background: 'var(--color-surface-sunk)',
                          color: bandColor,
                          boxShadow: glowStyle,
                        }}
                      >
                        <span className="text-[var(--text-xl)] leading-none tabular-nums">
                          {app.score.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3
                            className="font-[var(--font-display)] font-medium truncate"
                            style={{ color: 'var(--color-ink)' }}
                          >
                            {app.role}
                          </h3>
                          <span
                            className="text-[var(--text-xs)] uppercase tracking-[0.08em] shrink-0"
                            style={{ color: 'var(--color-ink-faint)' }}
                          >
                            {STATUS_LABELS[app.status]}
                          </span>
                        </div>
                        <p
                          className="text-[var(--text-sm)] truncate"
                          style={{ color: 'var(--color-ink-soft)' }}
                        >
                          {app.company}
                        </p>
                        <p
                          className="text-[var(--text-xs)] mt-1.5 line-clamp-1"
                          style={{ color: 'var(--color-ink-faint)' }}
                        >
                          {app.notes || format(new Date(app.date), 'PP')}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </PageTransition>
  );
}
