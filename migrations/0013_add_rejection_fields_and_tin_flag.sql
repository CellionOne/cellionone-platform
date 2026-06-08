-- G4: CAC rejection fields on company_applications
ALTER TABLE "company_applications"
  ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP;

-- G5: Enable TIN registration feature flag
-- The seed function only inserts if missing, so we upsert directly here
INSERT INTO "feature_flags" ("key", "description", "is_enabled")
VALUES ('enable_tin_registration', 'Enable TIN registration feature', TRUE)
ON CONFLICT ("key") DO UPDATE SET "is_enabled" = TRUE, "updated_at" = NOW();
