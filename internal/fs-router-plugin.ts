import { Plugin, normalizePath, ResolvedConfig } from 'vite';
import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { basename, dirname, join, relative } from 'path';
import esbuild from 'esbuild';

interface PluginOptions {
    pagesDir: string;
}

export interface SiteManifest {
    routes: Record<string, string>;
    assets: Record<string, string>;
}

const vitePluginRouter = (options: PluginOptions): Plugin => {
    let config: ResolvedConfig;
    const virtualPrefix = 'virtual:route-';

    return {
        name: 'vite-plugin-router',
        enforce: 'pre',

        async config(userConfig) {
            const pages = await findPageRoutes(join(process.cwd(), options.pagesDir), options.pagesDir, []);
            const pageMap = new Map<string, string>();
            for (const page of pages) {
                pageMap.set(
                    page.routePath.substring(1) || 'index',
                    `${virtualPrefix}${page.routePath.substring(1) || 'index'}`
                );
            }

            return {
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

        async load(id) {
            if (id.startsWith(`\0${virtualPrefix}`)) {
                const routeName = id.replace(`\0${virtualPrefix}`, '');
                const pages = await findPageRoutes(join(config.root, options.pagesDir), options.pagesDir, []);
                const currentPage = pages.find(
                    (p) => (p.routePath.substring(1) || 'index') === routeName
                );

                if (!currentPage) {
                    throw new Error(`Route not found for virtual module (${id}): ${routeName}`);
                }

                const layoutPaths = await getLayoutComponents(dirname(currentPage.fullPath), join(config.root, 'src'));
                const layoutImports = layoutPaths.map((p, i) => `import Layout${i} from '${p.replaceAll('\\', '/')}';`).join('\n');

                const layoutWrappers = layoutPaths.map((_, i) => `<Layout${i}>`).join('');
                const layoutClosures = layoutPaths.map((_, i) => `</Layout${layoutPaths.length - 1 - i}>`).join('');

                const code = `
                import { render } from 'preact';
                import Page from '${currentPage.fullPath.replaceAll('\\', '/')}';
                ${layoutImports}

                const PageWrapper = () => {
                    return (
                    ${layoutWrappers}
                        <Page />
                    ${layoutClosures}
                    );
                };

                render(<PageWrapper />, document.getElementById('app'));
                `

                try {
                    const result = await esbuild.transform(code, {
                        loader: 'tsx',
                        jsx: 'automatic',
                        jsxImportSource: 'preact',
                    });
                    return result.code;
                } catch (e) {
                    console.error(`Failed to transpile virtual module for route: ${routeName}`);
                    throw e;
                }
            }
            return null;
        },

        async generateBundle(_, bundle) {
            console.log('Generating static HTML files and route manifest...');

            const siteManifest: SiteManifest = {
                routes: {},
                assets: {},
            };
            const pages = await findPageRoutes(join(config.root, options.pagesDir), options.pagesDir, []);

            for (const route of pages) {
                const routeName = route.routePath.substring(1) || 'index';

                const entryFile = Object.values(bundle).find(
                    (asset) => asset.type === 'chunk' && asset.isEntry && asset.name === routeName
                );
                if (!entryFile) {
                    console.warn(`Could not find an entry chunk for route: ${routeName}`);
                    continue;
                }

                const mainBundlePath = normalizePath(relative(config.root, entryFile.fileName));

                try {
                    const routePath = routeName === 'index' ? '/' : `/${routeName}`;
                    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${routePath === '/' ? 'Home' : capitalize(basename(routePath))}</title>
  </head>
  <body>
    <div id="app"></div>
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
                    siteManifest.assets[mainBundlePath] = entryFile.fileName;

                    console.log(`Generated HTML for route: ${routePath}`);
                } catch (err) {
                    console.error(`Failed to process route ${routeName}:`, err);
                }
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

export default vitePluginRouter;

// Helper function to capitalize the first letter of a string.
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Recursively finds all page.tsx files and returns their route paths.
async function findPageRoutes(dir: string, baseDir: string, foundRoutes: { routePath: string; fullPath: string }[]) {
    const files = await readdir(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = join(dir, file.name);
        if (file.isDirectory()) {
            await findPageRoutes(fullPath, baseDir, foundRoutes);
        } else if (file.name === 'page.tsx') {
            const relativePath = relative(baseDir, fullPath);
            const routePath = '/' + normalizePath(dirname(relativePath)).replace('pages', '');
            foundRoutes.push({ routePath: routePath === '/.' ? '/' : routePath, fullPath });
        }
    }
    return foundRoutes;
}

// Finds all layout components for a given page by walking up the directory tree.
async function getLayoutComponents(dir: string, rootDir: string): Promise<string[]> {
    const layouts: string[] = [];
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