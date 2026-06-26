'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

if (!fs.existsSync(path.join(repoRoot, '.git'))) {
  process.exit(0);
}

try {
  execSync('git config core.hooksPath .githooks', {
    cwd: repoRoot,
    stdio: 'ignore',
  });
} catch {
  process.exit(0);
}
