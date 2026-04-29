CREATE TABLE "director_upload_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(128) NOT NULL,
	"application_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"director_name" varchar(255),
	"director_email" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "director_upload_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "application_checklist_items" ADD COLUMN "source" varchar(50);--> statement-breakpoint
CREATE INDEX "idx_director_upload_tokens_token" ON "director_upload_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_director_upload_tokens_application" ON "director_upload_tokens" USING btree ("application_id");