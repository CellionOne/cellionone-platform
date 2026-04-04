import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, json, jsonb, serial, index, uniqueIndex, check, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// ============== FOUNDER PROFILE (personal profile for any user) ==============
export const founderProfiles = pgTable("founder_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  fullName: varchar("full_name", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  dateOfBirth: varchar("date_of_birth"),
  nationality: varchar("nationality", { length: 100 }),
  gender: varchar("gender", { length: 20 }),
  occupation: varchar("occupation", { length: 255 }),
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }).default("Nigeria"),
  ninEncrypted: varchar("nin_encrypted", { length: 500 }),
  bvnEncrypted: varchar("bvn_encrypted", { length: 500 }),
  idType: varchar("id_type", { length: 50 }),
  idNumber: varchar("id_number", { length: 100 }),
  idDocumentPath: varchar("id_document_path", { length: 500 }),
  passportPhotoPath: varchar("passport_photo_path", { length: 500 }),
  signaturePath: varchar("signature_path", { length: 500 }),
  profileCompletion: integer("profile_completion").default(0),
  isProfileComplete: boolean("is_profile_complete").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFounderProfileSchema = createInsertSchema(founderProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type FounderProfile = typeof founderProfiles.$inferSelect;
export type InsertFounderProfile = z.infer<typeof insertFounderProfileSchema>;

// ============== COMPANY PEOPLE (directors/shareholders linked to applications) ==============
export const companyPeople = pgTable("company_people", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id"),
  companyProfileId: integer("company_profile_id"),
  founderId: varchar("founder_id").notNull(),
  personUserId: varchar("person_user_id"),
  inviteEmail: varchar("invite_email", { length: 255 }),
  inviteStatus: varchar("invite_status", { length: 50 }).default("pending"),
  inviteToken: varchar("invite_token", { length: 255 }),
  inviteSentAt: timestamp("invite_sent_at"),
  role: varchar("role", { length: 50 }).notNull(),
  title: varchar("title", { length: 100 }),
  sharesAllocated: integer("shares_allocated"),
  shareClass: varchar("share_class", { length: 50 }),
  sharePercentage: varchar("share_percentage", { length: 20 }),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_company_people_application").on(table.applicationId),
  index("idx_company_people_company_profile").on(table.companyProfileId),
  index("idx_company_people_founder").on(table.founderId),
  index("idx_company_people_person").on(table.personUserId),
  index("idx_company_people_invite_email").on(table.inviteEmail),
]);

export const insertCompanyPersonSchema = createInsertSchema(companyPeople).omit({ id: true, createdAt: true, updatedAt: true });
export type CompanyPerson = typeof companyPeople.$inferSelect;
export type InsertCompanyPerson = z.infer<typeof insertCompanyPersonSchema>;

// ============== SENSITIVE DATA ACCESS LOG ==============
export const sensitiveDataAccessLogs = pgTable("sensitive_data_access_logs", {
  id: serial("id").primaryKey(),
  accessorUserId: varchar("accessor_user_id").notNull(),
  targetUserId: varchar("target_user_id").notNull(),
  dataType: varchar("data_type", { length: 50 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  entityType: varchar("entity_type", { length: 100 }),
  entityId: varchar("entity_id", { length: 100 }),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sensitive_access_accessor").on(table.accessorUserId),
  index("idx_sensitive_access_target").on(table.targetUserId),
  index("idx_sensitive_access_data_type").on(table.dataType),
]);

// ============== LAWYER PROFILE ==============
export const lawyerProfiles = pgTable("lawyer_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  firmName: varchar("firm_name", { length: 255 }),
  barId: varchar("bar_id", { length: 100 }),
  payoutSubaccountId: varchar("payout_subaccount_id", { length: 100 }),
  serviceRegions: json("service_regions").$type<string[]>().default([]),
  activeCaseCapacity: integer("active_case_capacity").default(10),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLawyerProfileSchema = createInsertSchema(lawyerProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type LawyerProfile = typeof lawyerProfiles.$inferSelect;
export type InsertLawyerProfile = z.infer<typeof insertLawyerProfileSchema>;

// ============== USER ROLES ==============
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  role: varchar("role", { length: 50 }).notNull(), // founder, lawyer, admin
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("idx_user_roles_user_id").on(table.userId)]);

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({ id: true, createdAt: true });
export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

// ============== IDENTITY VERIFICATION ==============
export const identityVerifications = pgTable("identity_verifications", {
  id: serial("id").primaryKey(),
  founderUserId: varchar("founder_user_id").notNull(),
  status: varchar("status", { length: 50 }).default("not_started"), // not_started, pending, in_progress, verified, rejected, expired
  method: varchar("method", { length: 50 }).default("manual"), // manual, automated, external
  externalProvider: varchar("external_provider", { length: 100 }), // e.g., "smile_id", "onfido", etc.
  externalSessionId: varchar("external_session_id", { length: 255 }), // session ID from external provider
  selfieFileId: integer("selfie_file_id"),
  selfieUrl: varchar("selfie_url", { length: 500 }), // URL from external verification service selfie
  idDocFileId: integer("id_doc_file_id"),
  livenessScore: integer("liveness_score"),
  notes: text("notes"),
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"), // verification expires after 1 year
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIdentityVerificationSchema = createInsertSchema(identityVerifications).omit({ id: true, createdAt: true, updatedAt: true });
export type IdentityVerification = typeof identityVerifications.$inferSelect;
export type InsertIdentityVerification = z.infer<typeof insertIdentityVerificationSchema>;

// ============== COMPANY APPLICATION ==============
export const companyApplications = pgTable("company_applications", {
  id: serial("id").primaryKey(),
  founderUserId: varchar("founder_user_id").notNull(),
  applicationType: varchar("application_type", { length: 50 }).default("incorporation"), // incorporation, post_incorporation
  status: varchar("status", { length: 50 }).default("draft"), // draft, pending_verification, submitted, under_review, clarification_requested, filed, pending_originals, courier_in_transit, completed, rejected
  companyName1: varchar("company_name_1", { length: 255 }),
  companyName2: varchar("company_name_2", { length: 255 }),
  companyName3: varchar("company_name_3", { length: 255 }),
  businessDescription: text("business_description"),
  legalAiActivitySuggestions: json("legal_ai_activity_suggestions").$type<any[]>(),
  selectedActivities: json("selected_activities").$type<string[]>(),
  companyType: varchar("company_type", { length: 100 }).default("LTD"), // LTD, PLC, LLP, etc.
  registeredAddress: json("registered_address").$type<{
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }>(),
  directorsData: json("directors_data").$type<any[]>(),
  shareholdersData: json("shareholders_data").$type<any[]>(),
  assignedLawyerUserId: varchar("assigned_lawyer_user_id"),
  submittedAt: timestamp("submitted_at"),
  completedAt: timestamp("completed_at"),
  readinessScore: integer("readiness_score").default(0),
  readinessBreakdown: json("readiness_breakdown").$type<{
    missingItems?: string[];
    warnings?: string[];
    blockers?: string[];
    nextActions?: string[];
  }>(),
  paymentState: varchar("payment_state", { length: 50 }).default("unpaid"), // unpaid, paid_escrowed, released_to_lawyer, refunded_partial, refunded_full, chargeback
  paymentStateUpdatedAt: timestamp("payment_state_updated_at"),
  aiSuggestionVersion: varchar("ai_suggestion_version", { length: 50 }),
  aiLastSuggestedAt: timestamp("ai_last_suggested_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_applications_founder").on(table.founderUserId),
  index("idx_applications_lawyer").on(table.assignedLawyerUserId),
  index("idx_applications_status").on(table.status),
]);

export const insertCompanyApplicationSchema = createInsertSchema(companyApplications).omit({ id: true, createdAt: true, updatedAt: true });
export type CompanyApplication = typeof companyApplications.$inferSelect;
export type InsertCompanyApplication = z.infer<typeof insertCompanyApplicationSchema>;

// ============== APPLICATION CHECKLIST ITEM ==============
export const applicationChecklistItems = pgTable("application_checklist_items", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(),
  key: varchar("key", { length: 100 }).notNull(), // passport_photo, id_doc, address_proof, director_details
  label: varchar("label", { length: 255 }).notNull(),
  required: boolean("required").default(true),
  status: varchar("status", { length: 50 }).default("missing"), // missing, provided, accepted, rejected
  reviewerNotes: text("reviewer_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertChecklistItemSchema = createInsertSchema(applicationChecklistItems).omit({ id: true, createdAt: true, updatedAt: true });
export type ApplicationChecklistItem = typeof applicationChecklistItems.$inferSelect;
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;

// ============== DOCUMENT FILE ==============
export const documentFiles = pgTable("document_files", {
  id: serial("id").primaryKey(),
  ownerUserId: varchar("owner_user_id").notNull(),
  applicationId: integer("application_id"),
  category: varchar("category", { length: 50 }).notNull(), // identity, company, filing, stamped_originals, courier
  docType: varchar("doc_type", { length: 100 }).notNull(), // passport, nin, utility_bill, cac_form, stamped_certificate
  filename: varchar("filename", { length: 255 }).notNull(),
  storagePath: varchar("storage_path", { length: 500 }).notNull(),
  sha256Hash: varchar("sha256_hash", { length: 64 }),
  sizeBytes: integer("size_bytes"),
  mimeType: varchar("mime_type", { length: 100 }),
  isSensitive: boolean("is_sensitive").default(true),
  qualityStatus: varchar("quality_status", { length: 50 }).default("not_checked"), // not_checked, pass, needs_attention
  qualityReport: json("quality_report").$type<{
    blurScore?: number;
    cropWarnings?: string[];
    missingPagesHints?: string[];
    isExpired?: boolean;
    overallScore?: number;
  }>(),
  lastQualityCheckedAt: timestamp("last_quality_checked_at"),
  expiryDate: timestamp("expiry_date"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_documents_owner").on(table.ownerUserId),
  index("idx_documents_application").on(table.applicationId),
]);

export const insertDocumentFileSchema = createInsertSchema(documentFiles).omit({ id: true, createdAt: true });
export type DocumentFile = typeof documentFiles.$inferSelect;
export type InsertDocumentFile = z.infer<typeof insertDocumentFileSchema>;

// ============== PAYMENT ==============
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(),
  provider: varchar("provider", { length: 50 }).default("paystack"),
  amountTotalKobo: integer("amount_total_kobo").notNull(),
  currency: varchar("currency", { length: 10 }).default("NGN"),
  breakdownJson: json("breakdown_json").$type<{
    platformFee?: number;
    lawyerFee?: number;
    governmentFee?: number;
    courierFee?: number;
  }>(),
  status: varchar("status", { length: 50 }).default("initialized"), // initialized, success, failed, refunded
  state: varchar("state", { length: 50 }).default("unpaid"), // unpaid, paid_escrowed, released_to_lawyer, refunded_partial, refunded_full, chargeback
  paystackReference: varchar("paystack_reference", { length: 255 }),
  paidAt: timestamp("paid_at"),
  escrowedAt: timestamp("escrowed_at"),
  releasedAt: timestamp("released_at"),
  refundedAt: timestamp("refunded_at"),
  refundReason: text("refund_reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("idx_payments_application").on(table.applicationId)]);

export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

// ============== PAYSTACK TRANSACTION ==============
export const paystackTransactions = pgTable("paystack_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  reference: varchar("reference", { length: 255 }).notNull().unique(),
  accessCode: varchar("access_code", { length: 255 }),
  paystackTransactionId: varchar("paystack_transaction_id", { length: 255 }),
  status: varchar("status", { length: 50 }).default("pending"), // pending, success, failed
  currency: varchar("currency", { length: 10 }).default("NGN"),
  amountTotal: integer("amount_total"), // in kobo
  lineItems: json("line_items").$type<{
    serviceType: string;
    tier?: string;
    amount: number;
    description: string;
  }[]>(),
  contextJson: json("context_json").$type<{
    applicationId?: number;
    subscriptionId?: number;
  }>(),
  gatewayResponse: varchar("gateway_response", { length: 255 }),
  channel: varchar("channel", { length: 50 }), // card, bank, ussd, etc.
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_paystack_transactions_user").on(table.userId),
  index("idx_paystack_transactions_status").on(table.status),
  index("idx_paystack_transactions_reference").on(table.reference),
]);

export const insertPaystackTransactionSchema = createInsertSchema(paystackTransactions).omit({ id: true, createdAt: true, updatedAt: true });
export type PaystackTransaction = typeof paystackTransactions.$inferSelect;
export type InsertPaystackTransaction = z.infer<typeof insertPaystackTransactionSchema>;

// ============== PAYOUT LEDGER ==============
export const payoutLedger = pgTable("payout_ledger", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").notNull(),
  lawyerUserId: varchar("lawyer_user_id").notNull(),
  amountKobo: integer("amount_kobo").notNull(),
  status: varchar("status", { length: 50 }).default("pending"), // pending, queued, sent, failed
  providerRef: varchar("provider_ref", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPayoutLedgerSchema = createInsertSchema(payoutLedger).omit({ id: true, createdAt: true, updatedAt: true });
export type PayoutLedger = typeof payoutLedger.$inferSelect;
export type InsertPayoutLedger = z.infer<typeof insertPayoutLedgerSchema>;

// ============== COURIER SHIPMENT ==============
export const courierShipments = pgTable("courier_shipments", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(),
  courierName: varchar("courier_name", { length: 255 }),
  trackingNumber: varchar("tracking_number", { length: 255 }),
  shipFrom: text("ship_from"),
  shipTo: text("ship_to"),
  status: varchar("status", { length: 50 }).default("not_started"), // not_started, label_created, dispatched, in_transit, delivered
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCourierShipmentSchema = createInsertSchema(courierShipments).omit({ id: true, createdAt: true, updatedAt: true });
export type CourierShipment = typeof courierShipments.$inferSelect;
export type InsertCourierShipment = z.infer<typeof insertCourierShipmentSchema>;

// ============== CONSENT GRANT ==============
export const consentGrants = pgTable("consent_grants", {
  id: serial("id").primaryKey(),
  founderUserId: varchar("founder_user_id").notNull(),
  lawyerUserId: varchar("lawyer_user_id").notNull(),
  applicationId: integer("application_id").notNull(),
  scope: varchar("scope", { length: 100 }).notNull(), // view_documents, view_identity, process_application
  grantedAt: timestamp("granted_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

export const insertConsentGrantSchema = createInsertSchema(consentGrants).omit({ id: true, grantedAt: true });
export type ConsentGrant = typeof consentGrants.$inferSelect;
export type InsertConsentGrant = z.infer<typeof insertConsentGrantSchema>;

// ============== AUDIT LOG ==============
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: varchar("actor_user_id"),
  action: varchar("action", { length: 100 }).notNull(), // Actions: create_application, submit_application, upload_document, change_status, create_declaration, quality_override, create_clarification, send_clarification, resolve_clarification, generate_ai_draft, sync_offline_draft, admin_override, issue_receipt, revoke_receipt
  entityType: varchar("entity_type", { length: 100 }),
  entityId: varchar("entity_id", { length: 100 }),
  details: json("details").$type<Record<string, any>>(),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_audit_actor").on(table.actorUserId),
  index("idx_audit_entity").on(table.entityType, table.entityId),
  index("idx_audit_action").on(table.action),
]);

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// ============== FEATURE FLAG ==============
export const featureFlags = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  isEnabled: boolean("is_enabled").default(false),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({ id: true, createdAt: true, updatedAt: true });
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;

// ============== OFFLINE DRAFT ==============
export const offlineDrafts = pgTable("offline_drafts", {
  id: serial("id").primaryKey(),
  founderUserId: varchar("founder_user_id").notNull(),
  applicationId: integer("application_id"),
  clientDraftId: varchar("client_draft_id", { length: 100 }).notNull(),
  draftJson: json("draft_json").$type<Record<string, any>>(),
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOfflineDraftSchema = createInsertSchema(offlineDrafts).omit({ id: true, createdAt: true });
export type OfflineDraft = typeof offlineDrafts.$inferSelect;
export type InsertOfflineDraft = z.infer<typeof insertOfflineDraftSchema>;

// ============== CLARIFICATION REQUEST ==============
export const clarificationRequests = pgTable("clarification_requests", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(),
  lawyerUserId: varchar("lawyer_user_id").notNull(),
  founderUserId: varchar("founder_user_id").notNull(),
  status: varchar("status", { length: 50 }).default("open"), // open, sent, resolved, cancelled
  subject: text("subject"),
  message: text("message"),
  aiDraftJson: json("ai_draft_json").$type<{
    subject?: string;
    message?: string;
    rationale?: string;
    requiredActions?: string[];
  }>(),
  sentAt: timestamp("sent_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClarificationRequestSchema = createInsertSchema(clarificationRequests).omit({ id: true, createdAt: true });
export type ClarificationRequest = typeof clarificationRequests.$inferSelect;
export type InsertClarificationRequest = z.infer<typeof insertClarificationRequestSchema>;

// ============== NOTIFICATIONS ==============
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).default("info"), // info, success, warning, error
  isRead: boolean("is_read").default(false),
  linkUrl: varchar("link_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("idx_notifications_user").on(table.userId)]);

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// ============== VERIFICATION RECEIPT ==============
export const verificationReceipts = pgTable("verification_receipts", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(),
  founderId: varchar("founder_id").notNull(),
  issuedBy: varchar("issued_by", { length: 50 }).notNull(), // celion, lawyer_proxy, agency
  scope: varchar("scope", { length: 50 }).notNull(), // identity, incorporation, post_incorporation, document_bundle
  status: varchar("status", { length: 50 }).default("issued"), // issued, revoked, expired
  receiptNumber: varchar("receipt_number", { length: 50 }).notNull().unique(),
  receiptJson: json("receipt_json").$type<{
    companySummary?: { name: string; type: string; founders: string[] };
    statusTimeline?: { status: string; timestamp: string }[];
    documentHashes?: { docType: string; sha256: string }[];
    executionDeclarationRef?: number;
    paymentState?: string;
  }>(),
  verificationHash: varchar("verification_hash", { length: 64 }).notNull(),
  issuedAt: timestamp("issued_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  revocationReason: text("revocation_reason"),
}, (table) => [
  index("idx_receipts_application").on(table.applicationId),
  index("idx_receipts_founder").on(table.founderId),
]);

export const insertVerificationReceiptSchema = createInsertSchema(verificationReceipts).omit({ id: true, issuedAt: true });
export type VerificationReceipt = typeof verificationReceipts.$inferSelect;
export type InsertVerificationReceipt = z.infer<typeof insertVerificationReceiptSchema>;

// ============== EXECUTION DECLARATION ==============
export const executionDeclarations = pgTable("execution_declarations", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(),
  lawyerId: varchar("lawyer_id").notNull(),
  submissionType: varchar("submission_type", { length: 50 }).notNull(), // physical, digital
  submissionLocation: text("submission_location"),
  submittedAt: timestamp("submitted_at").notNull(),
  declarationAccepted: boolean("declaration_accepted").default(false),
  declarationTextVersion: varchar("declaration_text_version", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_execution_application").on(table.applicationId),
  index("idx_execution_lawyer").on(table.lawyerId),
]);

export const insertExecutionDeclarationSchema = createInsertSchema(executionDeclarations).omit({ id: true, createdAt: true });
export type ExecutionDeclaration = typeof executionDeclarations.$inferSelect;
export type InsertExecutionDeclaration = z.infer<typeof insertExecutionDeclarationSchema>;

// ============== APPLICATION AI EVENT ==============
export const applicationAIEvents = pgTable("application_ai_events", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(),
  actorUserId: varchar("actor_user_id").notNull(),
  feature: varchar("feature", { length: 50 }).notNull(), // cac_activity_mapping, clarification_generator, readiness_explainer, doc_quality
  model: varchar("model", { length: 100 }),
  promptVersion: varchar("prompt_version", { length: 50 }),
  inputHash: varchar("input_hash", { length: 64 }), // sha256 of input payload
  outputJson: json("output_json").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_events_application").on(table.applicationId),
  index("idx_ai_events_actor").on(table.actorUserId),
  index("idx_ai_events_feature").on(table.feature),
]);

export const insertApplicationAIEventSchema = createInsertSchema(applicationAIEvents).omit({ id: true, createdAt: true });
export type ApplicationAIEvent = typeof applicationAIEvents.$inferSelect;
export type InsertApplicationAIEvent = z.infer<typeof insertApplicationAIEventSchema>;

// ============== LAWYER APPLICATION (for new lawyer onboarding) ==============
export const lawyerApplications = pgTable("lawyer_applications", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  barId: varchar("bar_id", { length: 100 }).notNull(),
  scnNumber: varchar("scn_number", { length: 100 }), // Supreme Court Number
  firmName: varchar("firm_name", { length: 255 }),
  firmAddress: text("firm_address"),
  yearsOfExperience: integer("years_of_experience"),
  specializations: json("specializations").$type<string[]>().default([]),
  serviceRegions: json("service_regions").$type<string[]>().default([]),
  statementOfInterest: text("statement_of_interest"),
  status: varchar("status", { length: 50 }).default("pending"), // pending, approved, rejected
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  createdUserId: varchar("created_user_id"), // user ID if application is approved
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_lawyer_applications_email").on(table.email),
  index("idx_lawyer_applications_status").on(table.status),
]);

export const insertLawyerApplicationSchema = createInsertSchema(lawyerApplications).omit({ 
  id: true, 
  status: true, 
  reviewedBy: true, 
  reviewedAt: true, 
  rejectionReason: true,
  createdUserId: true,
  createdAt: true, 
  updatedAt: true 
});
export type LawyerApplication = typeof lawyerApplications.$inferSelect;
export type InsertLawyerApplication = z.infer<typeof insertLawyerApplicationSchema>;

// ============== SERVICE ADDRESS (for registered office) ==============
export const serviceAddresses = pgTable("service_addresses", {
  id: serial("id").primaryKey(),
  label: varchar("label", { length: 255 }).notNull(),
  line1: varchar("line_1", { length: 255 }).notNull(),
  line2: varchar("line_2", { length: 255 }),
  floorDetails: varchar("floor_details", { length: 255 }),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  country: varchar("country", { length: 100 }).default("Nigeria"),
  isActive: boolean("is_active").default(true),
  managerUserId: varchar("manager_user_id"),
  contactPhone: varchar("contact_phone", { length: 50 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  operatingHours: varchar("operating_hours", { length: 255 }),
  utilityBillPath: text("utility_bill_path"),
  utilityBillUploadedAt: timestamp("utility_bill_uploaded_at"),
  utilityBillExpiresAt: timestamp("utility_bill_expires_at"),
  utilityBillStatus: varchar("utility_bill_status", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertServiceAddressSchema = createInsertSchema(serviceAddresses).omit({ id: true, createdAt: true, updatedAt: true });
export type ServiceAddress = typeof serviceAddresses.$inferSelect;
export type InsertServiceAddress = z.infer<typeof insertServiceAddressSchema>;

// ============== REGISTERED OFFICE SUBSCRIPTION ==============
export const registeredOfficeSubscriptions = pgTable("registered_office_subscriptions", {
  id: serial("id").primaryKey(),
  founderId: varchar("founder_id").notNull(),
  applicationId: integer("application_id"),
  tier: varchar("tier", { length: 50 }).notNull(),
  serviceAddressId: integer("service_address_id").notNull(),
  status: varchar("status", { length: 50 }).default("selected"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  paymentId: integer("payment_id"),
  useAsRegisteredAddress: boolean("use_as_registered_address").default(false),
  registeredAddressConfirmedAt: timestamp("registered_address_confirmed_at"),
  registeredAddressConsentText: text("registered_address_consent_text"),
  proofOfAddressPath: text("proof_of_address_path"),
  proofOfAddressUploadedAt: timestamp("proof_of_address_uploaded_at"),
  proofOfAddressStatus: varchar("proof_of_address_status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ro_subscriptions_founder").on(table.founderId),
  index("idx_ro_subscriptions_application").on(table.applicationId),
  index("idx_ro_subscriptions_status").on(table.status),
]);

export const insertRegisteredOfficeSubscriptionSchema = createInsertSchema(registeredOfficeSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type RegisteredOfficeSubscription = typeof registeredOfficeSubscriptions.$inferSelect;
export type InsertRegisteredOfficeSubscription = z.infer<typeof insertRegisteredOfficeSubscriptionSchema>;

// ============== MAIL HANDLING PREFERENCE ==============
export const mailHandlingPreferences = pgTable("mail_handling_preferences", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull(),
  founderId: varchar("founder_id").notNull(),
  preferenceType: varchar("preference_type", { length: 50 }).notNull(), // 'scan_all' | 'approve_before_scan' | 'forward_only'
  isSensitiveAutoEscalationEnabled: boolean("is_sensitive_auto_escalation_enabled").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_mail_prefs_subscription").on(table.subscriptionId),
  index("idx_mail_prefs_founder").on(table.founderId),
]);

export const insertMailHandlingPreferenceSchema = createInsertSchema(mailHandlingPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export type MailHandlingPreference = typeof mailHandlingPreferences.$inferSelect;
export type InsertMailHandlingPreference = z.infer<typeof insertMailHandlingPreferenceSchema>;

// ============== MAIL ITEM ==============
export const mailItems = pgTable("mail_items", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull(),
  founderId: varchar("founder_id").notNull(),
  senderName: varchar("sender_name", { length: 255 }),
  senderType: varchar("sender_type", { length: 100 }), // government, bank, legal, commercial, personal, unknown
  envelopePhotoDocId: integer("envelope_photo_doc_id"), // FK to documentFiles
  scannedDocId: integer("scanned_doc_id"), // FK to documentFiles
  status: varchar("status", { length: 50 }).default("received"), // received, pending_approval, approved, scan_in_progress, scanned, forwarding, forwarded, archived, discarded, returned_to_sender
  isSensitive: boolean("is_sensitive").default(false),
  isOverage: boolean("is_overage").default(false), // True if this item exceeds monthly cap
  overageReason: text("overage_reason"), // Admin notes for overage items
  receivedAt: timestamp("received_at").defaultNow(),
  scannedAt: timestamp("scanned_at"),
  forwardedAt: timestamp("forwarded_at"),
  courierName: varchar("courier_name", { length: 100 }),
  trackingNumber: varchar("tracking_number", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_mail_items_subscription").on(table.subscriptionId),
  index("idx_mail_items_founder").on(table.founderId),
  index("idx_mail_items_status").on(table.status),
]);

export const insertMailItemSchema = createInsertSchema(mailItems).omit({ id: true, createdAt: true, updatedAt: true });
export type MailItem = typeof mailItems.$inferSelect;
export type InsertMailItem = z.infer<typeof insertMailItemSchema>;

// ============== MAIL APPROVAL REQUEST ==============
export const mailApprovalRequests = pgTable("mail_approval_requests", {
  id: serial("id").primaryKey(),
  mailItemId: integer("mail_item_id").notNull(),
  founderId: varchar("founder_id").notNull(),
  requestedAction: varchar("requested_action", { length: 50 }).notNull(), // scan, forward, discard
  decision: varchar("decision", { length: 50 }), // approved, rejected
  decisionReason: text("decision_reason"),
  requestedAt: timestamp("requested_at").defaultNow(),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_mail_approvals_mail_item").on(table.mailItemId),
  index("idx_mail_approvals_founder").on(table.founderId),
]);

export const insertMailApprovalRequestSchema = createInsertSchema(mailApprovalRequests).omit({ id: true, createdAt: true });
export type MailApprovalRequest = typeof mailApprovalRequests.$inferSelect;
export type InsertMailApprovalRequest = z.infer<typeof insertMailApprovalRequestSchema>;

// ============== LEGAL AI CHAT ==============
export const legalChatConversations = pgTable("legal_chat_conversations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("idx_legal_chat_user").on(table.userId)]);

export const insertLegalChatConversationSchema = createInsertSchema(legalChatConversations).omit({ id: true, createdAt: true, updatedAt: true });
export type LegalChatConversation = typeof legalChatConversations.$inferSelect;
export type InsertLegalChatConversation = z.infer<typeof insertLegalChatConversationSchema>;

export const legalChatMessages = pgTable("legal_chat_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: varchar("role", { length: 20 }).notNull(), // user, assistant
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("idx_legal_chat_messages_conv").on(table.conversationId)]);

export const insertLegalChatMessageSchema = createInsertSchema(legalChatMessages).omit({ id: true, createdAt: true });
export type LegalChatMessage = typeof legalChatMessages.$inferSelect;
export type InsertLegalChatMessage = z.infer<typeof insertLegalChatMessageSchema>;

// ============== COMPANY PROFILE ==============
export const companyProfiles = pgTable("company_profiles", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id"),
  founderId: varchar("founder_id").notNull(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  rcNumber: varchar("rc_number", { length: 100 }),
  companyType: varchar("company_type", { length: 100 }),
  incorporationDate: timestamp("incorporation_date"),
  isExistingCompany: boolean("is_existing_company").default(false),
  existingCompanyStatus: varchar("existing_company_status", { length: 30 }).default("pending_review"),
  registeredAddress: json("registered_address").$type<{
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }>(),
  directors: json("directors").$type<{ name: string; role?: string; email?: string }[]>(),
  shareholders: json("shareholders").$type<{ name: string; shares?: number; percentage?: number }[]>(),
  businessActivities: json("business_activities").$type<string[]>(),
  shareCapital: varchar("share_capital", { length: 255 }),
  tinNumber: varchar("tin_number", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_company_profiles_founder").on(table.founderId),
  index("idx_company_profiles_application").on(table.applicationId),
]);

export const insertCompanyProfileSchema = createInsertSchema(companyProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type CompanyProfile = typeof companyProfiles.$inferSelect;
export type InsertCompanyProfile = z.infer<typeof insertCompanyProfileSchema>;

// ============== POST-INCORPORATION CHECKLIST ==============
export const postIncorporationTasks = pgTable("post_incorporation_tasks", {
  id: serial("id").primaryKey(),
  companyProfileId: integer("company_profile_id").notNull(),
  founderId: varchar("founder_id").notNull(),
  taskKey: varchar("task_key", { length: 100 }).notNull(), // tin_registration, bank_account, vat_registration, company_seal, scuml_registration, pension_setup, employee_registration, business_premises, annual_returns_setup
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  guidance: text("guidance"),
  status: varchar("status", { length: 50 }).default("not_started"), // not_started, in_progress, completed, skipped
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_post_inc_tasks_company").on(table.companyProfileId),
  index("idx_post_inc_tasks_founder").on(table.founderId),
]);

export const insertPostIncorporationTaskSchema = createInsertSchema(postIncorporationTasks).omit({ id: true, createdAt: true, updatedAt: true });
export type PostIncorporationTask = typeof postIncorporationTasks.$inferSelect;
export type InsertPostIncorporationTask = z.infer<typeof insertPostIncorporationTaskSchema>;

// ============== COMPLIANCE DEADLINE ==============
export const complianceDeadlines = pgTable("compliance_deadlines", {
  id: serial("id").primaryKey(),
  companyProfileId: integer("company_profile_id").notNull(),
  founderId: varchar("founder_id").notNull(),
  deadlineType: varchar("deadline_type", { length: 100 }).notNull(), // annual_return, tax_filing, vat_return, paye_remittance, audit_filing
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  dueDate: timestamp("due_date").notNull(),
  penaltyInfo: text("penalty_info"),
  status: varchar("status", { length: 50 }).default("upcoming"), // upcoming, due_soon, overdue, completed
  completedAt: timestamp("completed_at"),
  isRecurring: boolean("is_recurring").default(true),
  recurrenceRule: varchar("recurrence_rule", { length: 100 }), // yearly, quarterly, monthly
  lastNotifiedAt: timestamp("last_notified_at"),
  notes: text("notes"),
  notificationsSent: integer("notifications_sent").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_compliance_deadlines_company").on(table.companyProfileId),
  index("idx_compliance_deadlines_founder").on(table.founderId),
  index("idx_compliance_deadlines_due").on(table.dueDate),
  index("idx_compliance_deadlines_status").on(table.status),
]);

export const insertComplianceDeadlineSchema = createInsertSchema(complianceDeadlines).omit({ id: true, createdAt: true, updatedAt: true });
export type ComplianceDeadline = typeof complianceDeadlines.$inferSelect;
export type InsertComplianceDeadline = z.infer<typeof insertComplianceDeadlineSchema>;

// ============== PRODUCT CATALOG ==============
export const productCatalog = pgTable("product_catalog", {
  id: serial("id").primaryKey(),
  sku: varchar("sku", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(), // incorporation | post_incorporation | addon
  priceNgn: integer("price_ngn").notNull(), // in kobo
  cellionCutNgn: integer("cellion_cut_ngn"), // fixed cut in kobo; null => manual pricing
  isActive: boolean("is_active").default(true),
  requiresManualPricing: boolean("requires_manual_pricing").default(false),
  metadata: json("metadata").$type<{
    shareCapital?: number;
    foreignParticipation?: boolean;
    note?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_product_catalog_sku").on(table.sku),
  index("idx_product_catalog_category").on(table.category),
]);

export const insertProductCatalogSchema = createInsertSchema(productCatalog).omit({ id: true, createdAt: true, updatedAt: true });
export type ProductCatalogItem = typeof productCatalog.$inferSelect;
export type InsertProductCatalogItem = z.infer<typeof insertProductCatalogSchema>;

// ============== ORDERS ==============
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  founderId: varchar("founder_id").notNull(),
  applicationId: integer("application_id"), // link to incorporation application if relevant
  status: varchar("status", { length: 50 }).default("draft"), // draft | pending_payment | paid | failed | cancelled
  currency: varchar("currency", { length: 10 }).default("NGN"),
  totalAmount: integer("total_amount").notNull(), // in kobo
  totalCellionCut: integer("total_cellion_cut").notNull().default(0), // sum of all item cuts in kobo
  totalLawyerNet: integer("total_lawyer_net").notNull().default(0), // total - cellion cut in kobo
  fulfilmentStatus: varchar("fulfilment_status", { length: 50 }).default("pending"), // pending | assigned | in_progress | completed
  assignedLawyerId: varchar("assigned_lawyer_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_orders_founder").on(table.founderId),
  index("idx_orders_application").on(table.applicationId),
  index("idx_orders_status").on(table.status),
]);

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

// ============== ORDER ITEMS ==============
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  sku: varchar("sku", { length: 50 }).notNull(),
  quantity: integer("quantity").default(1),
  unitPrice: integer("unit_price").notNull(), // in kobo
  cellionCut: integer("cellion_cut").notNull().default(0), // for this item in kobo
  lawyerNet: integer("lawyer_net").notNull().default(0), // unit_price - cellion_cut in kobo
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_order_items_order").on(table.orderId),
  index("idx_order_items_product").on(table.productId),
]);

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true, createdAt: true });
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

// ============== ORDER PAYMENTS (Paystack split) ==============
export const orderPayments = pgTable("order_payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  provider: varchar("provider", { length: 50 }).default("paystack"),
  status: varchar("status", { length: 50 }).default("initiated"), // initiated | pending | paid | failed
  amount: integer("amount").notNull(), // in kobo
  currency: varchar("currency", { length: 10 }).default("NGN"),
  paystackReference: varchar("paystack_reference", { length: 255 }).unique(),
  authorizationUrl: text("authorization_url"),
  paidAt: timestamp("paid_at"),
  rawEvent: json("raw_event").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_order_payments_order").on(table.orderId),
  index("idx_order_payments_reference").on(table.paystackReference),
  index("idx_order_payments_status").on(table.status),
]);

export const insertOrderPaymentSchema = createInsertSchema(orderPayments).omit({ id: true, createdAt: true, updatedAt: true });
export type OrderPayment = typeof orderPayments.$inferSelect;
export type InsertOrderPayment = z.infer<typeof insertOrderPaymentSchema>;

// ============== SERVICE REQUESTS (SCUML, TM, TIN fulfillment) ==============
export const serviceRequests = pgTable("service_requests", {
  id: serial("id").primaryKey(),
  founderId: varchar("founder_id").notNull(),
  orderId: integer("order_id"),
  orderItemId: integer("order_item_id"),
  serviceType: varchar("service_type", { length: 50 }).notNull(), // SCUML | TM | TIN | ADD_DIR
  status: varchar("status", { length: 50 }).default("queued"), // queued | assigned | in_progress | completed | cancelled
  assignedLawyerId: varchar("assigned_lawyer_id"),
  companyProfileId: integer("company_profile_id"),
  notes: text("notes"), // For ADD_DIR: stores structured director data as JSON
  lawyerNotes: text("lawyer_notes"), // Lawyer's internal comments, separate from structured notes
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_service_requests_founder").on(table.founderId),
  index("idx_service_requests_order").on(table.orderId),
  index("idx_service_requests_status").on(table.status),
  index("idx_service_requests_type").on(table.serviceType),
]);

export const insertServiceRequestSchema = createInsertSchema(serviceRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;

// ============== ADD DIRECTOR REQUESTS (explicit table for ADD_DIR data) ==============
// status flow: draft → submitted → awaiting_director_verification → ready_for_filing → filed → completed
export const addDirectorRequests = pgTable("add_director_requests", {
  id: serial("id").primaryKey(),
  serviceRequestId: integer("service_request_id").notNull(), // FK to service_requests
  founderId: varchar("founder_id").notNull(),

  // Company Info
  companyRcNumber: varchar("company_rc_number", { length: 20 }),
  companyName: varchar("company_name", { length: 255 }),
  companyTin: varchar("company_tin", { length: 20 }),
  incorporationDate: varchar("incorporation_date", { length: 20 }),
  registeredAddress: text("registered_address"),
  existingDirectors: jsonb("existing_directors"), // [{name, role, bvn?, nin?}]

  // New Director Personal Info
  newDirectorFirstName: varchar("new_director_first_name", { length: 100 }),
  newDirectorLastName: varchar("new_director_last_name", { length: 100 }),
  newDirectorEmail: varchar("new_director_email", { length: 255 }),
  newDirectorPhone: varchar("new_director_phone", { length: 20 }),
  newDirectorNin: varchar("new_director_nin", { length: 30 }),
  newDirectorDateOfBirth: varchar("new_director_date_of_birth", { length: 20 }),
  newDirectorNationality: varchar("new_director_nationality", { length: 100 }),
  newDirectorOccupation: varchar("new_director_occupation", { length: 255 }),
  newDirectorAddress: text("new_director_address"),
  newDirectorProposedRole: varchar("new_director_proposed_role", { length: 100 }), // e.g. Managing Director, Executive Director
  newDirectorShareholding: varchar("new_director_shareholding", { length: 50 }), // optional percentage or number of shares
  additionalNotes: text("additional_notes"),

  // Workflow status
  dataStatus: varchar("data_status", { length: 50 }).default("draft"), // draft | submitted
  directorInviteToken: varchar("director_invite_token", { length: 128 }),
  directorInvitedAt: timestamp("director_invited_at"),
  directorVerifiedAt: timestamp("director_verified_at"),
  directorVerificationStatus: varchar("director_verification_status", { length: 50 }).default("not_invited"), // not_invited | invited | verified | skipped

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_add_director_sr").on(table.serviceRequestId),
  index("idx_add_director_founder").on(table.founderId),
  index("idx_add_director_invite_token").on(table.directorInviteToken),
]);

export const insertAddDirectorRequestSchema = createInsertSchema(addDirectorRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type AddDirectorRequest = typeof addDirectorRequests.$inferSelect;
export type InsertAddDirectorRequest = z.infer<typeof insertAddDirectorRequestSchema>;

// ============== SERVICE REQUEST COMPANY PROFILES (reusable across services) ==============
export const serviceRequestCompanyProfiles = pgTable("service_request_company_profiles", {
  id: serial("id").primaryKey(),
  founderId: varchar("founder_id").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  cacRegistrationType: varchar("cac_registration_type", { length: 50 }).notNull(),
  sector: varchar("sector", { length: 255 }),
  mainBusinessObjectives: text("main_business_objectives"),
  incorporationNumber: varchar("incorporation_number", { length: 100 }).notNull(),
  registeredName: varchar("registered_name", { length: 500 }).notNull(),
  dateIncorporated: varchar("date_incorporated", { length: 20 }),
  tinNumber: varchar("tin_number", { length: 50 }),
  headOfficeAddress: text("head_office_address"),
  state: varchar("state", { length: 100 }),
  bankName: varchar("bank_name", { length: 255 }),
  accountNumber: varchar("account_number", { length: 20 }),
  accountName: varchar("account_name", { length: 255 }),
  organizationPhone: varchar("organization_phone", { length: 30 }),
  organizationEmail: varchar("organization_email", { length: 255 }),
  contactPersonName: varchar("contact_person_name", { length: 255 }),
  contactPersonNin: varchar("contact_person_nin", { length: 20 }),
  contactPersonAddress: text("contact_person_address"),
  contactPersonEmail: varchar("contact_person_email", { length: 255 }),
  contactPersonMobile: varchar("contact_person_mobile", { length: 30 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sr_company_profiles_founder").on(table.founderId),
]);

export const insertServiceRequestCompanyProfileSchema = createInsertSchema(serviceRequestCompanyProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type ServiceRequestCompanyProfile = typeof serviceRequestCompanyProfiles.$inferSelect;
export type InsertServiceRequestCompanyProfile = z.infer<typeof insertServiceRequestCompanyProfileSchema>;

// ============== SERVICE REQUEST DOCUMENTS ==============
export const serviceRequestDocuments = pgTable("service_request_documents", {
  id: serial("id").primaryKey(),
  founderId: varchar("founder_id").notNull(),
  serviceRequestId: integer("service_request_id"),
  companyProfileId: integer("company_profile_id"),
  docType: varchar("doc_type", { length: 100 }).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  storagePath: varchar("storage_path", { length: 500 }).notNull(),
  sizeBytes: integer("size_bytes"),
  mimeType: varchar("mime_type", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sr_documents_founder").on(table.founderId),
  index("idx_sr_documents_service_request").on(table.serviceRequestId),
  index("idx_sr_documents_company_profile").on(table.companyProfileId),
  index("idx_sr_documents_doc_type").on(table.docType),
]);

export const insertServiceRequestDocumentSchema = createInsertSchema(serviceRequestDocuments).omit({ id: true, createdAt: true });
export type ServiceRequestDocument = typeof serviceRequestDocuments.$inferSelect;
export type InsertServiceRequestDocument = z.infer<typeof insertServiceRequestDocumentSchema>;

// ============== NOTIFICATION PREFERENCES ==============
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  complianceReminders: boolean("compliance_reminders").default(true),
  serviceRequestUpdates: boolean("service_request_updates").default(true),
  orderUpdates: boolean("order_updates").default(true),
  incorporationUpdates: boolean("incorporation_updates").default(true),
  marketingEmails: boolean("marketing_emails").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_notification_prefs_user").on(table.userId),
]);

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({ id: true, updatedAt: true });
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferencesSchema>;

// ============== DATA SHARING CONSENTS ==============
export const dataSharingConsents = pgTable("data_sharing_consents", {
  id: serial("id").primaryKey(),
  founderId: varchar("founder_id").notNull(),
  applicationId: integer("application_id"),
  kycVerificationRequestId: integer("kyc_verification_request_id"),
  partnerName: varchar("partner_name", { length: 255 }).notNull(),
  partnerType: varchar("partner_type", { length: 50 }).notNull(),
  consentToken: varchar("consent_token", { length: 128 }).notNull().unique(),
  consentText: text("consent_text").notNull(),
  dataScope: jsonb("data_scope").notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_dsc_founder").on(table.founderId),
  index("idx_dsc_token").on(table.consentToken),
  index("idx_dsc_status").on(table.status),
]);

export const insertDataSharingConsentSchema = createInsertSchema(dataSharingConsents).omit({ id: true, createdAt: true });
export type DataSharingConsent = typeof dataSharingConsents.$inferSelect;
export type InsertDataSharingConsent = z.infer<typeof insertDataSharingConsentSchema>;

export const dataSharingAccessLogs = pgTable("data_sharing_access_logs", {
  id: serial("id").primaryKey(),
  consentId: integer("consent_id").notNull(),
  accessType: varchar("access_type", { length: 50 }).notNull(),
  accessedBy: varchar("accessed_by", { length: 255 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  dataReturned: jsonb("data_returned"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_dsal_consent").on(table.consentId),
]);

export type DataSharingAccessLog = typeof dataSharingAccessLogs.$inferSelect;

// ============== KYC-AS-A-SERVICE ==============

export const kycOrganisations = pgTable("kyc_organisations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  clientType: varchar("client_type", { length: 20 }).default("organisation").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 50 }),
  address: text("address"),
  logoPath: varchar("logo_path", { length: 500 }),
  createdByUserId: varchar("created_by_user_id").notNull(),
  status: varchar("status", { length: 20 }).default("pending_review").notNull(),
  settings: jsonb("settings").default({}),
  employeePortalEnabled: boolean("employee_portal_enabled").default(true),
  supplierPortalEnabled: boolean("supplier_portal_enabled").default(true),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  termsVersion: varchar("terms_version", { length: 20 }),
  termsAcceptedByUserId: varchar("terms_accepted_by_user_id"),
  termsAcceptedIp: varchar("terms_accepted_ip", { length: 45 }),
  integrationProfile: jsonb("integration_profile").$type<{
    mode: "full_hosted" | "prefill_selfie" | "selfie_only" | "data_collection";
    verificationLocation: "hosted" | "embedded" | "headless";
    requiresBiometric: boolean;
    resultTiming: "instant" | "webhook";
    configuredAt?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kyc_org_slug").on(table.slug),
  index("idx_kyc_org_status").on(table.status),
  check("chk_kyc_org_client_type", sql`${table.clientType} IN ('organisation', 'application')`),
]);

export const insertKycOrganisationSchema = createInsertSchema(kycOrganisations).omit({ id: true, createdAt: true, updatedAt: true });
export type KycOrganisation = typeof kycOrganisations.$inferSelect;
export type InsertKycOrganisation = z.infer<typeof insertKycOrganisationSchema>;

export const kycOrgMembers = pgTable("kyc_org_members", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  userId: varchar("user_id"),
  role: varchar("role", { length: 30 }).notNull(),
  inviteEmail: varchar("invite_email", { length: 255 }).notNull(),
  inviteStatus: varchar("invite_status", { length: 20 }).default("pending").notNull(),
  inviteToken: varchar("invite_token", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kyc_om_org").on(table.orgId),
  index("idx_kyc_om_user").on(table.userId),
]);

export const insertKycOrgMemberSchema = createInsertSchema(kycOrgMembers).omit({ id: true, createdAt: true });
export type KycOrgMember = typeof kycOrgMembers.$inferSelect;

export const kycVerificationTemplates = pgTable("kyc_verification_templates", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  description: text("description"),
  requireDirectorVerification: boolean("require_director_verification").default(false),
  documentRequirementIds: jsonb("document_requirement_ids").default([]),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kyc_vt_org").on(table.orgId),
]);

export const insertKycVerificationTemplateSchema = createInsertSchema(kycVerificationTemplates).omit({ id: true, createdAt: true });
export type KycVerificationTemplate = typeof kycVerificationTemplates.$inferSelect;

export const kycDocumentRequirements = pgTable("kyc_document_requirements", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id"),
  type: varchar("type", { length: 20 }).notNull(),
  documentName: varchar("document_name", { length: 255 }).notNull(),
  documentDescription: text("document_description"),
  documentCategory: varchar("document_category", { length: 30 }).notNull(),
  isStandard: boolean("is_standard").default(false).notNull(),
  isMandatory: boolean("is_mandatory").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  hasExpiry: boolean("has_expiry").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kyc_dr_org").on(table.orgId),
  index("idx_kyc_dr_type").on(table.type),
]);

export const insertKycDocumentRequirementSchema = createInsertSchema(kycDocumentRequirements).omit({ id: true, createdAt: true });
export type KycDocumentRequirement = typeof kycDocumentRequirements.$inferSelect;

export interface KycVerifiedSnapshot {
  verificationType: "individual" | "supplier";
  riskScore: "green" | "amber" | "red";
  verificationMethod: string;
  dataSource: string;
  verifiedAt: string;
  documentsVerified: {
    documentName: string;
    documentCategory: string;
    documentType: string;
    status: "accepted";
    extractedName?: string;
    extractedDateOfBirth?: string;
    documentValidity?: "valid" | "expired" | "unknown";
  }[];
  documentCount: number;
  biometricVerified: boolean;
  livenessConfirmed: boolean;
  faceMatchConfidence?: number;
  amlScreened: boolean;
  amlClear?: boolean;
}

export const kycVerificationRequests = pgTable("kyc_verification_requests", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  templateId: integer("template_id"),
  requestedByUserId: varchar("requested_by_user_id"),
  type: varchar("type", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).default("pending_invite").notNull(),
  subjectEmail: varchar("subject_email", { length: 255 }).notNull(),
  subjectName: varchar("subject_name", { length: 255 }).notNull(),
  subjectUserId: varchar("subject_user_id"),
  notes: text("notes"),
  reviewedByUserId: varchar("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  riskScore: varchar("risk_score", { length: 10 }),
  paymentResponsibility: varchar("payment_responsibility", { length: 20 }).default("organisation").notNull(),
  paymentStatus: varchar("payment_status", { length: 20 }).default("not_required").notNull(),
  paymentReference: varchar("payment_reference", { length: 128 }),
  inviteToken: varchar("invite_token", { length: 128 }).notNull().unique(),
  selfRegistered: boolean("self_registered").default(false),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  termsVersion: varchar("terms_version", { length: 20 }),
  termsAcceptedIp: varchar("terms_accepted_ip", { length: 45 }),
  expiresAt: timestamp("expires_at").notNull(),
  certificateRef: varchar("certificate_ref", { length: 40 }).unique(),
  verifiedDataSnapshot: jsonb("verified_data_snapshot").$type<KycVerifiedSnapshot>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kyc_vr_org").on(table.orgId),
  index("idx_kyc_vr_token").on(table.inviteToken),
  index("idx_kyc_vr_status").on(table.status),
  index("idx_kyc_vr_subject").on(table.subjectUserId),
  index("idx_kyc_vr_cert_ref").on(table.certificateRef),
]);

export const insertKycVerificationRequestSchema = createInsertSchema(kycVerificationRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type KycVerificationRequest = typeof kycVerificationRequests.$inferSelect;

export const kycSupplierProfiles = pgTable("kyc_supplier_profiles", {
  id: serial("id").primaryKey(),
  verificationRequestId: integer("verification_request_id").notNull().unique(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  rcNumber: varchar("rc_number", { length: 50 }),
  tinNumber: varchar("tin_number", { length: 50 }),
  vatRegistered: boolean("vat_registered").default(false),
  yearEstablished: integer("year_established"),
  industryCategory: varchar("industry_category", { length: 100 }),
  headOfficeAddress: text("head_office_address"),
  websiteUrl: varchar("website_url", { length: 500 }),
  contactPersonName: varchar("contact_person_name", { length: 255 }).notNull(),
  contactPersonEmail: varchar("contact_person_email", { length: 255 }).notNull(),
  contactPersonPhone: varchar("contact_person_phone", { length: 50 }),
  contactPersonRole: varchar("contact_person_role", { length: 100 }),
  bankName: varchar("bank_name", { length: 255 }),
  bankAccountNumber: varchar("bank_account_number", { length: 50 }),
  bankAccountName: varchar("bank_account_name", { length: 255 }),
  extractedData: jsonb("extracted_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kyc_sp_vr").on(table.verificationRequestId),
]);

export const insertKycSupplierProfileSchema = createInsertSchema(kycSupplierProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type KycSupplierProfile = typeof kycSupplierProfiles.$inferSelect;

export const kycSubmittedDocuments = pgTable("kyc_submitted_documents", {
  id: serial("id").primaryKey(),
  verificationRequestId: integer("verification_request_id").notNull(),
  requirementId: integer("requirement_id").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  status: varchar("status", { length: 20 }).default("uploaded").notNull(),
  detectedDocumentType: varchar("detected_document_type", { length: 100 }),
  extractedData: jsonb("extracted_data"),
  extractionConfirmed: boolean("extraction_confirmed").default(false),
  expiryDate: timestamp("expiry_date"),
  reviewNote: text("review_note"),
  reviewedByUserId: varchar("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => [
  index("idx_kyc_sd_vr").on(table.verificationRequestId),
  index("idx_kyc_sd_req").on(table.requirementId),
]);

export const insertKycSubmittedDocumentSchema = createInsertSchema(kycSubmittedDocuments).omit({ id: true, uploadedAt: true });
export type KycSubmittedDocument = typeof kycSubmittedDocuments.$inferSelect;

export const kycSupplierPeople = pgTable("kyc_supplier_people", {
  id: serial("id").primaryKey(),
  supplierProfileId: integer("supplier_profile_id").notNull(),
  verificationRequestId: integer("verification_request_id").notNull(),
  individualRequestId: integer("individual_request_id"),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  userId: varchar("user_id"),
  requiresVerification: boolean("requires_verification").default(false).notNull(),
  verificationStatus: varchar("verification_status", { length: 20 }).default("not_required").notNull(),
  inviteToken: varchar("invite_token", { length: 128 }),
  inviteSentAt: timestamp("invite_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kyc_spp_sp").on(table.supplierProfileId),
  index("idx_kyc_spp_vr").on(table.verificationRequestId),
]);

export const insertKycSupplierPersonSchema = createInsertSchema(kycSupplierPeople).omit({ id: true, createdAt: true });
export type KycSupplierPerson = typeof kycSupplierPeople.$inferSelect;

// ============== KYC API KEYS ==============
export const kycApiKeys = pgTable("kyc_api_keys", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id"),
  userId: varchar("user_id", { length: 255 }),
  /** FK to cie_partners.id — set when this key is a CIE Partner key (lazy ref avoids circular dependency) */
  ciePartnerId: integer("cie_partner_id").references((): AnyPgColumn => ciePartners.id, { onDelete: "set null" }),
  keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
  keyHash: varchar("key_hash", { length: 128 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  permissions: text("permissions").array().default([]).notNull(),
  rateLimitPerMinute: integer("rate_limit_per_minute").default(60).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kyc_ak_org").on(table.organisationId),
  index("idx_kyc_ak_hash").on(table.keyHash),
  index("idx_kyc_ak_partner").on(table.ciePartnerId),
]);

export const insertKycApiKeySchema = createInsertSchema(kycApiKeys).omit({ id: true, createdAt: true });
export type KycApiKey = typeof kycApiKeys.$inferSelect;
export type InsertKycApiKey = z.infer<typeof insertKycApiKeySchema>;

// ============== KYC API USAGE LOGS ==============
export const kycApiUsageLogs = pgTable("kyc_api_usage_logs", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").notNull(),
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  statusCode: integer("status_code").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  requestId: varchar("request_id", { length: 64 }).notNull(),
  responseTimeMs: integer("response_time_ms"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kyc_aul_key").on(table.apiKeyId),
  index("idx_kyc_aul_created").on(table.createdAt),
]);

export const insertKycApiUsageLogSchema = createInsertSchema(kycApiUsageLogs).omit({ id: true, createdAt: true });
export type KycApiUsageLog = typeof kycApiUsageLogs.$inferSelect;

// ============== KYC WEBHOOK CONFIGS ==============
export const kycWebhookConfigs = pgTable("kyc_webhook_configs", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  secret: varchar("secret", { length: 128 }).notNull(),
  events: text("events").array().default([]).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kyc_wc_org").on(table.organisationId),
]);

export const insertKycWebhookConfigSchema = createInsertSchema(kycWebhookConfigs).omit({ id: true, createdAt: true });
export type KycWebhookConfig = typeof kycWebhookConfigs.$inferSelect;
export type InsertKycWebhookConfig = z.infer<typeof insertKycWebhookConfigSchema>;

// ============== KYC WEBHOOK DELIVERY LOGS ==============
export const kycWebhookDeliveryLogs = pgTable("kyc_webhook_delivery_logs", {
  id: serial("id").primaryKey(),
  webhookConfigId: integer("webhook_config_id").notNull(),
  event: varchar("event", { length: 100 }).notNull(),
  verificationRequestId: integer("verification_request_id"),
  payload: jsonb("payload").notNull(),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  attempts: integer("attempts").default(0).notNull(),
  nextRetryAt: timestamp("next_retry_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kyc_wdl_config").on(table.webhookConfigId),
  index("idx_kyc_wdl_event").on(table.event),
]);

export const insertKycWebhookDeliveryLogSchema = createInsertSchema(kycWebhookDeliveryLogs).omit({ id: true, createdAt: true });
export type KycWebhookDeliveryLog = typeof kycWebhookDeliveryLogs.$inferSelect;

// ============== KYC BILLING ACCOUNTS ==============
export const kycBillingAccounts = pgTable("kyc_billing_accounts", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().unique(),
  billingMode: varchar("billing_mode", { length: 20 }).default("prepaid").notNull(),
  creditBalance: integer("credit_balance").default(0).notNull(),
  invoiceEmail: varchar("invoice_email", { length: 255 }),
  invoiceCompanyName: varchar("invoice_company_name", { length: 255 }),
  invoiceAddress: text("invoice_address"),
  paymentTermsDays: integer("payment_terms_days").default(30),
  creditLimit: integer("credit_limit").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kyc_ba_org").on(table.organisationId),
]);

export const KYC_BILLING_MODES = ["prepaid", "invoiced", "exempt"] as const;
export type KycBillingMode = typeof KYC_BILLING_MODES[number];

export const insertKycBillingAccountSchema = createInsertSchema(kycBillingAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export type KycBillingAccount = typeof kycBillingAccounts.$inferSelect;
export type InsertKycBillingAccount = z.infer<typeof insertKycBillingAccountSchema>;

// ============== KYC BILLING REQUESTS (Contact Us for invoiced billing) ==============
export const kycBillingRequests = pgTable("kyc_billing_requests", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull(),
  requestedBy: varchar("requested_by").notNull(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  companyEmail: varchar("company_email", { length: 255 }).notNull(),
  estimatedMonthlyVolume: varchar("estimated_monthly_volume", { length: 100 }),
  message: text("message"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  adminNotes: text("admin_notes"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kyc_br_org").on(table.organisationId),
  index("idx_kyc_br_status").on(table.status),
]);

export const insertKycBillingRequestSchema = createInsertSchema(kycBillingRequests).omit({ id: true, createdAt: true });
export type KycBillingRequest = typeof kycBillingRequests.$inferSelect;
export type InsertKycBillingRequest = z.infer<typeof insertKycBillingRequestSchema>;

// ============== KYC CREDIT TRANSACTIONS ==============
export const kycCreditTransactions = pgTable("kyc_credit_transactions", {
  id: serial("id").primaryKey(),
  billingAccountId: integer("billing_account_id").notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  verificationType: varchar("verification_type", { length: 20 }),
  amount: integer("amount").notNull(),
  balance: integer("balance").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  verificationRequestId: integer("verification_request_id"),
  paystackReference: varchar("paystack_reference", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kyc_ct_ba").on(table.billingAccountId),
  index("idx_kyc_ct_type").on(table.type),
  index("idx_kyc_ct_created").on(table.createdAt),
]);

export const insertKycCreditTransactionSchema = createInsertSchema(kycCreditTransactions).omit({ id: true, createdAt: true });
export type KycCreditTransaction = typeof kycCreditTransactions.$inferSelect;
export type InsertKycCreditTransaction = z.infer<typeof insertKycCreditTransactionSchema>;

// ============== KYC INVOICES ==============
export const kycInvoices = pgTable("kyc_invoices", {
  id: serial("id").primaryKey(),
  billingAccountId: integer("billing_account_id").notNull(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  lineItems: jsonb("line_items").default([]).notNull(),
  subtotal: integer("subtotal").default(0).notNull(),
  total: integer("total").default(0).notNull(),
  currency: varchar("currency", { length: 10 }).default("NGN").notNull(),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  paystackReference: varchar("paystack_reference", { length: 128 }),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kyc_inv_ba").on(table.billingAccountId),
  index("idx_kyc_inv_status").on(table.status),
]);

export const insertKycInvoiceSchema = createInsertSchema(kycInvoices).omit({ id: true, createdAt: true });
export type KycInvoice = typeof kycInvoices.$inferSelect;
export type InsertKycInvoice = z.infer<typeof insertKycInvoiceSchema>;

// ============== VERIFIED ENTITIES REGISTRY ==============
export const verifiedEntities = pgTable("verified_entities", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 20 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  bvnHash: varchar("bvn_hash", { length: 128 }),
  ninHash: varchar("nin_hash", { length: 128 }),
  rcNumber: varchar("rc_number", { length: 50 }),
  tinNumber: varchar("tin_number", { length: 50 }),
  country: varchar("country", { length: 10 }).default("NG").notNull(),
  verificationCount: integer("verification_count").default(1).notNull(),
  lastVerifiedAt: timestamp("last_verified_at").notNull(),
  lastVerifiedByOrgId: integer("last_verified_by_org_id"),
  lastVerificationRequestId: integer("last_verification_request_id"),
  riskScore: varchar("risk_score", { length: 10 }),
  amlScreeningStatus: varchar("aml_screening_status", { length: 20 }),
  firstVerifiedAt: timestamp("first_verified_at").notNull(),
  dateOfBirth: varchar("date_of_birth", { length: 20 }),
  governmentPhotoPath: varchar("government_photo_path", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ve_bvn_hash").on(table.bvnHash),
  index("idx_ve_nin_hash").on(table.ninHash),
  index("idx_ve_rc_number").on(table.rcNumber),
  index("idx_ve_email").on(table.email),
  index("idx_ve_entity_type").on(table.entityType),
  index("idx_ve_country").on(table.country),
]);

export const insertVerifiedEntitySchema = createInsertSchema(verifiedEntities).omit({ id: true, createdAt: true, updatedAt: true });
export type VerifiedEntity = typeof verifiedEntities.$inferSelect;
export type InsertVerifiedEntity = z.infer<typeof insertVerifiedEntitySchema>;

// ============== KYC VERIFIED IDENTITY PROFILE STORE ==============
export const kycVerifiedIdentityData = pgTable("kyc_verified_identity_data", {
  id: serial("id").primaryKey(),
  verificationRequestId: integer("verification_request_id").notNull().references(() => kycVerificationRequests.id),
  orgId: integer("org_id").notNull().references(() => kycOrganisations.id),
  fullName: varchar("full_name", { length: 255 }),
  dateOfBirth: varchar("date_of_birth", { length: 20 }),
  phone: varchar("phone", { length: 30 }),
  gender: varchar("gender", { length: 20 }),
  address: text("address"),
  idTypesVerified: jsonb("id_types_verified"),
  dataSource: varchar("data_source", { length: 50 }).notNull().default("document_review"),
  governmentPhotoPath: varchar("government_photo_path", { length: 500 }),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_kvid_request_unique").on(table.verificationRequestId),
  index("idx_kvid_org").on(table.orgId),
]);

export const insertKycVerifiedIdentityDataSchema = createInsertSchema(kycVerifiedIdentityData).omit({ id: true, createdAt: true });
export type KycVerifiedIdentityData = typeof kycVerifiedIdentityData.$inferSelect;
export type InsertKycVerifiedIdentityData = z.infer<typeof insertKycVerifiedIdentityDataSchema>;

// ============== SECURITY: LOGIN ATTEMPTS (persistent account lockout) ==============
export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockoutUntil: timestamp("lockout_until"),
  lastAttempt: timestamp("last_attempt").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_login_attempts_identifier").on(table.identifier),
]);

export type LoginAttempt = typeof loginAttempts.$inferSelect;

// ============== SECURITY: SECURITY EVENTS ==============
export const securityEvents = pgTable("security_events", {
  id: serial("id").primaryKey(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  ipAddress: varchar("ip_address", { length: 100 }),
  userId: varchar("user_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_security_events_type").on(table.eventType),
  index("idx_security_events_severity").on(table.severity),
  index("idx_security_events_created").on(table.createdAt),
]);

export type SecurityEvent = typeof securityEvents.$inferSelect;
export type InsertSecurityEvent = typeof securityEvents.$inferInsert;

// ============== SECURITY: USER LOGIN HISTORY ==============
export const userLoginHistory = pgTable("user_login_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  ipAddress: varchar("ip_address", { length: 100 }),
  userAgent: text("user_agent"),
  loginAt: timestamp("login_at").notNull().defaultNow(),
  isNewIp: boolean("is_new_ip").notNull().default(false),
}, (table) => [
  index("idx_login_history_user").on(table.userId),
  index("idx_login_history_ip").on(table.ipAddress),
]);

export type UserLoginHistoryEntry = typeof userLoginHistory.$inferSelect;

// ============== PROCUREMENT SYSTEM ==============

export const rfqCategories = pgTable("rfq_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRfqCategorySchema = createInsertSchema(rfqCategories).omit({ id: true, createdAt: true });
export type RfqCategory = typeof rfqCategories.$inferSelect;
export type InsertRfqCategory = z.infer<typeof insertRfqCategorySchema>;

export const rfqs = pgTable("rfqs", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  buyerOrgId: integer("buyer_org_id").notNull(),
  createdByUserId: varchar("created_by_user_id").notNull(),
  categoryId: integer("category_id"),
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  deadline: timestamp("deadline").notNull(),
  deliveryDeadline: timestamp("delivery_deadline"),
  visibility: varchar("visibility", { length: 20 }).notNull().default("open"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  requirements: text("requirements"),
  qualifications: text("qualifications"),
  attachments: jsonb("attachments"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_rfqs_buyer_org").on(table.buyerOrgId),
  index("idx_rfqs_status").on(table.status),
  index("idx_rfqs_category").on(table.categoryId),
]);

export const insertRfqSchema = createInsertSchema(rfqs).omit({ id: true, createdAt: true, updatedAt: true });
export type Rfq = typeof rfqs.$inferSelect;
export type InsertRfq = z.infer<typeof insertRfqSchema>;

export const rfqInvitations = pgTable("rfq_invitations", {
  id: serial("id").primaryKey(),
  rfqId: integer("rfq_id").notNull(),
  supplierOrgId: integer("supplier_org_id").notNull(),
  invitedAt: timestamp("invited_at").defaultNow(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
});

export const insertRfqInvitationSchema = createInsertSchema(rfqInvitations).omit({ id: true, invitedAt: true });
export type RfqInvitation = typeof rfqInvitations.$inferSelect;
export type InsertRfqInvitation = z.infer<typeof insertRfqInvitationSchema>;

export const rfqItems = pgTable("rfq_items", {
  id: serial("id").primaryKey(),
  rfqId: integer("rfq_id").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  unit: varchar("unit", { length: 50 }).notNull().default("units"),
  specifications: text("specifications"),
});

export const insertRfqItemSchema = createInsertSchema(rfqItems).omit({ id: true });
export type RfqItem = typeof rfqItems.$inferSelect;
export type InsertRfqItem = z.infer<typeof insertRfqItemSchema>;

export const bidTemplates = pgTable("bid_templates", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  categoryId: integer("category_id"),
  coverLetterTemplate: text("cover_letter_template"),
  termsTemplate: text("terms_template"),
  defaultItems: jsonb("default_items"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBidTemplateSchema = createInsertSchema(bidTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type BidTemplate = typeof bidTemplates.$inferSelect;
export type InsertBidTemplate = z.infer<typeof insertBidTemplateSchema>;

export const bids = pgTable("bids", {
  id: serial("id").primaryKey(),
  rfqId: integer("rfq_id").notNull(),
  supplierOrgId: integer("supplier_org_id").notNull(),
  submittedByUserId: varchar("submitted_by_user_id").notNull(),
  totalAmount: integer("total_amount").notNull().default(0),
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  deliveryTimeline: varchar("delivery_timeline", { length: 255 }),
  validUntil: timestamp("valid_until"),
  coverLetter: text("cover_letter"),
  terms: text("terms"),
  attachments: jsonb("attachments"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  templateId: integer("template_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_bids_rfq").on(table.rfqId),
  index("idx_bids_supplier_org").on(table.supplierOrgId),
  index("idx_bids_status").on(table.status),
]);

export const insertBidSchema = createInsertSchema(bids).omit({ id: true, createdAt: true, updatedAt: true });
export type Bid = typeof bids.$inferSelect;
export type InsertBid = z.infer<typeof insertBidSchema>;

export const bidItems = pgTable("bid_items", {
  id: serial("id").primaryKey(),
  bidId: integer("bid_id").notNull(),
  rfqItemId: integer("rfq_item_id").notNull(),
  unitPrice: integer("unit_price").notNull().default(0),
  quantity: integer("quantity").notNull().default(1),
  subtotal: integer("subtotal").notNull().default(0),
  notes: text("notes"),
});

export const insertBidItemSchema = createInsertSchema(bidItems).omit({ id: true });
export type BidItem = typeof bidItems.$inferSelect;
export type InsertBidItem = z.infer<typeof insertBidItemSchema>;

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  rfqId: integer("rfq_id").notNull(),
  bidId: integer("bid_id").notNull(),
  buyerOrgId: integer("buyer_org_id").notNull(),
  supplierOrgId: integer("supplier_org_id").notNull(),
  contractNumber: varchar("contract_number", { length: 50 }).notNull().unique(),
  totalAmount: integer("total_amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  status: varchar("status", { length: 20 }).notNull().default("awarded"),
  terms: text("terms"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  awardedByUserId: varchar("awarded_by_user_id").notNull(),
  awardedAt: timestamp("awarded_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  attachments: jsonb("attachments"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_contracts_buyer_org").on(table.buyerOrgId),
  index("idx_contracts_supplier_org").on(table.supplierOrgId),
  index("idx_contracts_status").on(table.status),
]);

export const insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true, updatedAt: true });
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;

export const contractMilestones = pgTable("contract_milestones", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  amount: integer("amount").notNull().default(0),
  dueDate: timestamp("due_date"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  evidence: jsonb("evidence"),
  sortOrder: integer("sort_order").notNull().default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_milestones_contract").on(table.contractId),
]);

export const insertContractMilestoneSchema = createInsertSchema(contractMilestones).omit({ id: true, createdAt: true });
export type ContractMilestone = typeof contractMilestones.$inferSelect;
export type InsertContractMilestone = z.infer<typeof insertContractMilestoneSchema>;

// ============== BANKING PARTNERS ==============
// Escrow custody partners. Only one may be isActive at a time.
// feeRateBps = basis points carved from Cellion's 1.5% service fee (e.g. 50 = 0.50%).
// Max: 150 bps (1.50%), matching Cellion's service fee ceiling.
// The buyer-facing total is never changed — this is internal revenue accounting.
export const bankPartners = pgTable("bank_partners", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }),
  feeRateBps: integer("fee_rate_bps").notNull().default(0), // basis points, e.g. 50 = 0.50%
  isActive: boolean("is_active").notNull().default(false),
  notes: text("notes"),
  activatedAt: timestamp("activated_at"),
  deactivatedAt: timestamp("deactivated_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBankPartnerSchema = createInsertSchema(bankPartners).omit({ id: true, createdAt: true });
export type BankPartner = typeof bankPartners.$inferSelect;
export type InsertBankPartner = z.infer<typeof insertBankPartnerSchema>;

export const escrowTransactions = pgTable("escrow_transactions", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull(),
  milestoneId: integer("milestone_id"),
  amount: integer("amount").notNull(),       // principal in kobo
  serviceFee: integer("service_fee"),        // Cellion 1.5% fee in kobo (min 150000, max 5000000)
  bankCustodyFee: integer("bank_custody_fee").default(0), // bank partner's carved-out share from serviceFee (clamped ≤ serviceFee)
  bankPartnerId: integer("bank_partner_id").references(() => bankPartners.id), // FK to bankPartners (nullable)
  totalCharged: integer("total_charged"),   // amount + serviceFee — what buyer actually pays
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  // pending | funded | released | disputed | refunded
  buyerOrgId: integer("buyer_org_id").notNull(),
  supplierOrgId: integer("supplier_org_id").notNull(),
  paystackReference: varchar("paystack_reference", { length: 255 }),
  paystackPaymentUrl: varchar("paystack_payment_url", { length: 512 }),
  paymentReference: varchar("payment_reference", { length: 255 }),
  fundedAt: timestamp("funded_at"),
  releasedAt: timestamp("released_at"),
  disputedAt: timestamp("disputed_at"),
  disputeReason: text("dispute_reason"),
  refundedAt: timestamp("refunded_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_escrow_contract").on(table.contractId),
]);

export const insertEscrowTransactionSchema = createInsertSchema(escrowTransactions).omit({ id: true, createdAt: true, updatedAt: true });
export type EscrowTransaction = typeof escrowTransactions.$inferSelect;
export type InsertEscrowTransaction = z.infer<typeof insertEscrowTransactionSchema>;

// Escrow-as-a-Service: third-party API escrow transactions
export const escrowApiTransactions = pgTable("escrow_api_transactions", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  reference: varchar("reference", { length: 40 }).notNull().unique(),
  // CO-ESC-YYYY-XXXXXXXX
  description: text("description").notNull(),
  amount: integer("amount").notNull(),       // principal in kobo
  serviceFee: integer("service_fee"),        // Cellion 1.5% fee in kobo (min 150000, max 5000000)
  bankCustodyFee: integer("bank_custody_fee").default(0), // bank partner's carved-out share from serviceFee (clamped ≤ serviceFee)
  bankPartnerId: integer("bank_partner_id").references(() => bankPartners.id), // FK to bankPartners (nullable)
  totalCharged: integer("total_charged"),   // amount + serviceFee — what buyer actually pays
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  status: varchar("status", { length: 30 }).notNull().default("pending_payment"),
  // pending_payment | funded | released | disputed | refunded | expired
  buyerName: varchar("buyer_name", { length: 255 }).notNull(),
  buyerEmail: varchar("buyer_email", { length: 255 }).notNull(),
  beneficiaryName: varchar("beneficiary_name", { length: 255 }).notNull(),
  beneficiaryEmail: varchar("beneficiary_email", { length: 255 }).notNull(),
  paystackReference: varchar("paystack_reference", { length: 255 }),
  paystackPaymentUrl: varchar("paystack_payment_url", { length: 512 }),
  releaseConditions: text("release_conditions"),
  releasedTo: varchar("released_to", { length: 255 }),
  disputeReason: text("dispute_reason"),
  disputedAt: timestamp("disputed_at"),
  fundedAt: timestamp("funded_at"),
  releasedAt: timestamp("released_at"),
  refundedAt: timestamp("refunded_at"),
  expiresAt: timestamp("expires_at"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_escrow_api_org").on(table.orgId),
  index("idx_escrow_api_ref").on(table.reference),
  index("idx_escrow_api_status").on(table.status),
]);

export const insertEscrowApiTransactionSchema = createInsertSchema(escrowApiTransactions).omit({ id: true, createdAt: true, updatedAt: true });
export type EscrowApiTransaction = typeof escrowApiTransactions.$inferSelect;
export type InsertEscrowApiTransaction = z.infer<typeof insertEscrowApiTransactionSchema>;

export const procurementInvoices = pgTable("procurement_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  contractId: integer("contract_id").notNull(),
  milestoneId: integer("milestone_id"),
  supplierOrgId: integer("supplier_org_id").notNull(),
  buyerOrgId: integer("buyer_org_id").notNull(),
  issuedByUserId: varchar("issued_by_user_id").notNull(),
  subtotal: integer("subtotal").notNull().default(0),
  taxAmount: integer("tax_amount").notNull().default(0),
  totalAmount: integer("total_amount").notNull().default(0),
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  paymentTerms: varchar("payment_terms", { length: 100 }),
  bankDetails: text("bank_details"),
  notes: text("notes"),
  taxLabel: varchar("tax_label", { length: 50 }).notNull().default("VAT"),
  dueDate: timestamp("due_date"),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_proc_invoices_contract").on(table.contractId),
  index("idx_proc_invoices_supplier").on(table.supplierOrgId),
  index("idx_proc_invoices_buyer").on(table.buyerOrgId),
  index("idx_proc_invoices_status").on(table.status),
]);

export const insertProcurementInvoiceSchema = createInsertSchema(procurementInvoices).omit({ id: true, createdAt: true, updatedAt: true });
export type ProcurementInvoice = typeof procurementInvoices.$inferSelect;
export type InsertProcurementInvoice = z.infer<typeof insertProcurementInvoiceSchema>;

export const procurementInvoiceItems = pgTable("procurement_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull().default(0),
  subtotal: integer("subtotal").notNull().default(0),
  unit: varchar("unit", { length: 50 }),
});

export const insertProcurementInvoiceItemSchema = createInsertSchema(procurementInvoiceItems).omit({ id: true });
export type ProcurementInvoiceItem = typeof procurementInvoiceItems.$inferSelect;
export type InsertProcurementInvoiceItem = z.infer<typeof insertProcurementInvoiceItemSchema>;

// ============== SETTINGS SCHEMAS ==============
export const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .refine((p) => /[A-Z]/.test(p), "Must contain uppercase letter")
    .refine((p) => /[a-z]/.test(p), "Must contain lowercase letter")
    .refine((p) => /[0-9]/.test(p), "Must contain a number")
    .refine((p) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/.test(p), "Must contain special character"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ============== KYC HOSTED SESSIONS ==============
export const kycSessions = pgTable("kyc_sessions", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  sessionToken: varchar("session_token", { length: 128 }).notNull().unique(),
  type: varchar("type", { length: 20 }).notNull(), // individual, supplier
  subjectEmail: varchar("subject_email", { length: 255 }).notNull(),
  subjectName: varchar("subject_name", { length: 255 }).notNull(),
  returnUrl: varchar("return_url", { length: 1000 }),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, in_progress, completed, expired
  verificationRequestId: integer("verification_request_id"),
  metadata: jsonb("metadata"),
  prefillData: jsonb("prefill_data").$type<{
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    idNumber?: string;
    documentType?: string;
    idDocumentUrl?: string;
  }>(),
  requiredSteps: text("required_steps").array(),
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kyc_sess_org").on(table.orgId),
  index("idx_kyc_sess_token").on(table.sessionToken),
  index("idx_kyc_sess_status").on(table.status),
]);

export const insertKycSessionSchema = createInsertSchema(kycSessions).omit({ id: true, createdAt: true, updatedAt: true });
export type KycSession = typeof kycSessions.$inferSelect;
export type InsertKycSession = z.infer<typeof insertKycSessionSchema>;

// ============== KYC SANCTIONS MONITORING ==============
export const kycSanctionsLogs = pgTable("kyc_sanctions_logs", {
  id: serial("id").primaryKey(),
  verificationRequestId: integer("verification_request_id").notNull(),
  orgId: integer("org_id").notNull(),
  subjectName: varchar("subject_name", { length: 255 }).notNull(),
  previousRiskScore: varchar("previous_risk_score", { length: 10 }),
  newRiskScore: varchar("new_risk_score", { length: 10 }),
  screeningResult: varchar("screening_result", { length: 30 }).notNull(), // clear, alert, error
  matchDetails: jsonb("match_details"),
  alertSentAt: timestamp("alert_sent_at"),
  // Hit review fields
  reviewStatus: varchar("review_status", { length: 20 }).default("open"), // open, cleared, escalated
  reviewNote: text("review_note"),
  reviewedByUserId: integer("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kyc_sl_vr").on(table.verificationRequestId),
  index("idx_kyc_sl_org").on(table.orgId),
  index("idx_kyc_sl_created").on(table.createdAt),
  index("idx_kyc_sl_review_status").on(table.reviewStatus),
]);

export const insertKycSanctionsLogSchema = createInsertSchema(kycSanctionsLogs).omit({ id: true, createdAt: true });
export type KycSanctionsLog = typeof kycSanctionsLogs.$inferSelect;
export type InsertKycSanctionsLog = z.infer<typeof insertKycSanctionsLogSchema>;

// ============== KYC STR REPORTS ==============
export const kycStrReports = pgTable("kyc_str_reports", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => kycOrganisations.id),
  verificationRequestId: integer("verification_request_id").references(() => kycVerificationRequests.id),
  subjectName: varchar("subject_name", { length: 255 }).notNull(),
  subjectCertificateRef: varchar("subject_certificate_ref", { length: 50 }),
  status: varchar("status", { length: 30 }).notNull().default("draft"), // draft, internally_reviewed, filed
  suspiciousActivityDescription: text("suspicious_activity_description").notNull(),
  transactionAmountKobo: integer("transaction_amount_kobo"),
  activityDateFrom: varchar("activity_date_from", { length: 20 }),
  activityDateTo: varchar("activity_date_to", { length: 20 }),
  reporterName: varchar("reporter_name", { length: 255 }).notNull(),
  reporterRole: varchar("reporter_role", { length: 100 }).notNull(),
  notes: text("notes"),
  nfiuReference: varchar("nfiu_reference", { length: 100 }),
  createdByUserId: integer("created_by_user_id").notNull(),
  reviewedByUserId: integer("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at"),
  filedAt: timestamp("filed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kyc_str_org").on(table.orgId),
  index("idx_kyc_str_status").on(table.status),
  index("idx_kyc_str_vr").on(table.verificationRequestId),
  index("idx_kyc_str_created").on(table.createdAt),
]);

export const insertKycStrReportSchema = createInsertSchema(kycStrReports).omit({ id: true, createdAt: true, updatedAt: true });
export type KycStrReport = typeof kycStrReports.$inferSelect;
export type InsertKycStrReport = z.infer<typeof insertKycStrReportSchema>;

// ============================================================
// CIE — CELLION INTELLIGENCE ENGINE (NGX Equity Intelligence)
// ============================================================

// ============== CIE SECURITIES ==============
export const cieSecurities = pgTable("cie_securities", {
  id: serial("id").primaryKey(),
  symbol: varchar("symbol", { length: 20 }).notNull().unique(), // e.g. GTCO, DANGCEM
  name: varchar("name", { length: 255 }).notNull(),
  sector: varchar("sector", { length: 100 }).notNull(),
  exchange: varchar("exchange", { length: 50 }).default("NGX"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_cie_sec_symbol").on(table.symbol),
  index("idx_cie_sec_sector").on(table.sector),
  index("idx_cie_sec_active").on(table.isActive),
]);

export const insertCieSecuritySchema = createInsertSchema(cieSecurities).omit({ id: true, createdAt: true, updatedAt: true });
export type CieSecurity = typeof cieSecurities.$inferSelect;
export type InsertCieSecurity = z.infer<typeof insertCieSecuritySchema>;

// ============== CIE PRICES (end-of-day OHLCV) ==============
// Prices stored as kobo (Naira × 100) for integer precision
export const ciePrices = pgTable("cie_prices", {
  id: serial("id").primaryKey(),
  securityId: integer("security_id").notNull().references(() => cieSecurities.id),
  tradeDate: varchar("trade_date", { length: 20 }).notNull(), // YYYY-MM-DD
  openKobo: integer("open_kobo"),
  highKobo: integer("high_kobo"),
  lowKobo: integer("low_kobo"),
  closeKobo: integer("close_kobo").notNull(),
  volume: integer("volume"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_cie_prices_sec_date").on(table.securityId, table.tradeDate),
  index("idx_cie_prices_date").on(table.tradeDate),
  uniqueIndex("cie_prices_sec_date_unique").on(table.securityId, table.tradeDate),
]);

export const insertCiePriceSchema = createInsertSchema(ciePrices).omit({ id: true, createdAt: true });
export type CiePrice = typeof ciePrices.$inferSelect;
export type InsertCiePrice = z.infer<typeof insertCiePriceSchema>;

// ============== CIE MODEL VERSIONS ==============
export const cieModelVersions = pgTable("cie_model_versions", {
  id: serial("id").primaryKey(),
  versionLabel: varchar("version_label", { length: 50 }).notNull(),
  weights: jsonb("weights").$type<{
    momentum: number;
    liquidity: number;
    valuation: number;
    quality: number;
    growth: number;
    financialStrength: number;
  }>().notNull(),
  status: varchar("status", { length: 20 }).default("draft").notNull(), // draft, pending, active
  notes: text("notes"),
  submittedByUserId: varchar("submitted_by_user_id"),
  reviewedByUserId: varchar("reviewed_by_user_id"),
  activatedAt: timestamp("activated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_cie_mv_status").on(table.status),
]);

export const insertCieModelVersionSchema = createInsertSchema(cieModelVersions).omit({ id: true, createdAt: true, updatedAt: true });
export type CieModelVersion = typeof cieModelVersions.$inferSelect;
export type InsertCieModelVersion = z.infer<typeof insertCieModelVersionSchema>;

// ============== CIE SCORES (nightly computed) ==============
export const cieScores = pgTable("cie_scores", {
  id: serial("id").primaryKey(),
  securityId: integer("security_id").notNull().references(() => cieSecurities.id),
  scoreDate: varchar("score_date", { length: 20 }).notNull(), // YYYY-MM-DD
  ias: integer("ias"), // Investment Attractiveness Score 0-100
  rs: integer("rs"),  // Risk Score 0-100
  cs: integer("cs"),  // Confidence Score 0-100
  recommendation: varchar("recommendation", { length: 30 }), // Strong Buy, Accumulate, Hold, Reduce, Sell
  pillarBreakdown: jsonb("pillar_breakdown").$type<{
    momentum: number;
    liquidity: number;
    valuation: number;
    quality: number;
    growth: number;
    financialStrength: number;
    rawMomentum?: number;
    rawLiquidity?: number;
  }>(),
  modelVersionId: integer("model_version_id").references(() => cieModelVersions.id),
  dataPointsUsed: integer("data_points_used"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_cie_scores_sec_date").on(table.securityId, table.scoreDate),
  index("idx_cie_scores_date").on(table.scoreDate),
  uniqueIndex("cie_scores_sec_date_unique").on(table.securityId, table.scoreDate),
]);

export const insertCieScoreSchema = createInsertSchema(cieScores).omit({ id: true, createdAt: true });
export type CieScore = typeof cieScores.$inferSelect;
export type InsertCieScore = z.infer<typeof insertCieScoreSchema>;

// ============== CIE DIVIDENDS ==============
export const cieDividends = pgTable("cie_dividends", {
  id: serial("id").primaryKey(),
  securityId: integer("security_id").notNull().references(() => cieSecurities.id),
  exDividendDate: varchar("ex_dividend_date", { length: 20 }).notNull(), // YYYY-MM-DD
  paymentDate: varchar("payment_date", { length: 20 }),
  amountPerShareKobo: integer("amount_per_share_kobo"), // dividend amount in kobo
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_cie_div_sec").on(table.securityId),
  index("idx_cie_div_exdate").on(table.exDividendDate),
]);

export const insertCieDividendSchema = createInsertSchema(cieDividends).omit({ id: true, createdAt: true });
export type CieDividend = typeof cieDividends.$inferSelect;
export type InsertCieDividend = z.infer<typeof insertCieDividendSchema>;

// ============== CIE SIGNALS (analyst intel) ==============
export const cieSignals = pgTable("cie_signals", {
  id: serial("id").primaryKey(),
  securityId: integer("security_id").references(() => cieSecurities.id), // null = market-wide signal
  type: varchar("type", { length: 30 }).notNull(), // rumour, news, trade_call, sector_rotation
  sentiment: varchar("sentiment", { length: 20 }), // bullish, bearish, neutral
  credibility: integer("credibility"), // 1-5 analyst credibility rating
  content: text("content").notNull(),
  analystUserId: varchar("analyst_user_id"),
  tags: text("tags").array(),
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_cie_sig_sec").on(table.securityId),
  index("idx_cie_sig_type").on(table.type),
  index("idx_cie_sig_published").on(table.isPublished),
]);

export const insertCieSignalSchema = createInsertSchema(cieSignals).omit({ id: true, createdAt: true });
export type CieSignal = typeof cieSignals.$inferSelect;
export type InsertCieSignal = z.infer<typeof insertCieSignalSchema>;

// ============== CIE MARKET PULSE ==============
export const cieMarketPulse = pgTable("cie_market_pulse", {
  id: serial("id").primaryKey(),
  asiIndex: integer("asi_index"), // ASI in integer form (×100 for 2 decimal places)
  brentCrudeUsdCents: integer("brent_crude_usd_cents"), // Brent crude in USD cents
  ngnPerUsd: integer("ngn_per_usd"), // Naira per USD ×100
  asiChange: integer("asi_change"), // daily change ×100 (basis points)
  source: varchar("source", { length: 50 }).default("manual"),
  commentary: text("commentary"), // AI-generated daily market commentary
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCieMarketPulseSchema = createInsertSchema(cieMarketPulse).omit({ id: true, createdAt: true });
export type CieMarketPulse = typeof cieMarketPulse.$inferSelect;
export type InsertCieMarketPulse = z.infer<typeof insertCieMarketPulseSchema>;

// ============== CIE INGESTION LOGS ==============
export const cieIngestionLogs = pgTable("cie_ingestion_logs", {
  id: serial("id").primaryKey(),
  uploadId: varchar("upload_id", { length: 36 }), // UUID for the preview session (links preview → confirm)
  format: varchar("format", { length: 20 }).notNull(), // csv, xlsx, pdf
  dataType: varchar("data_type", { length: 30 }).notNull(), // prices, dividends, signals, market_pulse
  filename: varchar("filename", { length: 255 }),
  rowsExtracted: integer("rows_extracted").default(0),
  rowsAccepted: integer("rows_accepted").default(0),
  rowsRejected: integer("rows_rejected").default(0),
  rowsFlagged: integer("rows_flagged").default(0),
  rowsAnalystApproved: integer("rows_analyst_approved").default(0),
  status: varchar("status", { length: 20 }).default("pending"), // pending, previewed, committed, failed
  errorSummary: text("error_summary"),
  uploadedByUserId: varchar("uploaded_by_user_id"),
  confirmedByUserId: varchar("confirmed_by_user_id"),
  triggeredRecomputation: boolean("triggered_recomputation").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  previewedAt: timestamp("previewed_at"),
  committedAt: timestamp("committed_at"),
}, (table) => [
  index("idx_cie_ingest_type").on(table.dataType),
  index("idx_cie_ingest_status").on(table.status),
  index("idx_cie_ingest_created").on(table.createdAt),
]);

export const insertCieIngestionLogSchema = createInsertSchema(cieIngestionLogs).omit({ id: true, createdAt: true });
export type CieIngestionLog = typeof cieIngestionLogs.$inferSelect;
export type InsertCieIngestionLog = z.infer<typeof insertCieIngestionLogSchema>;

// ============== CIE SUBSCRIPTIONS ==============
// Tracks Paystack recurring subscriptions for CIE tier access.
// userId is the Cellion user; orgId is optional (set when the subscriber is
// a KYC org, null for direct individual subscribers).
export const cieSubscriptions = pgTable("cie_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  orgId: integer("org_id").references(() => kycOrganisations.id),
  tier: varchar("tier", { length: 20 }).notNull().default("free"), // free | subscriber | pro
  // Status lifecycle:
  //   pending    — checkout initiated; awaiting charge.success webhook
  //   active     — subscription live; access granted while currentPeriodEnd > now
  //   past_due   — invoice.payment_failed; Paystack will retry; access continues briefly
  //   cancelled  — subscription.disable received; cancelAtPeriodEnd transitions via scheduler
  //   expired    — period ended without renewal; scheduler-driven
  //   failed     — charge.failed on initial checkout; user may re-initiate
  status: varchar("status", { length: 20 }).notNull().default("active"), // pending | active | past_due | cancelled | expired | failed
  paystackSubscriptionCode: varchar("paystack_subscription_code", { length: 100 }),
  paystackCustomerCode: varchar("paystack_customer_code", { length: 100 }),
  paystackAuthorizationCode: varchar("paystack_authorization_code", { length: 100 }),
  paystackPlanCode: varchar("paystack_plan_code", { length: 100 }),
  paystackEmail: varchar("paystack_email", { length: 255 }),
  paystackReference: varchar("paystack_reference", { length: 255 }),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelledAt: timestamp("cancelled_at"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_cie_sub_user").on(table.userId),
  index("idx_cie_sub_org").on(table.orgId),
  index("idx_cie_sub_status").on(table.status),
]);

export const insertCieSubscriptionSchema = createInsertSchema(cieSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type CieSubscription = typeof cieSubscriptions.$inferSelect;
export type InsertCieSubscription = z.infer<typeof insertCieSubscriptionSchema>;

// ============== CIE PARTNER PROGRAMME ==============
// Partners receive free API access under a revenue-share model.
// Their API tier is resolved from this table, bypassing cie_subscriptions.
export const ciePartners = pgTable("cie_partners", {
  id: serial("id").primaryKey(),
  orgName: varchar("org_name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  /** Cellion's revenue share percentage (e.g. 60 means Cellion keeps 60%) */
  cellionRevenueSharePct: integer("cellion_revenue_share_pct").notNull().default(60),
  /** CIE access tier granted to this partner */
  tier: varchar("tier", { length: 20 }).notNull().default("subscriber"), // subscriber | pro
  /** Partner programme status */
  status: varchar("status", { length: 20 }).notNull().default("active"), // active | inactive | suspended
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_cie_partners_status").on(table.status),
]);

export const insertCiePartnerSchema = createInsertSchema(ciePartners).omit({ id: true, createdAt: true, updatedAt: true });
export type CiePartner = typeof ciePartners.$inferSelect;
export type InsertCiePartner = z.infer<typeof insertCiePartnerSchema>;

