// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  site: 'https://niebischmarkus.de',
  integrations: [preact()],
  build: { format: 'directory' },
  vite: { build: { chunkSizeWarningLimit: 1200 } },
});
