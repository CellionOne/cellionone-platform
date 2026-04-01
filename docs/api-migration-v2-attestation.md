# Cellion One KYC API — Migration Notice
**Affected API Version:** v1  
**Change Date:** April 2026  
**Urgency:** Action required if you use `?format=json` on the certificate endpoint

---

## Summary

We have introduced the **Verification Attestation API** — a way to issue, store, and publicly verify cryptographic proof of every approved KYC verification. Most changes are additive and require no action. One endpoint has a **breaking change** in its JSON response shape.

---

## 1. Webhook — `verification.completed` (No action required)

Two new fields have been added to the webhook payload. Your existing handler will continue to work. No changes are needed unless you want to use the new attestation feature.

**New fields added:**

```json
{
  "event": "verification.completed",
  "data": {
    "requestId": 142,
    "status": "verified",
    "certificateRef": "CO-KYC-2026-A1B2C3D4",
    "certificateUrl": "https://cellionone.com/api/v1/kyc/attest/CO-KYC-2026-A1B2C3D4"
  }
}
```

**What to do:** Store `certificateRef` against the verified subject in your system. You can use `certificateUrl` to share proof of verification with third parties — no API key required.

---

## 2. Certificate JSON Endpoint — BREAKING CHANGE

**Endpoint:** `GET /api/v1/kyc/requests/:requestId/certificate?format=json`

The JSON response has been restructured to return a proper attestation object. The old flat response shape is no longer returned.

### Field Mapping

| Old Field | New Field | Notes |
|---|---|---|
| `certificateNumber` | `certificateRef` | Same value, new name |
| `verificationDate` | `issuedAt` | ISO 8601 format |
| `expiryDate` | `expiresAt` | ISO 8601 format |
| `partnerName` | `issuedBy.name` | Now nested |
| `checks` | `verifiedData` | Richer structure |
| `subjectName` | Removed from JSON | Not in attestation payload |
| `subjectEmail` | Removed from JSON | Not in attestation payload |
| `smileIdJobId` | Removed | Not exposed externally |

### New Response Shape

```json
{
  "certificateRef": "CO-KYC-2026-A1B2C3D4",
  "verificationId": 142,
  "verificationType": "individual",
  "issuedAt": "2026-04-01T09:30:00.000Z",
  "expiresAt": "2027-04-01T09:30:00.000Z",
  "status": "verified",
  "attestationUrl": "https://cellionone.com/api/v1/kyc/attest/CO-KYC-2026-A1B2C3D4",
  "issuedBy": {
    "name": "Acme Fintech Ltd",
    "certificationBody": "Cellion One"
  },
  "verifiedData": {
    "riskScore": "green",
    "verificationMethod": "biometric_document_review",
    "dataSource": "cellionone_kyc_review",
    "documentsVerified": [
      {
        "documentName": "National ID Card",
        "documentCategory": "identity",
        "documentType": "national_id",
        "status": "accepted",
        "documentValidity": "valid"
      }
    ],
    "documentCount": 1,
    "biometricVerified": true,
    "livenessConfirmed": true,
    "amlScreened": true,
    "amlClear": true,
    "verifiedAt": "2026-04-01T09:30:00.000Z"
  }
}
```

**What to do:** Update any code that reads the JSON certificate response to use the new field names listed in the mapping table above.

> The `?format=html` and `?format=pdf` endpoints are unchanged in format.

---

## 3. New Endpoint — Public Attestation (No migration needed, new capability)

A new **unauthenticated** endpoint is now available. Anyone with a `certificateRef` can call it — no API key required.

```
GET https://cellionone.com/api/v1/kyc/attest/:certificateRef
```

**Response:**

```json
{
  "valid": true,
  "verificationType": "individual",
  "status": "verified",
  "issuedAt": "2026-04-01T09:30:00.000Z",
  "expiresAt": "2027-04-01T09:30:00.000Z",
  "certificationBody": "Cellion One"
}
```

**Use case:** Share the `certificateUrl` from the webhook with a bank, partner, or auditor. They can verify it themselves without needing access to your API key or account.

---

## Action Checklist

- [ ] **Update your webhook handler** to store `certificateRef` from `verification.completed` events
- [ ] **Update your certificate JSON parser** to read the new field names (see mapping table above)
- [ ] **Optional:** Share `certificateUrl` with downstream parties who need to verify your subjects

---

## Questions

Contact us at **support@cellionone.com** or refer to the full API documentation at **https://cellionone.com/api-docs**.
