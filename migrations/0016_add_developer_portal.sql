-- Developer portal tables

ALTER TABLE "kyc_api_keys"
  ADD COLUMN IF NOT EXISTS "developer_org_id" integer,
  ADD COLUMN IF NOT EXISTS "environment" varchar(10) DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS "revoked_at" timestamp;

CREATE INDEX IF NOT EXISTS "idx_kyc_ak_dev_org" ON "kyc_api_keys" ("developer_org_id");

CREATE TABLE IF NOT EXISTS "developer_orgs" (
  "id" serial PRIMARY KEY,
  "name" varchar(200) NOT NULL,
  "email" varchar(200) UNIQUE NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "org_type" varchar(50),
  "website" varchar(300),
  "country" varchar(3) DEFAULT 'NGA',
  "is_email_verified" boolean DEFAULT false,
  "is_approved" boolean DEFAULT false,
  "is_suspended" boolean DEFAULT false,
  "sandbox_only" boolean DEFAULT true,
  "tier" varchar(20) DEFAULT 'starter',
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_developer_orgs_email" ON "developer_orgs" ("email");

CREATE TABLE IF NOT EXISTS "developer_email_tokens" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "developer_orgs"("id") ON DELETE CASCADE,
  "token_hash" varchar(64) UNIQUE NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_dev_email_tokens_org" ON "developer_email_tokens" ("org_id");
