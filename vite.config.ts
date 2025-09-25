import { defineConfig } from 'vite';
import vitePluginRouter from './internal/fs-router-plugin';
import preact from '@preact/preset-vite';
import preview from 'vite-live-preview';
import vitePluginStaticPreview from './internal/static-preview-plugin';
import viteGenerateCHeader from './internal/generate-c-header-plugin';

export default defineConfig({
    plugins: [
        preact(), 
        vitePluginRouter({ 
            pagesDir: 'src/pages',
            bundlePreact: false,
        }), 
        vitePluginStaticPreview(),
        preview({
            debug: false,
            reload: true,
            config: {
                plugins: [vitePluginStaticPreview()]
            }
        }),
        viteGenerateCHeader(),
    ],
    build: {
        outDir: 'dist',
        modulePreload: {
            polyfill: false,
        },
        manifest: true,
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 3,
            },
        },
        cssCodeSplit: true,
        sourcemap: false,
        cssMinify: true,
        target: 'es2017'
    },
})