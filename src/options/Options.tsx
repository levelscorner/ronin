// Full-screen options page (chrome-extension://.../options.html).
// For v0.1 this just redirects the user to the side panel's Settings
// route — the real settings UI lives there. A future phase will break
// out a dedicated options surface with the customization + portals
// editors, which need more room than the side panel affords.

import { useEffect } from 'react';

export default function Options() {
  useEffect(() => {
    if (chrome.sidePanel) {
      chrome.sidePanel.open({ windowId: chrome.windows?.WINDOW_ID_CURRENT }).catch(() => undefined);
    }
  }, []);

  return (
    <div
      className="h-screen flex items-center justify-center font-[var(--font-sans)]"
      style={{ background: 'var(--color-surface)', color: 'var(--color-ink)' }}
    >
      <div className="text-center space-y-3 max-w-md px-6">
        <h1
          className="font-[var(--font-display)] text-[var(--text-3xl)] font-semibold"
          style={{ color: 'var(--color-ink)' }}
        >
          Trishula
        </h1>
        <p style={{ color: 'var(--color-ink-soft)' }}>
          Settings live inside the side panel. Click the toolbar icon to open it.
        </p>
      </div>
    </div>
  );
}
