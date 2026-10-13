import { promises as fs, createReadStream } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { Public } from '../../../../shared/auth/public.decorator';
import { contentTypeForExtension } from '../../domain/media-content-type';
import { DevObjectStorageAdapter } from '../../infrastructure/adapters/dev-object-storage.adapter';

/**
 * Dev-only receiver/server for the local filesystem storage adapter. These routes
 * exist so local dev works without R2: the presigned PUT lands here and bytes are
 * written under MEDIA_DEV_DIR; the public GET serves them back. Every handler
 * 404s unless STORAGE_DRIVER=dev, so they are inert in production.
 *
 * The object key travels as a `key` query param (not a path splat) so routing is
 * independent of Express/path-to-regexp wildcard semantics. Public (no bearer
 * auth): the presigned URL carries its own HMAC signature. Excluded from OpenAPI.
 */
@ApiExcludeController()
@Public()
@Controller(DevObjectStorageAdapter.ROUTE_PREFIX)
export class MediaDevController {
  private readonly devDir: string;
  private readonly signingSecret: string;
  private readonly driver: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.driver = config.get('STORAGE_DRIVER', { infer: true });
    this.devDir = resolve(config.get('MEDIA_DEV_DIR', { infer: true }) as string);
    this.signingSecret = config.get('JWT_ACCESS_SECRET', { infer: true }) as string;
  }

  private assertDevDriver(): void {
    if (this.driver !== 'dev') {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found.' });
    }
  }

  /** Resolve a request key to an absolute path, refusing traversal outside devDir. */
  private safePath(key: string): string {
    if (!key) {
      throw new BadRequestException({ code: 'INVALID_OBJECT_KEY', message: 'Missing object key.' });
    }
    const target = resolve(join(this.devDir, normalize(key)));
    if (target !== this.devDir && !target.startsWith(this.devDir + '/')) {
      throw new BadRequestException({ code: 'INVALID_OBJECT_KEY', message: 'Invalid object key.' });
    }
    return target;
  }

  @Put()
  async upload(
    @Query('key') key: string,
    @Query('exp') expRaw: string,
    @Query('sig') sig: string,
    @Req() req: Request,
  ): Promise<{ key: string; bytes: number }> {
    this.assertDevDriver();
    const exp = Number(expRaw);
    if (!Number.isFinite(exp) || exp < Date.now()) {
      throw new BadRequestException({ code: 'UPLOAD_URL_EXPIRED', message: 'Upload URL expired.' });
    }
    const expected = DevObjectStorageAdapter.signature(key, exp, this.signingSecret);
    if (!sig || sig !== expected) {
      throw new BadRequestException({
        code: 'INVALID_UPLOAD_SIGNATURE',
        message: 'Invalid upload signature.',
      });
    }
    const target = this.safePath(key);
    const body = await MediaDevController.readRawBody(req);
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    return { key, bytes: body.length };
  }

  @Get()
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async serve(@Query('key') key: string, @Res() res: Response): Promise<void> {
    this.assertDevDriver();
    const target = this.safePath(key);
    try {
      await fs.access(target);
    } catch {
      throw new NotFoundException({ code: 'OBJECT_NOT_FOUND', message: 'Object not found.' });
    }
    res.setHeader('Content-Type', contentTypeForExtension(extname(target).replace(/^\./, '')));
    createReadStream(target).pipe(res);
  }

  private static readRawBody(req: Request): Promise<Buffer> {
    return new Promise((resolvePromise, rejectPromise) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => resolvePromise(Buffer.concat(chunks)));
      req.on('error', rejectPromise);
    });
  }
}
