import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './modules/realtime/infrastructure/redis-io.adapter';
import { AppConfig } from './shared/infrastructure/config/env.schema';
import { AllExceptionsFilter } from './shared/presentation/filters/all-exceptions.filter';
import { DomainExceptionFilter } from './shared/presentation/filters/domain-exception.filter';
import { ResponseEnvelopeInterceptor } from './shared/presentation/interceptors/response-envelope.interceptor';
import { setupSwagger } from './shared/presentation/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService<AppConfig, true>);

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

  // Real-time: Socket.IO with the Redis adapter so broadcasts fan out across
  // every API instance. Must be set before the server starts listening.
  const redisIoAdapter = new RedisIoAdapter(app, config.get('REDIS_URL', { infer: true }));
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

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
