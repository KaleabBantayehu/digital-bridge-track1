// apps/web-components/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'DbWidgets',
      formats: ['es'],
      fileName: () => 'db-widgets.v1.0.0.js',
    },
  },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
});