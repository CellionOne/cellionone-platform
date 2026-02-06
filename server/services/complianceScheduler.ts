import { db } from "../db";
import { complianceDeadlines, companyProfiles } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { sendComplianceReminderEmail } from "./emailService";

export async function runComplianceDeadlineCheck() {
  console.log("[ComplianceScheduler] Running compliance deadline check...");
  
  const now = new Date();
  
  const deadlines = await db.select()
    .from(complianceDeadlines)
    .where(
      and(
        sql`${complianceDeadlines.status} != 'completed'`
      )
    );
  
  let updatedCount = 0;
  let notifiedCount = 0;
  
  for (const deadline of deadlines) {
    const dueDate = new Date(deadline.dueDate);
    const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    let newStatus = deadline.status;
    if (daysRemaining < 0) {
      newStatus = "overdue";
    } else if (daysRemaining <= 14) {
      newStatus = "due_soon";
    } else {
      newStatus = "upcoming";
    }
    
    if (newStatus !== deadline.status) {
      await db.update(complianceDeadlines)
        .set({ status: newStatus, updatedAt: now })
        .where(eq(complianceDeadlines.id, deadline.id));
      updatedCount++;
    }
    
    const notifyAt = [30, 14, 7, 1, 0, -1, -7];
    const shouldNotify = notifyAt.includes(daysRemaining) && (
      !deadline.lastNotifiedAt || 
      (now.getTime() - new Date(deadline.lastNotifiedAt).getTime()) > 24 * 60 * 60 * 1000
    );
    
    if (shouldNotify) {
      try {
        const profiles = await db.select().from(companyProfiles)
          .where(eq(companyProfiles.id, deadline.companyProfileId));
        
        if (profiles.length > 0) {
          const profile = profiles[0];
          const { users } = await import("@shared/schema");
          const userRecords = await db.select().from(users)
            .where(eq(users.id, profile.founderId));
          
          if (userRecords.length > 0 && userRecords[0].email) {
            await sendComplianceReminderEmail(
              userRecords[0].email,
              userRecords[0].firstName || "Founder",
              profile.companyName,
              deadline.title,
              dueDate,
              daysRemaining,
              deadline.penaltyInfo || ""
            );
            
            await db.update(complianceDeadlines)
              .set({ 
                lastNotifiedAt: now,
                notificationsSent: (deadline.notificationsSent || 0) + 1,
                updatedAt: now 
              })
              .where(eq(complianceDeadlines.id, deadline.id));
            
            notifiedCount++;
          }
        }
      } catch (err) {
        console.error(`[ComplianceScheduler] Failed to send notification for deadline ${deadline.id}:`, err);
      }
    }
  }
  
  console.log(`[ComplianceScheduler] Updated ${updatedCount} statuses, sent ${notifiedCount} notifications`);
}
