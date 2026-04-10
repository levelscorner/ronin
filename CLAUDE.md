# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`career-ops-plugin` is a **Chrome + Firefox browser extension** that ports the [career-ops](https://github.com/santifer/career-ops) Claude Code skill system into a browser-native tool. It runs entirely on the user's machine: content scripts detect job postings on LinkedIn/Greenhouse/Ashby/Lever, the background service worker calls the Anthropic API directly, IndexedDB stores the tracker, and pdf-lib renders ATS-safe CVs from an offscreen document.

No server. No CLI. No Playwright install. One-click install.

## Stack

- **WXT 0.19** — cross-browser MV3 framework built on Vite. Handles manifest generation, entrypoint discovery, hot reload, and Chrome+Firefox targets from one source tree.
- **React 19 + TypeScript strict** — side panel, popup, options page, onboarding.
- **Tailwind v4 + Framer Motion** — design system keyed on CSS custom properties in `src/sidepanel/styles/tokens.css`. Deliberately NOT shadcn defaults — editorial/luxury direction with warm amber accent and OKLCH palette.
- **Dexie 4 (IndexedDB)** — single source of truth for the tracker, reports, pipeline, scan history, profile, customization, CV, portals, PDFs.
- **Zustand** — UI state only (live evaluation buffer, theme, command palette). Server-state (= Dexie) goes through `dexie-react-hooks` `useLiveQuery`.
- **Anthropic API via raw fetch** — streaming SSE, manual parser, 0 npm deps. The official `@anthropic-ai/sdk` reaches for Node APIs that aren't available in MV3 service workers.
- **pdf-lib** — renders one-page ATS CVs inside an MV3 offscreen document (service workers have no DOM).
- **zod** — validates every untrusted boundary: LLM structured output, chrome.storage payloads, YAML imports.

## Knowledge base

`knowledge-base/` is a **verbatim snapshot** of the upstream career-ops repo (`~/ws/playground/career-ops`) at scaffold time, pinned to commit `9b17fa8`. See `knowledge-base/README.md` for provenance.

**Rules:**
- Never edit anything inside `knowledge-base/`.
- If you need to change a prompt that ships in the extension, edit `src/assets/modes/*.md` and rerun `npm run modes:bundle`.
- `knowledge-base/` exists so future maintainers can compare a runtime prompt to the original for drift detection.

## Data Contract (ported from the source repo)

The source repo splits files into **user layer** (CV, profile, reports, tracker — never auto-updated) and **system layer** (modes, scripts, templates — safe to replace on update). The extension maps this cleanly:

### User layer — NEVER clobbered by extension updates
- Every Dexie table **except** `modes`
- `chrome.storage.local` settings (API key, model, language, theme, onboarding flag)

### System layer — regenerated on every build
- Bundled JS/CSS/HTML in `.output/`
- The `modes` Dexie table, re-seeded on install from `src/assets/modes.generated.ts`

### The golden rule
> When the user asks to customize archetypes, scoring weights, narrative, proof points, negotiation scripts, or deal-breakers — write to the `customization` Dexie table (via `src/background/storage/profile.ts` → `saveCustomization`), NEVER edit files under `src/assets/modes/`.
>
> The mode files are system prompts. User data belongs in the `customization` singleton. `src/background/llm/modes.ts` interpolates the customization into `_shared.md` at runtime.

## Architecture

Six extension surfaces, one message bus.

| Surface | Code | Responsibility |
|---------|------|----------------|
| **Background service worker** | `src/background/` + `src/entrypoints/background.ts` | LLM calls, pipeline orchestration, Dexie writes, message routing, offscreen PDF coordination |
| **Content scripts** | `src/content/` + `src/entrypoints/content.ts` | Detect job postings on 5+ portals, inject floating badge, extract JD on click |
| **Side panel (main UI)** | `src/sidepanel/` + `src/entrypoints/sidepanel/` | React app — tracker, evaluate, report, CV editor, profile, settings, onboarding |
| **Popup** | `src/popup/` + `src/entrypoints/popup/` | Quick stats, "open side panel" button |
| **Options page** | `src/options/` + `src/entrypoints/options/` | v0.1: redirects to side panel; v0.2: customization + portals editor |
| **Offscreen document** | `src/offscreen/` + `src/entrypoints/offscreen/` | Hidden DOM for pdf-lib rendering (MV3 service workers have no DOM) |

### Message flow

All cross-surface traffic goes through the discriminated unions in `src/shared/messages.ts`:
- `ContentMessage` — content → background (`jobDetected`, `requestEvaluate`)
- `UiMessage` — sidepanel/popup → background (`evaluateJob`, `generatePdf`, `healthCheck`, `testApiKey`)
- `BackgroundEvent` — background → sidepanel broadcasts (`evalStarted`, `evalDelta`, `evalCompleted`, `pdfCompleted`)
- `OffscreenCommand` / `OffscreenResponse` — background ↔ offscreen (`renderPdf`, `pdfReady`)

The background router in `src/background/messages.ts` exhaustively matches on `type`, so TypeScript guarantees every message has a handler.

### Canonical data flow for an evaluation

```
User clicks badge on LinkedIn job page
  │
  ▼  content/index.ts → extractor.ts → linkedin.ts detector
  │  JobPosting object
  │
  ▼  content → background via sendToBackground('content:requestEvaluate')
  │
  ▼  background/messages.ts router → pipeline/evaluate.ts
  │   1. load settings + profile + customization + CV + digest
  │   2. buildSystemPrompt() interpolates customization into _shared + oferta mode
  │   3. AnthropicClient.streamText() with SSE parsing
  │   4. broadcast bg:evalDelta to side panel for every token
  │   5. parseEvaluationResult() extracts the JSON block
  │   6. upsertApplication() (fuzzy company+role dedup)
  │   7. createReport() (versioned per application)
  │   8. broadcast bg:evalCompleted
  │
  ▼  Side panel Evaluate.tsx subscribes via useBackgroundEvents
     → live ScoreDial fills in
     → auto-navigates to /report/:id after 1.2s
```

## Commands reference

| Command | What it does |
|---------|--------------|
| `npm install` | Installs deps + runs `wxt prepare` (generates `.wxt/` types) |
| `npm run dev` | Dev build for Chrome, watches for changes |
| `npm run dev:firefox` | Dev build for Firefox |
| `npm run build` | Production Chrome build → `.output/chrome-mv3/` (runs `modes:bundle` first) |
| `npm run build:firefox` | Production Firefox build → `.output/firefox-mv2/` |
| `npm run zip` | Zip Chrome build for Chrome Web Store |
| `npm run zip:firefox` | Zip Firefox build for AMO |
| `npm run compile` | TypeScript type-check only (no emit) |
| `npm run test` | Vitest unit tests (storage, pipeline, detectors) |
| `npm run e2e` | Playwright E2E with extension loaded |
| `npm run modes:bundle` | Regenerate `src/assets/modes.generated.ts` from `src/assets/modes/**/*.md` |

### Loading the extension locally

**Chrome:** `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3` (dev build) or `.output/chrome-mv3-dev` (from `npm run dev`).

**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `.output/firefox-mv2/manifest.json`.

## Testing a change

The background service worker restarts automatically on WXT dev reload, but:
- Content script changes need a tab reload.
- Side panel changes need the panel to be closed and reopened.
- `src/assets/modes/**/*.md` edits require `npm run modes:bundle` (or a full `npm run build`).
- Dexie schema changes (`src/background/storage/db.ts`) require bumping the Dexie version and writing an upgrade callback — existing users' DBs don't get migrated automatically.

## Ethical use (ported verbatim from the source repo)

This extension is designed for **quality, not quantity**. Do not weaponize it for mass applications.

- **Never submit an application automatically.** The `apply` pipeline fills forms but hard-stops before Submit/Send/Apply. The user clicks.
- **Strongly discourage low-fit applications.** The scoring UI surfaces a "Weak match" verdict below 3.5/5. If the user is about to apply anyway, show a confirmation explaining why the system doesn't recommend it.
- **Respect recruiters' time.** Every application a human reads costs someone's attention.
- **Never fabricate experience or metrics.** The prompts explicitly forbid it; if a response invents data, that's a bug — file it against `src/background/llm/modes.ts` interpolation.

## Extending the extension

### Adding a new portal detector

1. Create `src/content/detectors/{portal}.ts` implementing the `Detector` interface from `types.ts`.
2. Register it in `src/content/extractor.ts`'s `DETECTORS` array (most specific first).
3. Add the host to `host_permissions` in `wxt.config.ts` and to the content script `matches` in `src/entrypoints/content.ts`.
4. Drop an HTML fixture in `tests/fixtures/{portal}/` and write a Vitest case asserting `extract()` returns the expected `JobPosting`.

### Adding a new pipeline mode

1. Write the prompt markdown in `src/assets/modes/{name}.md`. The bundler will pick it up automatically.
2. Add the mode name to the `ModeName` union — this happens automatically when `npm run modes:bundle` regenerates `modes.generated.ts`.
3. Implement the pipeline at `src/background/pipeline/{name}.ts`, calling `buildSystemPrompt({ name: '{name}', ... })`.
4. Wire it into `src/background/messages.ts`'s router.
5. Add the route/UI to `src/sidepanel/routes/{Name}.tsx` and register it in `src/sidepanel/App.tsx`.

### Adding a new Dexie table

1. Define the type in `src/shared/types.ts`.
2. Add a zod schema in `src/shared/schemas.ts`.
3. Bump `CareerOpsDb`'s version in `src/background/storage/db.ts`, add the new table to `.stores({ ... })`, and — if you're changing existing tables — add an upgrade callback.
4. Write a storage helper in `src/background/storage/{name}.ts`.

## Current status (phase landing)

- [x] Phase 0 — Scaffold + knowledge base copy
- [x] Phase 1 — Dexie schema + shared types + zod schemas
- [x] Phase 2 — Modes bundle + Anthropic streaming client
- [x] Phase 3 — Core pipelines: evaluate, PDF, merge/dedup, health check
- [x] Phase 4 — Content scripts + 5 detectors (LinkedIn, Greenhouse, Ashby, Lever, generic JSON-LD)
- [x] Phase 5 — Side panel MVP: onboarding, tracker, evaluate (streaming), report, CV, profile, settings
- [ ] Phase 6 — Secondary pipelines: compare, scan, batch, patterns, inbox
- [ ] Phase 7 — Advanced: deep research (tool use), interview prep, apply wizard
- [ ] Phase 8 — Language packs (DE/FR/PT/ES UI strings, per-locale detector hints)
- [ ] Phase 9 — Polish: command palette, keyboard shortcuts, import from CLI, dark mode
- [ ] Phase 10 — Release: Chrome Web Store + Firefox AMO

## Things deliberately dropped from the source repo

These exist in `~/ws/playground/career-ops` but have no browser equivalent:

| Source feature | Why it's gone |
|----------------|---------------|
| `check-liveness.mjs` | The extension IS the browser — the current DOM is the liveness check |
| `update-system.mjs` + `backup-pre-update-*` branches | The browser auto-updates extensions; Chrome Web Store + AMO handle this |
| `batch/batch-runner.sh` bash orchestrator | Replaced by `pipeline/batch.ts` — single-process queue with `Promise.all` concurrency limit |
| Go dashboard TUI | Replaced by the React side panel Tracker view |
| `verify-pipeline.mjs` shell invocation | Ported to `src/background/verify/pipeline.ts`, callable from the Settings page |
| Playwright "always verify" mandate | Obsolete — content scripts extract directly from the rendered DOM with full access |

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

## Current date

Today's date is 2026-04-10. Keep timestamps absolute when writing memory files or reports.
