import { defineConfig } from 'vite';
import vitePluginRouter from './internal/fs-router-plugin';
import preact from '@preact/preset-vite';
import preview from 'vite-live-preview';
import vitePluginStaticPreview from './internal/static-preview-plugin';

export default defineConfig({
    plugins: [
        preact(), 
        vitePluginRouter({ pagesDir: 'src/pages' }), 
        vitePluginStaticPreview(),
        preview({
            debug: false,
            reload: true,
            config: {
                plugins: [vitePluginStaticPreview()]
            }
        }),
    ],
    build: {
        outDir: 'dist',
        manifest: true,
        minify: false,
        target: 'es2017'
    },
})