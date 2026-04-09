# Running and using career-ops-plugin

End-to-end walkthrough from zero to first evaluation. Written for the first-time user on a fresh browser profile.

**Last updated:** 2026-04-10 · covers commits `2e8d1f4` (MVP) + `5f5b24c` (India port).

---

## 1. Prerequisites (one-time)

1. **Node 20+**.
2. **Chrome 116+** or **Firefox 128+**. Chrome is the smoother target because WXT compiles to MV3 natively there.
3. **An Anthropic API key.** Go to [console.anthropic.com](https://console.anthropic.com/settings/keys) → **API Keys** → **Create Key** → copy the `sk-ant-…` string. You'll paste it during onboarding.
4. **A few dollars of credit** at Anthropic **Plans & Billing**. Per-evaluation cost:

   | Model | Approximate cost per evaluation |
   |---|---|
   | Claude Haiku 4.5 | ~$0.01 |
   | Claude Sonnet 4.6 (default) | ~$0.05 – $0.10 |
   | Claude Opus 4.6 | ~$0.15 – $0.25 |

   Start with $5 of credit — you'll barely dent it while testing.

## 2. Build (or dev-serve) the extension

From the project root:

```bash
cd ~/ws/projects/career-ops-plugin
```

Pick one mode.

### Mode A — Production build

```bash
npm run build              # Chrome target → .output/chrome-mv3
npm run build:firefox      # Firefox target → .output/firefox-mv2
```

Use this when you just want to install a working copy and not iterate on code.

### Mode B — Dev mode with hot reload (recommended for iterating)

```bash
npm run dev                # Chrome: writes .output/chrome-mv3-dev, watches src/
# or
npm run dev:firefox        # Firefox: writes .output/firefox-mv2-dev
```

Leave this running in a terminal. Any save under `src/` triggers a rebuild and most surfaces auto-reload. Content scripts need a page refresh; the service worker reloads itself.

## 3. Load the extension into the browser

### Chrome

1. Open `chrome://extensions`.
2. Top-right: toggle **Developer mode** on.
3. Click **Load unpacked** (top-left).
4. Select **`~/ws/projects/career-ops-plugin/.output/chrome-mv3`** (or `chrome-mv3-dev` if you ran `npm run dev`). Click **Select**.
5. A card appears labelled **career-ops 0.1.0**. The icon is a grey puzzle piece — that's expected, there are no icon PNGs yet, only the placeholder `icons/README.txt`.
6. Click the **🧩 puzzle icon** in Chrome's toolbar (top-right) → find **career-ops** → click **📌 pin** so the extension icon lives in the toolbar.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**
3. Navigate into **`.output/firefox-mv2`** and pick **`manifest.json`** (the file, not the folder).
4. It appears under **Temporary Extensions**. Note: "temporary" means it stays until Firefox restarts — you'll need to re-load after every Firefox restart during dev.

## 4. Open the side panel

**Chrome:** click the pinned career-ops toolbar icon. The side panel slides in from the right.

- If it doesn't open on click: right-click the icon → **Open side panel**.
- If still nothing: `chrome://extensions` → career-ops card → **Details** → confirm **Site access: On all sites** (or at least on the portals you care about) and that there are no red error banners on the card.

**Firefox:** click the icon once, then **View → Sidebar → career-ops**. Firefox MV2's sidebar APIs don't auto-open on click the way Chrome's do.

## 5. Run the onboarding wizard

Six steps, about one minute total.

| Step | What happens |
|---|---|
| **Welcome** | Intro copy → click **Get started** |
| **API key** | Paste your `sk-ant-…` string → **Continue**. Settings has a **Test key** button later that pings Anthropic with a 1-token Haiku request if you want to verify |
| **Profile** | Full name + target roles (comma-separated, e.g. `Senior AI Engineer, Head of Applied AI`) → **Continue** |
| **Market** | Two tiles: **Global** or **India**. If your timezone is `Asia/Kolkata` the India tile is pre-selected. This is changeable later under Profile |
| **CV** | Paste your CV as markdown. You can **Skip for now** and add it later from the CV tab |
| **Ready** | Click **Enter career-ops** |

You land on the **Tracker** (empty state). That's the main app now.

## 6. First evaluation

1. Open a new tab and navigate to a supported portal. Good smoke-tests:
   - **Global:** `https://www.linkedin.com/jobs/view/<id>` or any `boards.greenhouse.io/<company>/jobs/<id>` URL
   - **India:** `https://www.naukri.com/job-listings-<slug>-<id>`, `https://www.foundit.in/job/<id>`, `https://hirist.tech/j/<slug>`, or a logged-in `https://www.instahyre.com/job-<id>/…` page
2. Wait ~1 second for the page to settle (SPAs need a tick for the content to mount).
3. A small dark pill labelled **"Evaluate with career-ops"** animates in at the bottom-right of the page. That's the badge.
4. Click it. Two things happen:
   - The side panel opens (or comes to the front) on the **Evaluate** route.
   - A live streaming view shows the score dial starting at 0 and filling in as tokens arrive, with dimension cards (Match with CV, North Star, Comp, Cultural, Red flags) populating once the model commits each block.
5. When the stream finishes, the side panel auto-navigates to the **Report** view ~1.2 seconds later:
   - Animated score dial at the final value
   - Full A–F evaluation rendered as markdown
   - **Generate CV PDF** button (accent-coloured)
   - **Open posting** link back to the source
6. The evaluation is now persisted in **Tracker**. Switch to the Tracker tab in the side panel header — the row is there, sortable, filterable.

## 7. Generate a PDF

From the Report view, click **Generate CV PDF**. Takes ~2–3 seconds:

1. Background worker opens a hidden offscreen document
2. `pdf-lib` renders a one-page ATS-safe CV from your markdown + the evaluation's highlights
3. PDF is stored in IndexedDB (table `pdfBlobs`) and a download is triggered through the side panel

The v0.1 PDF uses Helvetica standard fonts (not DM Sans / Space Grotesk yet — that's Phase 6). Text is selectable and ATS-parseable.

## 8. Day-to-day usage

- **Browse naturally.** The badge appears whenever a supported portal page loads. One click = one evaluation.
- **Track status.** Open an application → status can be updated (full status picker UI ships Phase 6).
- **Change region mid-session.** Side panel → **Profile** → **Market region** dropdown. The next evaluation uses the new region's prompt framing immediately.
- **Edit your CV.** **CV** tab has a split-pane markdown editor with live preview. Changes land in Dexie; next evaluation uses the updated version.
- **Test API key / swap model / run health check.** **Settings** tab. The model dropdown switches between Opus 4.6 / Sonnet 4.6 / Haiku 4.5 on the fly. Health check runs `verify-pipeline.ts` against your Dexie tables and shows a pass/fail checklist.

## 9. Debugging

### Badge doesn't appear on a page

1. Is the URL in the supported list? Check `src/entrypoints/content.ts` `matches` array.
2. Open DevTools (`F12`) on the host page → **Console**. Filter by `career-ops` — detector errors show as warnings.
3. DevTools → **Sources** → look for `content.js` under the extension's origin. If it's not there, the content script didn't inject — usually a URL-match mismatch.

### Background service worker errors (API failures, missing modes, etc.)

1. Go to `chrome://extensions`.
2. career-ops card → **Details** → under **Inspect views** click **service worker**.
3. A separate DevTools window opens attached to the background worker. Full console + network + sources tabs.
4. Network tab shows every call to `api.anthropic.com` — response bodies are visible so you can see the actual error message on 401/429/etc.

### Side panel React errors

Right-click inside the side panel → **Inspect**. A DevTools window opens attached to the side panel document.

### Content script errors (bad selector, extractor returning null)

DevTools on the host page → **Sources** → **Content scripts** tab at the very top of the file tree (scroll if you can't see it). Set breakpoints inside `content.js`.

### Evaluation fails mid-stream with a parse error

Most common cause: the model forgot to emit the trailing `\`\`\`json` fence. `src/background/llm/parse.ts` tries to extract the last JSON block; if that fails, `evaluateJob` returns `{ok: false, error: '...', details: raw}`. The raw text shows up in the background worker console. If this happens repeatedly, tighten the instruction in `buildUserMessage` inside `src/background/pipeline/evaluate.ts`.

### API returns 401 or "invalid x-api-key"

Key is wrong or expired. Side panel → Settings → retype the key → click **Test key**. Green "API key works" means it's good. Red error tells you exactly what Anthropic rejected.

### API returns 429

Rate limit. The client retries with exponential backoff up to 3 attempts. If it still fails, you're hitting a token-per-minute cap on a fresh account — wait a minute or switch to Haiku in Settings.

### Evaluation looks weird / off-topic

Open the background service worker DevTools (above) → Console → temporarily add `console.log(system)` inside `evaluateJob` in `src/background/pipeline/evaluate.ts` right after `buildSystemPrompt()` to see the full prompt. This is the verification step from the India-port plan. Remove the log when done.

## 10. Where your data lives

| Data | Location | How to inspect |
|---|---|---|
| Applications, reports, pipeline, profile, customization, CV, PDFs | IndexedDB database **`career-ops`** | Side panel DevTools → **Application** → **Storage** → **IndexedDB** → `career-ops` |
| API key, model choice, theme, language, onboarding flag | `chrome.storage.local` under key **`careerOps:settings`** | Side panel DevTools → **Application** → **Storage** → **Extension storage** → **Local** |

### Resets

- **Nuclear reset:** `chrome://extensions` → career-ops → **Remove** → reinstall. Wipes both IndexedDB and chrome.storage.local.
- **Soft reset (keep settings, wipe tracker):** side panel DevTools → Application → IndexedDB → right-click `career-ops` → **Delete database** → reload the side panel. Schema re-creates empty on next open.

## 11. Cost control tips

- **Default to Haiku 4.5 while iterating.** Settings → Model → Claude Haiku 4.5. You can poke at detector selectors and UI behaviour for pennies.
- **Switch to Sonnet 4.6 for real evaluations** — noticeably stronger judgement on ambiguous roles.
- **Opus 4.6 is overkill for individual evaluations** but worth it when deciding between two offers.
- **One evaluation per role, not per variation.** The fuzzy company+role matcher in `upsertApplication` updates the existing row rather than duplicating, but each re-evaluation still costs tokens. Tracker dedup protects your data, not your bill.

## 12. The `knowledge-base/` directory (FYI)

It's a frozen snapshot of the upstream `~/ws/playground/career-ops` repo at commit `9b17fa8`, copied once at scaffold time. **Don't edit anything in there.** It exists so future maintainers can compare a runtime prompt to the original for drift detection.

Runtime prompts that ship in the extension live under `src/assets/modes/*.md`. To tweak how an evaluation is framed, edit those files and run `npm run modes:bundle` — changes show up on the next `npm run dev` rebuild.

## 13. First-run sanity checklist

- [ ] `npm run build` completes with no errors
- [ ] Extension loads in Chrome → card shows **career-ops 0.1.0**, no red error text
- [ ] Side panel opens → onboarding wizard appears
- [ ] API key saves → **Test key** returns success
- [ ] Open a LinkedIn job → badge appears bottom-right within 2 seconds
- [ ] Click badge → Evaluate route shows streaming text within ~3 seconds
- [ ] Evaluation completes → auto-navigates to Report with rendered markdown
- [ ] Tracker shows the new row
- [ ] **Generate CV PDF** → PDF downloads and opens with selectable text
- [ ] Flip region in Profile → re-evaluate a similar role → prompt framing changes (check the background service worker Network tab to see the request body diff)

If every box checks, the MVP is fully working.

## 14. Related docs

- `CLAUDE.md` — architecture, message flow, extension surfaces, golden rules
- `knowledge-base/README.md` — provenance of the upstream snapshot
- `knowledge-base/DATA_CONTRACT.md` — user vs system layer split (the upstream version; the ported version lives in `CLAUDE.md`)
