-- API usage summary: monthly rollup per API key / module / endpoint
CREATE TABLE IF NOT EXISTS "api_usage_summary" (
  "id" serial PRIMARY KEY,
  "api_key_id" integer NOT NULL REFERENCES "kyc_api_keys"("id") ON DELETE CASCADE,
  "period_year" integer NOT NULL,
  "period_month" integer NOT NULL,
  "module" varchar(50) NOT NULL,
  "endpoint" varchar(150) NOT NULL,
  "request_count" integer NOT NULL DEFAULT 0,
  "error_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_api_usage_summary"
  ON "api_usage_summary" ("api_key_id", "period_year", "period_month", "module", "endpoint");

CREATE INDEX IF NOT EXISTS "idx_api_usage_key_period"
  ON "api_usage_summary" ("api_key_id", "period_year", "period_month");
