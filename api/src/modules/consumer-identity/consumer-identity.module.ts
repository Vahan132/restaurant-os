import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ReservationsModule } from '../reservations/reservations.module';
import { AppConfig } from '../../shared/infrastructure/config/env.schema';

// ports
import { CONSUMER_TOKEN_SERVICE } from './application/ports/consumer-token.service';
import { PROVIDER_VERIFIER } from './application/ports/provider-verifier';
import { OTP_CODE_HASHER } from './application/ports/otp-code-hasher';
import { SMS_SENDER } from './application/ports/sms-sender';
import { CONSUMER_RESERVATION_LINK } from './application/ports/consumer-reservation-link';
import { CUSTOMER_ACCOUNT_REPOSITORY } from './domain/repositories/customer-account.repository';
import { CUSTOMER_IDENTITY_REPOSITORY } from './domain/repositories/customer-identity.repository';
import { CUSTOMER_REFRESH_TOKEN_REPOSITORY } from './domain/repositories/customer-refresh-token.repository';
import { PHONE_OTP_REPOSITORY } from './domain/repositories/phone-otp.repository';
import { CONSUMER_OTP_THROTTLE_REPOSITORY } from './domain/repositories/consumer-otp-throttle.repository';

// infrastructure
import { ConsumerJwtTokenService } from './infrastructure/services/consumer-jwt-token.service';
import { JwksProviderVerifier } from './infrastructure/services/jwks-provider-verifier';
import { Argon2OtpCodeHasher } from './infrastructure/services/argon2-otp-code-hasher';
import { NikitaSmsSender } from './infrastructure/services/nikita-sms-sender';
import { ConsoleSmsSender } from './infrastructure/services/console-sms-sender';
import { PrismaCustomerAccountRepository } from './infrastructure/persistence/prisma-customer-account.repository';
import { PrismaCustomerIdentityRepository } from './infrastructure/persistence/prisma-customer-identity.repository';
import { PrismaCustomerRefreshTokenRepository } from './infrastructure/persistence/prisma-customer-refresh-token.repository';
import { PrismaPhoneOtpRepository } from './infrastructure/persistence/prisma-phone-otp.repository';
import { PrismaConsumerOtpThrottleRepository } from './infrastructure/persistence/prisma-consumer-otp-throttle.repository';
import { PrismaConsumerReservationLink } from './infrastructure/persistence/prisma-consumer-reservation-link';

// application services
import { IssueConsumerSession } from './application/services/issue-consumer-session.service';
import { FindOrLinkProviderAccount } from './application/services/find-or-link-provider-account.service';
import { VerifyOtpChallenge } from './application/services/verify-otp-challenge.service';

// use-cases
import { SignInWithGoogleUseCase } from './application/commands/sign-in-with-google.usecase';
import { SignInWithAppleUseCase } from './application/commands/sign-in-with-apple.usecase';
import { RequestPhoneOtpUseCase } from './application/commands/request-phone-otp.usecase';
import { VerifyPhoneOtpUseCase } from './application/commands/verify-phone-otp.usecase';
import { RefreshConsumerTokenUseCase } from './application/commands/refresh-consumer-token.usecase';
import { SignOutConsumerUseCase } from './application/commands/sign-out-consumer.usecase';
import { GetMyProfileUseCase } from './application/queries/get-my-profile.usecase';
import { UpdateMyProfileUseCase } from './application/commands/update-my-profile.usecase';
import { RequestPhoneChangeOtpUseCase } from './application/commands/request-phone-change-otp.usecase';
import { ConfirmPhoneChangeUseCase } from './application/commands/confirm-phone-change.usecase';
import { DeleteMyAccountUseCase } from './application/commands/delete-my-account.usecase';

// presentation
import { ConsumerAuthController } from './presentation/http/consumer-auth.controller';
import { ConsumerProfileController } from './presentation/http/consumer-profile.controller';
import { ConsumerAuthGuard } from './presentation/http/consumer-auth.guard';

/**
 * Consumer identity (CX-2). A SEPARATE auth audience from all staff/platform auth.
 * Imports ReservationsModule to REUSE CancelReservationUseCase (delete-account frees
 * tables via the real path). The SMS sender is selected at runtime: the Nikita
 * adapter when creds are present, else a console stub (so OTP works in dev).
 */
@Module({
  imports: [ReservationsModule, JwtModule.register({})],
  controllers: [ConsumerAuthController, ConsumerProfileController],
  providers: [
    // use-cases
    SignInWithGoogleUseCase,
    SignInWithAppleUseCase,
    RequestPhoneOtpUseCase,
    VerifyPhoneOtpUseCase,
    RefreshConsumerTokenUseCase,
    SignOutConsumerUseCase,
    GetMyProfileUseCase,
    UpdateMyProfileUseCase,
    RequestPhoneChangeOtpUseCase,
    ConfirmPhoneChangeUseCase,
    DeleteMyAccountUseCase,
    // application services
    IssueConsumerSession,
    FindOrLinkProviderAccount,
    VerifyOtpChallenge,
    // guard
    ConsumerAuthGuard,
    // port → implementation bindings
    { provide: CONSUMER_TOKEN_SERVICE, useClass: ConsumerJwtTokenService },
    { provide: PROVIDER_VERIFIER, useClass: JwksProviderVerifier },
    { provide: OTP_CODE_HASHER, useClass: Argon2OtpCodeHasher },
    {
      provide: SMS_SENDER,
      // Auto-select Nikita when creds are present, else the dev console stub.
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const url = config.get('SMS_NIKITA_URL', { infer: true });
        const user = config.get('SMS_NIKITA_USER', { infer: true });
        const pass = config.get('SMS_NIKITA_PASS', { infer: true });
        return url && user && pass ? new NikitaSmsSender(config) : new ConsoleSmsSender();
      },
      inject: [ConfigService],
    },
    { provide: CUSTOMER_ACCOUNT_REPOSITORY, useClass: PrismaCustomerAccountRepository },
    { provide: CUSTOMER_IDENTITY_REPOSITORY, useClass: PrismaCustomerIdentityRepository },
    { provide: CUSTOMER_REFRESH_TOKEN_REPOSITORY, useClass: PrismaCustomerRefreshTokenRepository },
    { provide: PHONE_OTP_REPOSITORY, useClass: PrismaPhoneOtpRepository },
    { provide: CONSUMER_OTP_THROTTLE_REPOSITORY, useClass: PrismaConsumerOtpThrottleRepository },
    { provide: CONSUMER_RESERVATION_LINK, useClass: PrismaConsumerReservationLink },
  ],
  // CX-3: the consumer booking/saved controllers reuse ConsumerAuthGuard. A guard
  // applied via @UseGuards is instantiated in the CONSUMER module's context, so we
  // export the token service it depends on; ConsumerModule provides its own guard
  // instance from it.
  exports: [CONSUMER_TOKEN_SERVICE],
})
export class ConsumerIdentityModule {}
