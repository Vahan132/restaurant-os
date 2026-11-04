import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../../../shared/auth/public.decorator';
import { PairEdgeNodeUseCase } from '../../application/commands/pair-edge-node.usecase';
import { EdgePairResponse, PairEdgeNodeDto } from '../../application/dto/pairing.dto';

/**
 * EDGE-PAIR-3: per-IP throttle for the ONLY public, code-gated enrollment route.
 * 5 attempts / minute never inconveniences an admin typing one code, but blunts
 * brute-force / enumeration. Per-instance in-memory (matches the rest of the API);
 * the code's 40-bit entropy + 15-min TTL + single-use already make guessing
 * infeasible, so this is belt-and-suspenders on the highest-risk surface.
 */
export const EDGE_PAIR_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

/**
 * EDGE-PAIR-2: the hub redeems a pairing code here. PUBLIC (no node token yet —
 * that is exactly what this exchange delivers). The response carries the node
 * token + the per-hub fiscal KEK EXACTLY ONCE over TLS; neither is re-fetchable.
 * Separate from the node-token-guarded /edge/snapshot + /edge/config-sync.
 */
@ApiTags('edge')
@Public()
@UseGuards(ThrottlerGuard)
@Controller('edge')
export class EdgePairController {
  constructor(private readonly pair: PairEdgeNodeUseCase) {}

  @Post('pair')
  @Throttle(EDGE_PAIR_THROTTLE)
  @ApiOperation({
    summary: 'Redeem a pairing code: enrol the hub + deliver its token + fiscal KEK ONCE.',
  })
  @ApiOkResponse({ type: EdgePairResponse })
  @ApiUnauthorizedResponse({ description: 'The pairing code is invalid, already used, or expired.' })
  @ApiTooManyRequestsResponse({ description: 'Too many pairing attempts — wait a moment and retry.' })
  async pairNode(@Body() dto: PairEdgeNodeDto): Promise<EdgePairResponse> {
    return this.pair.execute({ code: dto.code });
  }
}
