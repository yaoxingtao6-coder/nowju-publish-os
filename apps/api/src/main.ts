import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function requireProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = ['DATABASE_URL', 'REDIS_URL', 'CORS_ORIGINS', 'ADMIN_TOKEN'];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

async function bootstrap() {
  requireProductionEnv();

  const app = await NestFactory.create(AppModule);
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors(
    allowedOrigins.length
      ? {
          origin: allowedOrigins,
          credentials: true,
        }
      : undefined,
  );

  app.use((req: any, res: any, next: any) => {
    if (req.method === 'OPTIONS' || req.path === '/health') return next();

    const adminToken = process.env.ADMIN_TOKEN?.trim();
    if (!adminToken) return next();

    const authorization = String(req.headers.authorization ?? '');
    if (authorization === `Bearer ${adminToken}`) return next();

    return res.status(401).json({ message: 'UNAUTHORIZED' });
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`NOWJU API listening on ${port}`);
}

bootstrap();
