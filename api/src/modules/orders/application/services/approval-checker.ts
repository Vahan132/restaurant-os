import { Inject, Injectable } from '@nestjs/common';
import { ApprovalRequired } from '../application.errors';
import { USER_PERMISSION_READER, UserPermissionReader } from '../ports/user-permission.reader';

/**
 * Validates that, when approval is required, the supplied approver actually
 * holds the relevant permission. Returns the approver id to record, or null
 * when approval is not required.
 */
@Injectable()
export class ApprovalChecker {
  constructor(@Inject(USER_PERMISSION_READER) private readonly users: UserPermissionReader) {}

  async resolve(params: {
    organizationId: string;
    required: boolean;
    approvedByUserId?: string | null;
    permission: string;
    action: string;
  }): Promise<string | null> {
    if (!params.required) {
      return params.approvedByUserId ?? null;
    }
    const approver = params.approvedByUserId;
    if (!approver) {
      throw ApprovalRequired(params.action);
    }
    const ok = await this.users.userHasPermission(
      params.organizationId,
      approver,
      params.permission,
    );
    if (!ok) {
      throw ApprovalRequired(params.action);
    }
    return approver;
  }
}
