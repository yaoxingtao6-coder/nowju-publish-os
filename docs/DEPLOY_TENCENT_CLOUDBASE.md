# NOWJU 腾讯云 CloudBase 部署

## 目标结构

- 前端：CloudBase 静态网站托管 / 应用部署
- API：CloudBase Run（使用根目录 `Dockerfile.api`）
- PostgreSQL：腾讯云托管 PostgreSQL 或兼容外部 PostgreSQL
- Redis：腾讯云 Redis 或兼容外部 Redis
- 素材：后续接 CloudBase 存储 / COS

## 1. API 运行环境变量

CloudBase Run 至少配置：

```text
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB
REDIS_URL=redis://HOST:6379
CORS_ORIGINS=https://YOUR_FRONTEND_DOMAIN
```

如果前端同时有正式自定义域名和 CloudBase 默认域名，可以用逗号分隔：

```text
CORS_ORIGINS=https://nowju.example.com,https://xxxx.tcloudbaseapp.com
```

不要把真实密码、Token、SecretId、SecretKey 写进 GitHub。

## 2. API 容器

构建：

```bash
docker build -f Dockerfile.api -t nowju-api .
```

CloudBase Run 只承载 HTTP API；PostgreSQL 和 Redis 使用独立托管服务，不放进 CloudBase Run 容器。

容器启动后先验收：

```text
GET https://YOUR_API_DOMAIN/health
```

必须返回健康状态后再部署前端。

## 3. 前端构建

复制生产环境变量：

```bash
cp apps/web/.env.production.example apps/web/.env.production
```

把其中：

```text
VITE_API_BASE_URL=https://YOUR_API_DOMAIN
```

替换为真实 API 域名，然后构建：

```bash
npm install
npm --workspace apps/web run build
```

产物目录：`apps/web/dist`。

CloudBase CLI V3：

```bash
npm i -g @cloudbase/cli
tcb login
tcb hosting deploy apps/web/dist --env-id YOUR_ENV_ID --yes
```

也可以使用 CloudBase 应用部署，从 GitHub 仓库自动构建 React 项目。

## 4. 数据层验收

API 启动后验证：

1. PostgreSQL 可创建/读取发布任务。
2. Redis/BullMQ 队列可加入和消费任务。
3. 服务重启后 PostgreSQL 中的任务仍存在。
4. 失败任务可重试，取消任务不会再次执行。
5. 发布执行日志可从 API 查询。

## 5. 前端验收

正式前端打开后验证：

1. 能读取平台账号。
2. 能创建发布任务。
3. 能填写正文和定时时间。
4. 能看到 queued / processing / awaiting_confirmation / published / failed / retrying / cancelled / needs_auth 等状态。
5. failed 任务可以点“重试”。
6. 未完成任务可以点“取消”。
7. 待确认任务可以批准或拒绝。
8. 手机浏览器与微信内置浏览器均可打开。

## 6. 上线顺序

严格按以下顺序：

1. 创建 PostgreSQL。
2. 创建 Redis。
3. 配置 CloudBase Run API 环境变量。
4. 部署 API。
5. 验证 `/health`。
6. 用正式 API 域名构建前端。
7. 部署前端静态站点。
8. 把前端正式域名加入 API 的 `CORS_ORIGINS`。
9. 再次验证前端所有 API 请求。
10. 手机端和微信内验收。

## 7. 仍需账号本人完成的动作

以下步骤涉及你的腾讯云账户或可能产生费用，必须由账号本人确认：

- 腾讯云登录/扫码
- 实名认证（如果控制台要求）
- 开通可能产生费用的 PostgreSQL / Redis / CloudBase Run 资源
- 确认资源地域与计费方案
- 平台 OAuth 或平台本人扫码授权

除此之外，代码、构建配置、部署参数和验收流程都应在仓库中完成。
