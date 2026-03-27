import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const bcrypt = await import("bcryptjs");
  
  const [user] = await db.select({ email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, "service@cellionone.com"));

  if (!user) { console.log("User not found"); process.exit(1); }
  
  console.log("Email:", user.email);
  console.log("Hash (first 20 chars):", user.passwordHash?.slice(0, 20));

  const testPassword = "CellionAdmin2026!";
  const valid = await bcrypt.compare(testPassword, user.passwordHash!);
  console.log("Password match:", valid);

  if (!valid) {
    // Reset it now
    const newHash = await bcrypt.hash(testPassword, 12);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.email, "service@cellionone.com"));
    const recheck = await bcrypt.compare(testPassword, newHash);
    console.log("New hash set. Recheck:", recheck);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
