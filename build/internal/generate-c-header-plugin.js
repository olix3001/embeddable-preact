"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const glob_1 = require("glob");
const promises_1 = require("fs/promises");
const html_minifier_terser_1 = require("html-minifier-terser");
const zlib_1 = __importStar(require("zlib"));
const mime_types_1 = __importDefault(require("mime-types"));
const ejs_1 = __importDefault(require("ejs"));
const asyncGzip = (data, options) => new Promise((resolve, reject) => (0, zlib_1.gzip)(data, options, (err, result) => {
    if (err)
        reject(err);
    else
        resolve(result);
}));
const viteGenerateCHeader = ({ bundlePreact = false } = {}) => {
    let config;
    return {
        name: 'vite-generate-c-header',
        enforce: 'post',
        configResolved(resolvedConfig) {
            config = resolvedConfig;
        },
        async closeBundle() {
            // Load manifest.
            const siteManifest = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(config.build.outDir, 'site-manifest.json'), 'utf-8'));
            // Compress and store all chunks.
            const allFiles = [];
            const distDir = config.build.outDir;
            const files = await (0, glob_1.glob)('**/*.{js,css,html}', {
                cwd: distDir,
                nodir: true,
            });
            const filesToProcess = files.map(async (file) => {
                const filePath = (0, path_1.join)(distDir, file);
                const isRoute = file.startsWith('route.');
                let data = await (0, promises_1.readFile)(filePath);
                if (isRoute) {
                    const minifiedHtml = await (0, html_minifier_terser_1.minify)(data.toString(), {
                        collapseWhitespace: true,
                        removeComments: true,
                        minifyCSS: true,
                        minifyJS: true,
                    });
                    data = Buffer.from(minifiedHtml);
                }
                const compressedData = await asyncGzip(data, {
                    level: zlib_1.default.constants.Z_BEST_COMPRESSION
                });
                const compressedSize = compressedData.length;
                // Normalize name and format data into C byte array.
                const normName = file.replace(/[^a-zA-Z0-9]/g, '_');
                let assetData = '';
                for (var i = 0; i < compressedData.length; i++) {
                    if (i % 16 == 0)
                        assetData += "\n";
                    assetData += '0x' + ('00' + compressedData[i].toString(16)).slice(-2);
                    if (i < compressedData.length - 1)
                        assetData += ', ';
                }
                const accessPath = isRoute
                    ? (Object.entries(siteManifest.routes)
                        .find(r => r[1] === file) ?? ['/'])[0]
                    : ('/' + file);
                allFiles.push({
                    path: accessPath,
                    normalizedName: normName,
                    mimeType: mime_types_1.default.lookup(file),
                    data: assetData,
                    size: compressedSize,
                    type: isRoute ? 'route' : 'resource',
                });
            });
            await Promise.all(filesToProcess);
            const totalBundleSize = humanFileSize(allFiles.reduce((acc, a) => acc + a.size, 0));
            const header = await ejs_1.default.renderFile((0, path_1.join)(__dirname, 'header_template.h.ejs'), {
                files: allFiles,
                meta: {
                    totalSize: totalBundleSize,
                }
            });
            (0, fs_1.writeFileSync)((0, path_1.join)(distDir, 'static_site.h'), header);
            console.log(`✓ Built C header with total bundle size of ${totalBundleSize}.`);
        }
    };
};
function humanFileSize(size) {
    var i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return +((size / Math.pow(1024, i)).toFixed(2)) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}
exports.default = viteGenerateCHeader;
