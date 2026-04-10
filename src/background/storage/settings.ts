// Typed wrapper around chrome.storage.local for the extension's global settings.
// Browser extension storage is origin-isolated but UNENCRYPTED.
// The API key stored here is as safe as any other extension data — acceptable
// for a personal tool but documented in onboarding.

import type { ExtensionSettings } from '../../shared/types';
import { DEFAULT_MODEL_ID } from '../../shared/constants';
import { zExtensionSettings } from '../../shared/schemas';

const STORAGE_KEY = 'trishula:settings';

const DEFAULTS: ExtensionSettings = Object.freeze({
  anthropicApiKey: '',
  selectedModel: DEFAULT_MODEL_ID,
  language: 'en',
  theme: 'auto',
  onboardingComplete: false,
});

/**
 * Read the full settings blob, merged with defaults so callers never see
 * an undefined field. Validation happens once here so the rest of the
 * codebase can rely on the type.
 */
export async function getSettings(): Promise<ExtensionSettings> {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const stored = (raw?.[STORAGE_KEY] ?? {}) as Partial<ExtensionSettings>;
  const merged = { ...DEFAULTS, ...stored };
  const parsed = zExtensionSettings.safeParse(merged);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.warn('[trishula] invalid settings in storage, resetting to defaults', parsed.error);
    await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULTS });
    return { ...DEFAULTS };
  }
  return parsed.data as ExtensionSettings;
}

/** Merge-update one or more fields. */
export async function updateSettings(
  patch: Partial<ExtensionSettings>,
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next: ExtensionSettings = { ...current, ...patch };
  const parsed = zExtensionSettings.safeParse(next);
  if (!parsed.success) {
    throw new Error(`Invalid settings patch: ${parsed.error.message}`);
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

/** Danger zone: reset everything to defaults. */
export async function resetSettings(): Promise<ExtensionSettings> {
  await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULTS });
  return { ...DEFAULTS };
}

/** Subscribe to storage changes for reactive UIs. */
export function onSettingsChanged(
  handler: (next: ExtensionSettings) => void,
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: chrome.storage.AreaName,
  ) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    getSettings().then(handler).catch(() => undefined);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
