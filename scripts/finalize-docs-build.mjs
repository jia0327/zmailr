import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(root, 'frontend', 'public', 'docs');
const readmeHtml = path.join(docsDir, 'README.html');
const indexHtml = path.join(docsDir, 'index.html');

if (!fs.existsSync(readmeHtml)) {
  console.error('docs build output missing README.html — run vitepress build first');
  process.exit(1);
}

fs.copyFileSync(readmeHtml, indexHtml);
console.log('Copied README.html → index.html for /docs/');
