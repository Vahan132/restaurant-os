-- CX-2: Consumer identity (Google / Apple / phone-OTP auth).
--   * CustomerAccount + CustomerIdentity (find-or-link by provider subject).
--   * CustomerRefreshToken — rotating family, hash-only, reuse detection.
--   * PhoneOtp (challenge, code hashed) + ConsumerOtpThrottle (reused lockout primitive).
--   * Reservation gains a nullable consumerId FK (SetNull) so delete-account can
--     sever the link; CX-3 populates it. All additive.

-- ── Enums ─────────────────────────────────────────────────────────────────────
CREATE TYPE "ConsumerGender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED');
CREATE TYPE "CustomerIdentityProvider" AS ENUM ('GOOGLE', 'APPLE', 'PHONE');

-- ── CustomerAccount (parent — created first for FK order) ──────────────────────
CREATE TABLE "customer_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "gender" "ConsumerGender",
    "birthday" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_accounts_email_key" ON "customer_accounts"("email");
CREATE UNIQUE INDEX "customer_accounts_phone_key" ON "customer_accounts"("phone");

-- ── CustomerIdentity ──────────────────────────────────────────────────────────
CREATE TABLE "customer_identities" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "provider" "CustomerIdentityProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_identities_provider_subject_key" ON "customer_identities"("provider", "subject");
CREATE INDEX "customer_identities_customerAccountId_idx" ON "customer_identities"("customerAccountId");

ALTER TABLE "customer_identities"
    ADD CONSTRAINT "customer_identities_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "customer_accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CustomerRefreshToken (rotating family, hash-only) ─────────────────────────
CREATE TABLE "consumer_refresh_tokens" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumer_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consumer_refresh_tokens_tokenHash_key" ON "consumer_refresh_tokens"("tokenHash");
CREATE INDEX "consumer_refresh_tokens_customerAccountId_idx" ON "consumer_refresh_tokens"("customerAccountId");
CREATE INDEX "consumer_refresh_tokens_familyId_idx" ON "consumer_refresh_tokens"("familyId");

ALTER TABLE "consumer_refresh_tokens"
    ADD CONSTRAINT "consumer_refresh_tokens_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "customer_accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── PhoneOtp (challenge; code hashed) ─────────────────────────────────────────
CREATE TABLE "consumer_phone_otps" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumer_phone_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consumer_phone_otps_phone_idx" ON "consumer_phone_otps"("phone");

-- ── ConsumerOtpThrottle (reused lockout primitive, keyed by phone) ────────────
CREATE TABLE "consumer_otp_throttles" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumer_otp_throttles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consumer_otp_throttles_phone_key" ON "consumer_otp_throttles"("phone");

-- ── Reservation: nullable consumer link (SetNull) ─────────────────────────────
ALTER TABLE "reservations" ADD COLUMN "consumerId" TEXT;

CREATE INDEX "reservations_consumerId_idx" ON "reservations"("consumerId");

ALTER TABLE "reservations"
    ADD CONSTRAINT "reservations_consumerId_fkey"
    FOREIGN KEY ("consumerId") REFERENCES "customer_accounts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
