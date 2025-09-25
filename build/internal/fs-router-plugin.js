"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vite_1 = require("vite");
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const path_1 = require("path");
const esbuild_1 = __importDefault(require("esbuild"));
const preact_iso_1 = require("preact-iso");
const process_1 = require("process");
const PREACT_CDN = 'https://esm.sh/preact';
const vitePluginRouter = ({ bundlePreact = false, prerender = false, ...options }) => {
    let config;
    const virtualPrefix = 'virtual:route-';
    return {
        name: 'vite-plugin-router',
        enforce: 'pre',
        async config(userConfig) {
            const pages = await findPageRoutes((0, path_1.join)(process.cwd(), options.pagesDir), options.pagesDir, []);
            const pageMap = new Map();
            for (const page of pages) {
                pageMap.set(page.routePath.substring(1) || 'index', `${virtualPrefix}${page.routePath.substring(1) || 'index'}`);
            }
            return {
                resolve: {
                    alias: (bundlePreact ? {} : {
                        preact: PREACT_CDN,
                    })
                },
                build: {
                    rollupOptions: {
                        input: Object.fromEntries(pageMap),
                        output: {
                            entryFileNames: `[name].[hash].js`,
                            chunkFileNames: `[name].[hash].js`,
                            assetFileNames: `[name].[hash].[ext]`,
                        },
                    },
                },
            };
        },
        configResolved(resolvedConfig) {
            config = resolvedConfig;
            if (prerender && !bundlePreact) {
                console.error('At the moment it is not possible to enable prerendering without bundling preact.');
                (0, process_1.exit)(1);
            }
        },
        resolveId(id) {
            if (id.startsWith(virtualPrefix)) {
                return `\0${id}`;
            }
            return null;
        },
        async load(id) {
            if (id.startsWith(`\0${virtualPrefix}`)) {
                const routeName = id.replace(`\0${virtualPrefix}`, '');
                const pages = await findPageRoutes((0, path_1.join)(config.root, options.pagesDir), options.pagesDir, []);
                const currentPage = pages.find((p) => (p.routePath.substring(1) || 'index') === routeName);
                if (!currentPage) {
                    throw new Error(`Route not found for virtual module (${id}): ${routeName}`);
                }
                const layoutPaths = await getLayoutComponents((0, path_1.dirname)(currentPage.fullPath), (0, path_1.join)(config.root, 'src'));
                const layoutImports = layoutPaths.map((p, i) => `import Layout${i} from '${p.replaceAll('\\', '/')}';`).join('\n');
                const layoutWrappers = layoutPaths.map((_, i) => `<Layout${i}>`).join('');
                const layoutClosures = layoutPaths.map((_, i) => `</Layout${layoutPaths.length - 1 - i}>`).join('');
                let code = `
                import Page from '${currentPage.fullPath.replaceAll('\\', '/')}';
                ${layoutImports}

                const PageWrapper = () => {
                    return (
                    ${layoutWrappers}
                        <Page />
                    ${layoutClosures}
                    );
                };
                `;
                if (prerender) {
                    code += `
                    import { hydrate } from 'preact-iso';
                    if (typeof window !== 'undefined') {
                        hydrate(<PageWrapper />, document.getElementById('app'));
                    }
                    `;
                }
                else {
                    code += `
                    import { render } from 'preact';
                    render(<PageWrapper />, document.getElementById('app'));
                    `;
                }
                try {
                    const result = await esbuild_1.default.transform(code, {
                        loader: 'tsx',
                        jsx: 'automatic',
                        jsxImportSource: 'preact',
                    });
                    return result.code;
                }
                catch (e) {
                    console.error(`Failed to transpile virtual module for route: ${routeName}`);
                    throw e;
                }
            }
            return null;
        },
        async generateBundle(_, bundle) {
            console.log('Generating static HTML files and route manifest...');
            const siteManifest = {
                routes: {},
            };
            const pages = await findPageRoutes((0, path_1.join)(config.root, options.pagesDir), options.pagesDir, []);
            let vite;
            if (prerender) {
                vite = await (0, vite_1.createServer)({
                    server: { middlewareMode: true },
                    optimizeDeps: { noDiscovery: true, include: [] },
                    appType: 'custom',
                });
            }
            for (const route of pages) {
                const routeName = route.routePath.substring(1) || 'index';
                let prerenderResult = '';
                if (prerender) {
                    const currentPage = pages.find((p) => (p.routePath.substring(1) || 'index') === routeName)?.fullPath.replaceAll('\\', '/');
                    try {
                        const mod = await vite.ssrLoadModule('file:///' + currentPage);
                        prerenderResult = (await (0, preact_iso_1.prerender)(mod.default, {})).html;
                    }
                    catch (err) {
                        console.error('Failed to import page: ', err);
                    }
                }
                const entryFile = Object.values(bundle).find((asset) => asset.type === 'chunk' && asset.isEntry && asset.name === routeName);
                if (!entryFile) {
                    console.warn(`Could not find an entry chunk for route: ${routeName}`);
                    continue;
                }
                const allCssFiles = getAllCssFromManifest(bundle, entryFile.fileName, new Set());
                const cssLinks = allCssFiles?.map((css) => `<link rel="stylesheet" href="/${css}">`).join('\n    ') || '';
                const mainBundlePath = (0, vite_1.normalizePath)((0, path_1.relative)(config.root, entryFile.fileName));
                try {
                    const routePath = routeName === 'index' ? '/' : `/${routeName}`;
                    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${routePath === '/' ? 'Home' : capitalize((0, path_1.basename)(routePath))}</title>
    ${cssLinks}
  </head>
  <body>
    <div id="app">${prerenderResult}</div>
    <script type="module" src="/${mainBundlePath}"></script>
  </body>
</html>`;
                    const outputHtmlName = routeName === 'index' ? 'route._index.html' : `route.${routeName}.html`;
                    this.emitFile({
                        type: 'asset',
                        fileName: outputHtmlName,
                        source: htmlContent
                    });
                    siteManifest.routes[routePath] = outputHtmlName;
                    console.log(`Generated HTML for route: ${routePath}`);
                }
                catch (err) {
                    console.error(`Failed to process route ${routeName}:`, err);
                }
            }
            if (prerender) {
                vite.close();
            }
            this.emitFile({
                type: 'asset',
                fileName: 'site-manifest.json',
                source: JSON.stringify(siteManifest, null, 2),
            });
            console.log('Static site generation complete.');
        },
    };
};
exports.default = vitePluginRouter;
// Helper function to capitalize the first letter of a string.
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Recursively finds all page.tsx files and returns their route paths.
async function findPageRoutes(dir, baseDir, foundRoutes) {
    const files = await (0, promises_1.readdir)(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = (0, path_1.join)(dir, file.name);
        if (file.isDirectory()) {
            await findPageRoutes(fullPath, baseDir, foundRoutes);
        }
        else if (file.name === 'page.tsx') {
            const relativePath = (0, path_1.relative)(baseDir, fullPath);
            const routePath = '/' + (0, vite_1.normalizePath)((0, path_1.dirname)(relativePath)).replace('pages', '');
            foundRoutes.push({ routePath: routePath === '/.' ? '/' : routePath, fullPath });
        }
    }
    return foundRoutes;
}
// Finds all layout components for a given page by walking up the directory tree.
async function getLayoutComponents(dir, rootDir) {
    const layouts = [];
    let currentDir = dir;
    while (currentDir.startsWith(rootDir) && currentDir !== rootDir) {
        const layoutPath = (0, path_1.join)(currentDir, 'layout.tsx');
        if ((0, fs_1.existsSync)(layoutPath)) {
            layouts.unshift(layoutPath);
        }
        currentDir = (0, path_1.dirname)(currentDir);
    }
    return layouts;
}
function getAllCssFromManifest(bundle, entryId, cssSet = new Set()) {
    const entry = bundle[entryId];
    if (!entry)
        return;
    entry.viteMetadata.importedCss.forEach((css) => cssSet.add(css));
    if (entry.imports) {
        entry.imports.forEach((importedEntry) => {
            getAllCssFromManifest(bundle, importedEntry, cssSet);
        });
    }
    return Array.from(cssSet);
}
