-- FISCAL-EDGE-3: per-branch AUTO/MANUAL dine-in fiscalize toggle on the fiscal
-- config. Additive: the enum defaults to AUTO so existing configs keep printing
-- on payment (unchanged behaviour). Non-secret scalar — it rides the existing
-- FISCAL-EDGE-1 config sync + snapshot mapper with no contract change.

CREATE TYPE "FiscalPrintMode" AS ENUM ('AUTO', 'MANUAL');

ALTER TABLE "fiscal_configs"
  ADD COLUMN "fiscal_print_mode" "FiscalPrintMode" NOT NULL DEFAULT 'AUTO';
