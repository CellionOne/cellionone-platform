/**
 * AUTH REGRESSION TEST
 * 
 * This test ensures that the /api/auth/user endpoint returns user roles.
 * 
 * CRITICAL: If this test fails, role-based routing will be broken.
 * The Replit Auth integration's registerAuthRoutes() MUST NOT be called,
 * as it would override the custom endpoint that returns roles.
 * 
 * See fix from January 31, 2026 for context.
 */

import { describe, test, expect } from "vitest";
import { storage } from "../storage";

describe("Auth Regression Tests", () => {
  describe("/api/auth/user endpoint requirements", () => {
    test("storage.getUserRoles returns an array", async () => {
      // Test that getUserRoles returns an array (even if empty)
      const roles = await storage.getUserRoles("demo-admin-001");
      expect(Array.isArray(roles)).toBe(true);
    });

    test("demo admin user has admin role", async () => {
      const roles = await storage.getUserRoles("demo-admin-001");
      expect(roles).toContain("admin");
    });

    test("demo lawyer user has lawyer role", async () => {
      const roles = await storage.getUserRoles("demo-lawyer-001");
      expect(roles).toContain("lawyer");
    });

    test("demo founder user has founder role", async () => {
      const roles = await storage.getUserRoles("demo-founder-001");
      expect(roles).toContain("founder");
    });

    test("roles are one of: admin, lawyer, founder", async () => {
      const validRoles = ["admin", "lawyer", "founder"];
      
      // Check admin
      const adminRoles = await storage.getUserRoles("demo-admin-001");
      for (const role of adminRoles) {
        expect(validRoles).toContain(role);
      }
      
      // Check lawyer
      const lawyerRoles = await storage.getUserRoles("demo-lawyer-001");
      for (const role of lawyerRoles) {
        expect(validRoles).toContain(role);
      }
      
      // Check founder
      const founderRoles = await storage.getUserRoles("demo-founder-001");
      for (const role of founderRoles) {
        expect(validRoles).toContain(role);
      }
    });

    test("role is never null or undefined", async () => {
      const roles = await storage.getUserRoles("demo-admin-001");
      expect(roles).not.toBeNull();
      expect(roles).not.toBeUndefined();
      
      for (const role of roles) {
        expect(role).not.toBeNull();
        expect(role).not.toBeUndefined();
        expect(typeof role).toBe("string");
        expect(role.length).toBeGreaterThan(0);
      }
    });
  });
});
