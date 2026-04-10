# Contributing to Trishula

Thanks for considering a contribution. This guide gets you from clone to merged PR.

## Setup

```bash
git clone https://github.com/levelscorner/trishula.git
cd trishula
npm install
npm run dev          # Chrome dev build + hot reload
npm run dev:firefox  # Firefox dev build
```

Load the extension:
- **Chrome:** `chrome://extensions` -> Developer mode -> Load unpacked -> `.output/chrome-mv3-dev`
- **Firefox:** `about:debugging#/runtime/this-firefox` -> Load Temporary Add-on -> `.output/firefox-mv2/manifest.json`

## Adding a new job board detector

This is the most common contribution. Each detector teaches Trishula how to extract job data from a specific site.

### 1. Create the detector file

Copy an existing detector as a starting point. `src/content/detectors/greenhouse.ts` is a good template (simple, well-structured).

```bash
cp src/content/detectors/greenhouse.ts src/content/detectors/yourboard.ts
```

### 2. Implement the Detector interface

Every detector has 3 things:

```typescript
import type { Detector } from './types';

export const yourboardDetector: Detector = {
  id: 'yourboard',

  // Does this URL belong to your job board? Keep this cheap.
  matches(url) {
    return url.hostname === 'yourboard.com' && /\/jobs\//.test(url.pathname);
  },

  // Extract job data from the current page DOM.
  // Return null if the page doesn't have enough info.
  extract(): JobPosting | null {
    const title = text(document.querySelector('h1.job-title'));
    const company = text(document.querySelector('.company-name'));
    const descriptionEl = document.querySelector('.job-description');

    if (!title || !company || !descriptionEl) return null;

    return {
      url: window.location.href,
      source: 'yourboard',
      company,
      role: title,
      location: text(document.querySelector('.location')) || null,
      remote: pickRemote(descriptionMarkdown),
      salary: extractSalary(descriptionMarkdown),
      descriptionMarkdown: markdownFromNode(descriptionEl),
      language: pickLanguage(descriptionMarkdown),
      extractedAt: Date.now(),
    };
  },
};
```

Helper functions from `types.ts` you'll use:
- `text(el)` - safely extracts trimmed text content
- `markdownFromNode(el)` - converts HTML to lightweight markdown
- `extractSalary(text)` - regex-based salary extraction (LPA, USD, EUR)
- `pickRemote(text)` - classifies remote/hybrid/onsite/unknown
- `pickLanguage(text)` - detects language from keywords

### 3. Register the detector

Add your detector to `src/content/extractor.ts`:

```typescript
import { yourboardDetector } from './detectors/yourboard';

const DETECTORS: readonly Detector[] = [
  // ... existing detectors (most specific first)
  yourboardDetector,
  genericDetector, // always last — catches JSON-LD
];
```

### 4. Add host permissions

In `wxt.config.ts`, add the domain to `host_permissions`:

```typescript
host_permissions: [
  // ... existing
  'https://*.yourboard.com/*',
],
```

And add match patterns to `src/entrypoints/content.ts`:

```typescript
matches: [
  // ... existing
  'https://*.yourboard.com/jobs/*',
],
```

### 5. Test it

```bash
npm run compile    # type check
npm run test       # unit tests
npm run build      # production build
```

Then load the extension and navigate to a job posting on your board. Open devtools console. You should see either:
- The floating badge appears (extraction succeeded)
- `[trishula] yourboard matched <url> but extract() returned null` (selectors need fixing)

### 6. Add a test fixture (optional but appreciated)

Save a sample HTML page to `tests/fixtures/yourboard/` and write a Vitest case:

```typescript
// tests/detectors/yourboard.test.ts
import { yourboardDetector } from '../../src/content/detectors/yourboard';

test('extracts job posting from yourboard', () => {
  document.body.innerHTML = await readFile('tests/fixtures/yourboard/sample.html');
  const job = yourboardDetector.extract();
  expect(job).not.toBeNull();
  expect(job!.company).toBe('Expected Company');
});
```

## Adding a new pipeline mode

See `CLAUDE.md` section "Adding a new pipeline mode" for the full process. The short version:

1. Write prompt markdown in `src/assets/modes/{name}.md`
2. Run `npm run modes:bundle` to regenerate the modes TypeScript
3. Implement the pipeline in `src/background/pipeline/{name}.ts`
4. Wire it into the message router (`src/background/messages.ts`)
5. Add the UI route in `src/sidepanel/routes/`

## Code style

- TypeScript strict, no `any`
- Immutable patterns (spread, don't mutate)
- Files under 800 lines, functions under 50 lines
- CSS uses custom properties from `src/sidepanel/styles/tokens.css`
- Warm amber accent (`oklch(72% 0.18 55)`), no purple/blue gradients

## Running tests

```bash
npm run test           # run once
npm run test:watch     # watch mode
npm run compile        # type check only
npm run build          # full production build
```

## Commit messages

```
<type>: <description>

Types: feat, fix, refactor, docs, test, chore, perf
```
