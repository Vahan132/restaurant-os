import { Body, Controller, Delete, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { ConsumerGender } from '../../domain/entities/customer-account';
import { GetMyProfileUseCase } from '../../application/queries/get-my-profile.usecase';
import { UpdateMyProfileUseCase } from '../../application/commands/update-my-profile.usecase';
import { RequestPhoneChangeOtpUseCase } from '../../application/commands/request-phone-change-otp.usecase';
import { ConfirmPhoneChangeUseCase } from '../../application/commands/confirm-phone-change.usecase';
import { DeleteMyAccountUseCase } from '../../application/commands/delete-my-account.usecase';
import { ConsumerProfileView } from '../../application/dto/profile-view';
import { ConsumerAuthGuard } from './consumer-auth.guard';
import { CurrentConsumer } from './current-consumer.decorator';
import {
  ConfirmPhoneChangeDto,
  RequestPhoneChangeDto,
  UpdateProfileDto,
} from './dto/profile.dto';
import { AcknowledgementResponse, ConsumerProfileResponse } from './dto/responses';

/**
 * Authenticated consumer profile. Protected SOLELY by ConsumerAuthGuard (aud:consumer);
 * @Public() makes the GLOBAL staff guard chain skip these routes. Tagged
 * "Consumer Profile" for a clean orval group.
 */
@ApiTags('Consumer Profile')
@ApiBearerAuth()
@Public()
@UseGuards(ConsumerAuthGuard)
@Controller('consumer/me')
export class ConsumerProfileController {
  constructor(
    private readonly getProfile: GetMyProfileUseCase,
    private readonly updateProfile: UpdateMyProfileUseCase,
    private readonly requestPhoneChange: RequestPhoneChangeOtpUseCase,
    private readonly confirmPhoneChange: ConfirmPhoneChangeUseCase,
    private readonly deleteAccount: DeleteMyAccountUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ type: ConsumerProfileResponse })
  getMe(@CurrentConsumer() customerAccountId: string): Promise<ConsumerProfileView> {
    return this.getProfile.execute(customerAccountId);
  }

  @Patch()
  @ApiOkResponse({ type: ConsumerProfileResponse })
  updateMe(
    @CurrentConsumer() customerAccountId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<ConsumerProfileView> {
    return this.updateProfile.execute({
      customerAccountId,
      name: dto.name,
      gender: dto.gender as ConsumerGender | null | undefined,
      birthday: dto.birthday,
      email: dto.email,
    });
  }

  @Post('phone/request')
  @HttpCode(200)
  @ApiOkResponse({ type: AcknowledgementResponse })
  async requestPhone(
    @CurrentConsumer() customerAccountId: string,
    @Body() dto: RequestPhoneChangeDto,
  ): Promise<AcknowledgementResponse> {
    await this.requestPhoneChange.execute({
      customerAccountId,
      newPhone: dto.newPhone,
      locale: dto.locale,
    });
    return { success: true };
  }

  @Post('phone/confirm')
  @ApiOkResponse({ type: ConsumerProfileResponse })
  confirmPhone(
    @CurrentConsumer() customerAccountId: string,
    @Body() dto: ConfirmPhoneChangeDto,
  ): Promise<ConsumerProfileView> {
    return this.confirmPhoneChange.execute({
      customerAccountId,
      newPhone: dto.newPhone,
      code: dto.code,
    });
  }

  @Delete()
  @HttpCode(200)
  @ApiOkResponse({ type: AcknowledgementResponse })
  async deleteMe(
    @CurrentConsumer() customerAccountId: string,
  ): Promise<AcknowledgementResponse> {
    await this.deleteAccount.execute({ customerAccountId });
    return { success: true };
  }
}
