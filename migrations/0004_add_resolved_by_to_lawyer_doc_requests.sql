-- Add resolved_by_user_id to lawyer_document_requests
-- Records which lawyer manually marked a request as resolved/fulfilled
ALTER TABLE "lawyer_document_requests" ADD COLUMN IF NOT EXISTS "resolved_by_user_id" varchar(255);
