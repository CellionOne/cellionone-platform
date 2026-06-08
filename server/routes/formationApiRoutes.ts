import type { Express } from "express";
import { authenticateApiKey } from "../middleware/apiKeyAuth";
import { verifyBusiness } from "../services/smileIdService";
import crypto from "crypto";

export function registerFormationApiRoutes(app: Express) {
  app.get("/api/v1/formation/lookup",
    authenticateApiKey("formation:read"),
    async (req: any, res) => {
      try {
        const { rcNumber, reference } = req.query;
        if (!rcNumber) {
          return res.status(400).json({ success: false, error: { code: "MISSING_RC_NUMBER", message: "rcNumber is required" } });
        }
        const jobId = crypto.randomUUID();
        const userId = `api_${req.apiKey?.id || 'anon'}`;
        const result = await verifyBusiness(String(rcNumber), userId, jobId);
        res.json({ success: true, data: result, reference });
      } catch (err: any) {
        res.status(500).json({ success: false, error: { code: "LOOKUP_FAILED", message: err.message } });
      }
    }
  );

  app.post("/api/v1/formation/lookup",
    authenticateApiKey("formation:read"),
    async (req: any, res) => {
      try {
        const { rc_number, reference } = req.body;
        if (!rc_number) {
          return res.status(400).json({ success: false, error: { code: "MISSING_RC_NUMBER", message: "rc_number is required" } });
        }
        const jobId = crypto.randomUUID();
        const userId = `api_${req.apiKey?.id || 'anon'}`;
        const result = await verifyBusiness(String(rc_number), userId, jobId);
        res.json({ success: true, data: result, reference });
      } catch (err: any) {
        res.status(500).json({ success: false, error: { code: "LOOKUP_FAILED", message: err.message } });
      }
    }
  );
}
