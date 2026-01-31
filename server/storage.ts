import { db } from "./db";
import { eq, and, desc, sql, count, inArray, or } from "drizzle-orm";
import {
  users, type User,
  founderProfiles, type FounderProfile, type InsertFounderProfile,
  lawyerProfiles, type LawyerProfile, type InsertLawyerProfile,
  userRoles, type UserRole, type InsertUserRole,
  identityVerifications, type IdentityVerification, type InsertIdentityVerification,
  companyApplications, type CompanyApplication, type InsertCompanyApplication,
  applicationChecklistItems, type ApplicationChecklistItem, type InsertChecklistItem,
  documentFiles, type DocumentFile, type InsertDocumentFile,
  payments, type Payment, type InsertPayment,
  payoutLedger, type PayoutLedger, type InsertPayoutLedger,
  courierShipments, type CourierShipment, type InsertCourierShipment,
  consentGrants, type ConsentGrant, type InsertConsentGrant,
  auditLogs, type AuditLog, type InsertAuditLog,
  featureFlags, type FeatureFlag, type InsertFeatureFlag,
  offlineDrafts, type OfflineDraft, type InsertOfflineDraft,
  clarificationRequests, type ClarificationRequest, type InsertClarificationRequest,
  notifications, type Notification, type InsertNotification,
  verificationReceipts, type VerificationReceipt, type InsertVerificationReceipt,
  executionDeclarations, type ExecutionDeclaration, type InsertExecutionDeclaration,
  applicationAIEvents, type ApplicationAIEvent, type InsertApplicationAIEvent,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserRoles(userId: string): Promise<string[]>;
  addUserRole(data: InsertUserRole): Promise<UserRole>;
  removeUserRole(userId: string, role: string): Promise<void>;

  // Founder Profiles
  getFounderProfile(userId: string): Promise<FounderProfile | undefined>;
  upsertFounderProfile(data: InsertFounderProfile): Promise<FounderProfile>;

  // Lawyer Profiles
  getLawyerProfile(userId: string): Promise<LawyerProfile | undefined>;
  upsertLawyerProfile(data: InsertLawyerProfile): Promise<LawyerProfile>;
  getActiveLawyers(): Promise<LawyerProfile[]>;

  // Identity Verification
  getIdentityVerification(founderUserId: string): Promise<IdentityVerification | undefined>;
  upsertIdentityVerification(data: InsertIdentityVerification): Promise<IdentityVerification>;

  // Applications
  getApplication(id: number): Promise<CompanyApplication | undefined>;
  getApplicationsByFounder(founderUserId: string): Promise<CompanyApplication[]>;
  getApplicationsByLawyer(lawyerUserId: string): Promise<CompanyApplication[]>;
  getAllApplications(): Promise<CompanyApplication[]>;
  createApplication(data: InsertCompanyApplication): Promise<CompanyApplication>;
  updateApplication(id: number, data: Partial<InsertCompanyApplication>): Promise<CompanyApplication | undefined>;

  // Application Checklist
  getChecklistItems(applicationId: number): Promise<ApplicationChecklistItem[]>;
  createChecklistItem(data: InsertChecklistItem): Promise<ApplicationChecklistItem>;
  updateChecklistItem(id: number, data: Partial<InsertChecklistItem>): Promise<ApplicationChecklistItem | undefined>;

  // Documents
  getDocument(id: number): Promise<DocumentFile | undefined>;
  getDocumentsByUser(ownerUserId: string): Promise<DocumentFile[]>;
  getDocumentsByApplication(applicationId: number): Promise<DocumentFile[]>;
  createDocument(data: InsertDocumentFile): Promise<DocumentFile>;

  // Payments
  getPayment(id: number): Promise<Payment | undefined>;
  getPaymentByApplication(applicationId: number): Promise<Payment | undefined>;
  createPayment(data: InsertPayment): Promise<Payment>;
  updatePayment(id: number, data: Partial<InsertPayment>): Promise<Payment | undefined>;

  // Payouts
  getPayoutsByLawyer(lawyerUserId: string): Promise<PayoutLedger[]>;
  createPayout(data: InsertPayoutLedger): Promise<PayoutLedger>;

  // Clarification Requests
  getClarificationsByApplication(applicationId: number): Promise<ClarificationRequest[]>;
  createClarificationRequest(data: InsertClarificationRequest): Promise<ClarificationRequest>;
  updateClarificationRequest(id: number, data: Partial<InsertClarificationRequest>): Promise<ClarificationRequest | undefined>;

  // Audit Logs
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;

  // Feature Flags
  getFeatureFlags(): Promise<FeatureFlag[]>;
  getFeatureFlag(key: string): Promise<FeatureFlag | undefined>;
  upsertFeatureFlag(data: InsertFeatureFlag): Promise<FeatureFlag>;
  updateFeatureFlag(key: string, isEnabled: boolean): Promise<FeatureFlag | undefined>;

  // Notifications
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  createNotification(data: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number): Promise<void>;

  // Verification Receipts
  getReceipt(id: number): Promise<VerificationReceipt | undefined>;
  getReceiptByNumber(receiptNumber: string): Promise<VerificationReceipt | undefined>;
  getReceiptsByApplication(applicationId: number): Promise<VerificationReceipt[]>;
  getReceiptsByFounder(founderId: string): Promise<VerificationReceipt[]>;
  createReceipt(data: InsertVerificationReceipt): Promise<VerificationReceipt>;
  updateReceipt(id: number, data: Partial<InsertVerificationReceipt>): Promise<VerificationReceipt | undefined>;

  // Execution Declarations
  getExecutionDeclaration(id: number): Promise<ExecutionDeclaration | undefined>;
  getExecutionDeclarationsByApplication(applicationId: number): Promise<ExecutionDeclaration[]>;
  getExecutionDeclarationsByLawyer(lawyerId: string): Promise<ExecutionDeclaration[]>;
  createExecutionDeclaration(data: InsertExecutionDeclaration): Promise<ExecutionDeclaration>;

  // AI Events
  getAIEventsByApplication(applicationId: number): Promise<ApplicationAIEvent[]>;
  getAIEventsByFeature(feature: string, limit?: number): Promise<ApplicationAIEvent[]>;
  createAIEvent(data: InsertApplicationAIEvent): Promise<ApplicationAIEvent>;

  // Documents - extended
  updateDocument(id: number, data: Partial<InsertDocumentFile>): Promise<DocumentFile | undefined>;

  // Stats
  getFounderStats(founderUserId: string): Promise<{ total: number; draft: number; inProgress: number; completed: number }>;
  getLawyerStats(lawyerUserId: string): Promise<{ assigned: number; underReview: number; clarificationPending: number; completed: number }>;
  getAdminStats(): Promise<{ totalUsers: number; totalApplications: number; totalLawyers: number; activeApplications: number; completedApplications: number; pendingReview: number }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
    return roles.map(r => r.role);
  }

  async addUserRole(data: InsertUserRole): Promise<UserRole> {
    const [role] = await db.insert(userRoles).values(data).returning();
    return role;
  }

  async removeUserRole(userId: string, role: string): Promise<void> {
    await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
  }

  // Founder Profiles
  async getFounderProfile(userId: string): Promise<FounderProfile | undefined> {
    const [profile] = await db.select().from(founderProfiles).where(eq(founderProfiles.userId, userId));
    return profile;
  }

  async upsertFounderProfile(data: InsertFounderProfile): Promise<FounderProfile> {
    const [profile] = await db.insert(founderProfiles).values(data)
      .onConflictDoUpdate({ target: founderProfiles.userId, set: { ...data, updatedAt: new Date() } })
      .returning();
    return profile;
  }

  // Lawyer Profiles
  async getLawyerProfile(userId: string): Promise<LawyerProfile | undefined> {
    const [profile] = await db.select().from(lawyerProfiles).where(eq(lawyerProfiles.userId, userId));
    return profile;
  }

  async upsertLawyerProfile(data: InsertLawyerProfile): Promise<LawyerProfile> {
    const [profile] = await db.insert(lawyerProfiles).values(data)
      .onConflictDoUpdate({ target: lawyerProfiles.userId, set: { ...data, updatedAt: new Date() } })
      .returning();
    return profile;
  }

  async getActiveLawyers(): Promise<LawyerProfile[]> {
    return db.select().from(lawyerProfiles).where(eq(lawyerProfiles.isActive, true));
  }

  // Identity Verification
  async getIdentityVerification(founderUserId: string): Promise<IdentityVerification | undefined> {
    const [verification] = await db.select().from(identityVerifications)
      .where(eq(identityVerifications.founderUserId, founderUserId));
    return verification;
  }

  async upsertIdentityVerification(data: InsertIdentityVerification): Promise<IdentityVerification> {
    const existing = await this.getIdentityVerification(data.founderUserId);
    if (existing) {
      const [updated] = await db.update(identityVerifications)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(identityVerifications.founderUserId, data.founderUserId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(identityVerifications).values(data).returning();
    return created;
  }

  // Applications
  async getApplication(id: number): Promise<CompanyApplication | undefined> {
    const [app] = await db.select().from(companyApplications).where(eq(companyApplications.id, id));
    return app;
  }

  async getApplicationsByFounder(founderUserId: string): Promise<CompanyApplication[]> {
    return db.select().from(companyApplications)
      .where(eq(companyApplications.founderUserId, founderUserId))
      .orderBy(desc(companyApplications.createdAt));
  }

  async getApplicationsByLawyer(lawyerUserId: string): Promise<CompanyApplication[]> {
    return db.select().from(companyApplications)
      .where(eq(companyApplications.assignedLawyerUserId, lawyerUserId))
      .orderBy(desc(companyApplications.createdAt));
  }

  async getAllApplications(): Promise<CompanyApplication[]> {
    return db.select().from(companyApplications).orderBy(desc(companyApplications.createdAt));
  }

  async createApplication(data: InsertCompanyApplication): Promise<CompanyApplication> {
    const [app] = await db.insert(companyApplications).values(data).returning();
    return app;
  }

  async updateApplication(id: number, data: Partial<InsertCompanyApplication>): Promise<CompanyApplication | undefined> {
    const [app] = await db.update(companyApplications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companyApplications.id, id))
      .returning();
    return app;
  }

  // Application Checklist
  async getChecklistItems(applicationId: number): Promise<ApplicationChecklistItem[]> {
    return db.select().from(applicationChecklistItems)
      .where(eq(applicationChecklistItems.applicationId, applicationId));
  }

  async createChecklistItem(data: InsertChecklistItem): Promise<ApplicationChecklistItem> {
    const [item] = await db.insert(applicationChecklistItems).values(data).returning();
    return item;
  }

  async updateChecklistItem(id: number, data: Partial<InsertChecklistItem>): Promise<ApplicationChecklistItem | undefined> {
    const [item] = await db.update(applicationChecklistItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(applicationChecklistItems.id, id))
      .returning();
    return item;
  }

  // Documents
  async getDocument(id: number): Promise<DocumentFile | undefined> {
    const [doc] = await db.select().from(documentFiles).where(eq(documentFiles.id, id));
    return doc;
  }

  async getDocumentsByUser(ownerUserId: string): Promise<DocumentFile[]> {
    return db.select().from(documentFiles).where(eq(documentFiles.ownerUserId, ownerUserId));
  }

  async getDocumentsByApplication(applicationId: number): Promise<DocumentFile[]> {
    return db.select().from(documentFiles).where(eq(documentFiles.applicationId, applicationId));
  }

  async createDocument(data: InsertDocumentFile): Promise<DocumentFile> {
    const [doc] = await db.insert(documentFiles).values(data).returning();
    return doc;
  }

  // Payments
  async getPayment(id: number): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async getPaymentByApplication(applicationId: number): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.applicationId, applicationId));
    return payment;
  }

  async createPayment(data: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(data).returning();
    return payment;
  }

  async updatePayment(id: number, data: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [payment] = await db.update(payments).set(data).where(eq(payments.id, id)).returning();
    return payment;
  }

  // Payouts
  async getPayoutsByLawyer(lawyerUserId: string): Promise<PayoutLedger[]> {
    return db.select().from(payoutLedger)
      .where(eq(payoutLedger.lawyerUserId, lawyerUserId))
      .orderBy(desc(payoutLedger.createdAt));
  }

  async createPayout(data: InsertPayoutLedger): Promise<PayoutLedger> {
    const [payout] = await db.insert(payoutLedger).values(data).returning();
    return payout;
  }

  // Clarification Requests
  async getClarificationsByApplication(applicationId: number): Promise<ClarificationRequest[]> {
    return db.select().from(clarificationRequests)
      .where(eq(clarificationRequests.applicationId, applicationId))
      .orderBy(desc(clarificationRequests.createdAt));
  }

  async createClarificationRequest(data: InsertClarificationRequest): Promise<ClarificationRequest> {
    const [req] = await db.insert(clarificationRequests).values(data).returning();
    return req;
  }

  async updateClarificationRequest(id: number, data: Partial<InsertClarificationRequest>): Promise<ClarificationRequest | undefined> {
    const [req] = await db.update(clarificationRequests).set(data).where(eq(clarificationRequests.id, id)).returning();
    return req;
  }

  // Audit Logs
  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  }

  // Feature Flags
  async getFeatureFlags(): Promise<FeatureFlag[]> {
    return db.select().from(featureFlags);
  }

  async getFeatureFlag(key: string): Promise<FeatureFlag | undefined> {
    const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.key, key));
    return flag;
  }

  async upsertFeatureFlag(data: InsertFeatureFlag): Promise<FeatureFlag> {
    const [flag] = await db.insert(featureFlags).values(data)
      .onConflictDoUpdate({ target: featureFlags.key, set: { ...data, updatedAt: new Date() } })
      .returning();
    return flag;
  }

  async updateFeatureFlag(key: string, isEnabled: boolean): Promise<FeatureFlag | undefined> {
    const [flag] = await db.update(featureFlags)
      .set({ isEnabled, updatedAt: new Date() })
      .where(eq(featureFlags.key, key))
      .returning();
    return flag;
  }

  // Notifications
  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(data).returning();
    return notification;
  }

  async markNotificationRead(id: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  // Stats
  async getFounderStats(founderUserId: string): Promise<{ total: number; draft: number; inProgress: number; completed: number }> {
    const apps = await this.getApplicationsByFounder(founderUserId);
    return {
      total: apps.length,
      draft: apps.filter(a => a.status === "draft").length,
      inProgress: apps.filter(a => ["submitted", "under_review", "filed", "pending_originals", "courier_in_transit"].includes(a.status || "")).length,
      completed: apps.filter(a => a.status === "completed").length,
    };
  }

  async getLawyerStats(lawyerUserId: string): Promise<{ assigned: number; underReview: number; clarificationPending: number; completed: number }> {
    const apps = await this.getApplicationsByLawyer(lawyerUserId);
    return {
      assigned: apps.length,
      underReview: apps.filter(a => a.status === "under_review").length,
      clarificationPending: apps.filter(a => a.status === "clarification_requested").length,
      completed: apps.filter(a => a.status === "completed").length,
    };
  }

  async getAdminStats(): Promise<{ totalUsers: number; totalApplications: number; totalLawyers: number; activeApplications: number; completedApplications: number; pendingReview: number }> {
    const allUsers = await this.getAllUsers();
    const allApps = await this.getAllApplications();
    const allLawyers = await this.getActiveLawyers();
    
    return {
      totalUsers: allUsers.length,
      totalApplications: allApps.length,
      totalLawyers: allLawyers.length,
      activeApplications: allApps.filter(a => !["draft", "completed", "rejected"].includes(a.status || "")).length,
      completedApplications: allApps.filter(a => a.status === "completed").length,
      pendingReview: allApps.filter(a => a.status === "submitted").length,
    };
  }

  // Verification Receipts
  async getReceipt(id: number): Promise<VerificationReceipt | undefined> {
    const [receipt] = await db.select().from(verificationReceipts).where(eq(verificationReceipts.id, id));
    return receipt;
  }

  async getReceiptByNumber(receiptNumber: string): Promise<VerificationReceipt | undefined> {
    const [receipt] = await db.select().from(verificationReceipts).where(eq(verificationReceipts.receiptNumber, receiptNumber));
    return receipt;
  }

  async getReceiptsByApplication(applicationId: number): Promise<VerificationReceipt[]> {
    return db.select().from(verificationReceipts).where(eq(verificationReceipts.applicationId, applicationId));
  }

  async getReceiptsByFounder(founderId: string): Promise<VerificationReceipt[]> {
    return db.select().from(verificationReceipts).where(eq(verificationReceipts.founderId, founderId));
  }

  async createReceipt(data: InsertVerificationReceipt): Promise<VerificationReceipt> {
    const [receipt] = await db.insert(verificationReceipts).values(data).returning();
    return receipt;
  }

  async updateReceipt(id: number, data: Partial<InsertVerificationReceipt>): Promise<VerificationReceipt | undefined> {
    const [receipt] = await db.update(verificationReceipts).set(data).where(eq(verificationReceipts.id, id)).returning();
    return receipt;
  }

  // Execution Declarations
  async getExecutionDeclaration(id: number): Promise<ExecutionDeclaration | undefined> {
    const [declaration] = await db.select().from(executionDeclarations).where(eq(executionDeclarations.id, id));
    return declaration;
  }

  async getExecutionDeclarationsByApplication(applicationId: number): Promise<ExecutionDeclaration[]> {
    return db.select().from(executionDeclarations).where(eq(executionDeclarations.applicationId, applicationId));
  }

  async getExecutionDeclarationsByLawyer(lawyerId: string): Promise<ExecutionDeclaration[]> {
    return db.select().from(executionDeclarations).where(eq(executionDeclarations.lawyerId, lawyerId));
  }

  async createExecutionDeclaration(data: InsertExecutionDeclaration): Promise<ExecutionDeclaration> {
    const [declaration] = await db.insert(executionDeclarations).values(data).returning();
    return declaration;
  }

  // AI Events
  async getAIEventsByApplication(applicationId: number): Promise<ApplicationAIEvent[]> {
    return db.select().from(applicationAIEvents)
      .where(eq(applicationAIEvents.applicationId, applicationId))
      .orderBy(desc(applicationAIEvents.createdAt));
  }

  async getAIEventsByFeature(feature: string, limit = 100): Promise<ApplicationAIEvent[]> {
    return db.select().from(applicationAIEvents)
      .where(eq(applicationAIEvents.feature, feature))
      .orderBy(desc(applicationAIEvents.createdAt))
      .limit(limit);
  }

  async createAIEvent(data: InsertApplicationAIEvent): Promise<ApplicationAIEvent> {
    const [event] = await db.insert(applicationAIEvents).values(data).returning();
    return event;
  }

  // Documents - extended
  async updateDocument(id: number, data: Partial<InsertDocumentFile>): Promise<DocumentFile | undefined> {
    const [doc] = await db.update(documentFiles).set(data).where(eq(documentFiles.id, id)).returning();
    return doc;
  }
}

export const storage = new DatabaseStorage();
