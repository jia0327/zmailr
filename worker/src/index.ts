import { Env } from './types';
import {
  ensureDatabaseInitialized,
  cleanupExpiredMailboxes,
  cleanupExpiredMails,
  cleanupReadMails,
  cleanupOldApiRequestStats,
  backfillMailboxMailDomains,
} from './database';
import { ensureMailDomainsSeeded, resolveDefaultMailDomain } from './mail-domains';
import { handleEmail } from './email-handler';
import app from './routes';

// 导出Worker处理函数
export default {
  // 处理HTTP请求
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      await ensureDatabaseInitialized(env.DB, env.ADMIN_PASSWORD);
      await ensureMailDomainsSeeded(env.DB, env);
      const defaultDomain = await resolveDefaultMailDomain(env.DB, env);
      await backfillMailboxMailDomains(env.DB, defaultDomain);

      return app.fetch(request, env, ctx);
    } catch (error) {
      console.error('请求处理失败:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: '服务器内部错误',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  },
  
  // 处理邮件
  async email(message: any, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      await ensureDatabaseInitialized(env.DB, env.ADMIN_PASSWORD);
      await ensureMailDomainsSeeded(env.DB, env);
      await handleEmail(message, env);
    } catch (error) {
      console.error('处理邮件失败:', error);
      throw new Error(`Failed to process email: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
  
  // 定时任务 - 每小时清理过期邮箱以及过期邮件和已被阅读的邮件
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      const deleted = await cleanupExpiredMailboxes(env.DB);
      console.log(`已清理 ${deleted} 个过期邮箱`);
      const deletedMail = await cleanupExpiredMails(env.DB);
      console.log(`已清理 ${deletedMail} 个过期邮件`);
      const deletedReadMail = await cleanupReadMails(env.DB);
      console.log(`已清理 ${deletedReadMail} 个已被阅读的邮件`);
      const deletedRequestStats = await cleanupOldApiRequestStats(env.DB);
      console.log(`已清理 ${deletedRequestStats} 条过期 API 请求统计`);
    } catch (error) {
      console.error('定时任务执行失败:', error);
    }
  },
};