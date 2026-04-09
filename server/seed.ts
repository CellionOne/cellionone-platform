import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { featureFlags, users, userRoles, companyApplications, auditLogs, serviceAddresses, productCatalog, kycDocumentRequirements, rfqCategories, loginAttempts, cieSecurities, cieModelVersions, cieMarketPulse, ciePartners, kycApiKeys } from "@shared/schema";
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
      { key: "enable_escrow_payments", isEnabled: true, description: "Enable escrow payment system for procurement contracts and Escrow-as-a-Service API" },
      { key: "enable_sanctions_monitoring", isEnabled: true, description: "Enable weekly automated sanctions/AML re-screening for all verified individuals" },
      { key: "enable_kyc_hosted_sessions", isEnabled: true, description: "Enable hosted KYC session links (no-code verification URLs for API customers)" },
      { key: "enable_cie_service", isEnabled: true, description: "Enable CIE (Cellion Intelligence Engine) — NGX equity intelligence scores and signals" },
    ];
    
    // Upsert feature flags — keep existing isEnabled values unless flag is new,
    // EXCEPT for flags we want to force-enable on startup (controlled list below)
    const forceEnabled = new Set(["enable_sanctions_monitoring"]);
    for (const flag of allFlags) {
      if (forceEnabled.has(flag.key)) {
        await db.insert(featureFlags).values(flag).onConflictDoUpdate({
          target: featureFlags.key,
          set: { isEnabled: flag.isEnabled, description: flag.description },
        });
      } else {
        await db.insert(featureFlags).values(flag).onConflictDoUpdate({
          target: featureFlags.key,
          set: { description: flag.description },
        });
      }
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
      { sku: "OFFICE_ONLY", name: "Registered Office Address (Office Only)", category: "registered_office", priceNgn: 7500000, cellionCutNgn: 7500000, metadata: { tier: "office_only", annual: true, note: "Annual registered office address at our Lagos premises. Includes official CAC-registered address and annual renewal." } },
      { sku: "OFFICE_PLUS_MAIL", name: "Registered Office Address (Office + Mail Handling)", category: "registered_office", priceNgn: 15000000, cellionCutNgn: 15000000, metadata: { tier: "office_plus_mail", annual: true, note: "Annual registered office address plus mail receiving, scanning, and forwarding services." } },
      { sku: "EXISTING_CO_VERIFY", name: "Existing Company Verification", category: "verification", priceNgn: 2500000, cellionCutNgn: 2500000, metadata: { note: "One-time company verification fee for existing companies. Covers Smile ID KYB (CAC database check), TIN lookup, and document review by our legal team." } },
      { sku: "BANK_ACCOUNT", name: "Corporate Bank Account Opening", category: "post_incorporation", priceNgn: 0, cellionCutNgn: 0, metadata: { requiresManualPricing: true, note: "Corporate bank account opening service. Fee varies by partner bank. Our team will contact you with pricing after submission." } },
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
      console.log("Password: [set via ADMIN_BOOTSTRAP_PASSWORD env var — not logged for security]");
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
      // One-time admin password bootstrap — runs when ADMIN_BOOTSTRAP_PASSWORD is set
      const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
      if (bootstrapPassword) {
        const newHash = await bcrypt.hash(bootstrapPassword, 12);
        await db.update(users).set({ passwordHash: newHash, emailVerified: true }).where(eq(users.email, SUPER_ADMIN_EMAIL));
        // Also clear any lockout so the admin can log in immediately
        await db.delete(loginAttempts).where(eq(loginAttempts.identifier, SUPER_ADMIN_EMAIL));
        console.log("==========================================================");
        console.log("SUPER ADMIN PASSWORD BOOTSTRAPPED");
        console.log(`Email: ${SUPER_ADMIN_EMAIL}`);
        console.log("Password set from ADMIN_BOOTSTRAP_PASSWORD env var");
        console.log("Lockout cleared.");
        console.log("==========================================================");
      }
    }

    // Seed demo users if in development
    if (process.env.NODE_ENV !== "production") {
      // Insert demo users (always sync)
      type DemoUser = { id: string; username: string; email: string; firstName: string; lastName: string; primaryIntent?: string };
      const demoUsers: DemoUser[] = [
        { id: "demo-admin-001", username: "admin@celion.ng", email: "admin@celion.ng", firstName: "Admin", lastName: "User" },
        { id: "demo-lawyer-001", username: "lawyer@celion.ng", email: "lawyer@celion.ng", firstName: "Chinedu", lastName: "Okonkwo" },
        { id: "demo-lawyer-002", username: "lawyer2@celion.ng", email: "lawyer2@celion.ng", firstName: "Amaka", lastName: "Nwachukwu" },
        { id: "demo-founder-001", username: "founder@celion.ng", email: "founder@celion.ng", firstName: "Emeka", lastName: "Okoro", primaryIntent: "founder_new_co" },
        { id: "demo-founder-002", username: "founder2@celion.ng", email: "founder2@celion.ng", firstName: "Ngozi", lastName: "Adeyemi", primaryIntent: "founder_new_co" },
        { id: "demo-analyst-001", username: "analyst@celion.ng", email: "analyst@celion.ng", firstName: "CIE", lastName: "Analyst" },
      ];
      
      for (const user of demoUsers) {
        await db.insert(users).values(user).onConflictDoUpdate({
          target: users.id,
          set: { primaryIntent: user.primaryIntent ?? null },
        });
      }
      console.log("Synced demo users");

      const demoRoles = [
        { userId: "demo-admin-001", role: "admin" },
        { userId: "demo-lawyer-001", role: "lawyer" },
        { userId: "demo-lawyer-002", role: "lawyer" },
        { userId: "demo-founder-001", role: "founder" },
        { userId: "demo-founder-002", role: "founder" },
        { userId: "demo-analyst-001", role: "cie_analyst" },
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

    // ============ CIE NGX Securities Master List ============
    const ngxSecurities = [
      // Banking
      { symbol: "GTCO", name: "Guaranty Trust Holding Company Plc", sector: "Banking" },
      { symbol: "ZENITHBANK", name: "Zenith Bank Plc", sector: "Banking" },
      { symbol: "ACCESSCORP", name: "Access Holdings Plc", sector: "Banking" },
      { symbol: "FBNH", name: "FBN Holdings Plc", sector: "Banking" },
      { symbol: "UBA", name: "United Bank for Africa Plc", sector: "Banking" },
      { symbol: "FIDELITYBK", name: "Fidelity Bank Plc", sector: "Banking" },
      { symbol: "STANBIC", name: "Stanbic IBTC Holdings Plc", sector: "Banking" },
      { symbol: "WEMABANK", name: "Wema Bank Plc", sector: "Banking" },
      { symbol: "STERLING", name: "Sterling Financial Holdings Plc", sector: "Banking" },
      { symbol: "FCMB", name: "FCMB Group Plc", sector: "Banking" },
      { symbol: "ECOBANK", name: "Ecobank Transnational Incorporated", sector: "Banking" },
      { symbol: "CORONATION", name: "Coronation Bank Plc", sector: "Banking" },
      { symbol: "UNITYBNK", name: "Unity Bank Plc", sector: "Banking" },
      { symbol: "JAIZBANK", name: "Jaiz Bank Plc", sector: "Banking" },
      // Consumer Goods
      { symbol: "DANGSUGAR", name: "Dangote Sugar Refinery Plc", sector: "Consumer Goods" },
      { symbol: "NASCON", name: "NASCON Allied Industries Plc", sector: "Consumer Goods" },
      { symbol: "NESTLE", name: "Nestle Nigeria Plc", sector: "Consumer Goods" },
      { symbol: "UNILEVER", name: "Unilever Nigeria Plc", sector: "Consumer Goods" },
      { symbol: "CADBURY", name: "Cadbury Nigeria Plc", sector: "Consumer Goods" },
      { symbol: "PZ", name: "PZ Cussons Nigeria Plc", sector: "Consumer Goods" },
      { symbol: "FLOURMILL", name: "Flour Mills of Nigeria Plc", sector: "Consumer Goods" },
      { symbol: "NB", name: "Nigerian Breweries Plc", sector: "Consumer Goods" },
      { symbol: "GUINNESS", name: "Guinness Nigeria Plc", sector: "Consumer Goods" },
      { symbol: "CHAMPION", name: "Champion Breweries Plc", sector: "Consumer Goods" },
      { symbol: "INTBREW", name: "International Breweries Plc", sector: "Consumer Goods" },
      { symbol: "VITAFOAM", name: "Vitafoam Nigeria Plc", sector: "Consumer Goods" },
      // Agri-Business
      { symbol: "PRESCO", name: "Presco Plc", sector: "Agri-Business" },
      { symbol: "OKOMUOIL", name: "The Okomu Oil Palm Company Plc", sector: "Agri-Business" },
      { symbol: "LIVESTOCK", name: "Livestock Feeds Plc", sector: "Agri-Business" },
      // Oil & Gas
      { symbol: "OANDO", name: "Oando Plc", sector: "Oil & Gas" },
      { symbol: "SEPLAT", name: "Seplat Energy Plc", sector: "Oil & Gas" },
      { symbol: "CONOIL", name: "Conoil Plc", sector: "Oil & Gas" },
      { symbol: "TOTAL", name: "TotalEnergies Marketing Nigeria Plc", sector: "Oil & Gas" },
      { symbol: "ETERNA", name: "Eterna Plc", sector: "Oil & Gas" },
      { symbol: "MRS", name: "MRS Oil Nigeria Plc", sector: "Oil & Gas" },
      { symbol: "ARDOVA", name: "Ardova Plc", sector: "Oil & Gas" },
      { symbol: "ARADEL", name: "Aradel Holdings Plc", sector: "Oil & Gas" },
      // Industrial Goods
      { symbol: "DANGCEM", name: "Dangote Cement Plc", sector: "Industrial Goods" },
      { symbol: "WAPCO", name: "Lafarge Africa Plc", sector: "Industrial Goods" },
      { symbol: "BUACEMENT", name: "BUA Cement Plc", sector: "Industrial Goods" },
      { symbol: "JBERGER", name: "Julius Berger Nigeria Plc", sector: "Industrial Goods" },
      { symbol: "CUTIX", name: "Cutix Plc", sector: "Industrial Goods" },
      { symbol: "PORTPAINT", name: "Portland Paints and Products Nig. Plc", sector: "Industrial Goods" },
      { symbol: "BUAFOODS", name: "BUA Foods Plc", sector: "Industrial Goods" },
      { symbol: "GEREGU", name: "Geregu Power Plc", sector: "Industrial Goods" },
      // Telecoms
      { symbol: "MTNN", name: "MTN Nigeria Communications Plc", sector: "Telecoms" },
      { symbol: "AIRTELAFRI", name: "Airtel Africa Plc", sector: "Telecoms" },
      // Healthcare
      { symbol: "FIDSON", name: "Fidson Healthcare Plc", sector: "Healthcare" },
      { symbol: "GLAXOSMITH", name: "GSK Consumer Nigeria Plc", sector: "Healthcare" },
      { symbol: "NEIMETH", name: "Neimeth International Pharmaceuticals Plc", sector: "Healthcare" },
      { symbol: "MAYBAKER", name: "May & Baker Nigeria Plc", sector: "Healthcare" },
      { symbol: "MORISON", name: "Morison Industries Plc", sector: "Healthcare" },
      { symbol: "AGLEVENT", name: "Agilvent Life Sciences Plc", sector: "Healthcare" },
      // Financial Services
      { symbol: "AFRIPRUD", name: "Africa Prudential Plc", sector: "Financial Services" },
      { symbol: "UPDC-REIT", name: "UPDC Real Estate Investment Trust", sector: "Financial Services" },
      { symbol: "FGNSUKUK", name: "FGN Sukuk Trust", sector: "Financial Services" },
      { symbol: "TRANSCORP", name: "Transnational Corporation Plc", sector: "Financial Services" },
      // Insurance
      { symbol: "CUSTODIAN", name: "Custodian Investment Plc", sector: "Insurance" },
      { symbol: "AIICO", name: "AIICO Insurance Plc", sector: "Insurance" },
      { symbol: "MANSARD", name: "AXA Mansard Insurance Plc", sector: "Insurance" },
      { symbol: "NEM", name: "NEM Insurance Plc", sector: "Insurance" },
      { symbol: "CONTINSURE", name: "Continental Reinsurance Plc", sector: "Insurance" },
      { symbol: "WAPIC", name: "Coronation Insurance Plc", sector: "Insurance" },
      { symbol: "LINKASSURE", name: "Linkage Assurance Plc", sector: "Insurance" },
      // Conglomerate
      { symbol: "UACN", name: "UAC of Nigeria Plc", sector: "Conglomerate" },
      { symbol: "CHELLARAMS", name: "Chellarams Plc", sector: "Conglomerate" },
      // Technology
      { symbol: "CHAMS", name: "Chams Holding Company Plc", sector: "Technology" },
      { symbol: "CWG", name: "CWG Plc", sector: "Technology" },
      { symbol: "NCR", name: "NCR Corporation Nigeria", sector: "Technology" },
      { symbol: "COURTVILLE", name: "Courtville Business Solutions Plc", sector: "Technology" },
      { symbol: "OMATEK", name: "Omatek Ventures Plc", sector: "Technology" },
      // Real Estate
      { symbol: "UPDC", name: "UPDC Plc", sector: "Real Estate" },
      { symbol: "LIVINGTRUST", name: "Livingtrust Mortgage Bank Plc", sector: "Real Estate" },
      { symbol: "DEAPCAP", name: "Deap Capital Management & Trust Plc", sector: "Real Estate" },
      // Utilities
      { symbol: "TRANSPOWER", name: "Transmission Company of Nigeria Plc", sector: "Utilities" },
      { symbol: "LASACO", name: "Lasaco Assurance Plc", sector: "Utilities" },
    ];

    for (const sec of ngxSecurities) {
      await db.insert(cieSecurities).values({
        symbol: sec.symbol,
        name: sec.name,
        sector: sec.sector,
        exchange: "NGX",
        isActive: true,
      }).onConflictDoUpdate({
        target: cieSecurities.symbol,
        set: { name: sec.name, sector: sec.sector, isActive: true },
      });
    }
    console.log(`Synced ${ngxSecurities.length} NGX securities`);

    // Seed default CIE model version (if none active)
    const [existingModel] = await db.select().from(cieModelVersions).limit(1);
    if (!existingModel) {
      await db.insert(cieModelVersions).values({
        versionLabel: "v1.0-baseline",
        weights: {
          momentum: 0.15,
          liquidity: 0.10,
          valuation: 0.20,
          quality: 0.20,
          growth: 0.20,
          financialStrength: 0.15,
        },
        status: "active",
        notes: "Baseline model — equal emphasis on quality and growth, moderate momentum weighting",
        activatedAt: new Date(),
      });
      console.log("Seeded CIE default model version v1.0-baseline");
    }

    // Seed initial market pulse snapshot
    const [existingPulse] = await db.select().from(cieMarketPulse).limit(1);
    if (!existingPulse) {
      await db.insert(cieMarketPulse).values({
        asiIndex: 10100500,      // ~101,005.00
        brentCrudeUsdCents: 7450, // $74.50
        ngnPerUsd: 163000,       // ₦1,630.00 per USD ×100
        asiChange: -25,          // -0.25% daily change (×100)
        source: "seed",
      });
      console.log("Seeded CIE initial market pulse");
    }

    // Seed CIE Paystack plans (best-effort: logs plan codes if not already in env vars)
    try {
      const { seedCiePlans } = await import("./routes/cieBillingRoutes");
      await seedCiePlans();
    } catch (planErr: any) {
      console.warn("[Seed] CIE plan seeding skipped:", planErr.message);
    }

    // Provision Icon eTrade as the first CIE partner (idempotent)
    try {
      const [existingPartner] = await db.select().from(ciePartners)
        .where(eq(ciePartners.orgName, "Icon eTrade")).limit(1);

      if (!existingPartner) {
        const [partner] = await db.insert(ciePartners).values({
          orgName: "Icon eTrade",
          contactName: null,
          contactEmail: null,
          cellionRevenueSharePct: 60,
          tier: "pro",
          status: "active",
          notes: "White-label reseller. Revenue share: 60% Cellion / 40% Icon eTrade. Pro tier (1,000 req/min). Contact details to be provided.",
        }).returning();

        // Generate CIE partner API key for Icon eTrade
        const randomPart = crypto.randomBytes(16).toString("hex");
        const fullKey = `co_live_${randomPart}`;
        const keyPrefix = fullKey.slice(0, 12);
        const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");

        await db.insert(kycApiKeys).values({
          ciePartnerId: partner.id,
          keyPrefix,
          keyHash,
          name: `CIE Partner — ${partner.orgName}`,
          permissions: ["cie:read"],
          rateLimitPerMinute: 1000,
          isActive: true,
        });

        console.log(`[Seed] Provisioned CIE partner: ${partner.orgName} (Pro, 60% Cellion share) — key prefix: ${keyPrefix}…`);
        console.log(`[Seed] NOTE: Icon eTrade API key was generated. Retrieve via Admin → CIE → Partners tab → Regenerate Key if needed.`);
      }
    } catch (partnerErr: any) {
      console.warn("[Seed] Icon eTrade partner provisioning skipped:", partnerErr.message);
    }

    console.log("Database seeding complete");
  } catch (error) {
    console.error("Seed error:", error);
  }
}
