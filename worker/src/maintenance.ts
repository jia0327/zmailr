import type { D1Database } from '@cloudflare/workers-types';
import type { MaintenanceMode } from './types';
import { getMaintenanceMode } from './database';

export function maintenanceBlockedBody(mode: MaintenanceMode): {
  success: false;
  error: 'maintenance';
  message: string;
} {
  return {
    success: false,
    error: 'maintenance',
    message: mode.message?.trim() || '系统维护中，请稍后再试',
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
      return path === '/api/send' || path === '/api/user/send';
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
