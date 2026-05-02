ALTER TABLE "company_applications" ADD COLUMN IF NOT EXISTS "name1_availability" varchar(20);
ALTER TABLE "company_applications" ADD COLUMN IF NOT EXISTS "name2_availability" varchar(20);
ALTER TABLE "company_applications" ADD COLUMN IF NOT EXISTS "name3_availability" varchar(20);
ALTER TABLE "company_applications" ADD COLUMN IF NOT EXISTS "selected_names" text[];
