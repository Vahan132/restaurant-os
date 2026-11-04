import { ApiProperty } from '@nestjs/swagger';
import { Device } from '../../domain/entities/device';
import { BranchStaffEntry } from '../ports/staff-directory.reader';
import { UserResponse } from './responses';

/** Device read shape. NEVER includes the secret hash. */
export class DeviceResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: ['POS', 'KDS', 'ADMIN'] }) surface!: string;
  @ApiProperty({ enum: ['ACTIVE', 'REVOKED'] }) status!: string;
  @ApiProperty({ nullable: true, type: String }) enrolledCidr!: string | null;
  @ApiProperty({ nullable: true, type: String }) lastSeenAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) lastSeenIp!: string | null;
  @ApiProperty() createdAt!: string;

  static from(d: Device): DeviceResponse {
    return {
      id: d.id,
      restaurantId: d.restaurantId,
      branchId: d.branchId,
      label: d.label,
      surface: d.surface,
      status: d.status,
      enrolledCidr: d.enrolledCidr,
      lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
      lastSeenIp: d.lastSeenIp,
      createdAt: d.createdAt.toISOString(),
    };
  }
}

/** Enrollment result — carries the plaintext secret EXACTLY ONCE. */
export class DeviceEnrolledResponse {
  @ApiProperty({ type: DeviceResponse }) device!: DeviceResponse;
  @ApiProperty({ description: 'Plaintext device secret — shown once, never retrievable again.' })
  secret!: string;
}

/** PIN create/reset result — carries the plaintext PIN EXACTLY ONCE. */
export class StaffPinIssuedResponse {
  @ApiProperty({ description: 'Plaintext PIN — shown once to the manager.' })
  pin!: string;
  @ApiProperty({ description: 'True if the staff member must rotate the PIN (after a reset).' })
  mustRotate!: boolean;
}

/** A staff-picker entry (display only — never PIN data). */
export class StaffPickerEntryResponse {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ nullable: true, type: String }) roleCode!: string | null;
  @ApiProperty({ nullable: true, type: String }) roleName!: string | null;

  static from(e: BranchStaffEntry): StaffPickerEntryResponse {
    return { id: e.id, fullName: e.fullName, roleCode: e.roleCode, roleName: e.roleName };
  }
}

/** PIN-login result — same token shape as email/password login, plus 3A extras. */
export class PinLoginResponse {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ description: 'Access-token lifetime in seconds.' }) expiresIn!: number;
  @ApiProperty({ type: UserResponse }) user!: UserResponse;
  @ApiProperty({ description: 'The branch the device is bound to (send as X-Branch-Id).' })
  branchId!: string;
  @ApiProperty({ description: 'True if this PIN was reset and should be rotated.' })
  mustRotate!: boolean;
}
