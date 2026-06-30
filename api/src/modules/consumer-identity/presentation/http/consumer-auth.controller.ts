import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { SignInWithGoogleUseCase } from '../../application/commands/sign-in-with-google.usecase';
import { SignInWithAppleUseCase } from '../../application/commands/sign-in-with-apple.usecase';
import { RequestPhoneOtpUseCase } from '../../application/commands/request-phone-otp.usecase';
import { VerifyPhoneOtpUseCase } from '../../application/commands/verify-phone-otp.usecase';
import { RefreshConsumerTokenUseCase } from '../../application/commands/refresh-consumer-token.usecase';
import { SignOutConsumerUseCase } from '../../application/commands/sign-out-consumer.usecase';
import { ConsumerSession } from '../../application/services/issue-consumer-session.service';
import {
  AppleSignInDto,
  GoogleSignInDto,
  RefreshDto,
  RequestOtpDto,
  SignOutDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { AcknowledgementResponse, ConsumerSessionResponse } from './dto/responses';

/**
 * Public (anonymous) consumer auth. @Public() so the GLOBAL staff guards skip these;
 * they need no authentication. Tagged "Consumer Auth" for a clean orval group.
 */
@ApiTags('Consumer Auth')
@Public()
@Controller('consumer/auth')
export class ConsumerAuthController {
  constructor(
    private readonly google: SignInWithGoogleUseCase,
    private readonly apple: SignInWithAppleUseCase,
    private readonly requestOtp: RequestPhoneOtpUseCase,
    private readonly verifyOtp: VerifyPhoneOtpUseCase,
    private readonly refresh: RefreshConsumerTokenUseCase,
    private readonly signOut: SignOutConsumerUseCase,
  ) {}

  @Post('google')
  @HttpCode(200)
  @ApiOkResponse({ type: ConsumerSessionResponse })
  signInWithGoogle(@Body() dto: GoogleSignInDto): Promise<ConsumerSession> {
    return this.google.execute({ idToken: dto.idToken });
  }

  @Post('apple')
  @HttpCode(200)
  @ApiOkResponse({ type: ConsumerSessionResponse })
  signInWithApple(@Body() dto: AppleSignInDto): Promise<ConsumerSession> {
    return this.apple.execute({
      idToken: dto.idToken,
      firstAuthName: dto.firstAuthName,
      firstAuthEmail: dto.firstAuthEmail,
    });
  }

  @Post('otp/request')
  @HttpCode(200)
  @ApiOkResponse({ type: AcknowledgementResponse })
  async requestOtpCode(@Body() dto: RequestOtpDto): Promise<AcknowledgementResponse> {
    await this.requestOtp.execute({ phone: dto.phone, locale: dto.locale });
    return { success: true };
  }

  @Post('otp/verify')
  @HttpCode(200)
  @ApiOkResponse({ type: ConsumerSessionResponse })
  verifyOtpCode(@Body() dto: VerifyOtpDto): Promise<ConsumerSession> {
    return this.verifyOtp.execute({ phone: dto.phone, code: dto.code });
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: ConsumerSessionResponse })
  refreshToken(@Body() dto: RefreshDto): Promise<ConsumerSession> {
    return this.refresh.execute({ refreshToken: dto.refreshToken });
  }

  @Post('signout')
  @HttpCode(200)
  @ApiOkResponse({ type: AcknowledgementResponse })
  async signOutConsumer(@Body() dto: SignOutDto): Promise<AcknowledgementResponse> {
    await this.signOut.execute({ refreshToken: dto.refreshToken });
    return { success: true };
  }
}
