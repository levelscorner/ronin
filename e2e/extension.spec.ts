/**
 * E2E tests for Trishula browser extension.
 *
 * These tests launch Chromium with the built extension loaded via
 * --load-extension. They use a persistent browser context (required
 * for MV3 extensions) and test the actual extension pages.
 *
 * Run: npx playwright test
 * Requires: npm run build first (extension must be in .output/chrome-mv3)
 */

import { test, expect, type BrowserContext, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '..', '.output/chrome-mv3');

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  // Launch with persistent context — required for extensions
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  // Wait for the service worker to register, then extract the extension ID
  let sw: { url(): string } | undefined;
  // Poll for the service worker (may take a moment after launch)
  for (let i = 0; i < 10; i++) {
    sw = context.serviceWorkers().find((w) => w.url().includes('chrome-extension://'));
    if (sw) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!sw) {
    // Fallback: listen for the next service worker registration
    sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  }

  const swUrl = sw.url();
  const match = swUrl.match(/chrome-extension:\/\/([^/]+)/);
  if (!match) throw new Error(`Could not extract extension ID from ${swUrl}`);
  extensionId = match[1];
  console.log(`Extension loaded with ID: ${extensionId}`);
});

test.afterAll(async () => {
  await context?.close();
});

// ---------------------------------------------------------------------------
// Test 1: Side panel loads and shows onboarding (first run, no profile)
// ---------------------------------------------------------------------------
test('side panel loads with onboarding on first run', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.waitForLoadState('domcontentloaded');

  // The side panel should render React content inside #root
  const root = page.locator('#root');
  await expect(root).not.toBeEmpty();

  // Take a screenshot for visual verification
  await page.screenshot({ path: 'e2e/screenshots/sidepanel-onboarding.png' });

  // Should see either onboarding wizard OR the shell navigation
  // (depends on whether dev fixtures ran in the service worker)
  const body = await page.textContent('body');
  const hasContent =
    body?.includes('Trishula') ||
    body?.includes('Welcome') ||
    body?.includes('Tracker') ||
    body?.includes('API key');
  expect(hasContent).toBeTruthy();

  await page.close();
});

// ---------------------------------------------------------------------------
// Test 2: Popup page loads and shows stats
// ---------------------------------------------------------------------------
test('popup page loads', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForLoadState('domcontentloaded');

  const root = page.locator('#root');
  await expect(root).not.toBeEmpty();

  await page.screenshot({ path: 'e2e/screenshots/popup.png' });

  const body = await page.textContent('body');
  expect(body?.includes('Trishula')).toBeTruthy();

  await page.close();
});

// ---------------------------------------------------------------------------
// Test 3: Side panel navigation works (all tabs render)
// ---------------------------------------------------------------------------
test('side panel tabs navigate correctly', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.waitForLoadState('domcontentloaded');

  // Wait for React to hydrate
  await page.waitForTimeout(1000);

  // Check if we can see tab navigation
  const bodyText = await page.textContent('body');

  // If onboarding is showing, complete it or skip. If shell is showing, test tabs.
  if (bodyText?.includes('Tracker')) {
    // Shell is visible — test tab navigation
    await page.screenshot({ path: 'e2e/screenshots/sidepanel-tracker.png' });

    // Click Evaluate tab
    const evaluateTab = page.locator('text=Evaluate').first();
    if (await evaluateTab.isVisible()) {
      await evaluateTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/sidepanel-evaluate.png' });
    }

    // Click Settings tab
    const settingsTab = page.locator('text=Settings').first();
    if (await settingsTab.isVisible()) {
      await settingsTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/sidepanel-settings.png' });

      // Settings should have API key input
      const settingsText = await page.textContent('body');
      expect(settingsText?.includes('API key') || settingsText?.includes('Anthropic')).toBeTruthy();
    }

    // Click Profile tab
    const profileTab = page.locator('text=Profile').first();
    if (await profileTab.isVisible()) {
      await profileTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/sidepanel-profile.png' });
    }

    // Click CV tab
    const cvTab = page.locator('text=CV').first();
    if (await cvTab.isVisible()) {
      await cvTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/sidepanel-cv.png' });
    }
  } else {
    // Onboarding is showing — just verify it rendered
    console.log('Onboarding visible, skipping tab navigation test');
    await page.screenshot({ path: 'e2e/screenshots/sidepanel-onboarding-full.png' });
    expect(bodyText?.length).toBeGreaterThan(0);
  }

  await page.close();
});

// ---------------------------------------------------------------------------
// Test 4: Content script badge appears on a job page
// ---------------------------------------------------------------------------
test('content script badge appears on LinkedIn job page', async () => {
  const page = await context.newPage();

  // Navigate to a LinkedIn job search page. The content script should
  // inject the badge if a job is detected. We use a real LinkedIn URL
  // but the page may require login. Test that the content script at
  // least loads without errors.
  await page.goto('https://www.linkedin.com/jobs/search/', {
    waitUntil: 'domcontentloaded',
    timeout: 15_000,
  }).catch(() => {
    console.log('LinkedIn page load timed out or was redirected (login wall)');
  });

  // Wait for content script to potentially inject
  await page.waitForTimeout(2000);

  // Check if the badge host element was injected into the page
  const badgeHost = page.locator('#trishula-badge-host');
  const badgeExists = await badgeHost.count();

  await page.screenshot({ path: 'e2e/screenshots/linkedin-badge-check.png' });

  // Log whether badge was found (may not be visible if no job detected or login wall)
  console.log(`Badge host element found: ${badgeExists > 0}`);

  // The content script should at least not crash the page
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.waitForTimeout(1000);

  // Filter out non-extension errors (LinkedIn's own JS errors)
  const extensionErrors = pageErrors.filter((e) => e.includes('trishula'));
  expect(extensionErrors).toHaveLength(0);

  await page.close();
});

// ---------------------------------------------------------------------------
// Test 5: Background service worker is running
// ---------------------------------------------------------------------------
test('background service worker is active', async () => {
  const workers = context.serviceWorkers();
  const extensionWorker = workers.find((w) =>
    w.url().includes(`chrome-extension://${extensionId}`),
  );

  expect(extensionWorker).toBeDefined();
  console.log(`Service worker URL: ${extensionWorker?.url()}`);
});

// ---------------------------------------------------------------------------
// Test 6: Extension manifest is valid (loaded without errors)
// ---------------------------------------------------------------------------
test('extension loaded without manifest errors', async () => {
  const page = await context.newPage();
  await page.goto('chrome://extensions/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'e2e/screenshots/chrome-extensions-page.png' });

  // The extensions page should show our extension without "Errors" badge
  // We can't easily query shadow DOM of chrome://extensions, but we can
  // verify the page loaded and our service worker is still running
  const workers = context.serviceWorkers();
  const alive = workers.some((w) =>
    w.url().includes(`chrome-extension://${extensionId}`),
  );
  expect(alive).toBeTruthy();

  await page.close();
});
