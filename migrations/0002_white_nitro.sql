ALTER TABLE "application_checklist_items" ADD COLUMN "is_auto_resolved" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "company_applications" ADD COLUMN "abandoned_cart_reminder_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "company_applications" ADD COLUMN "abandoned_cart_last_reminder_at" timestamp;--> statement-breakpoint
ALTER TABLE "company_applications" ADD COLUMN "is_legacy_draft" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "company_people" ADD COLUMN "corporate_business_type" varchar(10);--> statement-breakpoint
ALTER TABLE "company_people" ADD COLUMN "kyb_lookup_status" varchar(20);--> statement-breakpoint
ALTER TABLE "company_people" ADD COLUMN "kyb_lookup_attempted_at" timestamp;--> statement-breakpoint
ALTER TABLE "company_people" ADD COLUMN "auto_verify_method" varchar(30);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_company_people_app_rc_unique" ON "company_people" USING btree ("application_id","corporate_rc_number") WHERE application_id IS NOT NULL AND corporate_rc_number IS NOT NULL;