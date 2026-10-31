# NOWJU 腾讯云 CloudBase 部署

## 目标结构

- 前端：CloudBase 静态网站托管 / 应用部署
- API：CloudBase Run（使用根目录 `Dockerfile.api`）
- PostgreSQL：腾讯云托管 PostgreSQL 或兼容外部 PostgreSQL
- Redis：腾讯云 Redis 或兼容外部 Redis
- 素材：后续接 CloudBase 存储 / COS

## 前端构建

```bash
npm install
VITE_API_BASE_URL=https://YOUR_API_DOMAIN npm --workspace apps/web run build
```

产物目录：`apps/web/dist`

CloudBase CLI V3：

```bash
npm i -g @cloudbase/cli
tcb login
tcb hosting deploy apps/web/dist --env-id YOUR_ENV_ID --yes
```

也可以使用 CloudBase 的应用部署，从 Git 仓库自动构建 React 项目。

## API 容器

构建：

```bash
docker build -f Dockerfile.api -t nowju-api .
```

运行时必须提供：

```text
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
PORT=3000
```

CloudBase Run 只承载 HTTP API；PostgreSQL 和 Redis 使用独立托管服务，不放进 CloudBase Run 容器。

## 上线验收

1. `GET /health` 返回 ok。
2. 前端能够读取 `/platform-accounts`、`/publish-jobs`、`/media-assets`、`/publish-confirmations/pending`。
3. 新建发布任务后数据库中存在记录，队列可消费。
4. 手机浏览器和微信内置浏览器可打开前端正式域名。
5. 任何真实平台 Token、Cookie、Secret 不进入 GitHub 仓库。

## 仍需账号本人完成的动作

- 腾讯云登录/扫码
- 实名认证（如果控制台要求）
- 开通可能产生费用的 PostgreSQL / Redis / CloudBase Run 资源
- 平台 OAuth 或平台本人扫码授权
