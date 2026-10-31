# NOWJU Publish OS

AI-driven multi-platform content production, compliance review, publishing orchestration, and analytics system.

## Current milestone

v0.1 bootstrap: API service, publishing domain contracts, health check, local infrastructure, and CI baseline.

## Architecture

- `apps/api` — NestJS API and orchestration layer
- `packages/publishing` — platform adapter contracts and task states
- `infra` — PostgreSQL / Redis local infrastructure
- `.github/workflows` — CI

## Local development

```bash
cp .env.example .env
npm install
npm run dev
```

Start infrastructure:

```bash
docker compose up -d postgres redis
```

Health check after API starts:

```text
GET http://localhost:3000/health
```

## Security note

Never commit platform tokens, cookies, passwords, API keys, or `.env` files. Platform integrations will prefer official APIs; browser-assisted flows must keep final human confirmation where required.
