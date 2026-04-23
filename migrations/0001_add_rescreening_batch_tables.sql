CREATE TABLE "cie_market_context" (
	"id" serial PRIMARY KEY NOT NULL,
	"context_date" varchar(20) NOT NULL,
	"asi_close_kobo" integer,
	"asi_change_pct_bps" integer,
	"brent_usd_cents" integer,
	"ngn_per_usd" integer,
	"cbn_mpr_bps" integer,
	"gainers_count" integer,
	"losers_count" integer,
	"notes" text,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "cie_market_context_context_date_unique" UNIQUE("context_date")
);
--> statement-breakpoint
CREATE TABLE "kyc_rescreening_batch_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"verification_request_id" integer NOT NULL,
	"supplier_id" integer,
	"org_id" integer NOT NULL,
	"org_name" varchar(255),
	"subject_name" varchar(255) NOT NULL,
	"subject_email" varchar(255),
	"last_screened_at" timestamp,
	"current_risk_score" varchar(10),
	"screening_result" varchar(30),
	"screened_at" timestamp,
	"new_risk_score" varchar(10),
	"skipped" boolean DEFAULT false NOT NULL,
	"skip_note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_rescreening_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"approved_items" integer DEFAULT 0 NOT NULL,
	"skipped_items" integer DEFAULT 0 NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_user_id" varchar,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bank_document_requests" ADD COLUMN "fulfilled_at" timestamp;--> statement-breakpoint
ALTER TABLE "cie_scores" ADD COLUMN "rsi14" integer;--> statement-breakpoint
ALTER TABLE "cie_scores" ADD COLUMN "ma50_kobo" integer;--> statement-breakpoint
ALTER TABLE "cie_scores" ADD COLUMN "above_ma50" boolean;--> statement-breakpoint
ALTER TABLE "cie_scores" ADD COLUMN "week_return" integer;--> statement-breakpoint
ALTER TABLE "cie_scores" ADD COLUMN "month_return" integer;--> statement-breakpoint
ALTER TABLE "cie_scores" ADD COLUMN "ytd_return" integer;--> statement-breakpoint
ALTER TABLE "cie_scores" ADD COLUMN "d_sig" varchar(5);--> statement-breakpoint
ALTER TABLE "cie_scores" ADD COLUMN "w_sig" varchar(5);--> statement-breakpoint
ALTER TABLE "cie_scores" ADD COLUMN "m_sig" varchar(5);--> statement-breakpoint
ALTER TABLE "cie_scores" ADD COLUMN "y_sig" varchar(5);--> statement-breakpoint
ALTER TABLE "cie_scores" ADD COLUMN "stars" integer;--> statement-breakpoint
ALTER TABLE "cie_securities" ADD COLUMN "div_behaviour_pattern" varchar(30);--> statement-breakpoint
ALTER TABLE "cie_securities" ADD COLUMN "entry_zone_low_kobo" integer;--> statement-breakpoint
ALTER TABLE "cie_securities" ADD COLUMN "entry_zone_high_kobo" integer;--> statement-breakpoint
ALTER TABLE "cie_securities" ADD COLUMN "target_price_kobo" integer;--> statement-breakpoint
ALTER TABLE "company_people" ADD COLUMN "entity_type" varchar(20) DEFAULT 'individual';--> statement-breakpoint
ALTER TABLE "company_people" ADD COLUMN "corporate_name" varchar(255);--> statement-breakpoint
ALTER TABLE "company_people" ADD COLUMN "corporate_rc_number" varchar(50);--> statement-breakpoint
ALTER TABLE "company_people" ADD COLUMN "corporate_country" varchar(100);--> statement-breakpoint
ALTER TABLE "company_people" ADD COLUMN "corporate_authorised_rep_name" varchar(255);--> statement-breakpoint
ALTER TABLE "document_files" ADD COLUMN "share_with_bank" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "founder_profiles" ADD COLUMN "profile_populated_from_kyc" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "founder_profiles" ADD COLUMN "kyc_populated_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verification_requests" ADD COLUMN "last_screened_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "admin_fee_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_checklist_items" ADD COLUMN "share_with_bank" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_invite_token" varchar;--> statement-breakpoint
ALTER TABLE "kyc_rescreening_batch_items" ADD CONSTRAINT "kyc_rescreening_batch_items_batch_id_kyc_rescreening_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."kyc_rescreening_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cie_mctx_date" ON "cie_market_context" USING btree ("context_date");--> statement-breakpoint
CREATE INDEX "idx_kyc_rbi_batch" ON "kyc_rescreening_batch_items" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_rbi_vr" ON "kyc_rescreening_batch_items" USING btree ("verification_request_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_rbi_org" ON "kyc_rescreening_batch_items" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_rb_status" ON "kyc_rescreening_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kyc_rb_created" ON "kyc_rescreening_batches" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_kyc_vr_last_screened" ON "kyc_verification_requests" USING btree ("last_screened_at");