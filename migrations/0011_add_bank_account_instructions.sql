-- Task #258: Founder bank account instruction gate
-- Adds bank_account_instructions table and founder_instruction_id FK on bank_company_dispatches.
-- NOTE: This DDL was already applied directly to the database before this migration file was created.
-- The IF NOT EXISTS guards ensure idempotent execution on all environments.

CREATE TABLE IF NOT EXISTS "bank_account_instructions" (
  "id" SERIAL PRIMARY KEY,
  "founder_user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "company_profile_id" INTEGER NOT NULL REFERENCES "company_profiles"("id") ON DELETE CASCADE,
  "bank_partner_id" INTEGER NOT NULL REFERENCES "bank_partners"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "submitted_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_bank_account_instructions_founder"
  ON "bank_account_instructions" ("founder_user_id");

CREATE INDEX IF NOT EXISTS "idx_bank_account_instructions_company"
  ON "bank_account_instructions" ("company_profile_id");

CREATE INDEX IF NOT EXISTS "idx_bank_account_instructions_bank"
  ON "bank_account_instructions" ("bank_partner_id");

ALTER TABLE "bank_company_dispatches"
  ADD COLUMN IF NOT EXISTS "founder_instruction_id" INTEGER
  REFERENCES "bank_account_instructions"("id") ON DELETE SET NULL;

-- Partial unique index: at most one active (pending/dispatched) instruction per company+bank pair.
-- Prevents race-condition duplicates while still allowing a cancelled instruction to be re-created.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_bai_one_active_per_company_bank"
  ON "bank_account_instructions" ("company_profile_id", "bank_partner_id")
  WHERE status IN ('pending', 'dispatched');
