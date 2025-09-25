import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [
    preact(),
  ],
  server: {
    middlewareMode: true,
    hmr: false,
  },
  ssr: {
    external: ['vite:css'] // don’t include style runtime
  },
  css: {
    modules: {
      // only export the mapping, don’t try to inject styles
      localsConvention: 'camelCaseOnly'
    },
    // 👇 critical: disable style injection
    devSourcemap: false
  },
  appType: 'custom'
});
