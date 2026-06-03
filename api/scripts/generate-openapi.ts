/**
 * Offline OpenAPI spec generator.
 *
 * Bootstraps the Nest application (WITHOUT listening on a port), builds the
 * OpenAPI document from the same DocumentBuilder config the runtime uses, and
 * writes it pretty-printed to ./openapi.json at the repo root.
 *
 * NOTE: this bootstraps the full AppModule, which instantiates PrismaService —
 * so Postgres must be reachable (e.g. `docker compose up -d`) for it to run.
 * If you'd rather not boot the app, an alternative is to start the server
 * (`pnpm start:prod`) and fetch the live spec:  curl http://localhost:3001/docs-json > openapi.json
 *
 * Usage:  docker compose up -d  &&  pnpm generate:openapi
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { buildSwaggerConfig } from '../src/shared/presentation/swagger';

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());

  const outPath = resolve(process.cwd(), 'openapi.json');
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  const pathCount = Object.keys(document.paths ?? {}).length;
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec written to ${outPath} (${pathCount} paths).`);

  await app.close();
}

generate()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to generate OpenAPI spec:', err);
    process.exit(1);
  });
