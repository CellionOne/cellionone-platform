import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { featureFlags, users, userRoles, companyApplications, auditLogs, serviceAddresses, productCatalog, kycDocumentRequirements, rfqCategories } from "@shared/schema";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function seedDatabase() {
  try {
    // Seed feature flags
    const allFlags = [
      { key: "kyc_verification", isEnabled: true, description: "Enable KYC identity verification" },
      { key: "ai_suggestions", isEnabled: true, description: "Enable AI-powered CAC activity suggestions" },
      { key: "document_vault", isEnabled: true, description: "Enable document vault feature" },
      { key: "courier_tracking", isEnabled: false, description: "Enable courier tracking for document delivery" },
      { key: "multi_director", isEnabled: true, description: "Allow multiple directors per application" },
      { key: "bulk_applications", isEnabled: false, description: "Allow bulk application submissions" },
      { key: "offline_drafting", isEnabled: true, description: "Enable offline draft saving with IndexedDB sync" },
      { key: "document_quality_check", isEnabled: true, description: "Enable AI-powered document quality analysis" },
      { key: "ai_clarifications", isEnabled: true, description: "Enable AI-assisted clarification drafting" },
      { key: "execution_declarations", isEnabled: true, description: "Enable execution declaration tracking" },
      { key: "verification_receipts", isEnabled: true, description: "Enable verification receipt issuance" },
      { key: "readiness_scoring", isEnabled: true, description: "Enable application readiness scoring" },
      { key: "enable_registered_office_service", isEnabled: true, description: "Enable registered office address service" },
      { key: "enable_mail_handling", isEnabled: true, description: "Enable mail handling for registered office" },
      { key: "enable_mail_approval_flow", isEnabled: true, description: "Enable mail approval workflow" },
      { key: "enable_registered_office_payment_required", isEnabled: false, description: "Require payment for registered office (beta: false)" },
      { key: "enable_verification_required_for_registered_office", isEnabled: true, description: "Require identity verification for standalone registered office" },
      { key: "enable_paystack_payments", isEnabled: true, description: "Enable Paystack payment processing (NGN)" },
      { key: "enable_paystack_split_settlement", isEnabled: true, description: "Enable Paystack split settlement to lawyer subaccount" },
      { key: "enable_verification_payment_required", isEnabled: false, description: "Require payment for identity verification (beta: false)" },
      { key: "enable_incorporation_payment_required", isEnabled: false, description: "Require payment for incorporation (beta: false)" },
      { key: "enable_escrow_payments", isEnabled: false, description: "Enable escrow payment system for procurement contracts (requires banking partner)" },
    ];
    
    // Always insert any missing feature flags
    for (const flag of allFlags) {
      await db.insert(featureFlags).values(flag).onConflictDoNothing();
    }
    console.log("Synced feature flags");

    // Seed service address for registered office (deduplicate on startup)
    const existingAddresses = await db.select().from(serviceAddresses);
    if (existingAddresses.length === 0) {
      await db.insert(serviceAddresses).values({
        label: "Cellion One Registered Office (Ikoyi)",
        line1: "51 Raymond Njoku Street, Off Awolowo Road",
        line2: "Ikoyi",
        floorDetails: "First Floor",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        isActive: true,
      });
    } else if (existingAddresses.length > 1) {
      // Clean up duplicates: keep the lowest ID per unique line1+city+state
      const keepIds = await db.execute(sql`SELECT MIN(id) as id FROM service_addresses GROUP BY line_1, city, state`);
      const idsToKeep = (keepIds.rows as any[]).map((r: any) => r.id);
      if (idsToKeep.length > 0) {
        await db.execute(sql`DELETE FROM service_addresses WHERE id NOT IN (${sql.join(idsToKeep.map(id => sql`${id}`), sql`, `)})`);
        console.log(`Cleaned up duplicate service addresses, kept ${idsToKeep.length}`);
      }
      // Fix any old "Celion" typo labels
      await db.execute(sql`UPDATE service_addresses SET label = 'Cellion One Registered Office (Ikoyi)' WHERE label LIKE 'Celion%'`);
    }
    console.log("Synced service addresses");

    // Seed product catalog with fixed-cut SKUs (prices in kobo: ₦1 = 100 kobo)
    const catalogItems = [
      { sku: "CAC_1M", name: "Company Incorporation (₦1M Share Capital)", category: "incorporation", priceNgn: 10000000, cellionCutNgn: 2500000, metadata: { shareCapital: 1000000 } },
      { sku: "CAC_5M", name: "Company Incorporation (₦5M Share Capital)", category: "incorporation", priceNgn: 15000000, cellionCutNgn: 2500000, metadata: { shareCapital: 5000000 } },
      { sku: "CAC_10M", name: "Company Incorporation (₦10M Share Capital)", category: "incorporation", priceNgn: 35000000, cellionCutNgn: 3500000, metadata: { shareCapital: 10000000 } },
      { sku: "CAC_20M", name: "Company Incorporation (₦20M Share Capital)", category: "incorporation", priceNgn: 55000000, cellionCutNgn: 4000000, metadata: { shareCapital: 20000000 } },
      { sku: "CAC_100M", name: "Company Incorporation (₦100M Share Capital, incl. Foreign Participation per CAMA)", category: "incorporation", priceNgn: 300000000, cellionCutNgn: 10000000, metadata: { shareCapital: 100000000, foreignParticipation: true } },
      { sku: "SCUML", name: "SCUML Certificate (EFCC)", category: "post_incorporation", priceNgn: 15000000, cellionCutNgn: 2500000, metadata: { deliveryDays: 5 } },
      { sku: "TM", name: "Trademark Registration (2 Stages)", category: "post_incorporation", priceNgn: 25000000, cellionCutNgn: 3500000 },
      { sku: "TIN", name: "TIN Registration (FIRS)", category: "post_incorporation", priceNgn: 2000000, cellionCutNgn: 1000000, metadata: { note: "Price may vary by company location" } },
      { sku: "NGO", name: "Registration of Incorporated Trustees (NGO)", category: "incorporation", priceNgn: 25000000, cellionCutNgn: 4000000, metadata: { note: "Includes filing fees, newspaper publications, constitution and legal charges" } },
      { sku: "VERIFY", name: "Identity & Company Verification", category: "verification", priceNgn: 1000000, cellionCutNgn: 1000000, metadata: { note: "One-time verification fee per person. Covers BVN/NIN validation, government ID document verification, biometric selfie matching, and AML/sanctions screening through Smile ID." } },
      { sku: "ADD_DIR", name: "Add Director to Company", category: "post_incorporation", priceNgn: 7500000, cellionCutNgn: 2000000, metadata: { note: "Post-incorporation service to formally appoint a new director at the Corporate Affairs Commission (CAC). Includes Form CAC 7 filing and board resolution preparation." } },
    ];
    for (const item of catalogItems) {
      await db.insert(productCatalog).values(item).onConflictDoNothing();
    }
    console.log("Synced product catalog");

    const SUPER_ADMIN_EMAIL = "service@cellionone.com";
    const existingSuperAdmin = await db.select().from(users).where(eq(users.email, SUPER_ADMIN_EMAIL)).limit(1);
    if (existingSuperAdmin.length === 0) {
      const initialPassword = crypto.randomBytes(16).toString("hex");
      const passwordHash = await bcrypt.hash(initialPassword, 12);
      const superAdminId = crypto.randomUUID();
      await db.insert(users).values({
        id: superAdminId,
        email: SUPER_ADMIN_EMAIL,
        firstName: "Super",
        lastName: "Admin",
        passwordHash,
        emailVerified: true,
      });
      const existingRole = await db.select().from(userRoles)
        .where(and(eq(userRoles.userId, superAdminId), eq(userRoles.role, "admin")))
        .limit(1);
      if (existingRole.length === 0) {
        await db.insert(userRoles).values({ userId: superAdminId, role: "admin" });
      }
      console.log("==========================================================");
      console.log("SUPER ADMIN ACCOUNT CREATED");
      console.log(`Email: ${SUPER_ADMIN_EMAIL}`);
      console.log(`Initial Password: ${initialPassword}`);
      console.log("IMPORTANT: Change this password immediately after first login!");
      console.log("==========================================================");
    } else {
      const adminUser = existingSuperAdmin[0];
      const existingRole = await db.select().from(userRoles)
        .where(and(eq(userRoles.userId, adminUser.id), eq(userRoles.role, "admin")))
        .limit(1);
      if (existingRole.length === 0) {
        await db.insert(userRoles).values({ userId: adminUser.id, role: "admin" });
        console.log("Super admin role assigned to existing user: " + SUPER_ADMIN_EMAIL);
      }
    }

    // Seed demo users if in development
    if (process.env.NODE_ENV !== "production") {
      // Insert demo users (always sync)
      const demoUsers = [
        { id: "demo-admin-001", username: "admin@celion.ng", email: "admin@celion.ng", firstName: "Admin", lastName: "User" },
        { id: "demo-lawyer-001", username: "lawyer@celion.ng", email: "lawyer@celion.ng", firstName: "Chinedu", lastName: "Okonkwo" },
        { id: "demo-lawyer-002", username: "lawyer2@celion.ng", email: "lawyer2@celion.ng", firstName: "Amaka", lastName: "Nwachukwu" },
        { id: "demo-founder-001", username: "founder@celion.ng", email: "founder@celion.ng", firstName: "Emeka", lastName: "Okoro" },
        { id: "demo-founder-002", username: "founder2@celion.ng", email: "founder2@celion.ng", firstName: "Ngozi", lastName: "Adeyemi" },
      ];
      
      for (const user of demoUsers) {
        await db.insert(users).values(user).onConflictDoNothing();
      }
      console.log("Synced demo users");

      const demoRoles = [
        { userId: "demo-admin-001", role: "admin" },
        { userId: "demo-lawyer-001", role: "lawyer" },
        { userId: "demo-lawyer-002", role: "lawyer" },
        { userId: "demo-founder-001", role: "founder" },
        { userId: "demo-founder-002", role: "founder" },
      ];
      
      for (const r of demoRoles) {
        const existing = await db.select().from(userRoles)
          .where(and(eq(userRoles.userId, r.userId), eq(userRoles.role, r.role)))
          .limit(1);
        if (existing.length === 0) {
          await db.insert(userRoles).values(r);
        }
      }
      console.log("Synced demo user roles");
      
      // Check for and seed sample data if needed
      const existingApps = await db.select().from(companyApplications).limit(1);
      if (existingApps.length === 0) {

        // Seed sample applications
        await db.insert(companyApplications).values({
          founderUserId: "demo-founder-001",
          companyType: "LTD",
          companyName1: "TechHub Nigeria Limited",
          companyName2: "TechHub Africa Ltd",
          companyName3: "TechHub Solutions",
          businessDescription: "Software development, IT consulting, and digital transformation services for Nigerian businesses",
          registeredAddress: { line1: "12 Marina Street", city: "Lagos Island", state: "Lagos" },
          status: "under_review",
          assignedLawyerUserId: "demo-lawyer-001",
        });
        await db.insert(companyApplications).values({
          founderUserId: "demo-founder-001",
          companyType: "LTD",
          companyName1: "GreenFarm Agritech",
          companyName2: "GreenFarm Nigeria",
          companyName3: "GreenFarm Solutions",
          businessDescription: "Agricultural technology, farm produce distribution, and agribusiness consulting",
          registeredAddress: { line1: "45 Ahmadu Bello Way", city: "Kaduna", state: "Kaduna" },
          status: "draft",
        });
        await db.insert(companyApplications).values({
          founderUserId: "demo-founder-002",
          companyType: "PLC",
          companyName1: "NaijaFinance PLC",
          companyName2: "Nigerian Finance Holdings",
          companyName3: "NaijaFin Group",
          businessDescription: "Financial services, investment management, and wealth advisory for high-net-worth individuals",
          registeredAddress: { line1: "78 Awolowo Road", city: "Ikoyi", state: "Lagos" },
          status: "submitted",
        });
        console.log("Seeded sample applications");

        // Seed audit logs
        await db.insert(auditLogs).values([
          { actorUserId: "demo-admin-001", action: "user_role_change", entityType: "user", entityId: "demo-lawyer-001", details: { role: "lawyer", action: "add" }, ipAddress: "127.0.0.1" },
          { actorUserId: "demo-founder-001", action: "create_application", entityType: "company_application", entityId: "1", ipAddress: "127.0.0.1" },
          { actorUserId: "demo-admin-001", action: "assign_lawyer", entityType: "company_application", entityId: "1", details: { lawyerId: "demo-lawyer-001" }, ipAddress: "127.0.0.1" },
        ]);
        console.log("Seeded audit logs");
      }
    }
    
    // Seed KYC standard document requirements (global, orgId = null)
    const kycStandardDocs = [
      { type: "supplier", documentName: "CAC Certificate of Incorporation", documentDescription: "Official certificate issued by the Corporate Affairs Commission confirming company registration", documentCategory: "registration", isStandard: true, isMandatory: true, isActive: true, hasExpiry: false },
      { type: "supplier", documentName: "CAC Form CO2/CO7 — Particulars of Directors", documentDescription: "Official filing showing allotment of shares and particulars of directors", documentCategory: "registration", isStandard: true, isMandatory: true, isActive: true, hasExpiry: false },
      { type: "supplier", documentName: "Tax Identification Number (TIN) Certificate", documentDescription: "Certificate issued by the Federal Inland Revenue Service", documentCategory: "tax", isStandard: true, isMandatory: true, isActive: true, hasExpiry: false },
      { type: "supplier", documentName: "VAT Registration Certificate", documentDescription: "Value Added Tax registration certificate from FIRS", documentCategory: "tax", isStandard: true, isMandatory: false, isActive: true, hasExpiry: false },
      { type: "supplier", documentName: "Current Tax Clearance Certificate", documentDescription: "Annual tax clearance certificate confirming tax compliance", documentCategory: "tax", isStandard: true, isMandatory: true, isActive: true, hasExpiry: true },
      { type: "supplier", documentName: "Memorandum & Articles of Association", documentDescription: "Company's constitutional documents filed with CAC", documentCategory: "registration", isStandard: true, isMandatory: false, isActive: true, hasExpiry: false },
      { type: "supplier", documentName: "Bank Reference Letter", documentDescription: "Reference letter from the company's primary bank", documentCategory: "financial", isStandard: true, isMandatory: false, isActive: true, hasExpiry: true },
      { type: "supplier", documentName: "Proof of Business Address", documentDescription: "Utility bill, lease agreement, or other proof of registered business address", documentCategory: "compliance", isStandard: true, isMandatory: false, isActive: true, hasExpiry: false },
      { type: "individual", documentName: "Government-Issued ID", documentDescription: "Valid government-issued identification (driver's licence, international passport, NIN slip, voter's card)", documentCategory: "identity", isStandard: true, isMandatory: true, isActive: true, hasExpiry: true },
      { type: "individual", documentName: "Passport Photograph", documentDescription: "Recent passport-sized photograph with white background", documentCategory: "identity", isStandard: true, isMandatory: true, isActive: true, hasExpiry: false },
      { type: "individual", documentName: "Proof of Residential Address", documentDescription: "Utility bill, bank statement, or government letter showing current residential address (dated within 3 months)", documentCategory: "compliance", isStandard: true, isMandatory: false, isActive: true, hasExpiry: true },
    ];

    for (const doc of kycStandardDocs) {
      await db.insert(kycDocumentRequirements).values(doc).onConflictDoNothing();
    }
    console.log("Synced KYC standard document requirements");

    const procurementCategories = [
      { name: "IT & Technology", slug: "it-technology", description: "Software, hardware, cloud services, and IT consulting", parentId: null },
      { name: "Software Development", slug: "software-development", description: "Custom software, web, and mobile app development", parentId: null },
      { name: "Hardware Supply", slug: "hardware-supply", description: "Computers, servers, networking equipment", parentId: null },
      { name: "IT Consulting", slug: "it-consulting", description: "Technology advisory and implementation services", parentId: null },
      { name: "Cloud Services", slug: "cloud-services", description: "Cloud hosting, SaaS, and infrastructure services", parentId: null },
      { name: "Professional Services", slug: "professional-services", description: "Legal, accounting, consulting, and training services", parentId: null },
      { name: "Legal Services", slug: "legal-services", description: "Legal advisory, compliance, and regulatory services", parentId: null },
      { name: "Accounting & Audit", slug: "accounting-audit", description: "Bookkeeping, auditing, and financial reporting", parentId: null },
      { name: "Management Consulting", slug: "management-consulting", description: "Strategy, operations, and management advisory", parentId: null },
      { name: "Training & Development", slug: "training-development", description: "Corporate training, workshops, and capacity building", parentId: null },
      { name: "Office Supplies & Equipment", slug: "office-supplies", description: "Stationery, furniture, and office equipment", parentId: null },
      { name: "Construction & Facilities", slug: "construction-facilities", description: "Building, renovation, and facility management", parentId: null },
      { name: "Logistics & Transportation", slug: "logistics-transportation", description: "Freight, courier, warehousing, and fleet services", parentId: null },
      { name: "Marketing & Communications", slug: "marketing-communications", description: "Advertising, PR, branding, and digital marketing", parentId: null },
      { name: "Manufacturing & Industrial", slug: "manufacturing-industrial", description: "Raw materials, fabrication, and industrial supplies", parentId: null },
      { name: "Financial Services", slug: "financial-services", description: "Banking, insurance, and investment services", parentId: null },
      { name: "Healthcare & Pharmaceuticals", slug: "healthcare-pharma", description: "Medical supplies, pharmaceuticals, and health services", parentId: null },
      { name: "Energy & Utilities", slug: "energy-utilities", description: "Power generation, oil & gas, and utility services", parentId: null },
      { name: "Security Services", slug: "security-services", description: "Physical security, cybersecurity, and risk management", parentId: null },
      { name: "Food & Catering", slug: "food-catering", description: "Catering, food supply, and hospitality services", parentId: null },
    ];

    for (const cat of procurementCategories) {
      await db.insert(rfqCategories).values(cat).onConflictDoNothing();
    }
    console.log("Synced procurement categories");

    console.log("Database seeding complete");
  } catch (error) {
    console.error("Seed error:", error);
  }
}
