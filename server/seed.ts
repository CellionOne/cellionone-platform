import { db } from "./db";
import { featureFlags, users, userRoles, companyApplications, auditLogs, serviceAddresses, productCatalog } from "@shared/schema";

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
      { key: "enable_stripe_payments", isEnabled: true, description: "Enable Stripe payment processing (GBP/international)" },
      { key: "enable_paystack_payments", isEnabled: true, description: "Enable Paystack payment processing (NGN/Nigeria)" },
      { key: "enable_paystack_split_settlement", isEnabled: true, description: "Enable Paystack split settlement to lawyer subaccount" },
      { key: "enable_verification_payment_required", isEnabled: false, description: "Require payment for identity verification (beta: false)" },
      { key: "enable_incorporation_payment_required", isEnabled: false, description: "Require payment for incorporation (beta: false)" },
    ];
    
    // Always insert any missing feature flags
    for (const flag of allFlags) {
      await db.insert(featureFlags).values(flag).onConflictDoNothing();
    }
    console.log("Synced feature flags");

    // Seed service address for registered office
    await db.insert(serviceAddresses).values({
      label: "Celion One Registered Office (Ikoyi)",
      line1: "51 Raymond Njoku Street, Off Awolowo Road",
      line2: "Ikoyi",
      floorDetails: "First Floor",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
      isActive: true,
    }).onConflictDoNothing();
    console.log("Synced service addresses");

    // Seed product catalog with fixed-cut SKUs
    const catalogItems = [
      { sku: "CAC_1M", name: "Company Incorporation (₦1M Share Capital)", category: "incorporation", priceNgn: 10000000, cellionCutNgn: 2500000, metadata: { shareCapital: 1000000 } },
      { sku: "CAC_5M", name: "Company Incorporation (₦5M Share Capital)", category: "incorporation", priceNgn: 15000000, cellionCutNgn: 3000000, metadata: { shareCapital: 5000000 } },
      { sku: "CAC_10M", name: "Company Incorporation (₦10M Share Capital)", category: "incorporation", priceNgn: 35000000, cellionCutNgn: 3500000, metadata: { shareCapital: 10000000 } },
      { sku: "CAC_20M", name: "Company Incorporation (₦20M Share Capital)", category: "incorporation", priceNgn: 55000000, cellionCutNgn: 4000000, metadata: { shareCapital: 20000000 } },
      { sku: "CAC_100M", name: "Company Incorporation (₦100M Share Capital)", category: "incorporation", priceNgn: 300000000, cellionCutNgn: 10000000, metadata: { shareCapital: 100000000, foreignParticipation: true } },
      { sku: "SCUML", name: "SCUML Registration", category: "post_incorporation", priceNgn: 15000000, cellionCutNgn: 2500000 },
      { sku: "TM", name: "Trademark Registration", category: "post_incorporation", priceNgn: 25000000, cellionCutNgn: 3500000 },
      { sku: "TIN", name: "TIN Registration", category: "post_incorporation", priceNgn: 2000000, cellionCutNgn: null, requiresManualPricing: true, metadata: { note: "varies by location" } },
    ];
    for (const item of catalogItems) {
      await db.insert(productCatalog).values(item).onConflictDoNothing();
    }
    console.log("Synced product catalog");

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

      // Always sync roles (in case they're missing)
      const demoRoles = [
        { userId: "demo-admin-001", role: "admin" },
        { userId: "demo-lawyer-001", role: "lawyer" },
        { userId: "demo-lawyer-002", role: "lawyer" },
        { userId: "demo-founder-001", role: "founder" },
        { userId: "demo-founder-002", role: "founder" },
      ];
      
      for (const role of demoRoles) {
        await db.insert(userRoles).values(role).onConflictDoNothing();
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
    
    console.log("Database seeding complete");
  } catch (error) {
    console.error("Seed error:", error);
  }
}
