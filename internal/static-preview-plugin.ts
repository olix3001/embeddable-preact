import { Plugin, type ResolvedConfig } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { SiteManifest } from './fs-router-plugin';

const vitePluginStaticPreview = (): Plugin => {
    let config: ResolvedConfig;

    return {
        name: 'vite-static-preview',

        configResolved(resolvedConfig) {
            config = resolvedConfig;
        },

        configurePreviewServer(server) {
            return () => {
                let manifest: SiteManifest;
                try {
                    const manifestPath = resolve(config.build.outDir, 'site-manifest.json');
                    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
                } catch (e) {
                    console.error('Failed to load site-manifest.json. Is the project built?');
                    return
                }

                server.middlewares.use((req, res, next) => {
                    const urlPath = req.originalUrl?.split('?')[0];
                    const htmlFile = manifest.routes[urlPath as any];

                    if (htmlFile) {
                        const filePath = resolve(config.build.outDir, htmlFile);
                        try {
                            const htmlContent = readFileSync(filePath, 'utf-8');
                            res.setHeader('Content-Type', 'text/html');
                            res.end(htmlContent);
                        } catch (e) {
                            console.error(`Error serving file for path ${urlPath}:`, e);
                            res.statusCode = 500;
                            res.end('Internal Server Error');
                        }
                    } else {
                        next();
                    }
                })
            }
        },
    };
};

export default vitePluginStaticPreview;