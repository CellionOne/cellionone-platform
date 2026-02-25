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
  lawyerApplications, type LawyerApplication, type InsertLawyerApplication,
  serviceAddresses, type ServiceAddress,
  registeredOfficeSubscriptions, type RegisteredOfficeSubscription,
  mailHandlingPreferences, type MailHandlingPreference,
  mailItems, type MailItem,
  mailApprovalRequests, type MailApprovalRequest,
  paystackTransactions, type PaystackTransaction, type InsertPaystackTransaction,
  serviceRequestCompanyProfiles, type ServiceRequestCompanyProfile, type InsertServiceRequestCompanyProfile,
  serviceRequestDocuments, type ServiceRequestDocument, type InsertServiceRequestDocument,
  serviceRequests, type ServiceRequest, type InsertServiceRequest,
  notificationPreferences, type NotificationPreference,
  companyPeople, type CompanyPerson, type InsertCompanyPerson,
  sensitiveDataAccessLogs,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserRoles(userId: string): Promise<string[]>;
  addUserRole(userId: string, role: string): Promise<UserRole>;
  removeUserRole(userId: string, role: string): Promise<void>;
  createUserWithPassword(data: {
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    verificationToken: string;
    verificationTokenExpiry: Date;
    emailVerified: boolean;
  }): Promise<User>;
  markEmailVerified(userId: string): Promise<void>;
  updateVerificationToken(userId: string, token: string, expiry: Date): Promise<void>;
  updateResetToken(userId: string, token: string, expiry: Date): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  updateUser(userId: string, data: Partial<{
    firstName: string;
    lastName: string;
    passwordHash: string;
    verificationToken: string;
    verificationTokenExpiry: Date;
  }>): Promise<User>;

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
  markAllNotificationsRead(userId: string): Promise<void>;

  // Verification Receipts
  getReceipts(): Promise<VerificationReceipt[]>;
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

  // Offline Drafts
  createOfflineDraft(data: InsertOfflineDraft): Promise<OfflineDraft>;
  getOfflineDraftsByUser(userId: string): Promise<OfflineDraft[]>;

  // Documents - extended
  updateDocument(id: number, data: Partial<InsertDocumentFile>): Promise<DocumentFile | undefined>;

  // Stats
  getFounderStats(founderUserId: string): Promise<{ total: number; draft: number; inProgress: number; completed: number }>;
  getLawyerStats(lawyerUserId: string): Promise<{ assigned: number; underReview: number; clarificationPending: number; completed: number }>;
  getAdminStats(): Promise<{ totalUsers: number; totalApplications: number; totalLawyers: number; activeApplications: number; completedApplications: number; pendingReview: number }>;

  // Lawyer Applications (for onboarding)
  getLawyerApplication(id: number): Promise<LawyerApplication | undefined>;
  getLawyerApplicationByEmail(email: string): Promise<LawyerApplication | undefined>;
  getAllLawyerApplications(): Promise<LawyerApplication[]>;
  getPendingLawyerApplications(): Promise<LawyerApplication[]>;
  createLawyerApplication(data: InsertLawyerApplication): Promise<LawyerApplication>;
  updateLawyerApplication(id: number, data: Partial<LawyerApplication>): Promise<LawyerApplication | undefined>;

  // Paystack Transactions
  getPaystackTransaction(id: number): Promise<PaystackTransaction | undefined>;
  getPaystackTransactionByReference(reference: string): Promise<PaystackTransaction | undefined>;
  getPaystackTransactionsByUser(userId: string): Promise<PaystackTransaction[]>;
  createPaystackTransaction(data: InsertPaystackTransaction): Promise<PaystackTransaction>;
  updatePaystackTransaction(id: number, data: Partial<InsertPaystackTransaction>): Promise<PaystackTransaction | undefined>;

  // Service Request Company Profiles
  getServiceRequestCompanyProfile(id: number): Promise<ServiceRequestCompanyProfile | undefined>;
  getServiceRequestCompanyProfilesByFounder(founderId: string): Promise<ServiceRequestCompanyProfile[]>;
  createServiceRequestCompanyProfile(data: InsertServiceRequestCompanyProfile): Promise<ServiceRequestCompanyProfile>;
  updateServiceRequestCompanyProfile(id: number, data: Partial<InsertServiceRequestCompanyProfile>): Promise<ServiceRequestCompanyProfile | undefined>;

  // Service Request Documents
  getServiceRequestDocumentsByProfile(companyProfileId: number): Promise<ServiceRequestDocument[]>;
  getServiceRequestDocumentsByServiceRequest(serviceRequestId: number): Promise<ServiceRequestDocument[]>;
  createServiceRequestDocument(data: InsertServiceRequestDocument): Promise<ServiceRequestDocument>;
  deleteServiceRequestDocument(id: number): Promise<void>;

  // Service Requests
  getServiceRequest(id: number): Promise<ServiceRequest | undefined>;
  getServiceRequestsByFounder(founderId: string): Promise<ServiceRequest[]>;
  createServiceRequest(data: InsertServiceRequest): Promise<ServiceRequest>;
  updateServiceRequest(id: number, data: Partial<InsertServiceRequest>): Promise<ServiceRequest | undefined>;

  // Notification Preferences
  getNotificationPreferences(userId: string): Promise<NotificationPreference | undefined>;
  upsertNotificationPreferences(userId: string, data: Partial<{
    complianceReminders: boolean;
    serviceRequestUpdates: boolean;
    orderUpdates: boolean;
    incorporationUpdates: boolean;
    marketingEmails: boolean;
  }>): Promise<NotificationPreference>;

  // Company People (directors/shareholders)
  getCompanyPeople(applicationId: number): Promise<CompanyPerson[]>;
  getCompanyPeopleByFounder(founderId: string): Promise<CompanyPerson[]>;
  getCompanyPersonByInviteToken(token: string): Promise<CompanyPerson | undefined>;
  getCompanyPeopleByPersonUserId(personUserId: string): Promise<CompanyPerson[]>;
  createCompanyPerson(data: InsertCompanyPerson): Promise<CompanyPerson>;
  updateCompanyPerson(id: number, data: Partial<InsertCompanyPerson>): Promise<CompanyPerson | undefined>;
  deleteCompanyPerson(id: number): Promise<void>;

  // Sensitive Data Access Logging
  logSensitiveDataAccess(data: {
    accessorUserId: string;
    targetUserId: string;
    dataType: string;
    action: string;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;

  // 2FA
  updateUserTwoFactor(userId: string, data: Partial<{
    twoFactorEnabled: boolean;
    twoFactorMethod: string;
    twoFactorPhone: string;
    twoFactorSecret: string;
    twoFactorBackupCodes: string;
    lastTwoFactorAt: Date;
  }>): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.verificationToken, token));
    return user;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
    return roles.map(r => r.role);
  }

  async addUserRole(userId: string, role: string): Promise<UserRole> {
    const [newRole] = await db.insert(userRoles).values({ userId, role }).returning();
    return newRole;
  }

  async removeUserRole(userId: string, role: string): Promise<void> {
    await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
  }

  async createUserWithPassword(data: {
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    verificationToken: string;
    verificationTokenExpiry: Date;
    emailVerified: boolean;
  }): Promise<User> {
    const [user] = await db.insert(users).values({
      email: data.email.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash: data.passwordHash,
      verificationToken: data.verificationToken,
      verificationTokenExpiry: data.verificationTokenExpiry,
      emailVerified: data.emailVerified,
    }).returning();
    return user;
  }

  async markEmailVerified(userId: string): Promise<void> {
    await db.update(users).set({
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));
  }

  async updateVerificationToken(userId: string, token: string, expiry: Date): Promise<void> {
    await db.update(users).set({
      verificationToken: token,
      verificationTokenExpiry: expiry,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));
  }

  async updateResetToken(userId: string, token: string, expiry: Date): Promise<void> {
    await db.update(users).set({
      resetToken: token,
      resetTokenExpiry: expiry,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await db.update(users).set({
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));
  }

  async updateUser(userId: string, data: Partial<{
    firstName: string;
    lastName: string;
    passwordHash: string;
    verificationToken: string;
    verificationTokenExpiry: Date;
  }>): Promise<User> {
    const [user] = await db.update(users).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(users.id, userId)).returning();
    return user;
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

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
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
  async getReceipts(): Promise<VerificationReceipt[]> {
    return db.select().from(verificationReceipts).orderBy(desc(verificationReceipts.issuedAt));
  }

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

  // Offline Drafts
  async createOfflineDraft(data: InsertOfflineDraft): Promise<OfflineDraft> {
    const [draft] = await db.insert(offlineDrafts).values(data).returning();
    return draft;
  }

  async getOfflineDraftsByUser(userId: string): Promise<OfflineDraft[]> {
    return await db.select().from(offlineDrafts).where(eq(offlineDrafts.founderUserId, userId));
  }

  // Documents - extended
  async updateDocument(id: number, data: Partial<InsertDocumentFile>): Promise<DocumentFile | undefined> {
    const [doc] = await db.update(documentFiles).set(data).where(eq(documentFiles.id, id)).returning();
    return doc;
  }

  // Lawyer Applications (for onboarding)
  async getLawyerApplication(id: number): Promise<LawyerApplication | undefined> {
    const [app] = await db.select().from(lawyerApplications).where(eq(lawyerApplications.id, id));
    return app;
  }

  async getLawyerApplicationByEmail(email: string): Promise<LawyerApplication | undefined> {
    const [app] = await db.select().from(lawyerApplications).where(eq(lawyerApplications.email, email.toLowerCase()));
    return app;
  }

  async getAllLawyerApplications(): Promise<LawyerApplication[]> {
    return db.select().from(lawyerApplications).orderBy(desc(lawyerApplications.createdAt));
  }

  async getPendingLawyerApplications(): Promise<LawyerApplication[]> {
    return db.select().from(lawyerApplications)
      .where(eq(lawyerApplications.status, "pending"))
      .orderBy(desc(lawyerApplications.createdAt));
  }

  async createLawyerApplication(data: InsertLawyerApplication): Promise<LawyerApplication> {
    const [app] = await db.insert(lawyerApplications).values({
      ...data,
      email: data.email.toLowerCase(),
    }).returning();
    return app;
  }

  async updateLawyerApplication(id: number, data: Partial<LawyerApplication>): Promise<LawyerApplication | undefined> {
    const [app] = await db.update(lawyerApplications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(lawyerApplications.id, id))
      .returning();
    return app;
  }

  // Service Addresses
  async getServiceAddresses(): Promise<ServiceAddress[]> {
    return db.select().from(serviceAddresses).where(eq(serviceAddresses.isActive, true));
  }

  async getServiceAddressById(id: number): Promise<ServiceAddress | undefined> {
    const [address] = await db.select().from(serviceAddresses).where(eq(serviceAddresses.id, id));
    return address;
  }

  // Registered Office Subscriptions
  async createRegisteredOfficeSubscription(data: Omit<RegisteredOfficeSubscription, "id" | "createdAt" | "updatedAt">): Promise<RegisteredOfficeSubscription> {
    const [sub] = await db.insert(registeredOfficeSubscriptions).values(data).returning();
    return sub;
  }

  async getRegisteredOfficeSubscriptionById(id: number): Promise<RegisteredOfficeSubscription | undefined> {
    const [sub] = await db.select().from(registeredOfficeSubscriptions).where(eq(registeredOfficeSubscriptions.id, id));
    return sub;
  }

  async getUserActiveRegisteredOfficeSubscription(userId: string): Promise<RegisteredOfficeSubscription | undefined> {
    const [sub] = await db.select().from(registeredOfficeSubscriptions)
      .where(and(
        eq(registeredOfficeSubscriptions.founderId, userId),
        eq(registeredOfficeSubscriptions.status, "active")
      ));
    return sub;
  }

  async getUserRegisteredOfficeSubscriptions(userId: string): Promise<RegisteredOfficeSubscription[]> {
    return db.select().from(registeredOfficeSubscriptions)
      .where(eq(registeredOfficeSubscriptions.founderId, userId))
      .orderBy(desc(registeredOfficeSubscriptions.createdAt));
  }

  async getApplicationRegisteredOfficeSubscription(applicationId: number): Promise<RegisteredOfficeSubscription | undefined> {
    const [sub] = await db.select().from(registeredOfficeSubscriptions)
      .where(eq(registeredOfficeSubscriptions.applicationId, applicationId));
    return sub;
  }

  async updateRegisteredOfficeSubscription(id: number, data: Partial<RegisteredOfficeSubscription>): Promise<RegisteredOfficeSubscription | undefined> {
    const [sub] = await db.update(registeredOfficeSubscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(registeredOfficeSubscriptions.id, id))
      .returning();
    return sub;
  }

  async getAllRegisteredOfficeSubscriptions(): Promise<RegisteredOfficeSubscription[]> {
    return db.select().from(registeredOfficeSubscriptions).orderBy(desc(registeredOfficeSubscriptions.createdAt));
  }

  async getActiveMailSubscriptions(): Promise<RegisteredOfficeSubscription[]> {
    return db.select().from(registeredOfficeSubscriptions)
      .where(and(
        eq(registeredOfficeSubscriptions.status, "active"),
        eq(registeredOfficeSubscriptions.tier, "office_plus_mail")
      ));
  }

  // Mail Handling Preferences
  async createMailHandlingPreference(data: Omit<MailHandlingPreference, "id" | "createdAt" | "updatedAt">): Promise<MailHandlingPreference> {
    const [pref] = await db.insert(mailHandlingPreferences).values(data).returning();
    return pref;
  }

  async getMailHandlingPreference(subscriptionId: number): Promise<MailHandlingPreference | undefined> {
    const [pref] = await db.select().from(mailHandlingPreferences)
      .where(eq(mailHandlingPreferences.subscriptionId, subscriptionId));
    return pref;
  }

  async updateMailHandlingPreference(id: number, data: Partial<MailHandlingPreference>): Promise<MailHandlingPreference | undefined> {
    const [pref] = await db.update(mailHandlingPreferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(mailHandlingPreferences.id, id))
      .returning();
    return pref;
  }

  // Mail Items
  async createMailItem(data: Omit<MailItem, "id" | "createdAt" | "updatedAt">): Promise<MailItem> {
    const [item] = await db.insert(mailItems).values(data).returning();
    return item;
  }

  async getMailItemById(id: number): Promise<MailItem | undefined> {
    const [item] = await db.select().from(mailItems).where(eq(mailItems.id, id));
    return item;
  }

  async getMailItemsBySubscription(subscriptionId: number): Promise<MailItem[]> {
    return db.select().from(mailItems)
      .where(eq(mailItems.subscriptionId, subscriptionId))
      .orderBy(desc(mailItems.receivedAt));
  }

  async getMailItemsByStatus(status: string): Promise<MailItem[]> {
    return db.select().from(mailItems).where(eq(mailItems.status, status));
  }

  async getAllMailItems(): Promise<MailItem[]> {
    return db.select().from(mailItems).orderBy(desc(mailItems.receivedAt));
  }

  async updateMailItem(id: number, data: Partial<MailItem>): Promise<MailItem | undefined> {
    const [item] = await db.update(mailItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(mailItems.id, id))
      .returning();
    return item;
  }

  // Mail Approval Requests
  async createMailApprovalRequest(data: Omit<MailApprovalRequest, "id" | "createdAt">): Promise<MailApprovalRequest> {
    const [req] = await db.insert(mailApprovalRequests).values(data).returning();
    return req;
  }

  async getMailApprovalRequestsByUser(userId: string): Promise<MailApprovalRequest[]> {
    return db.select().from(mailApprovalRequests)
      .where(and(
        eq(mailApprovalRequests.founderId, userId),
        sql`${mailApprovalRequests.decision} IS NULL`
      ))
      .orderBy(desc(mailApprovalRequests.createdAt));
  }

  async updateMailApprovalRequest(id: number, data: Partial<MailApprovalRequest>): Promise<MailApprovalRequest | undefined> {
    const [req] = await db.update(mailApprovalRequests)
      .set(data)
      .where(eq(mailApprovalRequests.id, id))
      .returning();
    return req;
  }

  // Paystack Transactions
  async getPaystackTransaction(id: number): Promise<PaystackTransaction | undefined> {
    const [transaction] = await db.select().from(paystackTransactions).where(eq(paystackTransactions.id, id));
    return transaction;
  }

  async getPaystackTransactionByReference(reference: string): Promise<PaystackTransaction | undefined> {
    const [transaction] = await db.select().from(paystackTransactions).where(eq(paystackTransactions.reference, reference));
    return transaction;
  }

  async getPaystackTransactionsByUser(userId: string): Promise<PaystackTransaction[]> {
    return db.select().from(paystackTransactions)
      .where(eq(paystackTransactions.userId, userId))
      .orderBy(desc(paystackTransactions.createdAt));
  }

  async createPaystackTransaction(data: InsertPaystackTransaction): Promise<PaystackTransaction> {
    const [transaction] = await db.insert(paystackTransactions).values(data).returning();
    return transaction;
  }

  async updatePaystackTransaction(id: number, data: Partial<InsertPaystackTransaction>): Promise<PaystackTransaction | undefined> {
    const [transaction] = await db.update(paystackTransactions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(paystackTransactions.id, id))
      .returning();
    return transaction;
  }

  // Service Request Company Profiles
  async getServiceRequestCompanyProfile(id: number): Promise<ServiceRequestCompanyProfile | undefined> {
    const [profile] = await db.select().from(serviceRequestCompanyProfiles).where(eq(serviceRequestCompanyProfiles.id, id));
    return profile;
  }

  async getServiceRequestCompanyProfilesByFounder(founderId: string): Promise<ServiceRequestCompanyProfile[]> {
    return db.select().from(serviceRequestCompanyProfiles)
      .where(eq(serviceRequestCompanyProfiles.founderId, founderId))
      .orderBy(desc(serviceRequestCompanyProfiles.updatedAt));
  }

  async createServiceRequestCompanyProfile(data: InsertServiceRequestCompanyProfile): Promise<ServiceRequestCompanyProfile> {
    const [profile] = await db.insert(serviceRequestCompanyProfiles).values(data).returning();
    return profile;
  }

  async updateServiceRequestCompanyProfile(id: number, data: Partial<InsertServiceRequestCompanyProfile>): Promise<ServiceRequestCompanyProfile | undefined> {
    const [profile] = await db.update(serviceRequestCompanyProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(serviceRequestCompanyProfiles.id, id))
      .returning();
    return profile;
  }

  // Service Request Documents
  async getServiceRequestDocumentsByProfile(companyProfileId: number): Promise<ServiceRequestDocument[]> {
    return db.select().from(serviceRequestDocuments)
      .where(eq(serviceRequestDocuments.companyProfileId, companyProfileId))
      .orderBy(desc(serviceRequestDocuments.createdAt));
  }

  async getServiceRequestDocumentsByServiceRequest(serviceRequestId: number): Promise<ServiceRequestDocument[]> {
    return db.select().from(serviceRequestDocuments)
      .where(eq(serviceRequestDocuments.serviceRequestId, serviceRequestId))
      .orderBy(desc(serviceRequestDocuments.createdAt));
  }

  async createServiceRequestDocument(data: InsertServiceRequestDocument): Promise<ServiceRequestDocument> {
    const [doc] = await db.insert(serviceRequestDocuments).values(data).returning();
    return doc;
  }

  async deleteServiceRequestDocument(id: number): Promise<void> {
    await db.delete(serviceRequestDocuments).where(eq(serviceRequestDocuments.id, id));
  }

  // Service Requests
  async getServiceRequest(id: number): Promise<ServiceRequest | undefined> {
    const [request] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id));
    return request;
  }

  async getServiceRequestsByFounder(founderId: string): Promise<ServiceRequest[]> {
    return db.select().from(serviceRequests)
      .where(eq(serviceRequests.founderId, founderId))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async createServiceRequest(data: InsertServiceRequest): Promise<ServiceRequest> {
    const [request] = await db.insert(serviceRequests).values(data).returning();
    return request;
  }

  async updateServiceRequest(id: number, data: Partial<InsertServiceRequest>): Promise<ServiceRequest | undefined> {
    const [request] = await db.update(serviceRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(serviceRequests.id, id))
      .returning();
    return request;
  }

  // Notification Preferences
  async getNotificationPreferences(userId: string): Promise<NotificationPreference | undefined> {
    const [prefs] = await db.select().from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return prefs;
  }

  async upsertNotificationPreferences(userId: string, data: Partial<{
    complianceReminders: boolean;
    serviceRequestUpdates: boolean;
    orderUpdates: boolean;
    incorporationUpdates: boolean;
    marketingEmails: boolean;
  }>): Promise<NotificationPreference> {
    const existing = await this.getNotificationPreferences(userId);
    if (existing) {
      const [updated] = await db.update(notificationPreferences)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(notificationPreferences)
      .values({ userId, ...data })
      .returning();
    return created;
  }

  // Company People
  async getCompanyPeople(applicationId: number): Promise<CompanyPerson[]> {
    return db.select().from(companyPeople).where(eq(companyPeople.applicationId, applicationId));
  }

  async getCompanyPeopleByFounder(founderId: string): Promise<CompanyPerson[]> {
    return db.select().from(companyPeople).where(eq(companyPeople.founderId, founderId));
  }

  async getCompanyPersonByInviteToken(token: string): Promise<CompanyPerson | undefined> {
    const [person] = await db.select().from(companyPeople).where(eq(companyPeople.inviteToken, token));
    return person;
  }

  async getCompanyPeopleByPersonUserId(personUserId: string): Promise<CompanyPerson[]> {
    return db.select().from(companyPeople).where(eq(companyPeople.personUserId, personUserId));
  }

  async createCompanyPerson(data: InsertCompanyPerson): Promise<CompanyPerson> {
    const [person] = await db.insert(companyPeople).values(data).returning();
    return person;
  }

  async updateCompanyPerson(id: number, data: Partial<InsertCompanyPerson>): Promise<CompanyPerson | undefined> {
    const [updated] = await db.update(companyPeople)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companyPeople.id, id))
      .returning();
    return updated;
  }

  async deleteCompanyPerson(id: number): Promise<void> {
    await db.delete(companyPeople).where(eq(companyPeople.id, id));
  }

  // Sensitive Data Access Logging
  async logSensitiveDataAccess(data: {
    accessorUserId: string;
    targetUserId: string;
    dataType: string;
    action: string;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await db.insert(sensitiveDataAccessLogs).values(data);
  }

  // 2FA
  async updateUserTwoFactor(userId: string, data: Partial<{
    twoFactorEnabled: boolean;
    twoFactorMethod: string;
    twoFactorPhone: string;
    twoFactorSecret: string;
    twoFactorBackupCodes: string;
    lastTwoFactorAt: Date;
  }>): Promise<User> {
    const [updated] = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
