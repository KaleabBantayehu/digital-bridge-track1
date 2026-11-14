// apps/web-components/vite.config.ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function copySignupAliases() {
  return {
    name: 'copy-db-signup-aliases',
    generateBundle(_options: unknown, bundle: Record<string, { type: string; code?: string }>) {
      const widgetBundle = bundle['db-widgets.v1.0.0.js'];
      if (!widgetBundle || widgetBundle.type !== 'chunk' || typeof widgetBundle.code !== 'string') {
        throw new Error('The production widget bundle was not generated.');
      }

      for (const fileName of ['db-signup.js', 'module/db-signup.js', 'assets/js/db-signup.js']) {
        this.emitFile({ type: 'asset', fileName, source: widgetBundle.code });
      }

      // Read-aloud cues + manifests: served at dist/audio/{lang}/ as well as dist/assets/audio/{lang}/
      // (the latter arrives with the copied savanna-host-demo folder), so either audio-base-url works.
      const audioRoot = join(__dirname, '../savanna-host-demo/assets/audio');
      for (const lang of ['am', 'en']) {
        for (const name of readdirSync(join(audioRoot, lang))) {
          this.emitFile({ type: 'asset', fileName: `audio/${lang}/${name}`, source: readFileSync(join(audioRoot, lang, name)) });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copySignupAliases()],
  // @db/shared-schemas compiles to CommonJS; linked workspace packages are not converted by default.
  optimizeDeps: { include: ['@db/shared-schemas'] },
  build: {
    commonjsOptions: { include: [/shared-schemas/, /node_modules/] },
    lib: {
      entry: 'src/index.ts',
      name: 'DbWidgets',
      formats: ['es'],
      fileName: () => 'db-widgets.v1.0.0.js',
    },
  },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
});