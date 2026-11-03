-- PIN-VIEW-1: sealed copy of the current staff PIN so managers can look it up.
ALTER TABLE "staff_pins" ADD COLUMN "pinCipher" TEXT;
