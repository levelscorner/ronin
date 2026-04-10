import { NavLink, useLocation } from 'react-router';
import { motion } from 'framer-motion';
import type { PropsWithChildren } from 'react';

const NAV_ITEMS = [
  {
    to: '/tracker',
    label: 'Tracker',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
        <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
        <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      </svg>
    ),
  },
  {
    to: '/evaluate',
    label: 'Evaluate',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1.5l1.5 3 3.5.5-2.5 2.5.5 3.5L8 9.5 4.5 11l.5-3.5L2.5 5l3.5-.5z" />
      </svg>
    ),
  },
  {
    to: '/cv',
    label: 'CV',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 1.5H4a1 1 0 00-1 1v11a1 1 0 001 1h8a1 1 0 001-1V5L9.5 1.5z" />
        <path d="M9.5 1.5V5H13" />
        <path d="M5.5 8.5h5M5.5 11h3" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="5" r="3" />
        <path d="M2.5 14.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="2" />
        <path d="M13.5 8a5.5 5.5 0 01-.3 1.8l1.3.8-1 1.7-1.4-.5a5.5 5.5 0 01-1.5 1l-.1 1.5h-2l-.1-1.5a5.5 5.5 0 01-1.5-1l-1.4.5-1-1.7 1.3-.8A5.5 5.5 0 015 8a5.5 5.5 0 01.3-1.8L4 5.4l1-1.7 1.4.5a5.5 5.5 0 011.5-1L8 1.7h2l.1 1.5a5.5 5.5 0 011.5 1l1.4-.5 1 1.7-1.3.8a5.5 5.5 0 01.3 1.8z" />
      </svg>
    ),
  },
] as const;

export function Shell({ children }: PropsWithChildren) {
  const location = useLocation();

  return (
    <div className="h-full flex flex-col">
      <header
        className="glass flex items-center justify-between px-5 py-3 relative"
        style={{
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          borderBottom: '1px solid var(--color-glass-border)',
          boxShadow: '0 1px 16px oklch(72% 0.18 55 / 0.06)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{
              background: 'var(--color-accent)',
              boxShadow: 'var(--glow-accent)',
            }}
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
        <nav className="flex items-center gap-0.5 text-[var(--text-xs)]" role="navigation" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-full)] transition-colors"
                style={{
                  color: isActive ? 'var(--color-ink)' : 'var(--color-ink-faint)',
                }}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-[var(--radius-full)]"
                    style={{
                      background: 'var(--color-glass)',
                      border: '1px solid var(--color-glass-border)',
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 35,
                    }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {item.icon}
                  <span className="hidden sm:inline">{item.label}</span>
                </span>
              </NavLink>
            );
          })}
        </nav>
      </header>
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {children}
        {/* bottom gradient fade */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-12"
          style={{
            background: 'linear-gradient(to top, var(--color-surface), transparent)',
          }}
        />
      </main>
    </div>
  );
}
