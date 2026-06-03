import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';

/**
 * Example module demonstrating the canonical per-module layout
 * (see modules/MODULE_TEMPLATE.md). Health has only a presentation layer.
 * Public — no authentication required.
 */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({
    description: 'Service liveness probe.',
    schema: {
      example: { status: 'ok', timestamp: '2026-05-29T00:00:00.000Z' },
    },
  })
  check(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
