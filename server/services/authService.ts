import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "../storage";
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "./emailService";
import { registerSchema, loginSchema } from "@shared/schema";
import type { RegisterInput, LoginInput } from "@shared/schema";

const SALT_ROUNDS = 12;
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
const RESET_TOKEN_EXPIRY_HOURS = 1;

export interface AuthResult {
  success: boolean;
  message: string;
  user?: any;
  requiresVerification?: boolean;
}

export async function registerUser(input: RegisterInput, baseUrl: string): Promise<AuthResult> {
  const validation = registerSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: validation.error.errors[0].message };
  }

  const { email, password, firstName, lastName } = validation.data;

  const existingUser = await storage.getUserByEmail(email.toLowerCase());
  if (existingUser) {
    return { success: false, message: "An account with this email already exists" };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationTokenExpiry = new Date(
    Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
  );

  const user = await storage.createUserWithPassword({
    email: email.toLowerCase(),
    firstName,
    lastName,
    passwordHash,
    verificationToken,
    verificationTokenExpiry,
    emailVerified: false,
  });

  await storage.addUserRole(user.id, "founder");

  try {
    await sendVerificationEmail(email, verificationToken, baseUrl);
  } catch (error) {
    console.error("Failed to send verification email:", error);
  }

  return {
    success: true,
    message: "Registration successful. Please check your email to verify your account.",
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    requiresVerification: true,
  };
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const validation = loginSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: validation.error.errors[0].message };
  }

  const { email, password } = validation.data;

  const user = await storage.getUserByEmail(email.toLowerCase());
  if (!user) {
    return { success: false, message: "Invalid email or password" };
  }

  if (!user.passwordHash) {
    return { success: false, message: "This account uses a different login method" };
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return { success: false, message: "Invalid email or password" };
  }

  if (!user.emailVerified) {
    return {
      success: false,
      message: "Please verify your email before logging in",
      requiresVerification: true,
    };
  }

  const roles = await storage.getUserRoles(user.id);

  return {
    success: true,
    message: "Login successful",
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      roles,
    },
  };
}

export async function verifyEmail(token: string): Promise<AuthResult> {
  if (!token) {
    return { success: false, message: "Verification token is required" };
  }

  const user = await storage.getUserByVerificationToken(token);
  if (!user) {
    return { success: false, message: "Invalid or expired verification token" };
  }

  if (user.verificationTokenExpiry && new Date(user.verificationTokenExpiry) < new Date()) {
    return { success: false, message: "Verification token has expired. Please request a new one." };
  }

  await storage.markEmailVerified(user.id);

  try {
    if (user.email && user.firstName) {
      await sendWelcomeEmail(user.email, user.firstName);
    }
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }

  return {
    success: true,
    message: "Email verified successfully. You can now log in.",
    user: { id: user.id, email: user.email },
  };
}

export async function resendVerificationEmail(email: string, baseUrl: string): Promise<AuthResult> {
  const user = await storage.getUserByEmail(email.toLowerCase());
  if (!user) {
    return { success: true, message: "If an account exists, a verification email has been sent." };
  }

  if (user.emailVerified) {
    return { success: false, message: "This email is already verified." };
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationTokenExpiry = new Date(
    Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
  );

  await storage.updateVerificationToken(user.id, verificationToken, verificationTokenExpiry);

  try {
    await sendVerificationEmail(email, verificationToken, baseUrl);
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return { success: false, message: "Failed to send verification email. Please try again." };
  }

  return { success: true, message: "If an account exists, a verification email has been sent." };
}

export async function requestPasswordReset(email: string, baseUrl: string): Promise<AuthResult> {
  const user = await storage.getUserByEmail(email.toLowerCase());
  if (!user) {
    return { success: true, message: "If an account exists, a password reset email has been sent." };
  }

  if (!user.passwordHash) {
    return { success: true, message: "If an account exists, a password reset email has been sent." };
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await storage.updateResetToken(user.id, resetToken, resetTokenExpiry);

  try {
    await sendPasswordResetEmail(email, resetToken, baseUrl);
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return { success: false, message: "Failed to send password reset email. Please try again." };
  }

  return { success: true, message: "If an account exists, a password reset email has been sent." };
}

export async function resetPassword(token: string, newPassword: string): Promise<AuthResult> {
  if (!token || !newPassword) {
    return { success: false, message: "Token and new password are required" };
  }

  if (newPassword.length < 8) {
    return { success: false, message: "Password must be at least 8 characters" };
  }

  const user = await storage.getUserByResetToken(token);
  if (!user) {
    return { success: false, message: "Invalid or expired reset token" };
  }

  if (user.resetTokenExpiry && new Date(user.resetTokenExpiry) < new Date()) {
    return { success: false, message: "Reset token has expired. Please request a new one." };
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await storage.updatePassword(user.id, passwordHash);

  return {
    success: true,
    message: "Password reset successful. You can now log in with your new password.",
  };
}
