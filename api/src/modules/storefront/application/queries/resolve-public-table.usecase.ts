import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PUBLIC_STOREFRONT_QUERY, PublicStorefrontQuery } from '../ports/public-query.port';
import { PublicTableResponse } from '../dto/responses';

export interface ResolvePublicTableInput {
  restaurantId: string;
  qrIdentifier: string;
}

/** Resolve a table by its QR identifier WITHIN the resolved restaurant (404 if unknown). */
@Injectable()
export class ResolvePublicTableUseCase implements UseCase<
  ResolvePublicTableInput,
  PublicTableResponse
> {
  constructor(@Inject(PUBLIC_STOREFRONT_QUERY) private readonly query: PublicStorefrontQuery) {}

  async execute(input: ResolvePublicTableInput): Promise<PublicTableResponse> {
    const table = await this.query.tableByQr(input.restaurantId, input.qrIdentifier);
    if (!table) {
      throw new NotFoundException({ code: 'TABLE_NOT_FOUND', message: 'Table not found.' });
    }
    return table;
  }
}
