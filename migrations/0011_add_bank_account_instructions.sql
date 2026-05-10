-- Task #258: Founder bank account instruction gate
-- Adds bank_account_instructions table and founder_instruction_id FK on bank_company_dispatches.
-- NOTE: This DDL was already applied directly to the database before this migration file was created.
-- The IF NOT EXISTS guards ensure idempotent execution on all environments.

CREATE TABLE IF NOT EXISTS "bank_account_instructions" (
  "id" SERIAL PRIMARY KEY,
  -- founder_user_id is the Replit Auth user ID (string). No FK to users table
  -- because the users table is managed externally by the auth layer and is not
  -- guaranteed to exist in all environments. Integrity is enforced at app level.
  "founder_user_id" TEXT NOT NULL,
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

-- DB-level guard on status values (idempotent: ignored if constraint already exists).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_bai_status' AND conrelid = 'bank_account_instructions'::regclass
  ) THEN
    ALTER TABLE "bank_account_instructions"
      ADD CONSTRAINT "chk_bai_status"
      CHECK (status IN ('pending', 'dispatched', 'cancelled'));
  END IF;
END $$;
