-- C-account: self-serve account layer (subscription history, password reset, billing info).

-- CreateEnum
CREATE TYPE "ChangedByType" AS ENUM ('SYSTEM', 'PLATFORM_USER', 'USER');

-- CreateTable
CREATE TABLE "subscription_history" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "fromPlanId" TEXT,
    "toPlanId" TEXT,
    "changedByType" "ChangedByType" NOT NULL,
    "changedByUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_billing_info" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "billingName" TEXT,
    "billingEmail" TEXT,
    "billingAddress" TEXT,
    "taxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_billing_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_history_organizationId_createdAt_idx" ON "subscription_history"("organizationId", "createdAt");
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");
CREATE UNIQUE INDEX "organization_billing_info_organizationId_key" ON "organization_billing_info"("organizationId");

-- AddForeignKey
ALTER TABLE "organization_billing_info" ADD CONSTRAINT "organization_billing_info_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
