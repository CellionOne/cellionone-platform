-- Block B2: Signature capture tables for CAC-compliant e-signatures
-- Adds: signatures, board_resolution_signatures, shareholder_confirmations

CREATE TABLE IF NOT EXISTS "signatures" (
  "id" SERIAL PRIMARY KEY,
  "user_id" VARCHAR,
  "company_person_id" INTEGER REFERENCES "company_people"("id") ON DELETE SET NULL,
  "application_id" INTEGER REFERENCES "company_applications"("id") ON DELETE CASCADE,
  "signature_context" VARCHAR(50) NOT NULL,     -- "founder" | "director_consent" | "witness"
  "signature_data_url" TEXT NOT NULL,           -- base64 PNG data URL, white background
  "white_background" BOOLEAN DEFAULT TRUE,
  "ip_address" VARCHAR(50),
  "user_agent" TEXT,
  "signed_at" TIMESTAMPTZ DEFAULT NOW(),
  "consent_accepted" BOOLEAN DEFAULT FALSE,
  "consent_text" TEXT,
  "is_verified" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_signatures_user" ON "signatures" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_signatures_application" ON "signatures" ("application_id");
CREATE INDEX IF NOT EXISTS "idx_signatures_person" ON "signatures" ("company_person_id");
CREATE INDEX IF NOT EXISTS "idx_signatures_context" ON "signatures" ("signature_context");

CREATE TABLE IF NOT EXISTS "board_resolution_signatures" (
  "id" SERIAL PRIMARY KEY,
  "application_id" INTEGER NOT NULL REFERENCES "company_applications"("id") ON DELETE CASCADE,
  "company_person_id" INTEGER NOT NULL REFERENCES "company_people"("id") ON DELETE CASCADE,
  "signature_id" INTEGER REFERENCES "signatures"("id") ON DELETE SET NULL,
  "role" VARCHAR(50) NOT NULL,                  -- "director" | "chairman" | "secretary"
  "declaration_text" TEXT,
  "signed_at" TIMESTAMPTZ,
  "ip_address" VARCHAR(50),
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_board_res_sigs_application" ON "board_resolution_signatures" ("application_id");
CREATE INDEX IF NOT EXISTS "idx_board_res_sigs_person" ON "board_resolution_signatures" ("company_person_id");

CREATE TABLE IF NOT EXISTS "shareholder_confirmations" (
  "id" SERIAL PRIMARY KEY,
  "application_id" INTEGER NOT NULL REFERENCES "company_applications"("id") ON DELETE CASCADE,
  "company_person_id" INTEGER NOT NULL REFERENCES "company_people"("id") ON DELETE CASCADE,
  "signature_id" INTEGER REFERENCES "signatures"("id") ON DELETE SET NULL,
  "confirmed_shares_allocated" INTEGER,
  "confirmed_share_class" VARCHAR(50),
  "confirmed_share_percentage" VARCHAR(20),
  "psc_declaration_accepted" BOOLEAN DEFAULT FALSE,
  "capital_paid_up_declaration_accepted" BOOLEAN DEFAULT FALSE,
  "consent_token" VARCHAR(128) UNIQUE,
  "token_expires_at" TIMESTAMP,
  "confirmed_at" TIMESTAMPTZ,
  "ip_address" VARCHAR(50),
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_shareholder_conf_application" ON "shareholder_confirmations" ("application_id");
CREATE INDEX IF NOT EXISTS "idx_shareholder_conf_person" ON "shareholder_confirmations" ("company_person_id");
CREATE INDEX IF NOT EXISTS "idx_shareholder_conf_token" ON "shareholder_confirmations" ("consent_token");
