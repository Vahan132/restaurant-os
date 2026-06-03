import { Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { IdGenerator } from '../../application/ports/id-generator';

/** IdGenerator implementation producing cuid2 ids (matches the id convention). */
@Injectable()
export class CuidIdGenerator implements IdGenerator {
  generate(): string {
    return createId();
  }
}
