CREATE TABLE "add_director_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_request_id" integer NOT NULL,
	"founder_id" varchar NOT NULL,
	"company_rc_number" varchar(20),
	"company_name" varchar(255),
	"company_tin" varchar(20),
	"incorporation_date" varchar(20),
	"registered_address" text,
	"existing_directors" jsonb,
	"new_director_first_name" varchar(100),
	"new_director_last_name" varchar(100),
	"new_director_email" varchar(255),
	"new_director_phone" varchar(20),
	"new_director_nin" varchar(30),
	"new_director_date_of_birth" varchar(20),
	"new_director_nationality" varchar(100),
	"new_director_occupation" varchar(255),
	"new_director_address" text,
	"new_director_proposed_role" varchar(100),
	"new_director_shareholding" varchar(50),
	"additional_notes" text,
	"data_status" varchar(50) DEFAULT 'draft',
	"director_invite_token" varchar(128),
	"director_invited_at" timestamp,
	"director_verified_at" timestamp,
	"director_verification_status" varchar(50) DEFAULT 'not_invited',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "address_verification_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"founder_id" varchar NOT NULL,
	"youverify_candidate_id" varchar(100),
	"youverify_reference_id" varchar(100),
	"status" varchar(50) DEFAULT 'submitted',
	"verdict" varchar(30),
	"findings_json" jsonb,
	"admin_notes" text,
	"admin_reviewed_at" timestamp,
	"admin_reviewed_by" varchar,
	"submitted_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "application_ai_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"actor_user_id" varchar NOT NULL,
	"feature" varchar(50) NOT NULL,
	"model" varchar(100),
	"prompt_version" varchar(50),
	"input_hash" varchar(64),
	"output_json" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "application_checklist_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"key" varchar(100) NOT NULL,
	"label" varchar(255) NOT NULL,
	"required" boolean DEFAULT true,
	"status" varchar(50) DEFAULT 'missing',
	"reviewer_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" varchar,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100),
	"entity_id" varchar(100),
	"details" json,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_company_dispatches" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_profile_id" integer NOT NULL,
	"bank_partner_id" integer NOT NULL,
	"sent_by_user_id" varchar NOT NULL,
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_document_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_profile_id" integer NOT NULL,
	"bank_partner_id" integer NOT NULL,
	"requested_by_email" varchar(255) NOT NULL,
	"documents_requested" text NOT NULL,
	"reason" text,
	"status" varchar(50) DEFAULT 'open',
	"created_at" timestamp DEFAULT now(),
	"actioned_at" timestamp,
	"actioned_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "bank_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_email" varchar(255),
	"emails" json DEFAULT '[]'::json,
	"service_types" text[] DEFAULT ARRAY['escrow_custody']::text[] NOT NULL,
	"fee_rate_bps" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"notes" text,
	"activated_at" timestamp,
	"deactivated_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_portal_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"bank_partner_id" integer NOT NULL,
	"password_hash" varchar(500),
	"invite_token" varchar(255),
	"invite_token_expiry" timestamp,
	"reset_token" varchar(255),
	"reset_token_expiry" timestamp,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bank_portal_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "bid_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"bid_id" integer NOT NULL,
	"rfq_item_id" integer NOT NULL,
	"unit_price" integer DEFAULT 0 NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "bid_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"category_id" integer,
	"cover_letter_template" text,
	"terms_template" text,
	"default_items" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" serial PRIMARY KEY NOT NULL,
	"rfq_id" integer NOT NULL,
	"supplier_org_id" integer NOT NULL,
	"submitted_by_user_id" varchar NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"delivery_timeline" varchar(255),
	"valid_until" timestamp,
	"cover_letter" text,
	"terms" text,
	"attachments" jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"template_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cie_dividends" (
	"id" serial PRIMARY KEY NOT NULL,
	"security_id" integer NOT NULL,
	"ex_dividend_date" varchar(20) NOT NULL,
	"payment_date" varchar(20),
	"amount_per_share_kobo" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cie_ingestion_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"upload_id" varchar(36),
	"format" varchar(20) NOT NULL,
	"data_type" varchar(30) NOT NULL,
	"filename" varchar(255),
	"rows_extracted" integer DEFAULT 0,
	"rows_accepted" integer DEFAULT 0,
	"rows_rejected" integer DEFAULT 0,
	"rows_flagged" integer DEFAULT 0,
	"rows_analyst_approved" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'pending',
	"error_summary" text,
	"uploaded_by_user_id" varchar,
	"confirmed_by_user_id" varchar,
	"triggered_recomputation" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"previewed_at" timestamp,
	"committed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "cie_market_pulse" (
	"id" serial PRIMARY KEY NOT NULL,
	"asi_index" integer,
	"brent_crude_usd_cents" integer,
	"ngn_per_usd" integer,
	"asi_change" integer,
	"source" varchar(50) DEFAULT 'manual',
	"commentary" text,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cie_model_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"version_label" varchar(50) NOT NULL,
	"weights" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"notes" text,
	"submitted_by_user_id" varchar,
	"reviewed_by_user_id" varchar,
	"activated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cie_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_name" varchar(255) NOT NULL,
	"contact_name" varchar(255),
	"contact_email" varchar(255),
	"cellion_revenue_share_pct" integer DEFAULT 60 NOT NULL,
	"tier" varchar(20) DEFAULT 'subscriber' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cie_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"security_id" integer NOT NULL,
	"trade_date" varchar(20) NOT NULL,
	"open_kobo" integer,
	"high_kobo" integer,
	"low_kobo" integer,
	"close_kobo" integer NOT NULL,
	"volume" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cie_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"security_id" integer NOT NULL,
	"score_date" varchar(20) NOT NULL,
	"ias" integer,
	"rs" integer,
	"cs" integer,
	"recommendation" varchar(30),
	"pillar_breakdown" jsonb,
	"model_version_id" integer,
	"data_points_used" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cie_securities" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"sector" varchar(100) NOT NULL,
	"exchange" varchar(50) DEFAULT 'NGX',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "cie_securities_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "cie_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"security_id" integer,
	"type" varchar(30) NOT NULL,
	"sentiment" varchar(20),
	"credibility" integer,
	"content" text NOT NULL,
	"analyst_user_id" varchar,
	"tags" text[],
	"is_published" boolean DEFAULT false,
	"published_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cie_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"org_id" integer,
	"tier" varchar(20) DEFAULT 'free' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"paystack_subscription_code" varchar(100),
	"paystack_customer_code" varchar(100),
	"paystack_authorization_code" varchar(100),
	"paystack_plan_code" varchar(100),
	"paystack_email" varchar(255),
	"paystack_reference" varchar(255),
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancelled_at" timestamp,
	"cancel_at_period_end" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clarification_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"lawyer_user_id" varchar NOT NULL,
	"founder_user_id" varchar NOT NULL,
	"status" varchar(50) DEFAULT 'open',
	"subject" text,
	"message" text,
	"ai_draft_json" json,
	"sent_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"founder_user_id" varchar NOT NULL,
	"application_type" varchar(50) DEFAULT 'incorporation',
	"status" varchar(50) DEFAULT 'draft',
	"company_name_1" varchar(255),
	"company_name_2" varchar(255),
	"company_name_3" varchar(255),
	"business_description" text,
	"legal_ai_activity_suggestions" json,
	"selected_activities" json,
	"company_type" varchar(100) DEFAULT 'LTD',
	"registered_address" json,
	"operating_address" json,
	"directors_data" json,
	"shareholders_data" json,
	"assigned_lawyer_user_id" varchar,
	"submitted_at" timestamp,
	"completed_at" timestamp,
	"readiness_score" integer DEFAULT 0,
	"readiness_breakdown" json,
	"payment_state" varchar(50) DEFAULT 'unpaid',
	"payment_state_updated_at" timestamp,
	"address_verification_status" varchar(50) DEFAULT 'none',
	"ai_suggestion_version" varchar(50),
	"ai_last_suggested_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_people" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer,
	"company_profile_id" integer,
	"founder_id" varchar NOT NULL,
	"person_user_id" varchar,
	"invite_email" varchar(255),
	"invite_status" varchar(50) DEFAULT 'pending',
	"invite_token" varchar(255),
	"invite_sent_at" timestamp,
	"role" varchar(50) NOT NULL,
	"title" varchar(100),
	"shares_allocated" integer,
	"share_class" varchar(50),
	"share_percentage" varchar(20),
	"is_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer,
	"founder_id" varchar NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"rc_number" varchar(100),
	"company_type" varchar(100),
	"incorporation_date" timestamp,
	"is_existing_company" boolean DEFAULT false,
	"existing_company_status" varchar(30) DEFAULT 'draft',
	"registered_address" json,
	"operating_address" json,
	"directors" json,
	"shareholders" json,
	"business_activities" json,
	"share_capital" varchar(255),
	"tin_number" varchar(100),
	"smile_kyb_job_id" varchar(100),
	"smile_kyb_result" json,
	"smile_tin_job_id" varchar(100),
	"smile_tin_result" json,
	"verification_report" json,
	"existing_co_verify_order_id" integer,
	"profile_documents" json,
	"admin_review_notes" text,
	"admin_reviewed_by" varchar,
	"admin_reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_deadlines" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_profile_id" integer NOT NULL,
	"founder_id" varchar NOT NULL,
	"deadline_type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"due_date" timestamp NOT NULL,
	"penalty_info" text,
	"status" varchar(50) DEFAULT 'upcoming',
	"completed_at" timestamp,
	"is_recurring" boolean DEFAULT true,
	"recurrence_rule" varchar(100),
	"last_notified_at" timestamp,
	"notes" text,
	"notifications_sent" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consent_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"founder_user_id" varchar NOT NULL,
	"lawyer_user_id" varchar NOT NULL,
	"application_id" integer NOT NULL,
	"scope" varchar(100) NOT NULL,
	"granted_at" timestamp DEFAULT now(),
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "contract_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"amount" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"evidence" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"rfq_id" integer NOT NULL,
	"bid_id" integer NOT NULL,
	"buyer_org_id" integer NOT NULL,
	"supplier_org_id" integer NOT NULL,
	"contract_number" varchar(50) NOT NULL,
	"total_amount" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"status" varchar(20) DEFAULT 'awarded' NOT NULL,
	"terms" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"awarded_by_user_id" varchar NOT NULL,
	"awarded_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "courier_shipments" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"courier_name" varchar(255),
	"tracking_number" varchar(255),
	"ship_from" text,
	"ship_to" text,
	"status" varchar(50) DEFAULT 'not_started',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_sharing_access_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"consent_id" integer NOT NULL,
	"access_type" varchar(50) NOT NULL,
	"accessed_by" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"data_returned" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_sharing_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"founder_id" varchar NOT NULL,
	"application_id" integer,
	"kyc_verification_request_id" integer,
	"partner_name" varchar(255) NOT NULL,
	"partner_type" varchar(50) NOT NULL,
	"consent_token" varchar(128) NOT NULL,
	"consent_text" text NOT NULL,
	"data_scope" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "data_sharing_consents_consent_token_unique" UNIQUE("consent_token")
);
--> statement-breakpoint
CREATE TABLE "director_biometric_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(128) NOT NULL,
	"company_profile_id" integer NOT NULL,
	"director_index" integer NOT NULL,
	"director_name" varchar(255) NOT NULL,
	"director_email" varchar(255),
	"founder_user_id" varchar(255),
	"smile_job_id" varchar(255),
	"status" varchar(50) DEFAULT 'pending',
	"expires_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"result_code" varchar(20),
	"result_text" text,
	"raw_result" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "director_biometric_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "document_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_user_id" varchar NOT NULL,
	"application_id" integer,
	"category" varchar(50) NOT NULL,
	"doc_type" varchar(100) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"sha256_hash" varchar(64),
	"size_bytes" integer,
	"mime_type" varchar(100),
	"is_sensitive" boolean DEFAULT true,
	"quality_status" varchar(50) DEFAULT 'not_checked',
	"quality_report" json,
	"last_quality_checked_at" timestamp,
	"expiry_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "escrow_api_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"reference" varchar(40) NOT NULL,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"service_fee" integer,
	"bank_custody_fee" integer DEFAULT 0,
	"bank_partner_id" integer,
	"total_charged" integer,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"status" varchar(30) DEFAULT 'pending_payment' NOT NULL,
	"buyer_name" varchar(255) NOT NULL,
	"buyer_email" varchar(255) NOT NULL,
	"beneficiary_name" varchar(255) NOT NULL,
	"beneficiary_email" varchar(255) NOT NULL,
	"dva_id" varchar(100),
	"dva_account_number" varchar(20),
	"dva_bank_name" varchar(100),
	"dva_bank_code" varchar(20),
	"beneficiary_account_number" varchar(20),
	"beneficiary_bank_code" varchar(20),
	"beneficiary_account_name" varchar(255),
	"paystack_transfer_recipient_code" varchar(100),
	"paystack_transfer_reference" varchar(100),
	"paystack_reference" varchar(255),
	"paystack_payment_url" varchar(512),
	"release_conditions" text,
	"released_to" varchar(255),
	"dispute_reason" text,
	"disputed_at" timestamp,
	"funded_at" timestamp,
	"released_at" timestamp,
	"refunded_at" timestamp,
	"expires_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "escrow_api_transactions_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "escrow_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"milestone_id" integer,
	"amount" integer NOT NULL,
	"service_fee" integer,
	"bank_custody_fee" integer DEFAULT 0,
	"bank_partner_id" integer,
	"total_charged" integer,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"buyer_org_id" integer NOT NULL,
	"supplier_org_id" integer NOT NULL,
	"paystack_reference" varchar(255),
	"paystack_payment_url" varchar(512),
	"payment_reference" varchar(255),
	"funded_at" timestamp,
	"released_at" timestamp,
	"disputed_at" timestamp,
	"dispute_reason" text,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "execution_declarations" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"lawyer_id" varchar NOT NULL,
	"submission_type" varchar(50) NOT NULL,
	"submission_location" text,
	"submitted_at" timestamp NOT NULL,
	"declaration_accepted" boolean DEFAULT false,
	"declaration_text_version" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"is_enabled" boolean DEFAULT false,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "founder_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"full_name" varchar(255),
	"phone" varchar(50),
	"date_of_birth" varchar,
	"nationality" varchar(100),
	"gender" varchar(20),
	"occupation" varchar(255),
	"address_line_1" varchar(255),
	"address_line_2" varchar(255),
	"city" varchar(100),
	"state" varchar(100),
	"postal_code" varchar(20),
	"country" varchar(100) DEFAULT 'Nigeria',
	"nin_encrypted" varchar(500),
	"bvn_encrypted" varchar(500),
	"id_type" varchar(50),
	"id_number" varchar(100),
	"id_document_path" varchar(500),
	"passport_photo_path" varchar(500),
	"signature_path" varchar(500),
	"profile_completion" integer DEFAULT 0,
	"is_profile_complete" boolean DEFAULT false,
	"kyb_prefilled" boolean DEFAULT false,
	"kyb_source_company_profile_id" integer,
	"locked_fields" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "founder_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "identity_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"founder_user_id" varchar NOT NULL,
	"status" varchar(50) DEFAULT 'not_started',
	"method" varchar(50) DEFAULT 'manual',
	"external_provider" varchar(100),
	"external_session_id" varchar(255),
	"selfie_file_id" integer,
	"selfie_url" varchar(500),
	"id_doc_file_id" integer,
	"liveness_score" integer,
	"notes" text,
	"identity_source" varchar(50),
	"bvn_nin_verified" boolean DEFAULT false,
	"smile_job_id" varchar(255),
	"verified_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyb_lookups" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"reference" varchar(128) NOT NULL,
	"rc_number" varchar(50) NOT NULL,
	"business_type" varchar(50) DEFAULT 'co',
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"company_name" varchar(255),
	"registration_date" varchar(20),
	"company_status" varchar(100),
	"company_type" varchar(100),
	"address" text,
	"share_capital" varchar(100),
	"tin_number" varchar(50),
	"directors" json,
	"raw_result" json,
	"credit_deducted" boolean DEFAULT false,
	"error_message" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kyb_lookups_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "kyc_api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"organisation_id" integer,
	"user_id" varchar(255),
	"cie_partner_id" integer,
	"key_prefix" varchar(16) NOT NULL,
	"key_hash" varchar(128) NOT NULL,
	"name" varchar(255) NOT NULL,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_api_usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"api_key_id" integer NOT NULL,
	"endpoint" varchar(500) NOT NULL,
	"method" varchar(10) NOT NULL,
	"status_code" integer NOT NULL,
	"ip_address" varchar(45),
	"request_id" varchar(64) NOT NULL,
	"response_time_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_billing_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"organisation_id" integer NOT NULL,
	"billing_mode" varchar(20) DEFAULT 'prepaid' NOT NULL,
	"credit_balance" integer DEFAULT 0 NOT NULL,
	"invoice_email" varchar(255),
	"invoice_company_name" varchar(255),
	"invoice_address" text,
	"payment_terms_days" integer DEFAULT 30,
	"credit_limit" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"approved_at" timestamp,
	"approved_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kyc_billing_accounts_organisation_id_unique" UNIQUE("organisation_id")
);
--> statement-breakpoint
CREATE TABLE "kyc_billing_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"organisation_id" integer NOT NULL,
	"requested_by" varchar NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"company_email" varchar(255) NOT NULL,
	"estimated_monthly_volume" varchar(100),
	"message" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"billing_account_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"verification_type" varchar(20),
	"amount" integer NOT NULL,
	"balance" integer NOT NULL,
	"description" varchar(500) NOT NULL,
	"verification_request_id" integer,
	"paystack_reference" varchar(128),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_document_requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer,
	"type" varchar(20) NOT NULL,
	"document_name" varchar(255) NOT NULL,
	"document_description" text,
	"document_category" varchar(30) NOT NULL,
	"is_standard" boolean DEFAULT false NOT NULL,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"has_expiry" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"billing_account_id" integer NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"due_date" timestamp,
	"paid_at" timestamp,
	"paystack_reference" varchar(128),
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "kyc_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "kyc_org_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"user_id" varchar,
	"role" varchar(30) NOT NULL,
	"invite_email" varchar(255) NOT NULL,
	"invite_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"invite_token" varchar(128),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_organisations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"client_type" varchar(20) DEFAULT 'organisation' NOT NULL,
	"category" varchar(50) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"contact_phone" varchar(50),
	"address" text,
	"logo_path" varchar(500),
	"created_by_user_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'pending_review' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"employee_portal_enabled" boolean DEFAULT true,
	"supplier_portal_enabled" boolean DEFAULT true,
	"terms_accepted_at" timestamp,
	"terms_version" varchar(20),
	"terms_accepted_by_user_id" varchar,
	"terms_accepted_ip" varchar(45),
	"integration_profile" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kyc_organisations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "chk_kyc_org_client_type" CHECK ("kyc_organisations"."client_type" IN ('organisation', 'application'))
);
--> statement-breakpoint
CREATE TABLE "kyc_sanctions_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"verification_request_id" integer NOT NULL,
	"org_id" integer NOT NULL,
	"subject_name" varchar(255) NOT NULL,
	"previous_risk_score" varchar(10),
	"new_risk_score" varchar(10),
	"screening_result" varchar(30) NOT NULL,
	"match_details" jsonb,
	"alert_sent_at" timestamp,
	"review_status" varchar(20) DEFAULT 'open',
	"review_note" text,
	"reviewed_by_user_id" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"session_token" varchar(128) NOT NULL,
	"type" varchar(20) NOT NULL,
	"subject_email" varchar(255) NOT NULL,
	"subject_name" varchar(255) NOT NULL,
	"return_url" varchar(1000),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"verification_request_id" integer,
	"metadata" jsonb,
	"prefill_data" jsonb,
	"required_steps" text[],
	"expires_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kyc_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "kyc_str_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"verification_request_id" integer,
	"subject_name" varchar(255) NOT NULL,
	"subject_certificate_ref" varchar(50),
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"suspicious_activity_description" text NOT NULL,
	"transaction_amount_kobo" integer,
	"activity_date_from" varchar(20),
	"activity_date_to" varchar(20),
	"reporter_name" varchar(255) NOT NULL,
	"reporter_role" varchar(100) NOT NULL,
	"notes" text,
	"nfiu_reference" varchar(100),
	"created_by_user_id" integer NOT NULL,
	"reviewed_by_user_id" integer,
	"reviewed_at" timestamp,
	"filed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_submitted_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"verification_request_id" integer NOT NULL,
	"requirement_id" integer NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"status" varchar(20) DEFAULT 'uploaded' NOT NULL,
	"detected_document_type" varchar(100),
	"extracted_data" jsonb,
	"extraction_confirmed" boolean DEFAULT false,
	"expiry_date" timestamp,
	"review_note" text,
	"reviewed_by_user_id" varchar,
	"reviewed_at" timestamp,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_supplier_people" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_profile_id" integer NOT NULL,
	"verification_request_id" integer NOT NULL,
	"individual_request_id" integer,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"user_id" varchar,
	"requires_verification" boolean DEFAULT false NOT NULL,
	"verification_status" varchar(20) DEFAULT 'not_required' NOT NULL,
	"invite_token" varchar(128),
	"invite_sent_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_supplier_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"verification_request_id" integer NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"rc_number" varchar(50),
	"tin_number" varchar(50),
	"vat_registered" boolean DEFAULT false,
	"year_established" integer,
	"industry_category" varchar(100),
	"head_office_address" text,
	"website_url" varchar(500),
	"contact_person_name" varchar(255) NOT NULL,
	"contact_person_email" varchar(255) NOT NULL,
	"contact_person_phone" varchar(50),
	"contact_person_role" varchar(100),
	"bank_name" varchar(255),
	"bank_account_number" varchar(50),
	"bank_account_name" varchar(255),
	"extracted_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kyc_supplier_profiles_verification_request_id_unique" UNIQUE("verification_request_id")
);
--> statement-breakpoint
CREATE TABLE "kyc_verification_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"template_id" integer,
	"requested_by_user_id" varchar,
	"type" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'pending_invite' NOT NULL,
	"subject_email" varchar(255) NOT NULL,
	"subject_name" varchar(255) NOT NULL,
	"subject_user_id" varchar,
	"notes" text,
	"reviewed_by_user_id" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"risk_score" varchar(10),
	"payment_responsibility" varchar(20) DEFAULT 'organisation' NOT NULL,
	"payment_status" varchar(20) DEFAULT 'not_required' NOT NULL,
	"payment_reference" varchar(128),
	"invite_token" varchar(128) NOT NULL,
	"self_registered" boolean DEFAULT false,
	"terms_accepted_at" timestamp,
	"terms_version" varchar(20),
	"terms_accepted_ip" varchar(45),
	"expires_at" timestamp NOT NULL,
	"certificate_ref" varchar(40),
	"verified_data_snapshot" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kyc_verification_requests_invite_token_unique" UNIQUE("invite_token"),
	CONSTRAINT "kyc_verification_requests_certificate_ref_unique" UNIQUE("certificate_ref")
);
--> statement-breakpoint
CREATE TABLE "kyc_verification_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(20) NOT NULL,
	"description" text,
	"require_director_verification" boolean DEFAULT false,
	"document_requirement_ids" jsonb DEFAULT '[]'::jsonb,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_verified_identity_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"verification_request_id" integer NOT NULL,
	"org_id" integer NOT NULL,
	"full_name" varchar(255),
	"date_of_birth" varchar(20),
	"phone" varchar(30),
	"gender" varchar(20),
	"address" text,
	"id_types_verified" jsonb,
	"data_source" varchar(50) DEFAULT 'document_review' NOT NULL,
	"government_photo_path" varchar(500),
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_webhook_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"organisation_id" integer NOT NULL,
	"url" varchar(1000) NOT NULL,
	"secret" varchar(128) NOT NULL,
	"events" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_webhook_delivery_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"webhook_config_id" integer NOT NULL,
	"event" varchar(100) NOT NULL,
	"verification_request_id" integer,
	"payload" jsonb NOT NULL,
	"response_status" integer,
	"response_body" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lawyer_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"bar_id" varchar(100) NOT NULL,
	"scn_number" varchar(100),
	"firm_name" varchar(255),
	"firm_address" text,
	"years_of_experience" integer,
	"specializations" json DEFAULT '[]'::json,
	"service_regions" json DEFAULT '[]'::json,
	"statement_of_interest" text,
	"status" varchar(50) DEFAULT 'pending',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lawyer_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"firm_name" varchar(255),
	"bar_id" varchar(100),
	"payout_subaccount_id" varchar(100),
	"service_regions" json DEFAULT '[]'::json,
	"active_case_capacity" integer DEFAULT 10,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "lawyer_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "legal_chat_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legal_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"lockout_until" timestamp,
	"last_attempt" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_approval_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"mail_item_id" integer NOT NULL,
	"founder_id" varchar NOT NULL,
	"requested_action" varchar(50) NOT NULL,
	"decision" varchar(50),
	"decision_reason" text,
	"requested_at" timestamp DEFAULT now(),
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mail_handling_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"founder_id" varchar NOT NULL,
	"preference_type" varchar(50) NOT NULL,
	"is_sensitive_auto_escalation_enabled" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mail_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"founder_id" varchar NOT NULL,
	"sender_name" varchar(255),
	"sender_type" varchar(100),
	"envelope_photo_doc_id" integer,
	"scanned_doc_id" integer,
	"status" varchar(50) DEFAULT 'received',
	"is_sensitive" boolean DEFAULT false,
	"is_overage" boolean DEFAULT false,
	"overage_reason" text,
	"received_at" timestamp DEFAULT now(),
	"scanned_at" timestamp,
	"forwarded_at" timestamp,
	"courier_name" varchar(100),
	"tracking_number" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"compliance_reminders" boolean DEFAULT true,
	"service_request_updates" boolean DEFAULT true,
	"order_updates" boolean DEFAULT true,
	"incorporation_updates" boolean DEFAULT true,
	"marketing_emails" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"type" varchar(50) DEFAULT 'info',
	"is_read" boolean DEFAULT false,
	"link_url" varchar(500),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "offline_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"founder_user_id" varchar NOT NULL,
	"application_id" integer,
	"client_draft_id" varchar(100) NOT NULL,
	"draft_json" json,
	"last_synced_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"sku" varchar(50) NOT NULL,
	"quantity" integer DEFAULT 1,
	"unit_price" integer NOT NULL,
	"cellion_cut" integer DEFAULT 0 NOT NULL,
	"lawyer_net" integer DEFAULT 0 NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"provider" varchar(50) DEFAULT 'paystack',
	"status" varchar(50) DEFAULT 'initiated',
	"amount" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN',
	"paystack_reference" varchar(255),
	"authorization_url" text,
	"paid_at" timestamp,
	"raw_event" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "order_payments_paystack_reference_unique" UNIQUE("paystack_reference")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"founder_id" varchar NOT NULL,
	"application_id" integer,
	"status" varchar(50) DEFAULT 'draft',
	"currency" varchar(10) DEFAULT 'NGN',
	"total_amount" integer NOT NULL,
	"total_cellion_cut" integer DEFAULT 0 NOT NULL,
	"total_lawyer_net" integer DEFAULT 0 NOT NULL,
	"fulfilment_status" varchar(50) DEFAULT 'pending',
	"assigned_lawyer_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"provider" varchar(50) DEFAULT 'paystack',
	"amount_total_kobo" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN',
	"breakdown_json" json,
	"status" varchar(50) DEFAULT 'initialized',
	"state" varchar(50) DEFAULT 'unpaid',
	"paystack_reference" varchar(255),
	"paid_at" timestamp,
	"escrowed_at" timestamp,
	"released_at" timestamp,
	"refunded_at" timestamp,
	"refund_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payout_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"lawyer_user_id" varchar NOT NULL,
	"amount_kobo" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"provider_ref" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "paystack_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"reference" varchar(255) NOT NULL,
	"access_code" varchar(255),
	"paystack_transaction_id" varchar(255),
	"status" varchar(50) DEFAULT 'pending',
	"currency" varchar(10) DEFAULT 'NGN',
	"amount_total" integer,
	"line_items" json,
	"context_json" json,
	"gateway_response" varchar(255),
	"channel" varchar(50),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "paystack_transactions_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "post_incorporation_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_profile_id" integer NOT NULL,
	"founder_id" varchar NOT NULL,
	"task_key" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"guidance" text,
	"status" varchar(50) DEFAULT 'not_started',
	"completed_at" timestamp,
	"notes" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "procurement_invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer DEFAULT 0 NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"unit" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "procurement_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"contract_id" integer NOT NULL,
	"milestone_id" integer,
	"supplier_org_id" integer NOT NULL,
	"buyer_org_id" integer NOT NULL,
	"issued_by_user_id" varchar NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"payment_terms" varchar(100),
	"bank_details" text,
	"notes" text,
	"tax_label" varchar(50) DEFAULT 'VAT' NOT NULL,
	"due_date" timestamp,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "procurement_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "product_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(100) NOT NULL,
	"price_ngn" integer NOT NULL,
	"cellion_cut_ngn" integer,
	"is_active" boolean DEFAULT true,
	"requires_manual_pricing" boolean DEFAULT false,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "product_catalog_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "profile_checklist_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_profile_id" integer NOT NULL,
	"key" varchar(100) NOT NULL,
	"label" varchar(255) NOT NULL,
	"required" boolean DEFAULT true,
	"status" varchar(50) DEFAULT 'missing',
	"file_path" varchar(500),
	"uploaded_at" timestamp,
	"reviewer_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "registered_office_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"founder_id" varchar NOT NULL,
	"application_id" integer,
	"tier" varchar(50) NOT NULL,
	"service_address_id" integer NOT NULL,
	"status" varchar(50) DEFAULT 'selected',
	"start_date" timestamp,
	"end_date" timestamp,
	"payment_id" integer,
	"use_as_registered_address" boolean DEFAULT false,
	"registered_address_confirmed_at" timestamp,
	"registered_address_consent_text" text,
	"proof_of_address_path" text,
	"proof_of_address_uploaded_at" timestamp,
	"proof_of_address_status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rfq_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"parent_id" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "rfq_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rfq_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"rfq_id" integer NOT NULL,
	"supplier_org_id" integer NOT NULL,
	"invited_at" timestamp DEFAULT now(),
	"status" varchar(20) DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfq_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"rfq_id" integer NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit" varchar(50) DEFAULT 'units' NOT NULL,
	"specifications" text
);
--> statement-breakpoint
CREATE TABLE "rfqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"buyer_org_id" integer NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"category_id" integer,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"budget_min" integer,
	"budget_max" integer,
	"deadline" timestamp NOT NULL,
	"delivery_deadline" timestamp,
	"visibility" varchar(20) DEFAULT 'open' NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"requirements" text,
	"qualifications" text,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"ip_address" varchar(100),
	"user_id" varchar,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensitive_data_access_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"accessor_user_id" varchar NOT NULL,
	"target_user_id" varchar NOT NULL,
	"data_type" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"entity_type" varchar(100),
	"entity_id" varchar(100),
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"line_1" varchar(255) NOT NULL,
	"line_2" varchar(255),
	"floor_details" varchar(255),
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"country" varchar(100) DEFAULT 'Nigeria',
	"is_active" boolean DEFAULT true,
	"manager_user_id" varchar,
	"contact_phone" varchar(50),
	"contact_email" varchar(255),
	"operating_hours" varchar(255),
	"utility_bill_path" text,
	"utility_bill_uploaded_at" timestamp,
	"utility_bill_expires_at" timestamp,
	"utility_bill_status" varchar(20),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_request_company_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"founder_id" varchar NOT NULL,
	"category" varchar(100) NOT NULL,
	"cac_registration_type" varchar(50) NOT NULL,
	"sector" varchar(255),
	"main_business_objectives" text,
	"incorporation_number" varchar(100) NOT NULL,
	"registered_name" varchar(500) NOT NULL,
	"date_incorporated" varchar(20),
	"tin_number" varchar(50),
	"head_office_address" text,
	"state" varchar(100),
	"bank_name" varchar(255),
	"account_number" varchar(20),
	"account_name" varchar(255),
	"organization_phone" varchar(30),
	"organization_email" varchar(255),
	"contact_person_name" varchar(255),
	"contact_person_nin" varchar(20),
	"contact_person_address" text,
	"contact_person_email" varchar(255),
	"contact_person_mobile" varchar(30),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_request_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"founder_id" varchar NOT NULL,
	"service_request_id" integer,
	"company_profile_id" integer,
	"doc_type" varchar(100) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"size_bytes" integer,
	"mime_type" varchar(100),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"founder_id" varchar NOT NULL,
	"order_id" integer,
	"order_item_id" integer,
	"service_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'queued',
	"assigned_lawyer_id" varchar,
	"company_profile_id" integer,
	"notes" text,
	"lawyer_notes" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_login_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"ip_address" varchar(100),
	"user_agent" text,
	"login_at" timestamp DEFAULT now() NOT NULL,
	"is_new_ip" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "verification_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"founder_id" varchar NOT NULL,
	"issued_by" varchar(50) NOT NULL,
	"scope" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'issued',
	"receipt_number" varchar(50) NOT NULL,
	"receipt_json" json,
	"verification_hash" varchar(64) NOT NULL,
	"issued_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"revocation_reason" text,
	CONSTRAINT "verification_receipts_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "verified_entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"bvn_hash" varchar(128),
	"nin_hash" varchar(128),
	"rc_number" varchar(50),
	"tin_number" varchar(50),
	"country" varchar(10) DEFAULT 'NG' NOT NULL,
	"verification_count" integer DEFAULT 1 NOT NULL,
	"last_verified_at" timestamp NOT NULL,
	"last_verified_by_org_id" integer,
	"last_verification_request_id" integer,
	"risk_score" varchar(10),
	"aml_screening_status" varchar(20),
	"first_verified_at" timestamp NOT NULL,
	"date_of_birth" varchar(20),
	"government_photo_path" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"password_hash" varchar,
	"email_verified" boolean DEFAULT false,
	"is_identity_verified" boolean DEFAULT false,
	"identity_verified_at" timestamp,
	"verification_token" varchar,
	"verification_token_expiry" timestamp,
	"reset_token" varchar,
	"reset_token_expiry" timestamp,
	"two_factor_enabled" boolean DEFAULT false,
	"two_factor_method" varchar(20),
	"two_factor_phone" varchar(50),
	"two_factor_secret" varchar(255),
	"two_factor_backup_codes" varchar(1000),
	"last_two_factor_at" timestamp,
	"primary_intent" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bank_company_dispatches" ADD CONSTRAINT "bank_company_dispatches_bank_partner_id_bank_partners_id_fk" FOREIGN KEY ("bank_partner_id") REFERENCES "public"."bank_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_document_requests" ADD CONSTRAINT "bank_document_requests_bank_partner_id_bank_partners_id_fk" FOREIGN KEY ("bank_partner_id") REFERENCES "public"."bank_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_portal_users" ADD CONSTRAINT "bank_portal_users_bank_partner_id_bank_partners_id_fk" FOREIGN KEY ("bank_partner_id") REFERENCES "public"."bank_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cie_dividends" ADD CONSTRAINT "cie_dividends_security_id_cie_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."cie_securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cie_prices" ADD CONSTRAINT "cie_prices_security_id_cie_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."cie_securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cie_scores" ADD CONSTRAINT "cie_scores_security_id_cie_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."cie_securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cie_scores" ADD CONSTRAINT "cie_scores_model_version_id_cie_model_versions_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "public"."cie_model_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cie_signals" ADD CONSTRAINT "cie_signals_security_id_cie_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."cie_securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cie_subscriptions" ADD CONSTRAINT "cie_subscriptions_org_id_kyc_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."kyc_organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_api_transactions" ADD CONSTRAINT "escrow_api_transactions_bank_partner_id_bank_partners_id_fk" FOREIGN KEY ("bank_partner_id") REFERENCES "public"."bank_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_bank_partner_id_bank_partners_id_fk" FOREIGN KEY ("bank_partner_id") REFERENCES "public"."bank_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_api_keys" ADD CONSTRAINT "kyc_api_keys_cie_partner_id_cie_partners_id_fk" FOREIGN KEY ("cie_partner_id") REFERENCES "public"."cie_partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_str_reports" ADD CONSTRAINT "kyc_str_reports_org_id_kyc_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."kyc_organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_str_reports" ADD CONSTRAINT "kyc_str_reports_verification_request_id_kyc_verification_requests_id_fk" FOREIGN KEY ("verification_request_id") REFERENCES "public"."kyc_verification_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verified_identity_data" ADD CONSTRAINT "kyc_verified_identity_data_verification_request_id_kyc_verification_requests_id_fk" FOREIGN KEY ("verification_request_id") REFERENCES "public"."kyc_verification_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verified_identity_data" ADD CONSTRAINT "kyc_verified_identity_data_org_id_kyc_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."kyc_organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_add_director_sr" ON "add_director_requests" USING btree ("service_request_id");--> statement-breakpoint
CREATE INDEX "idx_add_director_founder" ON "add_director_requests" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_add_director_invite_token" ON "add_director_requests" USING btree ("director_invite_token");--> statement-breakpoint
CREATE INDEX "idx_addr_verify_jobs_app" ON "address_verification_jobs" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_addr_verify_jobs_founder" ON "address_verification_jobs" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_addr_verify_jobs_ref" ON "address_verification_jobs" USING btree ("youverify_reference_id");--> statement-breakpoint
CREATE INDEX "idx_addr_verify_jobs_status" ON "address_verification_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_events_application" ON "application_ai_events" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_ai_events_actor" ON "application_ai_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_events_feature" ON "application_ai_events" USING btree ("feature");--> statement-breakpoint
CREATE INDEX "idx_audit_actor" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_bank_dispatches_company" ON "bank_company_dispatches" USING btree ("company_profile_id");--> statement-breakpoint
CREATE INDEX "idx_bank_dispatches_bank" ON "bank_company_dispatches" USING btree ("bank_partner_id");--> statement-breakpoint
CREATE INDEX "idx_bank_doc_requests_company" ON "bank_document_requests" USING btree ("company_profile_id");--> statement-breakpoint
CREATE INDEX "idx_bank_doc_requests_bank" ON "bank_document_requests" USING btree ("bank_partner_id");--> statement-breakpoint
CREATE INDEX "idx_bank_doc_requests_status" ON "bank_document_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bank_portal_users_email" ON "bank_portal_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_bank_portal_users_bank" ON "bank_portal_users" USING btree ("bank_partner_id");--> statement-breakpoint
CREATE INDEX "idx_bank_portal_users_invite_token" ON "bank_portal_users" USING btree ("invite_token");--> statement-breakpoint
CREATE INDEX "idx_bank_portal_users_reset_token" ON "bank_portal_users" USING btree ("reset_token");--> statement-breakpoint
CREATE INDEX "idx_bids_rfq" ON "bids" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX "idx_bids_supplier_org" ON "bids" USING btree ("supplier_org_id");--> statement-breakpoint
CREATE INDEX "idx_bids_status" ON "bids" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cie_div_sec" ON "cie_dividends" USING btree ("security_id");--> statement-breakpoint
CREATE INDEX "idx_cie_div_exdate" ON "cie_dividends" USING btree ("ex_dividend_date");--> statement-breakpoint
CREATE INDEX "idx_cie_ingest_type" ON "cie_ingestion_logs" USING btree ("data_type");--> statement-breakpoint
CREATE INDEX "idx_cie_ingest_status" ON "cie_ingestion_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cie_ingest_created" ON "cie_ingestion_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_cie_mv_status" ON "cie_model_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cie_partners_status" ON "cie_partners" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cie_prices_sec_date" ON "cie_prices" USING btree ("security_id","trade_date");--> statement-breakpoint
CREATE INDEX "idx_cie_prices_date" ON "cie_prices" USING btree ("trade_date");--> statement-breakpoint
CREATE UNIQUE INDEX "cie_prices_sec_date_unique" ON "cie_prices" USING btree ("security_id","trade_date");--> statement-breakpoint
CREATE INDEX "idx_cie_scores_sec_date" ON "cie_scores" USING btree ("security_id","score_date");--> statement-breakpoint
CREATE INDEX "idx_cie_scores_date" ON "cie_scores" USING btree ("score_date");--> statement-breakpoint
CREATE UNIQUE INDEX "cie_scores_sec_date_unique" ON "cie_scores" USING btree ("security_id","score_date");--> statement-breakpoint
CREATE INDEX "idx_cie_sec_symbol" ON "cie_securities" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_cie_sec_sector" ON "cie_securities" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "idx_cie_sec_active" ON "cie_securities" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_cie_sig_sec" ON "cie_signals" USING btree ("security_id");--> statement-breakpoint
CREATE INDEX "idx_cie_sig_type" ON "cie_signals" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_cie_sig_published" ON "cie_signals" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "idx_cie_sub_user" ON "cie_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cie_sub_org" ON "cie_subscriptions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_cie_sub_status" ON "cie_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_applications_founder" ON "company_applications" USING btree ("founder_user_id");--> statement-breakpoint
CREATE INDEX "idx_applications_lawyer" ON "company_applications" USING btree ("assigned_lawyer_user_id");--> statement-breakpoint
CREATE INDEX "idx_applications_status" ON "company_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_company_people_application" ON "company_people" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_company_people_company_profile" ON "company_people" USING btree ("company_profile_id");--> statement-breakpoint
CREATE INDEX "idx_company_people_founder" ON "company_people" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_company_people_person" ON "company_people" USING btree ("person_user_id");--> statement-breakpoint
CREATE INDEX "idx_company_people_invite_email" ON "company_people" USING btree ("invite_email");--> statement-breakpoint
CREATE INDEX "idx_company_profiles_founder" ON "company_profiles" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_company_profiles_application" ON "company_profiles" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_deadlines_company" ON "compliance_deadlines" USING btree ("company_profile_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_deadlines_founder" ON "compliance_deadlines" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_deadlines_due" ON "compliance_deadlines" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_compliance_deadlines_status" ON "compliance_deadlines" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_milestones_contract" ON "contract_milestones" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_contracts_buyer_org" ON "contracts" USING btree ("buyer_org_id");--> statement-breakpoint
CREATE INDEX "idx_contracts_supplier_org" ON "contracts" USING btree ("supplier_org_id");--> statement-breakpoint
CREATE INDEX "idx_contracts_status" ON "contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_dsal_consent" ON "data_sharing_access_logs" USING btree ("consent_id");--> statement-breakpoint
CREATE INDEX "idx_dsc_founder" ON "data_sharing_consents" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_dsc_token" ON "data_sharing_consents" USING btree ("consent_token");--> statement-breakpoint
CREATE INDEX "idx_dsc_status" ON "data_sharing_consents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_dir_biometric_token" ON "director_biometric_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_dir_biometric_profile" ON "director_biometric_invites" USING btree ("company_profile_id");--> statement-breakpoint
CREATE INDEX "idx_documents_owner" ON "document_files" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_documents_application" ON "document_files" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_escrow_api_org" ON "escrow_api_transactions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_escrow_api_ref" ON "escrow_api_transactions" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "idx_escrow_api_status" ON "escrow_api_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_escrow_api_dva" ON "escrow_api_transactions" USING btree ("dva_account_number");--> statement-breakpoint
CREATE INDEX "idx_escrow_api_transfer_ref" ON "escrow_api_transactions" USING btree ("paystack_transfer_reference");--> statement-breakpoint
CREATE INDEX "idx_escrow_contract" ON "escrow_transactions" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_execution_application" ON "execution_declarations" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_execution_lawyer" ON "execution_declarations" USING btree ("lawyer_id");--> statement-breakpoint
CREATE INDEX "idx_kyb_lookups_org" ON "kyb_lookups" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_kyb_lookups_reference" ON "kyb_lookups" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "idx_kyb_lookups_status" ON "kyb_lookups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kyc_ak_org" ON "kyc_api_keys" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_ak_hash" ON "kyc_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_kyc_ak_partner" ON "kyc_api_keys" USING btree ("cie_partner_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_aul_key" ON "kyc_api_usage_logs" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_aul_created" ON "kyc_api_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_kyc_ba_org" ON "kyc_billing_accounts" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_br_org" ON "kyc_billing_requests" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_br_status" ON "kyc_billing_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kyc_ct_ba" ON "kyc_credit_transactions" USING btree ("billing_account_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_ct_type" ON "kyc_credit_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_kyc_ct_created" ON "kyc_credit_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_kyc_dr_org" ON "kyc_document_requirements" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_dr_type" ON "kyc_document_requirements" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_kyc_inv_ba" ON "kyc_invoices" USING btree ("billing_account_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_inv_status" ON "kyc_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kyc_om_org" ON "kyc_org_members" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_om_user" ON "kyc_org_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_org_slug" ON "kyc_organisations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_kyc_org_status" ON "kyc_organisations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kyc_sl_vr" ON "kyc_sanctions_logs" USING btree ("verification_request_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_sl_org" ON "kyc_sanctions_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_sl_created" ON "kyc_sanctions_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_kyc_sl_review_status" ON "kyc_sanctions_logs" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "idx_kyc_sess_org" ON "kyc_sessions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_sess_token" ON "kyc_sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "idx_kyc_sess_status" ON "kyc_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kyc_str_org" ON "kyc_str_reports" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_str_status" ON "kyc_str_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kyc_str_vr" ON "kyc_str_reports" USING btree ("verification_request_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_str_created" ON "kyc_str_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_kyc_sd_vr" ON "kyc_submitted_documents" USING btree ("verification_request_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_sd_req" ON "kyc_submitted_documents" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_spp_sp" ON "kyc_supplier_people" USING btree ("supplier_profile_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_spp_vr" ON "kyc_supplier_people" USING btree ("verification_request_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_sp_vr" ON "kyc_supplier_profiles" USING btree ("verification_request_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_vr_org" ON "kyc_verification_requests" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_vr_token" ON "kyc_verification_requests" USING btree ("invite_token");--> statement-breakpoint
CREATE INDEX "idx_kyc_vr_status" ON "kyc_verification_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kyc_vr_subject" ON "kyc_verification_requests" USING btree ("subject_user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_vr_cert_ref" ON "kyc_verification_requests" USING btree ("certificate_ref");--> statement-breakpoint
CREATE INDEX "idx_kyc_vt_org" ON "kyc_verification_templates" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kvid_request_unique" ON "kyc_verified_identity_data" USING btree ("verification_request_id");--> statement-breakpoint
CREATE INDEX "idx_kvid_org" ON "kyc_verified_identity_data" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_wc_org" ON "kyc_webhook_configs" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_wdl_config" ON "kyc_webhook_delivery_logs" USING btree ("webhook_config_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_wdl_event" ON "kyc_webhook_delivery_logs" USING btree ("event");--> statement-breakpoint
CREATE INDEX "idx_lawyer_applications_email" ON "lawyer_applications" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_lawyer_applications_status" ON "lawyer_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_legal_chat_user" ON "legal_chat_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_legal_chat_messages_conv" ON "legal_chat_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_identifier" ON "login_attempts" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_mail_approvals_mail_item" ON "mail_approval_requests" USING btree ("mail_item_id");--> statement-breakpoint
CREATE INDEX "idx_mail_approvals_founder" ON "mail_approval_requests" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_mail_prefs_subscription" ON "mail_handling_preferences" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_mail_prefs_founder" ON "mail_handling_preferences" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_mail_items_subscription" ON "mail_items" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_mail_items_founder" ON "mail_items" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_mail_items_status" ON "mail_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notification_prefs_user" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_order" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_product" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_order_payments_order" ON "order_payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_payments_reference" ON "order_payments" USING btree ("paystack_reference");--> statement-breakpoint
CREATE INDEX "idx_order_payments_status" ON "order_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_orders_founder" ON "orders" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_orders_application" ON "orders" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payments_application" ON "payments" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_paystack_transactions_user" ON "paystack_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_paystack_transactions_status" ON "paystack_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_paystack_transactions_reference" ON "paystack_transactions" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "idx_post_inc_tasks_company" ON "post_incorporation_tasks" USING btree ("company_profile_id");--> statement-breakpoint
CREATE INDEX "idx_post_inc_tasks_founder" ON "post_incorporation_tasks" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_proc_invoices_contract" ON "procurement_invoices" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_proc_invoices_supplier" ON "procurement_invoices" USING btree ("supplier_org_id");--> statement-breakpoint
CREATE INDEX "idx_proc_invoices_buyer" ON "procurement_invoices" USING btree ("buyer_org_id");--> statement-breakpoint
CREATE INDEX "idx_proc_invoices_status" ON "procurement_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_product_catalog_sku" ON "product_catalog" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_product_catalog_category" ON "product_catalog" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_profile_checklist_profile" ON "profile_checklist_items" USING btree ("company_profile_id");--> statement-breakpoint
CREATE INDEX "idx_ro_subscriptions_founder" ON "registered_office_subscriptions" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_ro_subscriptions_application" ON "registered_office_subscriptions" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_ro_subscriptions_status" ON "registered_office_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rfqs_buyer_org" ON "rfqs" USING btree ("buyer_org_id");--> statement-breakpoint
CREATE INDEX "idx_rfqs_status" ON "rfqs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rfqs_category" ON "rfqs" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_security_events_type" ON "security_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_security_events_severity" ON "security_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_security_events_created" ON "security_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sensitive_access_accessor" ON "sensitive_data_access_logs" USING btree ("accessor_user_id");--> statement-breakpoint
CREATE INDEX "idx_sensitive_access_target" ON "sensitive_data_access_logs" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "idx_sensitive_access_data_type" ON "sensitive_data_access_logs" USING btree ("data_type");--> statement-breakpoint
CREATE INDEX "idx_sr_company_profiles_founder" ON "service_request_company_profiles" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_sr_documents_founder" ON "service_request_documents" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_sr_documents_service_request" ON "service_request_documents" USING btree ("service_request_id");--> statement-breakpoint
CREATE INDEX "idx_sr_documents_company_profile" ON "service_request_documents" USING btree ("company_profile_id");--> statement-breakpoint
CREATE INDEX "idx_sr_documents_doc_type" ON "service_request_documents" USING btree ("doc_type");--> statement-breakpoint
CREATE INDEX "idx_service_requests_founder" ON "service_requests" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_service_requests_order" ON "service_requests" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_service_requests_status" ON "service_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_service_requests_type" ON "service_requests" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "idx_login_history_user" ON "user_login_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_login_history_ip" ON "user_login_history" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "idx_user_roles_user_id" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_receipts_application" ON "verification_receipts" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_receipts_founder" ON "verification_receipts" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_ve_bvn_hash" ON "verified_entities" USING btree ("bvn_hash");--> statement-breakpoint
CREATE INDEX "idx_ve_nin_hash" ON "verified_entities" USING btree ("nin_hash");--> statement-breakpoint
CREATE INDEX "idx_ve_rc_number" ON "verified_entities" USING btree ("rc_number");--> statement-breakpoint
CREATE INDEX "idx_ve_email" ON "verified_entities" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_ve_entity_type" ON "verified_entities" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "idx_ve_country" ON "verified_entities" USING btree ("country");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");