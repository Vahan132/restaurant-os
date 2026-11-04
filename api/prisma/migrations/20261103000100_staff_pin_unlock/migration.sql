-- PIN-UNLOCK-1: manager "Unlock PIN". Marks the moment the lockout counters were
-- cleared so cloud and hub can tell a deliberate unlock from ordinary counters
-- (the newer unlock wins in both sync directions).
ALTER TABLE "staff_pins" ADD COLUMN "lockResetAt" TIMESTAMP(3);
