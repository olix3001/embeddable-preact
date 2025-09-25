import { normalizePath, createServer } from 'vite';
import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { basename, dirname, join, relative } from 'path';
import esbuild from 'esbuild';
import { prerender as ssr } from 'preact-iso';
import { pathToFileURL } from 'url';
const PREACT_CDN = 'https://esm.sh/preact';
const vitePluginRouter = ({ bundlePreact = false, prerender = false, ...options }) => {
    let config;
    const virtualPrefix = 'virtual:route-';
    return {
        name: 'vite-plugin-router',
        enforce: 'pre',
        async config(_, { isSsrBuild }) {
            const pages = await findPageRoutes(join(process.cwd(), options.pagesDir), options.pagesDir, []);
            const pageMap = new Map();
            for (const page of pages) {
                pageMap.set(page.routePath.substring(1) || 'index', `${virtualPrefix}${page.routePath.substring(1) || 'index'}`);
            }
            return {
                resolve: {
                    alias: ((!isSsrBuild && bundlePreact) ? {} : {
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
        },
        resolveId(id) {
            if (id.startsWith(virtualPrefix)) {
                return `\0${id}`;
            }
            return null;
        },
        transform(code, id) {
            if (id.endsWith('.tsx') || id.endsWith('.ts')) {
                // We only remove the directive for client builds to avoid Rollup warnings.
                // It remains in place for SSR builds.
                const directiveRegex = /(['"]use strict['"]|['"]use static['"]|['"]use client['"]);\s*/g;
                return code.replace(directiveRegex, '');
            }
            return code;
        },
        async load(id) {
            if (id.startsWith(`\0${virtualPrefix}`)) {
                const routeName = id.replace(`\0${virtualPrefix}`, '');
                const pages = await findPageRoutes(join(config.root, options.pagesDir), options.pagesDir, []);
                const currentPage = pages.find((p) => (p.routePath.substring(1) || 'index') === routeName);
                if (!currentPage) {
                    throw new Error(`Route not found for virtual module (${id}): ${routeName}`);
                }
                const layoutPaths = await getLayoutComponents(dirname(currentPage.fullPath), join(config.root, 'src'));
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
                    const result = await esbuild.transform(code, {
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
        async generateBundle(cx, bundle) {
            console.log('Generating static HTML files and route manifest...');
            const siteManifest = {
                routes: {},
            };
            const pages = await findPageRoutes(join(config.root, options.pagesDir), options.pagesDir, []);
            const vite = await createServer({
                configFile: import.meta.filename.endsWith('js') ? join(import.meta.dirname, '../../vite.ssr.config.ts') : join(import.meta.dirname, '../vite.ssr.config.ts'),
                plugins: cx.plugins
            });
            for (const route of pages) {
                const routeName = route.routePath.substring(1) || 'index';
                const currentPage = pages.find((p) => (p.routePath.substring(1) || 'index') === routeName)?.fullPath.replaceAll('\\', '/');
                const fileSource = await readFile(currentPage, 'utf-8');
                const isStatic = fileSource.startsWith('"use static"') || fileSource.startsWith("'use static'");
                let prerenderResult = '';
                if (prerender || isStatic) {
                    try {
                        const mod = await vite.ssrLoadModule(pathToFileURL(currentPage).toString());
                        prerenderResult = (await ssr(mod.default, {})).html;
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
                const mainBundlePath = normalizePath(relative(config.root, entryFile.fileName));
                if (isStatic) {
                    // Remove this file's js from bundle.
                    delete bundle[entryFile.fileName];
                }
                try {
                    const routePath = routeName === 'index' ? '/' : `/${routeName}`;
                    const htmlContent = `<!DOCTYPE html>
<html class="${options.htmlClassName}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${routePath === '/' ? 'Home' : capitalize(basename(routePath))}</title>
    ${cssLinks}
  </head>
  <body>
    <div id="app">${prerenderResult}</div>
    ${isStatic ? '' : `<script type="module" src="/${mainBundlePath}"></script>`}
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
            vite.close();
            this.emitFile({
                type: 'asset',
                fileName: 'site-manifest.json',
                source: JSON.stringify(siteManifest, null, 2),
            });
            console.log('Static site generation complete.');
        },
    };
};
export default vitePluginRouter;
// Helper function to capitalize the first letter of a string.
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Recursively finds all page.tsx files and returns their route paths.
async function findPageRoutes(dir, baseDir, foundRoutes) {
    const files = await readdir(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = join(dir, file.name);
        if (file.isDirectory()) {
            await findPageRoutes(fullPath, baseDir, foundRoutes);
        }
        else if (file.name === 'page.tsx') {
            const relativePath = relative(baseDir, fullPath);
            const routePath = '/' + normalizePath(dirname(relativePath)).replace('pages', '');
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
        const layoutPath = join(currentDir, 'layout.tsx');
        if (existsSync(layoutPath)) {
            layouts.unshift(layoutPath);
        }
        currentDir = dirname(currentDir);
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
