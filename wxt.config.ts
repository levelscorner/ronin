import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// WXT config for Ronin. Cross-browser MV3 extension with React.
// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Trishula',
    short_name: 'Trishula',
    description:
      'AI-powered job evaluation — score, track, and generate tailored CVs from any job posting.',
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    version: '0.1.0',

    permissions: [
      'storage',
      'sidePanel',
      'offscreen',
      'alarms',
      'clipboardRead',
      'scripting',
      'activeTab',
    ],
    host_permissions: [
      'https://*.linkedin.com/*',
      'https://boards.greenhouse.io/*',
      'https://boards-api.greenhouse.io/*',
      'https://jobs.ashbyhq.com/*',
      'https://api.ashbyhq.com/*',
      'https://jobs.lever.co/*',
      'https://api.lever.co/*',
      'https://wellfound.com/*',
      'https://*.workable.com/*',
      'https://jobs.smartrecruiters.com/*',
      'https://api.smartrecruiters.com/*',
      // India market port
      'https://*.naukri.com/*',
      'https://*.foundit.in/*',
      'https://*.monsterindia.com/*',
      'https://www.instahyre.com/*',
      'https://instahyre.com/*',
      'https://hirist.tech/*',
      'https://*.hirist.tech/*',
      'https://cutshort.io/*',
      'https://*.cutshort.io/*',
      'https://*.shine.com/*',
      // LLM endpoint
      'https://api.anthropic.com/*',
    ],
    action: {
      default_title: 'Trishula',
      default_popup: 'popup.html',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    web_accessible_resources: [
      {
        resources: ['fonts/*.woff2'],
        matches: ['<all_urls>'],
      },
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
