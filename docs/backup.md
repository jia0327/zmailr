# D1 数据库备份

> **文档导航** → [README.md](./README.md) · **部署** → [deploy.md](./deploy.md)

本文说明如何将 zMailR 的 **D1 数据库**定期导出为 SQL，并上传到 **R2**（与附件共用 bucket `zmailr-attachments`，路径前缀 `backups/d1/`），便于自托管运维与灾难恢复。

---

## 前置条件

- 已部署 zMailR（见 [deploy.md](./deploy.md)）
- 本机已安装 [Node.js](https://nodejs.org/) 与项目依赖（`pnpm install`）
- 已登录 Wrangler（`pnpm exec wrangler login`），**或**在环境中设置：
  - `CF_API_TOKEN`（需 **D1 Read** + **R2 Object Write**）
  - `CF_ACCOUNT_ID`
- 知道 D1 **database_name**（与 `wrangler.toml` 中 `database_name` 一致，GitHub Secret `D1_DATABASE_NAME`）

---

## 手动备份

在仓库根目录执行：

```bash
# 从远程 D1 导出并上传到远程 R2（生产推荐）
node scripts/backup-d1-to-r2.mjs

# 指定数据库名与 bucket
D1_DATABASE_NAME=你的数据库名 R2_BUCKET=zmailr-attachments node scripts/backup-d1-to-r2.mjs

# 仅备份本地 wrangler dev 使用的 D1（开发/调试）
node scripts/backup-d1-to-r2.mjs --local
```

脚本流程：

1. `wrangler d1 export <database> --remote --output <临时.sql>`
2. `wrangler r2 object put zmailr-attachments/backups/d1/<database>-<UTC时间戳>.sql --file <临时.sql> --remote`

成功后在控制台输出 R2 对象路径，例如：

```text
[backup] done: r2://zmailr-attachments/backups/d1/zmailr-20250626120000.sql
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `D1_DATABASE_NAME` | `zmailr` | D1 数据库名称 |
| `R2_BUCKET` | `zmailr-attachments` | 目标 R2 bucket |
| `BACKUP_PREFIX` | `backups/d1` | R2 对象键前缀 |
| `CF_API_TOKEN` | — | 非交互环境（CI）必填 |
| `CF_ACCOUNT_ID` | — | 非交互环境（CI）必填 |

---

## 从 R2 恢复（参考）

Wrangler 不直接提供 `d1 import from r2`；恢复步骤为：

1. 下载备份 SQL：

   ```bash
   pnpm exec wrangler r2 object get zmailr-attachments/backups/d1/你的备份文件.sql --file restore.sql --remote
   ```

2. 导入 D1（**会覆盖目标库数据，请先确认环境**）：

   ```bash
   pnpm exec wrangler d1 execute 你的数据库名 --remote --file restore.sql
   ```

建议在恢复前先在测试库或 `--local` 环境验证 SQL 文件。

---

## GitHub Actions 定时备份（可选）

在仓库 `.github/workflows/` 下新建 workflow（示例），每周日凌晨执行：

```yaml
name: Backup D1 to R2

on:
  schedule:
    - cron: '0 3 * * 0'  # 每周日 03:00 UTC
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Export D1 and upload to R2
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
          D1_DATABASE_NAME: ${{ secrets.D1_DATABASE_NAME }}
          R2_BUCKET: zmailr-attachments
        run: node scripts/backup-d1-to-r2.mjs
```

复用部署 workflow 已有的 `CF_API_TOKEN`、`CF_ACCOUNT_ID`、`D1_DATABASE_NAME` 即可，无需新增 Secret（除非 bucket 名称不同）。

---

## 运维建议

- **保留策略**：在 Cloudflare R2 控制台为 `backups/d1/` 配置生命周期规则，或定期手动删除旧备份。
- **与附件隔离**：备份对象使用前缀 `backups/d1/`，与入站附件路径 `attachments/` 分离。
- **监控**：可配合 `GET /api/public/status` 的 `checks.d1` / `checks.r2` 确认依赖可用后再执行备份。

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [deploy.md](./deploy.md) | 部署、R2 附件 bucket、Secrets |
| [backup.md](./backup.md) | D1 备份脚本与恢复 |
| [api.md](./api.md) | `/api/public/status` 健康检查 |
| [admin-guide.md](./admin-guide.md) | 管理后台与维护模式 |
