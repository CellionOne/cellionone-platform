import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, json, serial, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// ============== FOUNDER PROFILE ==============
export const founderProfiles = pgTable("founder_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  fullName: varchar("full_name", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  dateOfBirth: varchar("date_of_birth"),
  nationality: varchar("nationality", { length: 100 }),
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }).default("Nigeria"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFounderProfileSchema = createInsertSchema(founderProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type FounderProfile = typeof founderProfiles.$inferSelect;
export type InsertFounderProfile = z.infer<typeof insertFounderProfileSchema>;

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
  label: varchar("label", { length: 255 }).notNull(), // e.g., "Celion One Registered Office (Ikoyi)"
  line1: varchar("line_1", { length: 255 }).notNull(), // Private - only shown after payment
  line2: varchar("line_2", { length: 255 }),
  floorDetails: varchar("floor_details", { length: 255 }),
  city: varchar("city", { length: 100 }).notNull(), // Public
  state: varchar("state", { length: 100 }).notNull(), // Public
  country: varchar("country", { length: 100 }).default("Nigeria"), // Public
  isActive: boolean("is_active").default(true),
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
  applicationId: integer("application_id"), // Nullable - linked if purchased via wizard
  tier: varchar("tier", { length: 50 }).notNull(), // 'office_only' | 'office_plus_mail'
  serviceAddressId: integer("service_address_id").notNull(),
  status: varchar("status", { length: 50 }).default("selected"), // selected, pending_payment, active, expired, cancelled
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  paymentId: integer("payment_id"), // Nullable FK to Payment
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
  applicationId: integer("application_id").notNull(),
  founderId: varchar("founder_id").notNull(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  rcNumber: varchar("rc_number", { length: 100 }),
  companyType: varchar("company_type", { length: 100 }),
  incorporationDate: timestamp("incorporation_date"),
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
  serviceType: varchar("service_type", { length: 50 }).notNull(), // SCUML | TM | TIN
  status: varchar("status", { length: 50 }).default("queued"), // queued | assigned | in_progress | completed | cancelled
  assignedLawyerId: varchar("assigned_lawyer_id"),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_service_requests_founder").on(table.founderId),
  index("idx_service_requests_order").on(table.orderId),
  index("idx_service_requests_status").on(table.status),
  index("idx_service_requests_type").on(table.serviceType),
]);
