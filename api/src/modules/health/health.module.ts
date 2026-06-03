import { Module } from '@nestjs/common';
import { HealthController } from './presentation/http/health.controller';

/**
 * Health module — minimal example of the canonical module structure.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
