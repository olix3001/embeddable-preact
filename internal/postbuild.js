// postbuild.js
import fs from 'fs';
import path from 'path';
import zlib, { brotliCompress } from 'zlib';
import { glob } from 'glob';
import { minify } from 'html-minifier-terser';
import mime from 'mime-types';
import ejs from 'ejs';

const buildDir = 'build'; // SvelteKit's default output directory
const headerFile = 'dist/static_site.h';
const assets = [];

const asyncBrotliCompress = (data, options) => new Promise((resolve, reject) => brotliCompress(data, options, (err, result) => {
    if (err) reject(err)
        else resolve(result)
}))

const generateHeader = async () => {
  const files = await glob('**/*.{js,css,html}', {
    cwd: buildDir,
    nodir: true,
  });

  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
  }

  const filesToProcess = files.map(async (file) => {
    const filePath = path.join(buildDir, file);
    const compressedPath = `${filePath}.br`;
    const isHtml = filePath.endsWith('.html');
    let data = fs.readFileSync(filePath);

    if (isHtml) {
      const minifiedHtml = await minify(data.toString(), {
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true,
      });
      data = Buffer.from(minifiedHtml);
    //   fs.writeFileSync(filePath, data); // Overwrite with minified content
    }

    // Compress with max Brotli level
    const compressedData = await asyncBrotliCompress(data, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      },
    });

    fs.writeFileSync(compressedPath, compressedData);
    const compressedSize = compressedData.length;

    // Generate C-style byte array
    const normName = file.replace(/[^a-zA-Z0-9]/g, '_');

    let assetData = '';
    for (var i = 0; i < compressedData.length; i++) {
        if (i % 16 == 0) assetData += "\n";
        assetData += '0x' + ('00' + compressedData[i].toString(16)).slice(-2);
        if (i < compressedData.length - 1) assetData += ', ';
    }

    let assetPath = `/${file.replaceAll('\\', '/')}`;
    if (assetPath.endsWith('.html')) {
        assetPath = assetPath.substring(0, assetPath.length-5)
    }
    if (assetPath === '/index') {
        assetPath = '/'
    }

    assets.push({
      path: assetPath,
      normalizedName: normName,
      mimeType: mime.lookup(file),
      data: assetData,
      size: compressedSize,
      type: file.endsWith('.html') ? 'route' : 'resource'
    });
  });

  await Promise.all(filesToProcess);

  const header = await ejs.renderFile(
    'header_template.h.ejs',
    {
        files: assets,
        meta: {
            totalSize: humanFileSize(assets.reduce((acc, a) => acc + a.size, 0))
        }
    }
  );

  fs.writeFileSync(headerFile, header);
};

function humanFileSize(size) {
    var i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return +((size / Math.pow(1024, i)).toFixed(2)) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

generateHeader().catch(console.error);