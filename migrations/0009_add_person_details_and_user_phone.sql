-- Add phone to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar(50);

-- Add personal detail fields to company_people (individual fully-detailed submission flow)
ALTER TABLE "company_people" ADD COLUMN IF NOT EXISTS "full_name" varchar(255);
ALTER TABLE "company_people" ADD COLUMN IF NOT EXISTS "date_of_birth" varchar;
ALTER TABLE "company_people" ADD COLUMN IF NOT EXISTS "nationality" varchar(100);
ALTER TABLE "company_people" ADD COLUMN IF NOT EXISTS "phone_number" varchar(50);
ALTER TABLE "company_people" ADD COLUMN IF NOT EXISTS "residential_address" text;
ALTER TABLE "company_people" ADD COLUMN IF NOT EXISTS "nin_encrypted" varchar(500);
ALTER TABLE "company_people" ADD COLUMN IF NOT EXISTS "bvn_encrypted" varchar(500);
