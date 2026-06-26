#!/usr/bin/env node
/**
 * Export remote D1 database to SQL and upload the dump to R2.
 *
 * Prerequisites:
 *   - wrangler logged in (`wrangler login`) OR CF_API_TOKEN + CF_ACCOUNT_ID in env
 *   - API token needs D1 Read and R2 Object Write
 *
 * Usage:
 *   node scripts/backup-d1-to-r2.mjs
 *   node scripts/backup-d1-to-r2.mjs --local
 *   D1_DATABASE_NAME=my-db R2_BUCKET=zmailr-attachments node scripts/backup-d1-to-r2.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
  const positionals = argv.filter((arg) => !arg.startsWith('--'));
  return {
    local: flags.has('--local'),
    databaseName:
      process.env.D1_DATABASE_NAME ||
      process.env.DATABASE_NAME ||
      positionals[0] ||
      'zmailr',
    bucket:
      process.env.R2_BUCKET ||
      process.env.ATTACHMENTS_BUCKET ||
      positionals[1] ||
      'zmailr-attachments',
    prefix: process.env.BACKUP_PREFIX || 'backups/d1',
  };
}

function runWrangler(args, options = {}) {
  const cmd = process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler';
  try {
    execFileSync(cmd, args, {
      cwd: ROOT,
      stdio: 'inherit',
      ...options,
    });
  } catch {
    execFileSync('pnpm', ['exec', 'wrangler', ...args], {
      cwd: ROOT,
      stdio: 'inherit',
      ...options,
    });
  }
}

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('');
}

function main() {
  const { local, databaseName, bucket, prefix } = parseArgs(process.argv.slice(2));
  const stamp = formatTimestamp();
  const objectKey = `${prefix.replace(/\/$/, '')}/${databaseName}-${stamp}.sql`;
  const tempDir = mkdtempSync(join(tmpdir(), 'zmailr-d1-backup-'));
  const sqlPath = join(tempDir, `${databaseName}-${stamp}.sql`);

  console.log(`[backup] database=${databaseName} target=r2://${bucket}/${objectKey} remote=${!local}`);

  try {
    const exportArgs = ['d1', 'export', databaseName, '--output', sqlPath];
    if (!local) exportArgs.push('--remote');
    runWrangler(exportArgs);

    const putArgs = [
      'r2',
      'object',
      'put',
      `${bucket}/${objectKey}`,
      '--file',
      sqlPath,
      '--content-type',
      'application/sql',
    ];
    if (!local) putArgs.push('--remote');
    runWrangler(putArgs);

    console.log(`[backup] done: r2://${bucket}/${objectKey}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
