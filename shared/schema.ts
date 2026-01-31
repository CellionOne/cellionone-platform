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
  status: varchar("status", { length: 50 }).default("not_started"), // not_started, pending, verified, rejected
  method: varchar("method", { length: 50 }).default("manual"), // manual, automated
  selfieFileId: integer("selfie_file_id"),
  idDocFileId: integer("id_doc_file_id"),
  livenessScore: integer("liveness_score"),
  notes: text("notes"),
  verifiedAt: timestamp("verified_at"),
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
  status: varchar("status", { length: 50 }).default("draft"), // draft, submitted, under_review, clarification_requested, filed, pending_originals, courier_in_transit, completed, rejected
  companyName1: varchar("company_name_1", { length: 255 }),
  companyName2: varchar("company_name_2", { length: 255 }),
  companyName3: varchar("company_name_3", { length: 255 }),
  businessDescription: text("business_description"),
  legalAiActivitySuggestions: json("legal_ai_activity_suggestions").$type<any[]>(),
  selectedActivities: json("selected_activities").$type<string[]>(),
  companyType: varchar("company_type", { length: 100 }).default("LLC"), // LLC, PLC, etc.
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
  paystackReference: varchar("paystack_reference", { length: 255 }),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("idx_payments_application").on(table.applicationId)]);

export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

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
  action: varchar("action", { length: 100 }).notNull(), // login, logout, view_application, upload_document, download_document, change_status, request_clarification, admin_override
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
  message: text("message").notNull(),
  status: varchar("status", { length: 50 }).default("pending"), // pending, resolved
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
