// Dispatcher: picks the first detector that claims the current page.
// Detectors are tried in specificity order (most specific first).

import type { JobPosting } from '../shared/types';
import type { Detector } from './detectors/types';
import { linkedinDetector } from './detectors/linkedin';
import { greenhouseDetector } from './detectors/greenhouse';
import { ashbyDetector } from './detectors/ashby';
import { leverDetector } from './detectors/lever';
import { naukriDetector } from './detectors/naukri';
import { founditDetector } from './detectors/foundit';
import { instahyreDetector } from './detectors/instahyre';
import { hiristDetector } from './detectors/hirist';
import { cutshortDetector } from './detectors/cutshort';
import { shineDetector } from './detectors/shine';
import { genericDetector } from './detectors/generic';

// Order matters: per-portal detectors run first so `source` is tagged with
// the real portal id. genericDetector claims any page with a JSON-LD
// JobPosting block, so it must stay at the end as a catch-all.
const DETECTORS: readonly Detector[] = [
  linkedinDetector,
  greenhouseDetector,
  ashbyDetector,
  leverDetector,
  naukriDetector,
  founditDetector,
  instahyreDetector,
  hiristDetector,
  cutshortDetector,
  shineDetector,
  genericDetector,
];

export function pickDetector(url: URL): Detector | null {
  return DETECTORS.find((d) => d.matches(url)) ?? null;
}

export function extractCurrentJob(): JobPosting | null {
  const url = new URL(window.location.href);
  const detector = pickDetector(url);
  if (!detector) return null;
  try {
    const result = detector.extract();
    if (!result) {
      // eslint-disable-next-line no-console
      console.debug(`[career-ops] ${detector.id} matched ${url.href} but extract() returned null — check selectors`);
    }
    return result;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[career-ops] ${detector.id} detector failed`, err);
    return null;
  }
}
