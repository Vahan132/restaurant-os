import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './modules/realtime/infrastructure/redis-io.adapter';
import { AppConfig } from './shared/infrastructure/config/env.schema';
import { AllExceptionsFilter } from './shared/presentation/filters/all-exceptions.filter';
import { DomainExceptionFilter } from './shared/presentation/filters/domain-exception.filter';
import { ResponseEnvelopeInterceptor } from './shared/presentation/interceptors/response-envelope.interceptor';
import { setupSwagger } from './shared/presentation/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  // REPORT-XLSX-1: report exports POST the rendered table (can exceed the 100kb default).
  app.useBodyParser('json', { limit: '5mb' });
  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService<AppConfig, true>);

  // Trust the reverse proxy (Nginx + Tailscale) so `req.ip` / `X-Forwarded-For`
  // resolve to the REAL client IP (3A). Without this every request looks like the
  // proxy IP and branch IP policy is meaningless. Accepts a hop count, a boolean,
  // or a subnet/keyword Express understands.
  const trustProxyRaw = config.get('TRUST_PROXY', { infer: true });
  const trustProxy: boolean | number | string =
    trustProxyRaw === 'true'
      ? true
      : trustProxyRaw === 'false'
        ? false
        : /^\d+$/.test(trustProxyRaw)
          ? Number(trustProxyRaw)
          : trustProxyRaw;
  // Set on the underlying Express instance (INestApplication has no `.set`).
  (app.getHttpAdapter().getInstance() as { set(k: string, v: unknown): void }).set(
    'trust proxy',
    trustProxy,
  );
  logger.log(`trust proxy = ${String(trustProxy)} (real client IP from X-Forwarded-For)`);

  // Global request validation.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Standard error shape + success envelope.
  // DomainExceptionFilter handles DomainError; AllExceptionsFilter is the catch-all.
  app.useGlobalFilters(new AllExceptionsFilter(), new DomainExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  // CORS from env.
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({
    origin: corsOrigins === '*' ? true : corsOrigins,
    credentials: true,
  });

  // Real-time: Socket.IO adapter.
  //  - CLOUD: Redis adapter so broadcasts fan out across every API instance.
  //  - EDGE: default in-process adapter (single node, no Redis).
  // Must be set before the server starts listening.
  if (config.get('APP_MODE', { infer: true }) === 'EDGE') {
    logger.log('EDGE mode: using in-process Socket.IO adapter (no Redis)');
  } else {
    const redisIoAdapter = new RedisIoAdapter(app, config.get('REDIS_URL', { infer: true }));
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
  }

  // Swagger at /docs.
  setupSwagger(app);

  // Graceful shutdown (Prisma onModuleDestroy etc.).
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  logger.log(`Restaurant OS API listening on http://localhost:${port}`);
  logger.log(`Swagger UI available at http://localhost:${port}/docs`);
}

void bootstrap();
