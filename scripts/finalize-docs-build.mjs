import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDocs = path.join(root, 'frontend', 'public', 'docs');
const distDocs = path.join(root, 'frontend', 'dist', 'docs');
const indexHtml = path.join(publicDocs, 'index.html');

if (!fs.existsSync(indexHtml)) {
  console.error('docs build output missing index.html — check docs/.vitepress rewrites and vitepress build');
  process.exit(1);
}

// Cross-page links still reference ./README.html from source markdown paths
fs.copyFileSync(indexHtml, path.join(publicDocs, 'README.html'));
console.log('Verified docs/index.html; copied → README.html for legacy links');

const distIndex = path.join(distDocs, 'index.html');
if (!fs.existsSync(distIndex)) {
  console.error('frontend/dist/docs/index.html missing — docs must build before vite copies public/ to dist');
  process.exit(1);
}

fs.copyFileSync(distIndex, path.join(distDocs, 'README.html'));
console.log('Verified frontend/dist/docs/index.html for /docs/');
