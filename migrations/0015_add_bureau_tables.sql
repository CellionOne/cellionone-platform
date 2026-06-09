-- Bureau / ClearLedger credit scoring tables

CREATE SEQUENCE IF NOT EXISTS bureau_profile_id_seq START 1000;

CREATE TABLE IF NOT EXISTS "bureau_profiles" (
  "id" serial PRIMARY KEY,
  "clearledger_id" varchar(20) UNIQUE NOT NULL,
  "bvn_hash" varchar(64) UNIQUE,
  "nin_hash" varchar(64),
  "score" integer,
  "score_band" varchar(20),
  "score_calculated_at" timestamptz,
  "score_identity" integer,
  "score_cash_flow" integer,
  "score_investment" integer,
  "score_obligation" integer,
  "score_stability" integer,
  "profile_stage" varchar(20) DEFAULT 'CREATED',
  "data_richness" varchar(10) DEFAULT 'LOW',
  "has_kyc_verified" boolean DEFAULT false,
  "has_bank_data" boolean DEFAULT false,
  "has_capital_markets" boolean DEFAULT false,
  "has_obligation_data" boolean DEFAULT false,
  "has_cac_verified" boolean DEFAULT false,
  "positive_flags" text[] DEFAULT '{}',
  "negative_flags" text[] DEFAULT '{}',
  "recommendation" jsonb,
  "consent_granted_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_bureau_profiles_bvn_hash" ON "bureau_profiles" ("bvn_hash");
CREATE INDEX IF NOT EXISTS "idx_bureau_profiles_nin_hash" ON "bureau_profiles" ("nin_hash");

CREATE TABLE IF NOT EXISTS "bureau_events" (
  "id" serial PRIMARY KEY,
  "profile_id" integer NOT NULL REFERENCES "bureau_profiles"("id") ON DELETE CASCADE,
  "source_api_key_id" integer REFERENCES "kyc_api_keys"("id") ON DELETE SET NULL,
  "event_type" varchar(50) NOT NULL,
  "event_category" varchar(20) NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}',
  "occurred_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_bureau_events_profile" ON "bureau_events" ("profile_id");
CREATE INDEX IF NOT EXISTS "idx_bureau_events_category" ON "bureau_events" ("profile_id", "event_category");
CREATE INDEX IF NOT EXISTS "idx_bureau_events_occurred" ON "bureau_events" ("profile_id", "occurred_at");

CREATE TABLE IF NOT EXISTS "bureau_queries" (
  "id" serial PRIMARY KEY,
  "api_key_id" integer NOT NULL REFERENCES "kyc_api_keys"("id") ON DELETE RESTRICT,
  "environment" varchar(10) NOT NULL,
  "query_type" varchar(30) NOT NULL,
  "identifier_hash" varchar(64) NOT NULL,
  "profile_found" boolean NOT NULL,
  "score_returned" integer,
  "band_returned" varchar(20),
  "billable" boolean DEFAULT true,
  "unit_cost_ngn" integer,
  "consumer_reference" varchar(200),
  "queried_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_bureau_queries_key" ON "bureau_queries" ("api_key_id");
CREATE INDEX IF NOT EXISTS "idx_bureau_queries_hash" ON "bureau_queries" ("identifier_hash");

CREATE TABLE IF NOT EXISTS "bureau_score_history" (
  "id" serial PRIMARY KEY,
  "profile_id" integer NOT NULL REFERENCES "bureau_profiles"("id") ON DELETE CASCADE,
  "score" integer NOT NULL,
  "score_band" varchar(20) NOT NULL,
  "score_identity" integer,
  "score_cash_flow" integer,
  "score_investment" integer,
  "score_obligation" integer,
  "score_stability" integer,
  "data_sources" text[],
  "calculated_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_bureau_score_history_profile" ON "bureau_score_history" ("profile_id", "calculated_at");
