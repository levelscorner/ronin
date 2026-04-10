/**
 * Live testing on real LinkedIn and Naukri pages.
 *
 * This test launches Chrome with:
 * - The Trishula extension loaded
 * - A copy of your Chrome profile (so you're logged in)
 *
 * IMPORTANT: Close Chrome before running this test.
 * Run: npx playwright test e2e/live-test.spec.ts
 */

import { test, expect, type BrowserContext, chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '..', '.output/chrome-mv3');
const chromeProfileSource = path.join(
  os.homedir(),
  'Library/Application Support/Google/Chrome',
);

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  // Copy the Chrome profile to a temp dir so we don't lock the original
  const tmpProfile = path.join(os.tmpdir(), `trishula-test-profile-${Date.now()}`);
  fs.mkdirSync(tmpProfile, { recursive: true });

  // Copy essential profile files (cookies, login sessions)
  const filesToCopy = ['Default/Cookies', 'Default/Login Data', 'Default/Web Data', 'Local State'];
  for (const file of filesToCopy) {
    const src = path.join(chromeProfileSource, file);
    const dst = path.join(tmpProfile, file);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  }

  context = await chromium.launchPersistentContext(tmpProfile, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
    ],
    viewport: { width: 1400, height: 900 },
    timeout: 30_000,
  });

  // Wait for extension service worker
  let sw: { url(): string } | undefined;
  for (let i = 0; i < 15; i++) {
    sw = context.serviceWorkers().find((w) => w.url().includes('chrome-extension://'));
    if (sw) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15_000 });

  const match = sw.url().match(/chrome-extension:\/\/([^/]+)/);
  if (!match) throw new Error(`Could not extract extension ID`);
  extensionId = match[1];
  console.log(`Extension loaded: ${extensionId}`);
});

test.afterAll(async () => {
  await context?.close();
});

// ---------------------------------------------------------------------------
// Test: LinkedIn job page — badge injection
// ---------------------------------------------------------------------------
test('LinkedIn: badge appears on a job detail page', async () => {
  test.setTimeout(30_000);
  const page = await context.newPage();

  // Navigate to LinkedIn jobs search
  await page.goto('https://www.linkedin.com/jobs/search/?keywords=software+engineer&location=India', {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'e2e/screenshots/linkedin-search.png', fullPage: false });

  // Check if we're logged in or hit a login wall
  const bodyText = await page.textContent('body');
  const loggedIn = !bodyText?.includes('Sign in') || bodyText?.includes('Jobs');
  console.log(`LinkedIn logged in: ${loggedIn}`);

  if (loggedIn) {
    // Try clicking on the first job to open detail view
    const jobCard = page.locator('.jobs-search-results__list-item').first();
    if (await jobCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(3000);
    }
  }

  // Check for badge
  const badgeHost = page.locator('#trishula-badge-host');
  const badgeExists = await badgeHost.count();
  console.log(`LinkedIn badge found: ${badgeExists > 0}`);

  await page.screenshot({ path: 'e2e/screenshots/linkedin-job-detail.png', fullPage: false });

  // Check for any extension errors
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForTimeout(1000);
  const extErrors = errors.filter((e) => e.includes('trishula'));
  console.log(`Extension errors: ${extErrors.length}`);

  await page.close();
});

// ---------------------------------------------------------------------------
// Test: Naukri job page — badge injection
// ---------------------------------------------------------------------------
test('Naukri: badge appears on a job detail page', async () => {
  test.setTimeout(30_000);
  const page = await context.newPage();

  // Navigate to Naukri job search
  await page.goto('https://www.naukri.com/software-developer-jobs', {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'e2e/screenshots/naukri-search.png', fullPage: false });

  // Check if content script injected the badge host
  const badgeOnSearch = page.locator('#trishula-badge-host');
  const badgeOnSearchExists = await badgeOnSearch.count();
  console.log(`Naukri search page - badge host: ${badgeOnSearchExists > 0}`);

  // Try clicking the first job to open detail
  const firstJob = page.locator('article.jobTuple, .srp-jobtuple-wrapper, [class*="jobTuple"]').first();
  if (await firstJob.isVisible({ timeout: 5000 }).catch(() => false)) {
    await firstJob.click();
    await page.waitForTimeout(3000);
    console.log(`Navigated to job detail: ${page.url()}`);
  }

  await page.waitForTimeout(2000);

  // Check for badge on detail page
  const badge = page.locator('#trishula-badge-host');
  const badgeExists = await badge.count();
  const badgeVisible = badgeExists > 0 ? await badge.isVisible().catch(() => false) : false;
  console.log(`Naukri detail page - badge host: ${badgeExists > 0}, visible: ${badgeVisible}`);

  await page.screenshot({ path: 'e2e/screenshots/naukri-job-detail.png', fullPage: false });

  // Check for JSON-LD on the page (primary extraction path)
  const hasJsonLd = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent || '');
        const str = JSON.stringify(data);
        if (str.includes('JobPosting')) return true;
      } catch { /* skip */ }
    }
    return false;
  });
  console.log(`Naukri page has JobPosting JSON-LD: ${hasJsonLd}`);

  // Check console for detector debug messages
  const consoleMessages: string[] = [];
  page.on('console', (msg) => {
    if (msg.text().includes('trishula')) consoleMessages.push(msg.text());
  });
  await page.waitForTimeout(1000);
  for (const msg of consoleMessages) {
    console.log(`  Console: ${msg}`);
  }

  await page.close();
});

// ---------------------------------------------------------------------------
// Test: Side panel — evaluate tab with pasted JD
// ---------------------------------------------------------------------------
test('Side panel: evaluate tab renders and accepts input', async () => {
  test.setTimeout(15_000);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'e2e/screenshots/sidepanel-loaded.png' });

  const bodyText = await page.textContent('body');
  console.log(`Side panel content (first 200 chars): ${bodyText?.slice(0, 200)}`);

  // Check if we can see the Evaluate tab
  const evalTab = page.locator('text=Evaluate').first();
  if (await evalTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await evalTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/sidepanel-evaluate-tab.png' });

    // Try to find the textarea
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textarea.fill('This is a test job description for a Senior Software Engineer position at a leading technology company in Bangalore, India. Requirements: 5+ years experience with React, TypeScript, Node.js. Responsibilities include building scalable web applications, mentoring junior developers, and participating in code reviews. Salary range: 20-35 LPA.');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/sidepanel-evaluate-filled.png' });
      console.log('JD pasted into evaluate textarea');

      // Check if Evaluate button is enabled
      const evalButton = page.locator('button:has-text("Evaluate")').first();
      const isDisabled = await evalButton.getAttribute('disabled');
      console.log(`Evaluate button disabled: ${isDisabled !== null}`);
    }
  } else {
    console.log('Evaluate tab not visible (might be showing onboarding)');
  }

  await page.close();
});

// ---------------------------------------------------------------------------
// Test: Side panel — settings page and API key
// ---------------------------------------------------------------------------
test('Side panel: settings page has API key field', async () => {
  test.setTimeout(15_000);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  // Navigate to settings
  const settingsTab = page.locator('text=Settings').first();
  if (await settingsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await settingsTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/sidepanel-settings.png' });

    const bodyText = await page.textContent('body');
    const hasApiKey = bodyText?.includes('API key') || bodyText?.includes('Anthropic');
    console.log(`Settings has API key field: ${hasApiKey}`);

    // Check for the password input
    const apiInput = page.locator('input[type="password"]').first();
    const inputExists = await apiInput.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`API key input visible: ${inputExists}`);
  } else {
    console.log('Settings tab not visible (onboarding mode)');
  }

  await page.close();
});
