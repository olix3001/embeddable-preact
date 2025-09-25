"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const vitePluginStaticPreview = () => {
    let config;
    return {
        name: 'vite-static-preview',
        configResolved(resolvedConfig) {
            config = resolvedConfig;
        },
        configurePreviewServer(server) {
            return () => {
                let manifest;
                try {
                    const manifestPath = (0, path_1.resolve)(config.build.outDir, 'site-manifest.json');
                    manifest = JSON.parse((0, fs_1.readFileSync)(manifestPath, 'utf-8'));
                }
                catch (e) {
                    console.error('Failed to load site-manifest.json. Is the project built?');
                    return;
                }
                server.middlewares.use((req, res, next) => {
                    const urlPath = req.originalUrl?.split('?')[0];
                    const htmlFile = manifest.routes[urlPath];
                    if (htmlFile) {
                        const filePath = (0, path_1.resolve)(config.build.outDir, htmlFile);
                        try {
                            const htmlContent = (0, fs_1.readFileSync)(filePath, 'utf-8');
                            res.setHeader('Content-Type', 'text/html');
                            res.end(htmlContent);
                        }
                        catch (e) {
                            console.error(`Error serving file for path ${urlPath}:`, e);
                            res.statusCode = 500;
                            res.end('Internal Server Error');
                        }
                    }
                    else {
                        next();
                    }
                });
            };
        },
    };
};
exports.default = vitePluginStaticPreview;
