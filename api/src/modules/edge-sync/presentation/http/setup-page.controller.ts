import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { SETUP_PAGE_HTML } from './setup-page.html';

/**
 * EDGE-SETUP-3B: serves the hub-local setup page at GET /setup. EDGE-only (this
 * module is excluded from CLOUD), @Public (an unpaired hub has no users), and a
 * SINGLE self-contained HTML document (no external assets) so it renders on a
 * branch-LAN device with no internet. Excluded from OpenAPI (it is a page, not an
 * API). The page drives the 3A JSON endpoints (/setup/status, /setup/pair).
 */
@ApiExcludeController()
@Public()
@Controller('setup')
export class SetupPageController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  page(): string {
    return SETUP_PAGE_HTML;
  }
}
