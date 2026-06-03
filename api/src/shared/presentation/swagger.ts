import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Single source of truth for the OpenAPI DocumentBuilder config. Used by BOTH
 * the runtime Swagger UI (main.ts) and the offline spec generator
 * (scripts/generate-openapi.ts) so the two never drift.
 */
export function buildSwaggerConfig(): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle('Restaurant OS API')
    .setDescription('Multi-tenant SaaS restaurant platform — backend API.')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();
}

/**
 * Bootstraps Swagger UI at /docs (OpenAPI JSON at /docs-json).
 * Called from main.ts after the app is created.
 */
export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
