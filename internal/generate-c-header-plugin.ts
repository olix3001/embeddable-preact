import { Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { SiteManifest } from './fs-router-plugin';
import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { minify as htmlMinify } from 'html-minifier-terser';
import zlib, { brotliCompress, type BrotliOptions } from 'zlib';
import mime from 'mime-types';
import ejs from 'ejs';

const asyncBrotliCompress = (data: any, options: BrotliOptions): Promise<Buffer> => new Promise((resolve, reject) => brotliCompress(data, options, (err, result) => {
    if (err) reject(err)
    else resolve(result)
}))

const viteGenerateCHeader = (): Plugin => {
    return {
        name: 'vite-generate-c-header',
        enforce: 'post',

        async closeBundle() {
            // Load manifest.
            const siteManifest: SiteManifest = JSON.parse(
                readFileSync(join(__dirname, '../dist/site-manifest.json'), 'utf-8')
            );

            // Compress and store all chunks.
            const allFiles: any[] = [];

            const distDir = join(__dirname, '../dist');
            const files = await glob('**/*.{js,css,html}', {
                cwd: distDir,
                nodir: true,
            });

            const filesToProcess = files.map(async (file) => {
                const filePath = join(distDir, file);
                const isRoute = file.startsWith('route.');
                let data = await readFile(filePath);

                if (isRoute) {
                    const minifiedHtml = await htmlMinify(data.toString(), {
                        collapseWhitespace: true,
                        removeComments: true,
                        minifyCSS: true,
                        minifyJS: true,
                    });
                    data = Buffer.from(minifiedHtml);
                }

                const compressedData = await asyncBrotliCompress(data, {
                    params: {
                        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
                    },
                });
                const compressedSize = compressedData.length;

                // Normalize name and format data into C byte array.
                const normName = file.replace(/[^a-zA-Z0-9]/g, '_');
                let assetData = '';
                for (var i = 0; i < compressedData.length; i++) {
                    if (i % 16 == 0) assetData += "\n";
                    assetData += '0x' + ('00' + compressedData[i].toString(16)).slice(-2);
                    if (i < compressedData.length - 1) assetData += ', ';
                }

                const accessPath = isRoute
                    ? (
                        Object.entries(siteManifest.routes)
                            .find(r => r[1] === file) ?? ['/']
                    )[0]
                    : ('/' + file);

                allFiles.push({
                    path: accessPath,
                    normalizedName: normName,
                    mimeType: mime.lookup(file),
                    data: assetData,
                    size: compressedSize,
                    type: isRoute ? 'route' : 'resource',
                })
            });

            await Promise.all(filesToProcess);

            const totalBundleSize = humanFileSize(allFiles.reduce((acc, a) => acc + a.size, 0))
            const header = await ejs.renderFile(
                join(__dirname, 'header_template.h.ejs'),
                {
                    files: allFiles,
                    meta: {
                        totalSize: totalBundleSize,
                    }
                }
            );

            writeFileSync(join(distDir, 'static_site.h'), header);
            console.log(`✓ Built C header with total bundle size of ${totalBundleSize}.`);
        }
    };
};

function humanFileSize(size: number) {
    var i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return +((size / Math.pow(1024, i)).toFixed(2)) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

export default viteGenerateCHeader;