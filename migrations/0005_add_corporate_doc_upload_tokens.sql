-- Add corporate_doc_upload_tokens table
-- Stores time-limited upload tokens for corporate entity authorised reps
CREATE TABLE IF NOT EXISTS "corporate_doc_upload_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "token" varchar(128) NOT NULL UNIQUE,
  "application_id" integer NOT NULL REFERENCES "company_applications"("id"),
  "person_id" integer NOT NULL REFERENCES "company_people"("id"),
  "entity_name" varchar(255),
  "contact_email" varchar(255) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_corp_doc_upload_tokens_token" ON "corporate_doc_upload_tokens"("token");
CREATE INDEX IF NOT EXISTS "idx_corp_doc_upload_tokens_application" ON "corporate_doc_upload_tokens"("application_id");
