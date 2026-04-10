# Trishula

> AI reconnaissance for your career.

A browser-native port of [career-ops](https://github.com/santifer/career-ops) — the same A–F scoring, tracker, CV generation, and pipeline modes, but running as a cross-browser MV3 extension that lives next to the job postings you're already browsing.

## Why a browser extension

- **One click to evaluate.** A small badge appears on every LinkedIn, Greenhouse, Ashby, Lever, Wellfound, Workable, and SmartRecruiters job posting. Click it → the side panel opens with a live-streaming A–F evaluation.
- **Zero install friction.** No Node, no Playwright, no CLI. Just add to browser.
- **Verification is free.** The extension _is_ the browser, so there's no "is this offer still live?" — the current DOM is the answer.
- **Private by default.** Everything lives in IndexedDB inside your browser profile. Your Anthropic API key stays in `chrome.storage.local`. Nothing leaves the machine except the API call to Claude.

## Status

Early development. See the `phases` list in `CLAUDE.md` for the roadmap. MVP goal: onboarding → evaluate a LinkedIn posting → tracker → ATS PDF.

## Install (development)

```bash
git clone <this repo>
cd trishula
npm install
npm run dev           # Chrome
npm run dev:firefox   # Firefox
```

Then:

- **Chrome:** `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3-dev`
- **Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `.output/firefox-mv2/manifest.json`

Open the side panel from the extension toolbar icon. On first run the onboarding wizard asks for your Anthropic API key, CV, and profile.

## Knowledge base

`knowledge-base/` is a **verbatim snapshot** of the original career-ops repo at scaffold time. It's a frozen reference — never edit it, never sync it back. See `knowledge-base/README.md` for details.

## License

MIT. Portions derived from career-ops by Santiago Fernández de Valderrama.
