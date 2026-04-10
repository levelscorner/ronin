import { describe, expect, it, afterEach } from 'vitest';
import { mountBadge, type BadgeController } from '../../src/content/badge';
import type { JobPosting } from '../../src/shared/types';

const FAKE_JOB: JobPosting = {
  url: 'https://example.com/job/123',
  source: 'linkedin',
  company: 'Acme Inc',
  role: 'Senior Engineer',
  location: 'Remote',
  remote: 'remote',
  salary: null,
  descriptionMarkdown: 'A '.repeat(40) + 'real job description here.',
  language: 'en',
  extractedAt: Date.now(),
};

describe('mountBadge', () => {
  let controller: BadgeController | null = null;

  afterEach(() => {
    controller?.destroy();
    controller = null;
  });

  it('has display:none when initial job is null', () => {
    controller = mountBadge(() => {}, null);
    const host = document.getElementById('trishula-badge-host');
    expect(host).not.toBeNull();
    expect(host!.style.display).toBe('none');
  });

  it('has display:block when initial job is provided', () => {
    controller = mountBadge(() => {}, FAKE_JOB);
    const host = document.getElementById('trishula-badge-host');
    expect(host).not.toBeNull();
    expect(host!.style.display).toBe('block');
  });
});
