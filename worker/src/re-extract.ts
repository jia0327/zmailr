import type { D1Database } from '@cloudflare/workers-types';
import type { ExecutionContext } from '@cloudflare/workers-types';
import type { Email } from './types';
import {
  getEmail,
  getEmailReExtractRow,
  listEmailsWithoutExtractedCode,
  updateEmailExtractResult,
  type EmailReExtractRow,
} from './database';
import { extractCode } from './extractor';
import { stripHtml } from './email-handler';

export const RE_EXTRACT_BATCH_LIMIT = 100;

export interface ReExtractEmailsOptions {
  /** Limit to mailboxes owned by this user (user rules). Omit for global admin rules. */
  userId?: number;
  /** When set (not `*`), only emails whose From ends with `@domain`. */
  domain?: string;
  limit?: number;
}

export interface ReExtractBatchResult {
  scanned: number;
  updated: number;
}

export interface ReExtractAfterRuleOptions {
  userId?: number | null;
  domain: string;
  enabled?: boolean;
}

function emailBodyText(row: Pick<EmailReExtractRow, 'textContent' | 'htmlContent'>): string {
  return row.textContent || stripHtml(row.htmlContent || '');
}

async function applyExtractToRow(
  db: D1Database,
  row: EmailReExtractRow,
  updateWhenEmpty: boolean
): Promise<boolean> {
  const extractResult = await extractCode(
    db,
    emailBodyText(row),
    row.subject,
    row.fromAddress,
    row.mailboxUserId
  );

  if (!extractResult) {
    if (updateWhenEmpty) {
      await updateEmailExtractResult(db, row.id, null, null);
    }
    return false;
  }

  await updateEmailExtractResult(db, row.id, extractResult.code, extractResult.ruleId);
  return true;
}

/** Re-run extraction on one email (manual API). Always writes the latest result. */
export async function reExtractSingleEmail(
  db: D1Database,
  emailId: string
): Promise<Email | null> {
  const row = await getEmailReExtractRow(db, emailId);
  if (!row) return null;

  await applyExtractToRow(db, row, true);
  return getEmail(db, emailId, false);
}

/** Batch re-extract for emails that currently have no extracted code. */
export async function reExtractEmailsWithoutCode(
  db: D1Database,
  opts: ReExtractEmailsOptions
): Promise<ReExtractBatchResult> {
  const rows = await listEmailsWithoutExtractedCode(db, {
    userId: opts.userId,
    domain: opts.domain,
    limit: opts.limit ?? RE_EXTRACT_BATCH_LIMIT,
  });

  let updated = 0;
  for (const row of rows) {
    if (await applyExtractToRow(db, row, false)) {
      updated += 1;
    }
  }

  return { scanned: rows.length, updated };
}

export function buildReExtractBatchOpts(
  opts: ReExtractAfterRuleOptions
): ReExtractEmailsOptions | null {
  if (opts.enabled === false) return null;

  const batchOpts: ReExtractEmailsOptions = {
    limit: RE_EXTRACT_BATCH_LIMIT,
  };
  if (opts.userId != null) {
    batchOpts.userId = opts.userId;
  }
  if (opts.domain !== '*') {
    batchOpts.domain = opts.domain;
  }
  return batchOpts;
}

/** Fire-and-forget batch after extract rule create/update. */
export function scheduleReExtractAfterRuleChange(
  executionCtx: ExecutionContext,
  db: D1Database,
  opts: ReExtractAfterRuleOptions
): void {
  const batchOpts = buildReExtractBatchOpts(opts);
  if (!batchOpts) return;

  executionCtx.waitUntil(
    reExtractEmailsWithoutCode(db, batchOpts).catch((err) => {
      console.error('re-extract batch after rule change failed:', err);
    })
  );
}
