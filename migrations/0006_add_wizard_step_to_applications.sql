-- Add wizard_step column to company_applications
-- Stores the last wizard step the founder was on when they saved a draft,
-- so the wizard can reopen at the correct step on any device/browser.
ALTER TABLE "company_applications"
  ADD COLUMN IF NOT EXISTS "wizard_step" integer DEFAULT 1;
