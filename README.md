# NOWJU Publish OS

NOWJU 是面向多平台内容生产、账号管理、发布调度、人工确认和数据复盘的自托管发布中控。

## 当前能力

- React 中控前端（`apps/web`）
- NestJS API（`apps/api`）
- PostgreSQL 发布任务 / 账号 / 素材 / 确认记录
- Redis + BullMQ 发布队列与失败重试
- 六平台统一 Adapter：小红书、抖音、快手、视频号、微博、B站
- 人工确认发布流程
- GitHub Actions CI
- 腾讯云 CloudBase / CloudBase Run 部署基础

## 本地开发

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npm run dev:api
```

另开终端：

```bash
npm run dev:web
```

默认地址：

- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- Health: `http://localhost:3000/health`

## 构建

```bash
npm install
npm run build
npm test
```

## 腾讯云部署

部署说明见：`docs/DEPLOY_TENCENT_CLOUDBASE.md`

推荐结构：

- React 前端 → CloudBase 静态网站托管
- NestJS API → CloudBase Run
- PostgreSQL / Redis → 独立托管服务
- 素材 → CloudBase 存储 / COS（下一阶段接真实上传）

## 安全原则

不要把任何平台 Token、Cookie、密码、SecretId、SecretKey 或 `.env` 提交到 GitHub。真实平台自动发布优先使用官方 API；没有官方发布权限的平台保持人工确认，不使用绕过检测的自动化方案。
