import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ALL_PERMISSIONS, PermissionKey } from '../../domain/permissions.catalog';

/** Return the full permission catalog (single source of truth). */
@Injectable()
export class GetPermissionsUseCase implements UseCase<void, PermissionKey[]> {
  execute(): PermissionKey[] {
    return [...ALL_PERMISSIONS];
  }
}
