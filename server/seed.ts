import { db } from "./db";
import { featureFlags, users, userRoles, companyApplications, auditLogs } from "@shared/schema";

export async function seedDatabase() {
  try {
    // Seed feature flags
    const existingFlags = await db.select().from(featureFlags).limit(1);
    
    if (existingFlags.length === 0) {
      await db.insert(featureFlags).values([
        { key: "kyc_verification", isEnabled: true, description: "Enable KYC identity verification" },
        { key: "ai_suggestions", isEnabled: true, description: "Enable AI-powered CAC activity suggestions" },
        { key: "paystack_payments", isEnabled: true, description: "Enable Paystack payment processing" },
        { key: "lawyer_payout", isEnabled: true, description: "Enable lawyer payout processing" },
        { key: "document_vault", isEnabled: true, description: "Enable document vault feature" },
        { key: "courier_tracking", isEnabled: false, description: "Enable courier tracking for document delivery" },
        { key: "multi_director", isEnabled: true, description: "Allow multiple directors per application" },
        { key: "bulk_applications", isEnabled: false, description: "Allow bulk application submissions" },
      ]);
      console.log("Seeded feature flags");
    }

    // Seed demo users if in development
    if (process.env.NODE_ENV !== "production") {
      const existingUsers = await db.select().from(users).limit(1);
      
      if (existingUsers.length === 0) {
        // Insert demo users
        for (const user of [
          { id: "demo-admin-001", username: "admin@celion.ng", email: "admin@celion.ng", firstName: "Admin", lastName: "User" },
          { id: "demo-lawyer-001", username: "lawyer@celion.ng", email: "lawyer@celion.ng", firstName: "Chinedu", lastName: "Okonkwo" },
          { id: "demo-lawyer-002", username: "lawyer2@celion.ng", email: "lawyer2@celion.ng", firstName: "Amaka", lastName: "Nwachukwu" },
          { id: "demo-founder-001", username: "founder@celion.ng", email: "founder@celion.ng", firstName: "Emeka", lastName: "Okoro" },
          { id: "demo-founder-002", username: "founder2@celion.ng", email: "founder2@celion.ng", firstName: "Ngozi", lastName: "Adeyemi" },
        ]) {
          await db.insert(users).values(user).onConflictDoNothing();
        }
        console.log("Seeded demo users");

        // Assign roles
        await db.insert(userRoles).values([
          { userId: "demo-admin-001", role: "admin" },
          { userId: "demo-lawyer-001", role: "lawyer" },
          { userId: "demo-lawyer-002", role: "lawyer" },
          { userId: "demo-founder-001", role: "founder" },
          { userId: "demo-founder-002", role: "founder" },
        ]);
        console.log("Seeded user roles");

        // Seed sample applications
        for (const app of [
          {
            founderUserId: "demo-founder-001",
            applicationType: "incorporation" as const,
            companyType: "LLC",
            companyName1: "TechHub Nigeria Limited",
            companyName2: "TechHub Africa Ltd",
            companyName3: "TechHub Solutions",
            businessDescription: "Software development, IT consulting, and digital transformation services for Nigerian businesses",
            registeredAddress: "12 Marina Street, Lagos Island, Lagos, Nigeria",
            status: "under_review" as const,
            assignedLawyerUserId: "demo-lawyer-001",
          },
          {
            founderUserId: "demo-founder-001",
            applicationType: "incorporation" as const,
            companyType: "LLC",
            companyName1: "GreenFarm Agritech",
            companyName2: "GreenFarm Nigeria",
            companyName3: "GreenFarm Solutions",
            businessDescription: "Agricultural technology, farm produce distribution, and agribusiness consulting",
            registeredAddress: "45 Ahmadu Bello Way, Kaduna, Nigeria",
            status: "draft" as const,
          },
          {
            founderUserId: "demo-founder-002",
            applicationType: "incorporation" as const,
            companyType: "PLC",
            companyName1: "NaijaFinance PLC",
            companyName2: "Nigerian Finance Holdings",
            companyName3: "NaijaFin Group",
            businessDescription: "Financial services, investment management, and wealth advisory for high-net-worth individuals",
            registeredAddress: "78 Awolowo Road, Ikoyi, Lagos, Nigeria",
            status: "submitted" as const,
          },
        ]) {
          await db.insert(companyApplications).values(app);
        }
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
