/**
 * Single re-export point for the orval-generated Consumer Auth / Profile client.
 *
 * Centralizing the generated import paths here means that if orval names the
 * tag-split folders differently than expected (e.g. `consumerAuth` vs
 * `consumer-auth`), this is the ONE file to adjust after `npm run codegen`.
 *
 * Generated from operationIds:
 *   ConsumerAuthController_signInWithGoogle/​signInWithApple/​requestOtpCode/
 *   verifyOtpCode/​refreshToken/​signOutConsumer  (tag "Consumer Auth")
 *   ConsumerProfileController_getMe/​updateMe/​requestPhone/​confirmPhone/​deleteMe
 *   (tag "Consumer Profile")
 */
export {
  consumerAuthControllerSignInWithGoogle as signInGoogleApi,
  consumerAuthControllerSignInWithApple as signInAppleApi,
  consumerAuthControllerRequestOtpCode as requestOtpApi,
  consumerAuthControllerVerifyOtpCode as verifyOtpApi,
  consumerAuthControllerSignOutConsumer as signOutApi,
} from './generated/consumer-auth/consumer-auth';

export {
  useConsumerProfileControllerGetMe as useGetMe,
  consumerProfileControllerUpdateMe as updateProfileApi,
  consumerProfileControllerRequestPhone as requestPhoneChangeApi,
  consumerProfileControllerConfirmPhone as confirmPhoneChangeApi,
  consumerProfileControllerDeleteMe as deleteAccountApi,
  getConsumerProfileControllerGetMeQueryKey as getMeQueryKey,
} from './generated/consumer-profile/consumer-profile';

export type {
  ConsumerSessionResponse,
  ConsumerProfileResponse,
  GoogleSignInDto,
  AppleSignInDto,
  RequestOtpDto,
  VerifyOtpDto,
  UpdateProfileDto,
  RequestPhoneChangeDto,
  ConfirmPhoneChangeDto,
  AcknowledgementResponse,
} from './generated/model';
