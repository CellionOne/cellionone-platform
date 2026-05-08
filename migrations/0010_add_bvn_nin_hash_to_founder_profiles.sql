ALTER TABLE "founder_profiles" ADD COLUMN IF NOT EXISTS "nin_hash" VARCHAR(64);
ALTER TABLE "founder_profiles" ADD COLUMN IF NOT EXISTS "bvn_hash" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "idx_founder_profiles_nin_hash"
  ON "founder_profiles" ("nin_hash")
  WHERE "nin_hash" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_founder_profiles_bvn_hash"
  ON "founder_profiles" ("bvn_hash")
  WHERE "bvn_hash" IS NOT NULL;
