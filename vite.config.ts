import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Fills in dist/sw.js after the build: the list of every output file to precache, and a version
 * hash of their contents so each deploy gets a fresh cache and the old one is deleted.
 */
function serviceWorkerPrecache(): Plugin {
  let outDir = 'dist';
  return {
    name: 'sw-precache',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
        .filter((f) => f.isFile())
        .map((f) => relative(outDir, join(f.parentPath, f.name)).split(sep).join('/'))
        .filter((f) => f !== 'sw.js')
        .sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const swPath = join(outDir, 'sw.js');
      const sw = readFileSync(swPath, 'utf8')
        .replace('__BUILD_VERSION__', hash.digest('hex').slice(0, 12))
        .replace('self.__PRECACHE__', JSON.stringify(['./', ...files.map((f) => `./${f}`)]));
      writeFileSync(swPath, sw);
    },
  };
}

export default defineConfig({
  // Relative base so the static build works from any sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss(), serviceWorkerPrecache()],
  test: {
    environment: 'node',
  },
});
