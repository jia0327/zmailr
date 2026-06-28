import type { D1Database } from '@cloudflare/workers-types';
import type { MaintenanceMode } from './types';
import { getMaintenanceMode } from './database';

/** User-facing labels for each maintenance block flag (deduped for display). */
export function getMaintenanceBlockedLabels(mode: MaintenanceMode): string[] {
  const labels: string[] = [];
  if (mode.blockSend) labels.push('发送邮件');
  if (mode.blockMailboxCreate) {
    labels.push('创建新邮箱（含 API 租用）');
  } else if (mode.blockLease) {
    labels.push('API 租用随机邮箱');
  }
  return labels;
}

/** Compose banner / API message: optional admin prefix + explicit blocked features. */
export function buildMaintenanceDisplayMessage(mode: MaintenanceMode): string {
  if (!mode.enabled) return '';
  const custom = mode.message?.trim();
  const blocked = getMaintenanceBlockedLabels(mode);
  if (blocked.length === 0) {
    return custom || '系统维护中，请稍后再试';
  }
  const blockedText = `暂停服务：${blocked.join('、')}。`;
  return custom ? `${custom} ${blockedText}` : `系统维护中。${blockedText}`;
}

export function maintenanceBlockedBody(mode: MaintenanceMode): {
  success: false;
  error: 'maintenance';
  message: string;
} {
  return {
    success: false,
    error: 'maintenance',
    message: buildMaintenanceDisplayMessage(mode),
  };
}

export type MaintenanceBlockCategory = 'lease' | 'send' | 'mailboxCreate';

export function pathMatchesMaintenanceBlock(
  path: string,
  method: string,
  category: MaintenanceBlockCategory
): boolean {
  if (method.toUpperCase() !== 'POST') return false;
  switch (category) {
    case 'lease':
      return path === '/api/lease';
    case 'send':
      return (
        path === '/api/send' ||
        path === '/api/user/send' ||
        (path.startsWith('/api/user/sent/') && path.endsWith('/resend'))
      );
    case 'mailboxCreate':
      return path === '/api/user/mailboxes' || path === '/api/lease';
    default:
      return false;
  }
}

export function isPathBlockedByMaintenance(
  path: string,
  method: string,
  mode: MaintenanceMode
): boolean {
  if (!mode.enabled) return false;
  if (mode.blockLease && pathMatchesMaintenanceBlock(path, method, 'lease')) return true;
  if (mode.blockSend && pathMatchesMaintenanceBlock(path, method, 'send')) return true;
  if (mode.blockMailboxCreate && pathMatchesMaintenanceBlock(path, method, 'mailboxCreate')) {
    return true;
  }
  return false;
}

export async function checkMaintenanceBlock(
  db: D1Database,
  path: string,
  method: string
): Promise<{ blocked: true; mode: MaintenanceMode } | { blocked: false }> {
  const mode = await getMaintenanceMode(db);
  if (isPathBlockedByMaintenance(path, method, mode)) {
    return { blocked: true, mode };
  }
  return { blocked: false };
}
