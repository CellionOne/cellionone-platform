import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table with custom email/password authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone", { length: 50 }),
  profileImageUrl: varchar("profile_image_url"),
  passwordHash: varchar("password_hash"),
  emailVerified: boolean("email_verified").default(false),
  isIdentityVerified: boolean("is_identity_verified").default(false),
  identityVerifiedAt: timestamp("identity_verified_at"),
  verificationToken: varchar("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  resetToken: varchar("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorMethod: varchar("two_factor_method", { length: 20 }),
  twoFactorPhone: varchar("two_factor_phone", { length: 50 }),
  twoFactorSecret: varchar("two_factor_secret", { length: 255 }),
  twoFactorBackupCodes: varchar("two_factor_backup_codes", { length: 1000 }),
  lastTwoFactorAt: timestamp("last_two_factor_at"),
  // Intent captured on the post-registration welcome screen
  // Values: founder_new_co | founder_existing_co | kyc_service | procurement
  primaryIntent: varchar("primary_intent", { length: 50 }),
  pendingInviteToken: varchar("pending_invite_token"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  passwordHash: true,
  verificationToken: true,
  verificationTokenExpiry: true,
  resetToken: true,
  resetTokenExpiry: true,
  twoFactorEnabled: true,
  twoFactorMethod: true,
  twoFactorPhone: true,
  twoFactorSecret: true,
  twoFactorBackupCodes: true,
  lastTwoFactorAt: true,
});

// Password strength validation
export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")
  .refine(
    (password) => /[A-Z]/.test(password),
    "Password must contain at least one uppercase letter"
  )
  .refine(
    (password) => /[a-z]/.test(password),
    "Password must contain at least one lowercase letter"
  )
  .refine(
    (password) => /[0-9]/.test(password),
    "Password must contain at least one number"
  )
  .refine(
    (password) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/.test(password),
    "Password must contain at least one special character"
  );

export const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: passwordSchema,
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  inviteToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordSchema,
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type UserWithRoles = User & { roles: string[] };
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
