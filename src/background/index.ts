// Background service worker entry point.
// WXT's src/entrypoints/background.ts imports { main } from this module.

import { installMessageRouter } from './messages';
import { getSettings } from './storage/settings';
import { getDb } from './storage/db';

export function main(): void {
  // eslint-disable-next-line no-console
  console.log('[trishula] background worker starting');

  installMessageRouter();

  // Open the side panel when the toolbar icon is clicked.
  if (chrome.sidePanel) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(() => undefined);
  }

  // Warm the Dexie DB so the first evaluation doesn't pay the open cost.
  getDb()
    .open()
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[trishula] failed to open IndexedDB', err);
    });

  // On install, flag onboarding incomplete so the side panel knows to greet.
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      await getSettings(); // forces default write
    }
  });

  // In dev mode, seed test fixtures so the pipeline works without onboarding.
  // @ts-expect-error — import.meta.env.DEV is injected by Vite/WXT at build time
  if (import.meta.env?.DEV) {
    import('../fixtures/testProfile').then(({ seedDevFixtures }) =>
      seedDevFixtures().then((seeded) => {
        if (seeded) {
          // eslint-disable-next-line no-console
          console.log('[trishula] dev fixtures seeded (profile + CV + customization)');
        }
      }),
    ).catch(() => undefined);
  }
}
