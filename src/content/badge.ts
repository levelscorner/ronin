// Floating "Evaluate with Trishula" badge injected into job pages.
// Shadow DOM isolated so host CSS can't bleed in, and pinned bottom-right
// with Framer-free vanilla CSS transitions to keep the content bundle small.

import type { JobPosting } from '../shared/types';

export interface BadgeController {
  update(job: JobPosting | null): void;
  destroy(): void;
}

export function mountBadge(
  onClick: (job: JobPosting) => void,
  initial: JobPosting | null,
): BadgeController {
  let currentJob: JobPosting | null = initial;

  const host = document.createElement('div');
  host.id = 'trishula-badge-host';
  host.style.cssText = `
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .badge {
      all: initial;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px 12px 14px;
      background: oklch(20% 0.015 255);
      color: oklch(97% 0.008 85);
      border: 1px solid oklch(36% 0.02 255);
      border-radius: 999px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 12px 32px oklch(0% 0 0 / 0.3), 0 0 0 4px oklch(72% 0.18 55 / 0.12);
      opacity: 0;
      transform: translateY(12px) scale(0.96);
      transition:
        opacity 280ms cubic-bezier(0.16, 1, 0.3, 1),
        transform 280ms cubic-bezier(0.16, 1, 0.3, 1),
        box-shadow 260ms ease,
        background 200ms ease;
    }
    .badge.in {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .badge:hover {
      background: oklch(24% 0.02 255);
      box-shadow: 0 16px 40px oklch(0% 0 0 / 0.4), 0 0 0 6px oklch(72% 0.18 55 / 0.18);
    }
    .badge:active {
      transform: translateY(0) scale(0.98);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: oklch(72% 0.18 55);
      box-shadow: 0 0 12px oklch(72% 0.18 55 / 0.8);
    }
    .label { letter-spacing: 0.01em; }
    .label small {
      display: block;
      font-weight: 400;
      font-size: 10.5px;
      color: oklch(70% 0.012 85);
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
  `;
  shadow.appendChild(style);

  const button = document.createElement('button');
  button.className = 'badge';
  button.innerHTML =
    '<span class="dot"></span><span class="label">Evaluate with Trishula<small>A–F scoring · streaming</small></span>';
  button.addEventListener('click', () => {
    if (currentJob) onClick(currentJob);
  });
  shadow.appendChild(button);

  // Only show badge when a job is actually detected.
  host.style.display = initial ? 'block' : 'none';
  document.documentElement.appendChild(host);
  // Trigger entrance animation next frame so the transition runs.
  if (initial) {
    requestAnimationFrame(() => button.classList.add('in'));
  }

  return {
    update(job) {
      currentJob = job;
      if (job) {
        host.style.display = 'block';
        // Trigger entrance animation if not already visible.
        if (!button.classList.contains('in')) {
          requestAnimationFrame(() => button.classList.add('in'));
        }
      } else {
        host.style.display = 'none';
        button.classList.remove('in');
      }
    },
    destroy() {
      host.remove();
    },
  };
}
