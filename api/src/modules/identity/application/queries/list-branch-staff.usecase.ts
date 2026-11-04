import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  BranchStaffEntry,
  STAFF_DIRECTORY_READER,
  StaffDirectoryReader,
} from '../ports/staff-directory.reader';

export interface ListBranchStaffInput {
  restaurantId: string;
  branchId: string;
}

/**
 * Staff-picker list for the POS/KDS login grid. Resolved from the DEVICE context
 * (never a user JWT). Returns display info only — no PIN data ever.
 */
@Injectable()
export class ListBranchStaffUseCase implements UseCase<ListBranchStaffInput, BranchStaffEntry[]> {
  constructor(@Inject(STAFF_DIRECTORY_READER) private readonly directory: StaffDirectoryReader) {}

  execute(input: ListBranchStaffInput): Promise<BranchStaffEntry[]> {
    return this.directory.listBranchStaff(input.restaurantId, input.branchId);
  }
}
