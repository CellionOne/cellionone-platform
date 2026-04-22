import { db } from "./db";
import { eq, and, desc, sql, count, inArray, or, ilike, gte, lte, lt, isNotNull } from "drizzle-orm";
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
  serviceAddresses, type ServiceAddress, type InsertServiceAddress,
  registeredOfficeSubscriptions, type RegisteredOfficeSubscription, type InsertRegisteredOfficeSubscription,
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
  loginAttempts, type LoginAttempt,
  securityEvents, type SecurityEvent, type InsertSecurityEvent,
  userLoginHistory, type UserLoginHistoryEntry,
  rfqCategories, type RfqCategory, type InsertRfqCategory,
  rfqs, type Rfq, type InsertRfq,
  rfqInvitations, type RfqInvitation, type InsertRfqInvitation,
  rfqItems, type RfqItem, type InsertRfqItem,
  bids, type Bid, type InsertBid,
  bidItems, type BidItem, type InsertBidItem,
  bidTemplates, type BidTemplate, type InsertBidTemplate,
  contracts, type Contract, type InsertContract,
  contractMilestones, type ContractMilestone, type InsertContractMilestone,
  escrowTransactions, type EscrowTransaction, type InsertEscrowTransaction,
  escrowApiTransactions, type EscrowApiTransaction, type InsertEscrowApiTransaction,
  procurementInvoices, type ProcurementInvoice, type InsertProcurementInvoice,
  procurementInvoiceItems, type ProcurementInvoiceItem, type InsertProcurementInvoiceItem,
  bankPartners, type BankPartner, type InsertBankPartner,
  bankPortalUsers, type BankPortalUser, type InsertBankPortalUser,
  bankCompanyDispatches, type BankCompanyDispatch, type InsertBankCompanyDispatch,
  bankDocumentRequests, type BankDocumentRequest, type InsertBankDocumentRequest,
  kycStrReports, type KycStrReport, type InsertKycStrReport,
  cieSecurities, type CieSecurity, type InsertCieSecurity,
  ciePrices, type CiePrice, type InsertCiePrice,
  cieScores, type CieScore, type InsertCieScore,
  cieDividends, type CieDividend, type InsertCieDividend,
  cieSignals, type CieSignal, type InsertCieSignal,
  cieModelVersions, type CieModelVersion, type InsertCieModelVersion,
  cieMarketPulse, type CieMarketPulse, type InsertCieMarketPulse,
  cieMarketContext, type CieMarketContext, type InsertCieMarketContext,
  cieIngestionLogs, type CieIngestionLog, type InsertCieIngestionLog,
  cieSubscriptions, type CieSubscription, type InsertCieSubscription,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserRoles(userId: string): Promise<string[]>;
  getUsersByRole(role: string): Promise<{ id: string; email: string; firstName: string; lastName: string }[]>;
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

  // Login Attempts (persistent account lockout)
  getLoginAttempt(identifier: string): Promise<LoginAttempt | undefined>;
  upsertLoginAttempt(identifier: string, data: { failedAttempts: number; lockoutUntil: Date | null; lastAttempt: Date }): Promise<LoginAttempt>;
  deleteLoginAttempt(identifier: string): Promise<void>;
  getLockedAccounts(): Promise<LoginAttempt[]>;
  cleanupExpiredLoginAttempts(): Promise<void>;

  // Security Events
  createSecurityEvent(data: InsertSecurityEvent): Promise<SecurityEvent>;
  getSecurityEvents(filters?: { eventType?: string; severity?: string; limit?: number; offset?: number }): Promise<SecurityEvent[]>;
  getSecurityEventCount(filters?: { eventType?: string; severity?: string; since?: Date }): Promise<number>;
  getSecuritySummary(): Promise<{ total24h: number; critical24h: number; lockedAccounts: number; uniqueFailedIps24h: number }>;
  getCspViolationSummary(): Promise<Array<{ blockedUri: string; violatedDirective: string; documentUri: string; count: number; lastSeen: string }>>;
  clearOldCspViolations(): Promise<number>;

  // User Login History
  recordLoginHistory(data: { userId: string; ipAddress: string | null; userAgent: string | null; isNewIp: boolean }): Promise<UserLoginHistoryEntry>;
  getLoginHistoryByUser(userId: string, limit?: number): Promise<UserLoginHistoryEntry[]>;
  isNewIpForUser(userId: string, ipAddress: string): Promise<boolean>;
  getRecentNewIpLogins(days?: number): Promise<UserLoginHistoryEntry[]>;
  getFailedLoginCountByIp(ipAddress: string, windowMinutes?: number): Promise<number>;

  // Service Addresses
  getServiceAddresses(): Promise<ServiceAddress[]>;
  getServiceAddressById(id: number): Promise<ServiceAddress | undefined>;
  getServiceAddressByManagerUserId(userId: string): Promise<ServiceAddress | undefined>;
  getAllServiceAddresses(): Promise<ServiceAddress[]>;
  createServiceAddress(data: Omit<ServiceAddress, "id" | "createdAt" | "updatedAt">): Promise<ServiceAddress>;
  updateServiceAddress(id: number, data: Partial<ServiceAddress>): Promise<ServiceAddress | undefined>;
  getSubscriptionsByServiceAddressId(serviceAddressId: number): Promise<RegisteredOfficeSubscription[]>;

  // Registered Office Subscriptions
  getRegisteredOfficeSubscriptionById(id: number): Promise<RegisteredOfficeSubscription | undefined>;
  getUserActiveRegisteredOfficeSubscription(userId: string): Promise<RegisteredOfficeSubscription | undefined>;
  getUserRegisteredOfficeSubscriptions(userId: string): Promise<RegisteredOfficeSubscription[]>;
  getAllRegisteredOfficeSubscriptions(): Promise<RegisteredOfficeSubscription[]>;
  updateRegisteredOfficeSubscription(id: number, data: Partial<RegisteredOfficeSubscription>): Promise<RegisteredOfficeSubscription | undefined>;

  // Mail Items
  getMailItemsBySubscription(subscriptionId: number): Promise<MailItem[]>;
  getAllMailItems(): Promise<MailItem[]>;

  // RFQ Categories
  getCategories(): Promise<RfqCategory[]>;
  getCategoryBySlug(slug: string): Promise<RfqCategory | undefined>;
  createCategory(data: InsertRfqCategory): Promise<RfqCategory>;

  // RFQs
  createRfq(data: InsertRfq): Promise<Rfq>;
  getRfqById(id: number): Promise<Rfq | undefined>;
  getRfqsByBuyerOrg(buyerOrgId: number): Promise<Rfq[]>;
  getOpenRfqs(filters?: { categoryId?: number; search?: string; budgetMin?: number; budgetMax?: number }): Promise<Rfq[]>;
  updateRfqStatus(id: number, status: string): Promise<Rfq | undefined>;
  updateRfq(id: number, data: Partial<InsertRfq>): Promise<Rfq | undefined>;
  getRfqsForSupplier(supplierOrgId: number): Promise<Rfq[]>;

  // RFQ Invitations
  createInvitation(data: InsertRfqInvitation): Promise<RfqInvitation>;
  getInvitationsByRfq(rfqId: number): Promise<RfqInvitation[]>;
  getInvitationsForOrg(supplierOrgId: number): Promise<RfqInvitation[]>;

  // RFQ Items
  createRfqItem(data: InsertRfqItem): Promise<RfqItem>;
  getRfqItems(rfqId: number): Promise<RfqItem[]>;
  updateRfqItem(id: number, data: Partial<InsertRfqItem>): Promise<RfqItem | undefined>;
  deleteRfqItem(id: number): Promise<void>;

  // Bids
  createBid(data: InsertBid): Promise<Bid>;
  getBidById(id: number): Promise<Bid | undefined>;
  getBidsByRfq(rfqId: number): Promise<Bid[]>;
  getBidsBySupplierOrg(supplierOrgId: number): Promise<Bid[]>;
  updateBid(id: number, data: Partial<InsertBid>): Promise<Bid | undefined>;
  updateBidStatus(id: number, status: string): Promise<Bid | undefined>;

  // Bid Items
  createBidItem(data: InsertBidItem): Promise<BidItem>;
  getBidItems(bidId: number): Promise<BidItem[]>;

  // Bid Templates
  createBidTemplate(data: InsertBidTemplate): Promise<BidTemplate>;
  getBidTemplatesByOrg(orgId: number): Promise<BidTemplate[]>;
  getBidTemplateById(id: number): Promise<BidTemplate | undefined>;
  updateBidTemplate(id: number, data: Partial<InsertBidTemplate>): Promise<BidTemplate | undefined>;
  deleteBidTemplate(id: number): Promise<void>;

  // Contracts
  createContract(data: InsertContract): Promise<Contract>;
  getContractById(id: number): Promise<Contract | undefined>;
  getContractsByBuyerOrg(buyerOrgId: number): Promise<Contract[]>;
  getContractsBySupplierOrg(supplierOrgId: number): Promise<Contract[]>;
  updateContractStatus(id: number, status: string): Promise<Contract | undefined>;
  generateContractNumber(): Promise<string>;

  // Contract Milestones
  createMilestone(data: InsertContractMilestone): Promise<ContractMilestone>;
  getMilestonesByContract(contractId: number): Promise<ContractMilestone[]>;
  updateMilestoneStatus(id: number, status: string, evidence?: any): Promise<ContractMilestone | undefined>;

  // Escrow Transactions
  createEscrowTransaction(data: InsertEscrowTransaction): Promise<EscrowTransaction>;
  getEscrowByContract(contractId: number): Promise<EscrowTransaction[]>;
  updateEscrowStatus(id: number, status: string): Promise<EscrowTransaction | undefined>;

  // Escrow API Transactions — expiry helpers
  getExpiredPendingEscrowTransactions(): Promise<EscrowApiTransaction[]>;
  bulkExpireEscrowTransactions(ids: number[]): Promise<number[]>;
  // Escrow API Transactions — DVA / transfer webhook lookups
  getEscrowApiTransactionByDvaAccount(accountNumber: string): Promise<EscrowApiTransaction | undefined>;
  getEscrowApiTransactionByTransferRef(transferRef: string): Promise<EscrowApiTransaction | undefined>;

  // Procurement Invoices
  createProcurementInvoice(data: InsertProcurementInvoice): Promise<ProcurementInvoice>;
  getProcurementInvoiceById(id: number): Promise<ProcurementInvoice | undefined>;
  getProcurementInvoicesByContract(contractId: number): Promise<ProcurementInvoice[]>;
  getProcurementInvoicesBySupplierOrg(supplierOrgId: number): Promise<ProcurementInvoice[]>;
  getProcurementInvoicesByBuyerOrg(buyerOrgId: number): Promise<ProcurementInvoice[]>;
  updateProcurementInvoice(id: number, data: Partial<InsertProcurementInvoice>): Promise<ProcurementInvoice | undefined>;
  updateProcurementInvoiceStatus(id: number, status: string): Promise<ProcurementInvoice | undefined>;
  generateInvoiceNumber(): Promise<string>;

  // Procurement Invoice Items
  createProcurementInvoiceItem(data: InsertProcurementInvoiceItem): Promise<ProcurementInvoiceItem>;
  getProcurementInvoiceItems(invoiceId: number): Promise<ProcurementInvoiceItem[]>;

  // Banking Partners
  createBankPartner(data: InsertBankPartner): Promise<BankPartner>;
  listBankPartners(): Promise<BankPartner[]>;
  getBankPartner(id: number): Promise<BankPartner | undefined>;
  getActiveBankPartner(): Promise<BankPartner | undefined>;
  updateBankPartner(id: number, data: Partial<InsertBankPartner>): Promise<BankPartner | undefined>;
  activateBankPartner(id: number): Promise<BankPartner | undefined>;
  deactivateBankPartner(id: number): Promise<BankPartner | undefined>;

  // Bank Portal Users
  createBankPortalUser(data: InsertBankPortalUser): Promise<BankPortalUser>;
  getBankPortalUserByEmail(email: string): Promise<BankPortalUser | undefined>;
  getBankPortalUserByInviteToken(token: string): Promise<BankPortalUser | undefined>;
  getBankPortalUserByResetToken(token: string): Promise<BankPortalUser | undefined>;
  getBankPortalUsersByBankId(bankPartnerId: number): Promise<BankPortalUser[]>;
  updateBankPortalUser(id: number, data: Partial<InsertBankPortalUser>): Promise<BankPortalUser | undefined>;
  deleteBankPortalUser(id: number): Promise<void>;

  // Bank Company Dispatches
  createBankCompanyDispatch(data: InsertBankCompanyDispatch): Promise<BankCompanyDispatch>;
  listBankCompanyDispatches(filters?: { companyProfileId?: number; bankPartnerId?: number }): Promise<BankCompanyDispatch[]>;

  // Bank Document Requests
  createBankDocumentRequest(data: InsertBankDocumentRequest): Promise<BankDocumentRequest>;
  listBankDocumentRequests(filters?: { status?: string; bankPartnerId?: number }): Promise<BankDocumentRequest[]>;
  getBankDocumentRequest(id: number): Promise<BankDocumentRequest | undefined>;
  updateBankDocumentRequest(id: number, data: Partial<InsertBankDocumentRequest>): Promise<BankDocumentRequest | undefined>;

  // STR Reports
  createStrReport(data: InsertKycStrReport): Promise<KycStrReport>;
  getStrReport(id: number, orgId: number): Promise<KycStrReport | undefined>;
  listStrReports(orgId: number): Promise<KycStrReport[]>;
  updateStrReport(id: number, orgId: number, data: Partial<InsertKycStrReport>): Promise<KycStrReport | undefined>;

  // CIE Securities
  createCieSecurity(data: InsertCieSecurity): Promise<CieSecurity>;
  upsertCieSecurity(data: InsertCieSecurity): Promise<CieSecurity>;
  getCieSecurityBySymbol(symbol: string): Promise<CieSecurity | undefined>;
  listCieSecurities(activeOnly?: boolean): Promise<CieSecurity[]>;
  updateCieSecurity(id: number, data: Partial<InsertCieSecurity>): Promise<CieSecurity | undefined>;

  // CIE Prices
  upsertCiePrice(data: InsertCiePrice): Promise<CiePrice>;
  listCiePrices(securityId: number, days?: number): Promise<CiePrice[]>;
  getLatestCiePrice(securityId: number): Promise<CiePrice | undefined>;

  // CIE Scores
  upsertCieScore(data: InsertCieScore): Promise<CieScore>;
  getLatestCieScore(securityId: number): Promise<CieScore | undefined>;
  listLatestCieScores(): Promise<(CieScore & { symbol: string; name: string; sector: string })[]>;
  /** Alias matching the task contract — same as listLatestCieScores */
  getLatestCieScores(): Promise<(CieScore & { symbol: string; name: string; sector: string })[]>;
  listCieScoreHistory(securityId: number, days?: number): Promise<CieScore[]>;

  // CIE Model Versions
  createCieModelVersion(data: InsertCieModelVersion): Promise<CieModelVersion>;
  getCieModelVersion(id: number): Promise<CieModelVersion | undefined>;
  listCieModelVersions(): Promise<CieModelVersion[]>;
  getActiveCieModelVersion(): Promise<CieModelVersion | undefined>;
  updateCieModelVersion(id: number, data: Partial<InsertCieModelVersion>): Promise<CieModelVersion | undefined>;
  submitCieModelVersion(id: number): Promise<CieModelVersion | undefined>;
  activateCieModelVersion(id: number, reviewerUserId: string): Promise<CieModelVersion | undefined>;

  // CIE Dividends
  createCieDividend(data: InsertCieDividend): Promise<CieDividend>;
  listCieDividends(upcomingOnly?: boolean): Promise<(CieDividend & { symbol: string; name: string })[]>;
  deleteCieDividend(id: number): Promise<void>;

  // CIE Signals
  createCieSignal(data: InsertCieSignal): Promise<CieSignal>;
  listCieSignals(publishedOnly?: boolean, limit?: number): Promise<(CieSignal & { symbol: string | null })[]>;
  updateCieSignal(id: number, data: Partial<InsertCieSignal>): Promise<CieSignal | undefined>;
  deleteCieSignal(id: number): Promise<void>;

  // CIE Market Pulse
  getLatestCieMarketPulse(): Promise<CieMarketPulse | undefined>;
  upsertCieMarketPulse(data: InsertCieMarketPulse): Promise<CieMarketPulse>;
  updateLatestCieMarketPulseCommentary(commentary: string): Promise<boolean>;

  // CIE Market Context
  upsertCieMarketContext(data: InsertCieMarketContext): Promise<CieMarketContext>;
  getLatestCieMarketContext(): Promise<CieMarketContext | undefined>;
  getCieMarketContextByDate(date: string): Promise<CieMarketContext | undefined>;

  // CIE Ingestion Logs
  createCieIngestionLog(data: InsertCieIngestionLog): Promise<CieIngestionLog>;
  updateCieIngestionLog(id: number, data: Partial<InsertCieIngestionLog>): Promise<CieIngestionLog | undefined>;
  listCieIngestionLogs(limit?: number): Promise<CieIngestionLog[]>;
  // CIE Subscriptions
  createCieSubscription(data: InsertCieSubscription): Promise<CieSubscription>;
  getCieSubscriptionById(id: number): Promise<CieSubscription | undefined>;
  getCieSubscriptionByUserId(userId: string): Promise<CieSubscription | undefined>;
  getLatestCieSubscriptionByUserId(userId: string): Promise<CieSubscription | undefined>;
  getCieSubscriptionByOrgId(orgId: number): Promise<CieSubscription | undefined>;
  getCieSubscriptionByReference(reference: string): Promise<CieSubscription | undefined>;
  getCieSubscriptionByPaystackCode(code: string): Promise<CieSubscription | undefined>;
  updateCieSubscription(id: number, data: Partial<InsertCieSubscription>): Promise<CieSubscription | undefined>;
  listCieSubscriptions(limit?: number): Promise<CieSubscription[]>;
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

  async getUsersByRole(role: string): Promise<{ id: string; email: string; firstName: string; lastName: string }[]> {
    return db
      .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(eq(userRoles.role, role));
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
    primaryIntent: string;
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

  async getServiceAddressByManagerUserId(userId: string): Promise<ServiceAddress | undefined> {
    const [address] = await db.select().from(serviceAddresses)
      .where(and(eq(serviceAddresses.managerUserId, userId), eq(serviceAddresses.isActive, true)));
    return address;
  }

  async getAllServiceAddresses(): Promise<ServiceAddress[]> {
    return db.select().from(serviceAddresses).orderBy(desc(serviceAddresses.createdAt));
  }

  async createServiceAddress(data: Omit<ServiceAddress, "id" | "createdAt" | "updatedAt">): Promise<ServiceAddress> {
    const [address] = await db.insert(serviceAddresses).values(data).returning();
    return address;
  }

  async updateServiceAddress(id: number, data: Partial<ServiceAddress>): Promise<ServiceAddress | undefined> {
    const [address] = await db.update(serviceAddresses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(serviceAddresses.id, id))
      .returning();
    return address;
  }

  async getSubscriptionsByServiceAddressId(serviceAddressId: number): Promise<RegisteredOfficeSubscription[]> {
    return db.select().from(registeredOfficeSubscriptions)
      .where(and(
        eq(registeredOfficeSubscriptions.serviceAddressId, serviceAddressId),
        eq(registeredOfficeSubscriptions.status, "active")
      ))
      .orderBy(desc(registeredOfficeSubscriptions.createdAt));
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

  // Login Attempts (persistent account lockout)
  async getLoginAttempt(identifier: string): Promise<LoginAttempt | undefined> {
    const [attempt] = await db.select().from(loginAttempts).where(eq(loginAttempts.identifier, identifier));
    return attempt;
  }

  async upsertLoginAttempt(identifier: string, data: { failedAttempts: number; lockoutUntil: Date | null; lastAttempt: Date }): Promise<LoginAttempt> {
    const existing = await this.getLoginAttempt(identifier);
    if (existing) {
      const [updated] = await db.update(loginAttempts)
        .set({ failedAttempts: data.failedAttempts, lockoutUntil: data.lockoutUntil, lastAttempt: data.lastAttempt })
        .where(eq(loginAttempts.identifier, identifier))
        .returning();
      return updated;
    }
    const [created] = await db.insert(loginAttempts)
      .values({ identifier, failedAttempts: data.failedAttempts, lockoutUntil: data.lockoutUntil, lastAttempt: data.lastAttempt })
      .returning();
    return created;
  }

  async deleteLoginAttempt(identifier: string): Promise<void> {
    await db.delete(loginAttempts).where(eq(loginAttempts.identifier, identifier));
  }

  async getLockedAccounts(): Promise<LoginAttempt[]> {
    const now = new Date();
    return db.select().from(loginAttempts)
      .where(sql`${loginAttempts.lockoutUntil} > ${now}`);
  }

  async cleanupExpiredLoginAttempts(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await db.delete(loginAttempts)
      .where(and(
        sql`${loginAttempts.lastAttempt} < ${oneHourAgo}`,
        or(
          sql`${loginAttempts.lockoutUntil} IS NULL`,
          sql`${loginAttempts.lockoutUntil} < NOW()`
        )
      ));
  }

  // Security Events
  async createSecurityEvent(data: InsertSecurityEvent): Promise<SecurityEvent> {
    const [event] = await db.insert(securityEvents).values(data).returning();
    return event;
  }

  async getSecurityEvents(filters?: { eventType?: string; severity?: string; limit?: number; offset?: number }): Promise<SecurityEvent[]> {
    const conditions = [];
    if (filters?.eventType) conditions.push(eq(securityEvents.eventType, filters.eventType));
    if (filters?.severity) conditions.push(eq(securityEvents.severity, filters.severity));

    const query = db.select().from(securityEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(securityEvents.createdAt))
      .limit(filters?.limit ?? 100)
      .offset(filters?.offset ?? 0);

    return query;
  }

  async getSecurityEventCount(filters?: { eventType?: string; severity?: string; since?: Date }): Promise<number> {
    const conditions = [];
    if (filters?.eventType) conditions.push(eq(securityEvents.eventType, filters.eventType));
    if (filters?.severity) conditions.push(eq(securityEvents.severity, filters.severity));
    if (filters?.since) conditions.push(sql`${securityEvents.createdAt} >= ${filters.since}`);

    const [result] = await db.select({ count: count() }).from(securityEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    return result?.count ?? 0;
  }

  async getSecuritySummary(): Promise<{ total24h: number; critical24h: number; lockedAccounts: number; uniqueFailedIps24h: number }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalResult] = await db.select({ count: count() }).from(securityEvents)
      .where(sql`${securityEvents.createdAt} >= ${twentyFourHoursAgo}`);

    const [criticalResult] = await db.select({ count: count() }).from(securityEvents)
      .where(and(
        sql`${securityEvents.createdAt} >= ${twentyFourHoursAgo}`,
        eq(securityEvents.severity, "critical")
      ));

    const lockedAccounts = await this.getLockedAccounts();

    const failedIps = await db.selectDistinct({ ip: securityEvents.ipAddress }).from(securityEvents)
      .where(and(
        sql`${securityEvents.createdAt} >= ${twentyFourHoursAgo}`,
        or(eq(securityEvents.eventType, "failed_login_spike"), eq(securityEvents.eventType, "account_locked"))
      ));

    return {
      total24h: totalResult?.count ?? 0,
      critical24h: criticalResult?.count ?? 0,
      lockedAccounts: lockedAccounts.length,
      uniqueFailedIps24h: failedIps.length,
    };
  }

  async getCspViolationSummary(): Promise<Array<{ blockedUri: string; violatedDirective: string; documentUri: string; count: number; lastSeen: string }>> {
    const rows = await db.select({
      blockedUri: sql<string>`details->>'blockedUri'`,
      violatedDirective: sql<string>`details->>'violatedDirective'`,
      documentUri: sql<string>`MAX(details->>'documentUri')`,
      count: count(),
      lastSeen: sql<string>`MAX(${securityEvents.createdAt})`,
    }).from(securityEvents)
      .where(eq(securityEvents.eventType, "csp_violation"))
      .groupBy(
        sql`details->>'blockedUri'`,
        sql`details->>'violatedDirective'`
      )
      .orderBy(desc(sql`MAX(${securityEvents.createdAt})`));
    return rows as Array<{ blockedUri: string; violatedDirective: string; documentUri: string; count: number; lastSeen: string }>;
  }

  async clearOldCspViolations(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deleted = await db.delete(securityEvents)
      .where(and(
        eq(securityEvents.eventType, "csp_violation"),
        sql`${securityEvents.createdAt} < ${thirtyDaysAgo}`
      ))
      .returning({ id: securityEvents.id });
    return deleted.length;
  }

  // User Login History
  async recordLoginHistory(data: { userId: string; ipAddress: string | null; userAgent: string | null; isNewIp: boolean }): Promise<UserLoginHistoryEntry> {
    const [entry] = await db.insert(userLoginHistory).values(data).returning();
    return entry;
  }

  async getLoginHistoryByUser(userId: string, limit: number = 50): Promise<UserLoginHistoryEntry[]> {
    return db.select().from(userLoginHistory)
      .where(eq(userLoginHistory.userId, userId))
      .orderBy(desc(userLoginHistory.loginAt))
      .limit(limit);
  }

  async isNewIpForUser(userId: string, ipAddress: string): Promise<boolean> {
    const [existing] = await db.select().from(userLoginHistory)
      .where(and(
        eq(userLoginHistory.userId, userId),
        eq(userLoginHistory.ipAddress, ipAddress)
      ))
      .limit(1);
    return !existing;
  }

  async getRecentNewIpLogins(days: number = 7): Promise<UserLoginHistoryEntry[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return db.select().from(userLoginHistory)
      .where(and(
        eq(userLoginHistory.isNewIp, true),
        sql`${userLoginHistory.loginAt} >= ${since}`
      ))
      .orderBy(desc(userLoginHistory.loginAt));
  }

  async getFailedLoginCountByIp(ipAddress: string, windowMinutes: number = 15): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const [result] = await db.select({ count: count() }).from(securityEvents)
      .where(and(
        eq(securityEvents.eventType, "failed_login"),
        eq(securityEvents.ipAddress, ipAddress),
        sql`${securityEvents.createdAt} >= ${since}`
      ));
    return result?.count ?? 0;
  }

  // RFQ Categories
  async getCategories(): Promise<RfqCategory[]> {
    return db.select().from(rfqCategories).orderBy(rfqCategories.name);
  }

  async getCategoryBySlug(slug: string): Promise<RfqCategory | undefined> {
    const [category] = await db.select().from(rfqCategories).where(eq(rfqCategories.slug, slug));
    return category;
  }

  async createCategory(data: InsertRfqCategory): Promise<RfqCategory> {
    const [category] = await db.insert(rfqCategories).values(data).returning();
    return category;
  }

  // RFQs
  async createRfq(data: InsertRfq): Promise<Rfq> {
    const [rfq] = await db.insert(rfqs).values(data).returning();
    return rfq;
  }

  async getRfqById(id: number): Promise<Rfq | undefined> {
    const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, id));
    return rfq;
  }

  async getRfqsByBuyerOrg(buyerOrgId: number): Promise<Rfq[]> {
    return db.select().from(rfqs)
      .where(eq(rfqs.buyerOrgId, buyerOrgId))
      .orderBy(desc(rfqs.createdAt));
  }

  async getOpenRfqs(filters?: { categoryId?: number; search?: string; budgetMin?: number; budgetMax?: number }): Promise<Rfq[]> {
    const conditions: any[] = [eq(rfqs.status, "open")];
    if (filters?.categoryId) conditions.push(eq(rfqs.categoryId, filters.categoryId));
    if (filters?.search) conditions.push(or(ilike(rfqs.title, `%${filters.search}%`), ilike(rfqs.description, `%${filters.search}%`)));
    if (filters?.budgetMin) conditions.push(gte(rfqs.budgetMax, filters.budgetMin));
    if (filters?.budgetMax) conditions.push(lte(rfqs.budgetMin, filters.budgetMax));

    return db.select().from(rfqs)
      .where(and(...conditions))
      .orderBy(desc(rfqs.createdAt));
  }

  async updateRfqStatus(id: number, status: string): Promise<Rfq | undefined> {
    const [rfq] = await db.update(rfqs)
      .set({ status, updatedAt: new Date() })
      .where(eq(rfqs.id, id))
      .returning();
    return rfq;
  }

  async updateRfq(id: number, data: Partial<InsertRfq>): Promise<Rfq | undefined> {
    const [rfq] = await db.update(rfqs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rfqs.id, id))
      .returning();
    return rfq;
  }

  async getRfqsForSupplier(supplierOrgId: number): Promise<Rfq[]> {
    const invitedRfqIds = await db.select({ rfqId: rfqInvitations.rfqId })
      .from(rfqInvitations)
      .where(eq(rfqInvitations.supplierOrgId, supplierOrgId));

    const invitedIds = invitedRfqIds.map(r => r.rfqId);

    if (invitedIds.length > 0) {
      return db.select().from(rfqs)
        .where(or(
          eq(rfqs.status, "open"),
          inArray(rfqs.id, invitedIds)
        ))
        .orderBy(desc(rfqs.createdAt));
    }

    return db.select().from(rfqs)
      .where(eq(rfqs.status, "open"))
      .orderBy(desc(rfqs.createdAt));
  }

  // RFQ Invitations
  async createInvitation(data: InsertRfqInvitation): Promise<RfqInvitation> {
    const [invitation] = await db.insert(rfqInvitations).values(data).returning();
    return invitation;
  }

  async getInvitationsByRfq(rfqId: number): Promise<RfqInvitation[]> {
    return db.select().from(rfqInvitations).where(eq(rfqInvitations.rfqId, rfqId));
  }

  async getInvitationsForOrg(supplierOrgId: number): Promise<RfqInvitation[]> {
    return db.select().from(rfqInvitations).where(eq(rfqInvitations.supplierOrgId, supplierOrgId));
  }

  // RFQ Items
  async createRfqItem(data: InsertRfqItem): Promise<RfqItem> {
    const [item] = await db.insert(rfqItems).values(data).returning();
    return item;
  }

  async getRfqItems(rfqId: number): Promise<RfqItem[]> {
    return db.select().from(rfqItems).where(eq(rfqItems.rfqId, rfqId));
  }

  async updateRfqItem(id: number, data: Partial<InsertRfqItem>): Promise<RfqItem | undefined> {
    const [item] = await db.update(rfqItems)
      .set(data)
      .where(eq(rfqItems.id, id))
      .returning();
    return item;
  }

  async deleteRfqItem(id: number): Promise<void> {
    await db.delete(rfqItems).where(eq(rfqItems.id, id));
  }

  // Bids
  async createBid(data: InsertBid): Promise<Bid> {
    const [bid] = await db.insert(bids).values(data).returning();
    return bid;
  }

  async getBidById(id: number): Promise<Bid | undefined> {
    const [bid] = await db.select().from(bids).where(eq(bids.id, id));
    return bid;
  }

  async getBidsByRfq(rfqId: number): Promise<Bid[]> {
    return db.select().from(bids)
      .where(eq(bids.rfqId, rfqId))
      .orderBy(desc(bids.createdAt));
  }

  async getBidsBySupplierOrg(supplierOrgId: number): Promise<Bid[]> {
    return db.select().from(bids)
      .where(eq(bids.supplierOrgId, supplierOrgId))
      .orderBy(desc(bids.createdAt));
  }

  async updateBid(id: number, data: Partial<InsertBid>): Promise<Bid | undefined> {
    const [bid] = await db.update(bids)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bids.id, id))
      .returning();
    return bid;
  }

  async updateBidStatus(id: number, status: string): Promise<Bid | undefined> {
    const [bid] = await db.update(bids)
      .set({ status, updatedAt: new Date() })
      .where(eq(bids.id, id))
      .returning();
    return bid;
  }

  // Bid Items
  async createBidItem(data: InsertBidItem): Promise<BidItem> {
    const [item] = await db.insert(bidItems).values(data).returning();
    return item;
  }

  async getBidItems(bidId: number): Promise<BidItem[]> {
    return db.select().from(bidItems).where(eq(bidItems.bidId, bidId));
  }

  // Bid Templates
  async createBidTemplate(data: InsertBidTemplate): Promise<BidTemplate> {
    const [template] = await db.insert(bidTemplates).values(data).returning();
    return template;
  }

  async getBidTemplatesByOrg(orgId: number): Promise<BidTemplate[]> {
    return db.select().from(bidTemplates)
      .where(eq(bidTemplates.orgId, orgId))
      .orderBy(desc(bidTemplates.createdAt));
  }

  async getBidTemplateById(id: number): Promise<BidTemplate | undefined> {
    const [template] = await db.select().from(bidTemplates).where(eq(bidTemplates.id, id));
    return template;
  }

  async updateBidTemplate(id: number, data: Partial<InsertBidTemplate>): Promise<BidTemplate | undefined> {
    const [template] = await db.update(bidTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bidTemplates.id, id))
      .returning();
    return template;
  }

  async deleteBidTemplate(id: number): Promise<void> {
    await db.delete(bidTemplates).where(eq(bidTemplates.id, id));
  }

  // Contracts
  async createContract(data: InsertContract): Promise<Contract> {
    const [contract] = await db.insert(contracts).values(data).returning();
    return contract;
  }

  async getContractById(id: number): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    return contract;
  }

  async getContractsByBuyerOrg(buyerOrgId: number): Promise<Contract[]> {
    return db.select().from(contracts)
      .where(eq(contracts.buyerOrgId, buyerOrgId))
      .orderBy(desc(contracts.createdAt));
  }

  async getContractsBySupplierOrg(supplierOrgId: number): Promise<Contract[]> {
    return db.select().from(contracts)
      .where(eq(contracts.supplierOrgId, supplierOrgId))
      .orderBy(desc(contracts.createdAt));
  }

  async updateContractStatus(id: number, status: string): Promise<Contract | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (status === "completed") updateData.completedAt = new Date();
    const [contract] = await db.update(contracts)
      .set(updateData)
      .where(eq(contracts.id, id))
      .returning();
    return contract;
  }

  async generateContractNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const [result] = await db.select({ count: count() }).from(contracts);
    const num = (result?.count ?? 0) + 1;
    return `CO-${year}-${String(num).padStart(5, "0")}`;
  }

  // Contract Milestones
  async createMilestone(data: InsertContractMilestone): Promise<ContractMilestone> {
    const [milestone] = await db.insert(contractMilestones).values(data).returning();
    return milestone;
  }

  async getMilestonesByContract(contractId: number): Promise<ContractMilestone[]> {
    return db.select().from(contractMilestones)
      .where(eq(contractMilestones.contractId, contractId))
      .orderBy(contractMilestones.sortOrder);
  }

  async updateMilestoneStatus(id: number, status: string, evidence?: any): Promise<ContractMilestone | undefined> {
    const updateData: any = { status };
    if (evidence) updateData.evidence = evidence;
    if (status === "approved") updateData.completedAt = new Date();
    const [milestone] = await db.update(contractMilestones)
      .set(updateData)
      .where(eq(contractMilestones.id, id))
      .returning();
    return milestone;
  }

  // Escrow Transactions
  async createEscrowTransaction(data: InsertEscrowTransaction): Promise<EscrowTransaction> {
    const [escrow] = await db.insert(escrowTransactions).values(data).returning();
    return escrow;
  }

  async getEscrowByContract(contractId: number): Promise<EscrowTransaction[]> {
    return db.select().from(escrowTransactions)
      .where(eq(escrowTransactions.contractId, contractId))
      .orderBy(desc(escrowTransactions.createdAt));
  }

  async updateEscrowStatus(id: number, status: string): Promise<EscrowTransaction | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (status === "funded") updateData.fundedAt = new Date();
    if (status === "released") updateData.releasedAt = new Date();
    if (status === "refunded") updateData.refundedAt = new Date();
    const [escrow] = await db.update(escrowTransactions)
      .set(updateData)
      .where(eq(escrowTransactions.id, id))
      .returning();
    return escrow;
  }

  async updateEscrowPaymentUrl(id: number, paymentUrl: string): Promise<void> {
    await db.update(escrowTransactions)
      .set({ paystackPaymentUrl: paymentUrl, updatedAt: new Date() })
      .where(eq(escrowTransactions.id, id));
  }

  async updateEscrowFunded(id: number, paystackReference: string): Promise<EscrowTransaction | undefined> {
    const [escrow] = await db.update(escrowTransactions)
      .set({ status: "funded", fundedAt: new Date(), paymentReference: paystackReference, updatedAt: new Date() })
      .where(eq(escrowTransactions.id, id))
      .returning();
    return escrow;
  }

  async updateEscrowDisputed(id: number, reason: string): Promise<EscrowTransaction | undefined> {
    const [escrow] = await db.update(escrowTransactions)
      .set({ status: "disputed", disputeReason: reason, disputedAt: new Date(), updatedAt: new Date() })
      .where(eq(escrowTransactions.id, id))
      .returning();
    return escrow;
  }

  async getEscrowTransactionById(id: number): Promise<EscrowTransaction | undefined> {
    const [escrow] = await db.select().from(escrowTransactions).where(eq(escrowTransactions.id, id));
    return escrow;
  }

  // Escrow API Transactions
  async createEscrowApiTransaction(data: InsertEscrowApiTransaction): Promise<EscrowApiTransaction> {
    const [tx] = await db.insert(escrowApiTransactions).values(data).returning();
    return tx;
  }

  async getEscrowApiTransaction(reference: string): Promise<EscrowApiTransaction | undefined> {
    const [tx] = await db.select().from(escrowApiTransactions)
      .where(eq(escrowApiTransactions.reference, reference));
    return tx;
  }

  async getEscrowApiTransactionById(id: number): Promise<EscrowApiTransaction | undefined> {
    const [tx] = await db.select().from(escrowApiTransactions)
      .where(eq(escrowApiTransactions.id, id));
    return tx;
  }

  async listEscrowApiTransactions(orgId: number, status?: string): Promise<EscrowApiTransaction[]> {
    if (status) {
      return db.select().from(escrowApiTransactions)
        .where(and(eq(escrowApiTransactions.orgId, orgId), eq(escrowApiTransactions.status, status)))
        .orderBy(desc(escrowApiTransactions.createdAt));
    }
    return db.select().from(escrowApiTransactions)
      .where(eq(escrowApiTransactions.orgId, orgId))
      .orderBy(desc(escrowApiTransactions.createdAt));
  }

  async listAllEscrowApiTransactions(limit = 100): Promise<EscrowApiTransaction[]> {
    return db.select().from(escrowApiTransactions)
      .orderBy(desc(escrowApiTransactions.createdAt))
      .limit(limit);
  }

  async updateEscrowApiTransaction(id: number, data: Partial<EscrowApiTransaction>): Promise<EscrowApiTransaction | undefined> {
    const [tx] = await db.update(escrowApiTransactions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(escrowApiTransactions.id, id))
      .returning();
    return tx;
  }

  async getExpiredPendingEscrowTransactions(): Promise<EscrowApiTransaction[]> {
    return db.select().from(escrowApiTransactions)
      .where(and(
        eq(escrowApiTransactions.status, "pending_payment"),
        isNotNull(escrowApiTransactions.expiresAt),
        lt(escrowApiTransactions.expiresAt, new Date()),
      ));
  }

  async bulkExpireEscrowTransactions(ids: number[]): Promise<number[]> {
    if (ids.length === 0) return [];
    const updated = await db.update(escrowApiTransactions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(and(
        inArray(escrowApiTransactions.id, ids),
        eq(escrowApiTransactions.status, "pending_payment"),
        isNotNull(escrowApiTransactions.expiresAt),
        lt(escrowApiTransactions.expiresAt, new Date()),
      ))
      .returning({ id: escrowApiTransactions.id });
    return updated.map((r) => r.id);
  }

  async getEscrowApiTransactionByDvaAccount(accountNumber: string): Promise<EscrowApiTransaction | undefined> {
    const [tx] = await db.select().from(escrowApiTransactions)
      .where(eq(escrowApiTransactions.dvaAccountNumber, accountNumber));
    return tx;
  }

  async getEscrowApiTransactionByTransferRef(transferRef: string): Promise<EscrowApiTransaction | undefined> {
    const [tx] = await db.select().from(escrowApiTransactions)
      .where(eq(escrowApiTransactions.paystackTransferReference, transferRef));
    return tx;
  }

  // Procurement Invoices
  async createProcurementInvoice(data: InsertProcurementInvoice): Promise<ProcurementInvoice> {
    const [invoice] = await db.insert(procurementInvoices).values(data).returning();
    return invoice;
  }

  async getProcurementInvoiceById(id: number): Promise<ProcurementInvoice | undefined> {
    const [invoice] = await db.select().from(procurementInvoices).where(eq(procurementInvoices.id, id));
    return invoice;
  }

  async getProcurementInvoicesByContract(contractId: number): Promise<ProcurementInvoice[]> {
    return db.select().from(procurementInvoices)
      .where(eq(procurementInvoices.contractId, contractId))
      .orderBy(desc(procurementInvoices.createdAt));
  }

  async getProcurementInvoicesBySupplierOrg(supplierOrgId: number): Promise<ProcurementInvoice[]> {
    return db.select().from(procurementInvoices)
      .where(eq(procurementInvoices.supplierOrgId, supplierOrgId))
      .orderBy(desc(procurementInvoices.createdAt));
  }

  async getProcurementInvoicesByBuyerOrg(buyerOrgId: number): Promise<ProcurementInvoice[]> {
    return db.select().from(procurementInvoices)
      .where(eq(procurementInvoices.buyerOrgId, buyerOrgId))
      .orderBy(desc(procurementInvoices.createdAt));
  }

  async updateProcurementInvoice(id: number, data: Partial<InsertProcurementInvoice>): Promise<ProcurementInvoice | undefined> {
    const [invoice] = await db.update(procurementInvoices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(procurementInvoices.id, id))
      .returning();
    return invoice;
  }

  async updateProcurementInvoiceStatus(id: number, status: string): Promise<ProcurementInvoice | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (status === "sent") updateData.sentAt = new Date();
    if (status === "viewed") updateData.viewedAt = new Date();
    if (status === "paid") updateData.paidAt = new Date();
    const [invoice] = await db.update(procurementInvoices)
      .set(updateData)
      .where(eq(procurementInvoices.id, id))
      .returning();
    return invoice;
  }

  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const [result] = await db.select({ count: count() }).from(procurementInvoices);
    const num = (result?.count ?? 0) + 1;
    return `INV-${year}-${String(num).padStart(5, "0")}`;
  }

  // Procurement Invoice Items
  async createProcurementInvoiceItem(data: InsertProcurementInvoiceItem): Promise<ProcurementInvoiceItem> {
    const [item] = await db.insert(procurementInvoiceItems).values(data).returning();
    return item;
  }

  async getProcurementInvoiceItems(invoiceId: number): Promise<ProcurementInvoiceItem[]> {
    return db.select().from(procurementInvoiceItems)
      .where(eq(procurementInvoiceItems.invoiceId, invoiceId));
  }

  // Banking Partners
  async createBankPartner(data: InsertBankPartner): Promise<BankPartner> {
    const [partner] = await db.insert(bankPartners).values(data).returning();
    return partner;
  }

  async runBankPartnerEmailMigration(): Promise<void> {
    const rows = await db.select().from(bankPartners);
    for (const partner of rows) {
      const emails: { label: string; address: string }[] = Array.isArray(partner.emails) ? (partner.emails as { label: string; address: string }[]) : [];
      if (emails.length === 0 && partner.contactEmail) {
        await db.update(bankPartners)
          .set({ emails: [{ label: "Primary Contact", address: partner.contactEmail }] })
          .where(eq(bankPartners.id, partner.id));
      }
    }
  }

  async listBankPartners(): Promise<BankPartner[]> {
    const rows = await db.select().from(bankPartners).orderBy(desc(bankPartners.createdAt));
    return rows;
  }

  async getBankPartner(id: number): Promise<BankPartner | undefined> {
    const [partner] = await db.select().from(bankPartners).where(eq(bankPartners.id, id));
    return partner;
  }

  async getActiveBankPartner(): Promise<BankPartner | undefined> {
    const [partner] = await db.select().from(bankPartners).where(eq(bankPartners.isActive, true)).limit(1);
    return partner;
  }

  async updateBankPartner(id: number, data: Partial<InsertBankPartner>): Promise<BankPartner | undefined> {
    const [partner] = await db.update(bankPartners).set(data).where(eq(bankPartners.id, id)).returning();
    return partner;
  }

  async activateBankPartner(id: number): Promise<BankPartner | undefined> {
    // Verify the target partner exists first so we never accidentally clear the
    // active partner when given an invalid id.
    const [target] = await db.select().from(bankPartners).where(eq(bankPartners.id, id)).limit(1);
    if (!target) return undefined;
    // Deactivate all currently active partners (only one active at a time)
    await db.update(bankPartners).set({ isActive: false, deactivatedAt: new Date() }).where(eq(bankPartners.isActive, true));
    const [partner] = await db.update(bankPartners)
      .set({ isActive: true, activatedAt: new Date(), deactivatedAt: null })
      .where(eq(bankPartners.id, id))
      .returning();
    return partner;
  }

  async deactivateBankPartner(id: number): Promise<BankPartner | undefined> {
    const [partner] = await db.update(bankPartners)
      .set({ isActive: false, deactivatedAt: new Date() })
      .where(eq(bankPartners.id, id))
      .returning();
    return partner;
  }

  // Bank Portal Users
  async createBankPortalUser(data: InsertBankPortalUser): Promise<BankPortalUser> {
    const [user] = await db.insert(bankPortalUsers).values(data).returning();
    return user;
  }

  async getBankPortalUserByEmail(email: string): Promise<BankPortalUser | undefined> {
    const [user] = await db.select().from(bankPortalUsers).where(eq(bankPortalUsers.email, email.toLowerCase()));
    return user;
  }

  async getBankPortalUserByInviteToken(token: string): Promise<BankPortalUser | undefined> {
    const [user] = await db.select().from(bankPortalUsers).where(eq(bankPortalUsers.inviteToken, token));
    return user;
  }

  async getBankPortalUserByResetToken(token: string): Promise<BankPortalUser | undefined> {
    const [user] = await db.select().from(bankPortalUsers).where(eq(bankPortalUsers.resetToken, token));
    return user;
  }

  async getBankPortalUsersByBankId(bankPartnerId: number): Promise<BankPortalUser[]> {
    return db.select().from(bankPortalUsers).where(eq(bankPortalUsers.bankPartnerId, bankPartnerId));
  }

  async updateBankPortalUser(id: number, data: Partial<InsertBankPortalUser>): Promise<BankPortalUser | undefined> {
    const [user] = await db.update(bankPortalUsers).set({ ...data, updatedAt: new Date() }).where(eq(bankPortalUsers.id, id)).returning();
    return user;
  }

  async deleteBankPortalUser(id: number): Promise<void> {
    await db.delete(bankPortalUsers).where(eq(bankPortalUsers.id, id));
  }

  // Bank Company Dispatches
  async createBankCompanyDispatch(data: InsertBankCompanyDispatch): Promise<BankCompanyDispatch> {
    const [dispatch] = await db.insert(bankCompanyDispatches).values(data).returning();
    return dispatch;
  }

  async listBankCompanyDispatches(filters?: { companyProfileId?: number; bankPartnerId?: number }): Promise<BankCompanyDispatch[]> {
    let query = db.select().from(bankCompanyDispatches);
    const conditions = [];
    if (filters?.companyProfileId) conditions.push(eq(bankCompanyDispatches.companyProfileId, filters.companyProfileId));
    if (filters?.bankPartnerId) conditions.push(eq(bankCompanyDispatches.bankPartnerId, filters.bankPartnerId));
    if (conditions.length > 0) {
      return db.select().from(bankCompanyDispatches).where(and(...conditions)).orderBy(desc(bankCompanyDispatches.sentAt));
    }
    return db.select().from(bankCompanyDispatches).orderBy(desc(bankCompanyDispatches.sentAt));
  }

  // Bank Document Requests
  async createBankDocumentRequest(data: InsertBankDocumentRequest): Promise<BankDocumentRequest> {
    const [req] = await db.insert(bankDocumentRequests).values(data).returning();
    return req;
  }

  async listBankDocumentRequests(filters?: { status?: string; bankPartnerId?: number }): Promise<BankDocumentRequest[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(bankDocumentRequests.status, filters.status));
    if (filters?.bankPartnerId) conditions.push(eq(bankDocumentRequests.bankPartnerId, filters.bankPartnerId));
    if (conditions.length > 0) {
      return db.select().from(bankDocumentRequests).where(and(...conditions)).orderBy(desc(bankDocumentRequests.createdAt));
    }
    return db.select().from(bankDocumentRequests).orderBy(desc(bankDocumentRequests.createdAt));
  }

  async getBankDocumentRequest(id: number): Promise<BankDocumentRequest | undefined> {
    const [req] = await db.select().from(bankDocumentRequests).where(eq(bankDocumentRequests.id, id));
    return req;
  }

  async updateBankDocumentRequest(id: number, data: Partial<InsertBankDocumentRequest>): Promise<BankDocumentRequest | undefined> {
    const [req] = await db.update(bankDocumentRequests).set(data).where(eq(bankDocumentRequests.id, id)).returning();
    return req;
  }

  // STR Reports
  async createStrReport(data: InsertKycStrReport): Promise<KycStrReport> {
    const [report] = await db.insert(kycStrReports).values(data).returning();
    return report;
  }

  async getStrReport(id: number, orgId: number): Promise<KycStrReport | undefined> {
    const [report] = await db.select().from(kycStrReports)
      .where(and(eq(kycStrReports.id, id), eq(kycStrReports.orgId, orgId)));
    return report;
  }

  async listStrReports(orgId: number): Promise<KycStrReport[]> {
    return db.select().from(kycStrReports)
      .where(eq(kycStrReports.orgId, orgId))
      .orderBy(desc(kycStrReports.createdAt));
  }

  async updateStrReport(id: number, orgId: number, data: Partial<InsertKycStrReport>): Promise<KycStrReport | undefined> {
    const [report] = await db.update(kycStrReports)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(kycStrReports.id, id), eq(kycStrReports.orgId, orgId)))
      .returning();
    return report;
  }

  // ============== CIE Securities ==============
  async createCieSecurity(data: InsertCieSecurity): Promise<CieSecurity> {
    const [sec] = await db.insert(cieSecurities).values(data).returning();
    return sec;
  }

  async upsertCieSecurity(data: InsertCieSecurity): Promise<CieSecurity> {
    const [sec] = await db.insert(cieSecurities).values(data)
      .onConflictDoUpdate({
        target: cieSecurities.symbol,
        set: { name: data.name, sector: data.sector, isActive: data.isActive, updatedAt: new Date() },
      }).returning();
    return sec;
  }

  async getCieSecurityBySymbol(symbol: string): Promise<CieSecurity | undefined> {
    const [sec] = await db.select().from(cieSecurities).where(eq(cieSecurities.symbol, symbol.toUpperCase()));
    return sec;
  }

  async listCieSecurities(activeOnly = true): Promise<CieSecurity[]> {
    if (activeOnly) {
      return db.select().from(cieSecurities).where(eq(cieSecurities.isActive, true)).orderBy(cieSecurities.symbol);
    }
    return db.select().from(cieSecurities).orderBy(cieSecurities.symbol);
  }

  async updateCieSecurity(id: number, data: Partial<InsertCieSecurity>): Promise<CieSecurity | undefined> {
    const [sec] = await db.update(cieSecurities).set({ ...data, updatedAt: new Date() }).where(eq(cieSecurities.id, id)).returning();
    return sec;
  }

  // ============== CIE Prices ==============
  async upsertCiePrice(data: InsertCiePrice): Promise<CiePrice> {
    const [price] = await db.insert(ciePrices).values(data)
      .onConflictDoUpdate({
        target: [ciePrices.securityId, ciePrices.tradeDate],
        set: {
          openKobo: data.openKobo,
          highKobo: data.highKobo,
          lowKobo: data.lowKobo,
          closeKobo: data.closeKobo,
          volume: data.volume,
        },
      }).returning();
    return price;
  }

  async listCiePrices(securityId: number, days = 90): Promise<CiePrice[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);
    return db.select().from(ciePrices)
      .where(and(eq(ciePrices.securityId, securityId), gte(ciePrices.tradeDate, cutoffStr)))
      .orderBy(desc(ciePrices.tradeDate));
  }

  async getLatestCiePrice(securityId: number): Promise<CiePrice | undefined> {
    const [price] = await db.select().from(ciePrices)
      .where(eq(ciePrices.securityId, securityId))
      .orderBy(desc(ciePrices.tradeDate))
      .limit(1);
    return price;
  }

  // ============== CIE Scores ==============
  async upsertCieScore(data: InsertCieScore): Promise<CieScore> {
    const [score] = await db.insert(cieScores).values(data)
      .onConflictDoUpdate({
        target: [cieScores.securityId, cieScores.scoreDate],
        set: {
          ias: data.ias,
          rs: data.rs,
          cs: data.cs,
          recommendation: data.recommendation,
          pillarBreakdown: data.pillarBreakdown,
          modelVersionId: data.modelVersionId,
          dataPointsUsed: data.dataPointsUsed,
          // Technical indicators
          rsi14: data.rsi14,
          ma50Kobo: data.ma50Kobo,
          aboveMa50: data.aboveMa50,
          weekReturn: data.weekReturn,
          monthReturn: data.monthReturn,
          ytdReturn: data.ytdReturn,
          dSig: data.dSig,
          wSig: data.wSig,
          mSig: data.mSig,
          ySig: data.ySig,
          stars: data.stars,
        },
      }).returning();
    return score;
  }

  async getLatestCieScore(securityId: number): Promise<CieScore | undefined> {
    const [score] = await db.select().from(cieScores)
      .where(eq(cieScores.securityId, securityId))
      .orderBy(desc(cieScores.scoreDate))
      .limit(1);
    return score;
  }

  async listLatestCieScores(): Promise<(CieScore & { symbol: string; name: string; sector: string })[]> {
    const latestDates = await db.select({
      securityId: cieScores.securityId,
      maxDate: sql<string>`MAX(${cieScores.scoreDate})`.as("max_date"),
    }).from(cieScores).groupBy(cieScores.securityId);

    if (latestDates.length === 0) return [];

    const results: (CieScore & { symbol: string; name: string; sector: string })[] = [];
    for (const { securityId, maxDate } of latestDates) {
      const [row] = await db.select({
        id: cieScores.id,
        securityId: cieScores.securityId,
        scoreDate: cieScores.scoreDate,
        ias: cieScores.ias,
        rs: cieScores.rs,
        cs: cieScores.cs,
        recommendation: cieScores.recommendation,
        pillarBreakdown: cieScores.pillarBreakdown,
        modelVersionId: cieScores.modelVersionId,
        dataPointsUsed: cieScores.dataPointsUsed,
        // Technical indicators
        rsi14: cieScores.rsi14,
        ma50Kobo: cieScores.ma50Kobo,
        aboveMa50: cieScores.aboveMa50,
        weekReturn: cieScores.weekReturn,
        monthReturn: cieScores.monthReturn,
        ytdReturn: cieScores.ytdReturn,
        dSig: cieScores.dSig,
        wSig: cieScores.wSig,
        mSig: cieScores.mSig,
        ySig: cieScores.ySig,
        stars: cieScores.stars,
        createdAt: cieScores.createdAt,
        symbol: cieSecurities.symbol,
        name: cieSecurities.name,
        sector: cieSecurities.sector,
      }).from(cieScores)
        .innerJoin(cieSecurities, eq(cieScores.securityId, cieSecurities.id))
        .where(and(eq(cieScores.securityId, securityId), eq(cieScores.scoreDate, maxDate)));
      if (row) results.push(row);
    }
    return results.sort((a, b) => (b.ias ?? 0) - (a.ias ?? 0));
  }

  /** Task-spec alias: same as listLatestCieScores */
  async getLatestCieScores(): Promise<(CieScore & { symbol: string; name: string; sector: string })[]> {
    return this.listLatestCieScores();
  }

  async listCieScoreHistory(securityId: number, days = 30): Promise<CieScore[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);
    return db.select().from(cieScores)
      .where(and(eq(cieScores.securityId, securityId), gte(cieScores.scoreDate, cutoffStr)))
      .orderBy(desc(cieScores.scoreDate));
  }

  // ============== CIE Model Versions ==============
  async createCieModelVersion(data: InsertCieModelVersion): Promise<CieModelVersion> {
    const [mv] = await db.insert(cieModelVersions).values(data).returning();
    return mv;
  }

  async getCieModelVersion(id: number): Promise<CieModelVersion | undefined> {
    const [mv] = await db.select().from(cieModelVersions).where(eq(cieModelVersions.id, id));
    return mv;
  }

  async listCieModelVersions(): Promise<CieModelVersion[]> {
    return db.select().from(cieModelVersions).orderBy(desc(cieModelVersions.createdAt));
  }

  async getActiveCieModelVersion(): Promise<CieModelVersion | undefined> {
    const [mv] = await db.select().from(cieModelVersions)
      .where(eq(cieModelVersions.status, "active"))
      .orderBy(desc(cieModelVersions.activatedAt))
      .limit(1);
    return mv;
  }

  async updateCieModelVersion(id: number, data: Partial<InsertCieModelVersion>): Promise<CieModelVersion | undefined> {
    const [mv] = await db.update(cieModelVersions).set({ ...data, updatedAt: new Date() }).where(eq(cieModelVersions.id, id)).returning();
    return mv;
  }

  /** Transition a model version from draft → pending (submit for review) */
  async submitCieModelVersion(id: number): Promise<CieModelVersion | undefined> {
    const [mv] = await db.update(cieModelVersions)
      .set({ status: "pending", updatedAt: new Date() })
      .where(and(eq(cieModelVersions.id, id), eq(cieModelVersions.status, "draft")))
      .returning();
    return mv;
  }

  /** Transition a model version from pending → active. Demotes any current active to draft. */
  async activateCieModelVersion(id: number, reviewerUserId: string): Promise<CieModelVersion | undefined> {
    // Only allow activation from pending state (enforce lifecycle)
    const [candidate] = await db.select().from(cieModelVersions).where(eq(cieModelVersions.id, id));
    if (!candidate || candidate.status !== "pending") return undefined;
    await db.update(cieModelVersions).set({ status: "draft", updatedAt: new Date() }).where(eq(cieModelVersions.status, "active"));
    const [mv] = await db.update(cieModelVersions)
      .set({ status: "active", reviewedByUserId: reviewerUserId, activatedAt: new Date(), updatedAt: new Date() })
      .where(eq(cieModelVersions.id, id))
      .returning();
    return mv;
  }

  // ============== CIE Dividends ==============
  async createCieDividend(data: InsertCieDividend): Promise<CieDividend> {
    const [div] = await db.insert(cieDividends).values(data).returning();
    return div;
  }

  async listCieDividends(upcomingOnly = false): Promise<(CieDividend & { symbol: string; name: string })[]> {
    const today = new Date().toISOString().slice(0, 10);
    const selectShape = {
      id: cieDividends.id,
      securityId: cieDividends.securityId,
      exDividendDate: cieDividends.exDividendDate,
      paymentDate: cieDividends.paymentDate,
      amountPerShareKobo: cieDividends.amountPerShareKobo,
      notes: cieDividends.notes,
      createdAt: cieDividends.createdAt,
      symbol: cieSecurities.symbol,
      name: cieSecurities.name,
    } as const;

    const base = db.select(selectShape)
      .from(cieDividends)
      .innerJoin(cieSecurities, eq(cieDividends.securityId, cieSecurities.id));

    const rows = upcomingOnly
      ? await base.where(gte(cieDividends.exDividendDate, today)).orderBy(cieDividends.exDividendDate)
      : await base.orderBy(desc(cieDividends.exDividendDate));

    return rows as (CieDividend & { symbol: string; name: string })[];
  }

  async deleteCieDividend(id: number): Promise<void> {
    await db.delete(cieDividends).where(eq(cieDividends.id, id));
  }

  // ============== CIE Signals ==============
  async createCieSignal(data: InsertCieSignal): Promise<CieSignal> {
    const [sig] = await db.insert(cieSignals).values(data).returning();
    return sig;
  }

  async listCieSignals(publishedOnly = true, limit = 50): Promise<(CieSignal & { symbol: string | null })[]> {
    const selectShape = {
      id: cieSignals.id,
      securityId: cieSignals.securityId,
      type: cieSignals.type,
      sentiment: cieSignals.sentiment,
      credibility: cieSignals.credibility,
      content: cieSignals.content,
      analystUserId: cieSignals.analystUserId,
      tags: cieSignals.tags,
      isPublished: cieSignals.isPublished,
      publishedAt: cieSignals.publishedAt,
      expiresAt: cieSignals.expiresAt,
      createdAt: cieSignals.createdAt,
      symbol: cieSecurities.symbol,
    } as const;

    const base = db.select(selectShape)
      .from(cieSignals)
      .leftJoin(cieSecurities, eq(cieSignals.securityId, cieSecurities.id));

    const rows = publishedOnly
      ? await base.where(eq(cieSignals.isPublished, true)).orderBy(desc(cieSignals.publishedAt)).limit(limit)
      : await base.orderBy(desc(cieSignals.createdAt)).limit(limit);

    return rows as (CieSignal & { symbol: string | null })[];
  }

  async updateCieSignal(id: number, data: Partial<InsertCieSignal>): Promise<CieSignal | undefined> {
    const [sig] = await db.update(cieSignals).set(data).where(eq(cieSignals.id, id)).returning();
    return sig;
  }

  async deleteCieSignal(id: number): Promise<void> {
    await db.delete(cieSignals).where(eq(cieSignals.id, id));
  }

  // ============== CIE Market Pulse ==============
  async getLatestCieMarketPulse(): Promise<CieMarketPulse | undefined> {
    const [pulse] = await db.select().from(cieMarketPulse).orderBy(desc(cieMarketPulse.createdAt)).limit(1);
    return pulse;
  }

  async upsertCieMarketPulse(data: InsertCieMarketPulse): Promise<CieMarketPulse> {
    const [pulse] = await db.insert(cieMarketPulse).values(data).returning();
    return pulse;
  }

  async updateLatestCieMarketPulseCommentary(commentary: string): Promise<boolean> {
    const [latest] = await db.select({ id: cieMarketPulse.id })
      .from(cieMarketPulse)
      .orderBy(desc(cieMarketPulse.createdAt))
      .limit(1);
    if (!latest) return false;
    await db.update(cieMarketPulse)
      .set({ commentary })
      .where(eq(cieMarketPulse.id, latest.id));
    return true;
  }

  // ============== CIE Market Context ==============
  async upsertCieMarketContext(data: InsertCieMarketContext): Promise<CieMarketContext> {
    const [ctx] = await db.insert(cieMarketContext).values(data)
      .onConflictDoUpdate({
        target: cieMarketContext.contextDate,
        set: {
          asiCloseKobo: data.asiCloseKobo,
          asiChangePctBps: data.asiChangePctBps,
          brentUsdCents: data.brentUsdCents,
          ngnPerUsd: data.ngnPerUsd,
          cbnMprBps: data.cbnMprBps,
          gainersCount: data.gainersCount,
          losersCount: data.losersCount,
          notes: data.notes,
          updatedAt: new Date(),
        },
      }).returning();
    return ctx;
  }

  async getLatestCieMarketContext(): Promise<CieMarketContext | undefined> {
    const [ctx] = await db.select().from(cieMarketContext)
      .orderBy(desc(cieMarketContext.contextDate))
      .limit(1);
    return ctx;
  }

  async getCieMarketContextByDate(date: string): Promise<CieMarketContext | undefined> {
    const [ctx] = await db.select().from(cieMarketContext)
      .where(eq(cieMarketContext.contextDate, date));
    return ctx;
  }

  // ============== CIE Ingestion Logs ==============
  async createCieIngestionLog(data: InsertCieIngestionLog): Promise<CieIngestionLog> {
    const [log] = await db.insert(cieIngestionLogs).values(data).returning();
    return log;
  }

  async updateCieIngestionLog(id: number, data: Partial<InsertCieIngestionLog>): Promise<CieIngestionLog | undefined> {
    const [log] = await db.update(cieIngestionLogs).set(data).where(eq(cieIngestionLogs.id, id)).returning();
    return log;
  }

  async listCieIngestionLogs(limit = 50): Promise<CieIngestionLog[]> {
    return db.select().from(cieIngestionLogs).orderBy(desc(cieIngestionLogs.createdAt)).limit(limit);
  }

  // ============== CIE Subscriptions ==============
  async createCieSubscription(data: InsertCieSubscription): Promise<CieSubscription> {
    const [sub] = await db.insert(cieSubscriptions).values(data).returning();
    return sub;
  }

  async getCieSubscriptionById(id: number): Promise<CieSubscription | undefined> {
    const [sub] = await db.select().from(cieSubscriptions).where(eq(cieSubscriptions.id, id));
    return sub;
  }

  async getCieSubscriptionByUserId(userId: string): Promise<CieSubscription | undefined> {
    // Returns the current ACTIVE subscription for this user (most recent period end).
    // Use getLatestCieSubscriptionByUserId when you need records in any status.
    const [sub] = await db.select().from(cieSubscriptions)
      .where(and(eq(cieSubscriptions.userId, userId), eq(cieSubscriptions.status, "active")))
      .orderBy(desc(cieSubscriptions.currentPeriodEnd))
      .limit(1);
    return sub;
  }

  async getLatestCieSubscriptionByUserId(userId: string): Promise<CieSubscription | undefined> {
    // Returns the most recent subscription for this user regardless of status.
    // Used by the subscribe/upgrade routes to detect existing pending records.
    const [sub] = await db.select().from(cieSubscriptions)
      .where(eq(cieSubscriptions.userId, userId))
      .orderBy(desc(cieSubscriptions.createdAt))
      .limit(1);
    return sub;
  }

  async getCieSubscriptionByOrgId(orgId: number): Promise<CieSubscription | undefined> {
    // Returns the most recent active subscription for this org.
    const [sub] = await db.select().from(cieSubscriptions)
      .where(and(eq(cieSubscriptions.orgId, orgId), eq(cieSubscriptions.status, 'active')))
      .orderBy(desc(cieSubscriptions.createdAt))
      .limit(1);
    return sub;
  }

  async getCieSubscriptionByReference(reference: string): Promise<CieSubscription | undefined> {
    const [sub] = await db.select().from(cieSubscriptions)
      .where(eq(cieSubscriptions.paystackReference, reference));
    return sub;
  }

  async getCieSubscriptionByPaystackCode(code: string): Promise<CieSubscription | undefined> {
    const [sub] = await db.select().from(cieSubscriptions)
      .where(eq(cieSubscriptions.paystackSubscriptionCode, code));
    return sub;
  }

  async updateCieSubscription(id: number, data: Partial<InsertCieSubscription>): Promise<CieSubscription | undefined> {
    const [sub] = await db.update(cieSubscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cieSubscriptions.id, id))
      .returning();
    return sub;
  }

  async listCieSubscriptions(limit = 100): Promise<CieSubscription[]> {
    return db.select().from(cieSubscriptions).orderBy(desc(cieSubscriptions.createdAt)).limit(limit);
  }
}

export const storage = new DatabaseStorage();
