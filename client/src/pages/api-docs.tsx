import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Key,
  Shield,
  CreditCard,
  Webhook,
  Code2,
  AlertTriangle,
  BookOpen,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative group rounded-lg border bg-zinc-950 dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900 dark:bg-zinc-800">
        <span className="text-xs text-zinc-400 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
          data-testid="button-copy-code"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 text-sm text-zinc-100 overflow-x-auto font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function EndpointSection({
  method,
  path,
  description,
  children,
}: {
  method: string;
  path: string;
  description: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const methodColor =
    method === "GET"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
      : method === "POST"
        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
        : method === "PATCH"
          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
          : method === "DELETE"
            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
            : "";

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
        data-testid={`endpoint-${method.toLowerCase()}-${path.replace(/[/:]/g, "-")}`}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <Badge variant="secondary" className={`border-0 font-mono text-xs ${methodColor}`}>
          {method}
        </Badge>
        <code className="text-sm font-mono font-medium">{path}</code>
        <span className="text-sm text-muted-foreground ml-auto hidden sm:inline">{description}</span>
      </button>
      {open && (
        <div className="border-t p-4 space-y-4 bg-muted/20">
          <p className="text-sm text-muted-foreground sm:hidden">{description}</p>
          {children}
        </div>
      )}
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="link-back-home">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">API Documentation</h1>
            </div>
          </div>
          <Badge variant="secondary" className="border-0">v1.0</Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold" data-testid="heading-getting-started">Getting Started</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Cellion One KYC Verification API lets you submit identity and corporate verification requests
              programmatically. Verify individuals (BVN, NIN, biometric, AML screening) and suppliers
              (corporate due diligence, director checks, document management) — all through a simple REST API.
            </p>
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">Quick Start</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Create a KYC organisation at <code className="bg-muted px-1 rounded">/kyc/organisations</code></li>
                  <li>Set up a billing account and purchase credits (minimum 10)</li>
                  <li>Generate an API key from your organisation settings</li>
                  <li>Start submitting verification requests</li>
                  <li>Register a webhook to receive results automatically</li>
                </ol>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">Base URL</h3>
                <CodeBlock
                  code="https://cellionone.com/api/v1/kyc"
                  language="text"
                />
                <p className="text-sm text-muted-foreground">
                  All API endpoints are prefixed with <code className="bg-muted px-1 rounded">/api/v1/kyc</code>.
                </p>
              </CardContent>
            </Card>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-authentication">
              <Key className="h-5 w-5" />
              Authentication
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              All API requests must include your API key in the <code className="bg-muted px-1 rounded">X-API-Key</code> header.
              API keys are scoped to your organisation and have configurable permissions.
            </p>
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">API Key Format</h3>
                <CodeBlock
                  code={`co_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`}
                  language="text"
                />
                <p className="text-sm text-muted-foreground">
                  Keys use the <code className="bg-muted px-1 rounded">co_live_</code> prefix followed by 32 hexadecimal characters.
                  The full key is shown once at creation — store it securely.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">Example Request</h3>
                <CodeBlock
                  language="bash"
                  code={`curl -X GET https://cellionone.com/api/v1/kyc/templates \\
  -H "X-API-Key: co_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \\
  -H "Content-Type: application/json"`}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">Rate Limits</h3>
                <p className="text-sm text-muted-foreground">
                  Default rate limit is <strong>60 requests per minute</strong> per API key. If you exceed this limit,
                  you'll receive a <code className="bg-muted px-1 rounded">429 Too Many Requests</code> response.
                  Contact us to increase your limit for high-volume integrations.
                </p>
              </CardContent>
            </Card>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-billing">
              <CreditCard className="h-5 w-5" />
              Billing
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Cellion One offers two billing models. All organisations start with pre-paid credits.
              High-volume organisations can apply for invoiced billing.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pre-paid Credits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>Purchase credits upfront via Paystack</li>
                    <li>Minimum 10 credits per purchase</li>
                    <li>1 credit = 1 verification request</li>
                    <li>Credits never expire</li>
                  </ul>
                  <Separator />
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Individual verification</span>
                      <span className="font-semibold">₦10,000</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Supplier verification</span>
                      <span className="font-semibold">₦100,000</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Invoiced Billing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>Verify now, pay later (Net 30)</li>
                    <li>Admin-approved with credit limit</li>
                    <li>Monthly invoices generated automatically</li>
                    <li>For established high-volume organisations</li>
                  </ul>
                  <Separator />
                  <p className="text-sm text-muted-foreground">
                    Apply through your organisation settings or contact us at{" "}
                    <a href="mailto:service@cellionone.com" className="text-primary hover:underline">
                      service@cellionone.com
                    </a>
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">Insufficient Credits</h3>
                <p className="text-sm text-muted-foreground">
                  If your balance is zero (prepaid) or you've exceeded your credit limit (invoiced),
                  verification requests will return <code className="bg-muted px-1 rounded">402 Payment Required</code>:
                </p>
                <CodeBlock
                  language="json"
                  code={`{
  "error": "INSUFFICIENT_CREDITS",
  "message": "Insufficient credits. Purchase more credits or contact support.",
  "billingMode": "prepaid",
  "currentBalance": 0
}`}
                />
              </CardContent>
            </Card>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-endpoints">
              <Code2 className="h-5 w-5" />
              Endpoints
            </h2>

            <Tabs defaultValue="verification" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="verification" data-testid="tab-verification-endpoints">Verification</TabsTrigger>
                <TabsTrigger value="status" data-testid="tab-status-endpoints">Status & Results</TabsTrigger>
                <TabsTrigger value="templates" data-testid="tab-templates-endpoints">Templates</TabsTrigger>
              </TabsList>

              <TabsContent value="verification" className="space-y-4 mt-4">
                <EndpointSection
                  method="POST"
                  path="/api/v1/kyc/verify/individual"
                  description="Submit individual identity verification"
                >
                  <p className="text-sm text-muted-foreground">
                    Submit a request to verify an individual's identity. Supports two modes:
                  </p>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Template-based mode</h4>
                    <p className="text-xs text-muted-foreground">
                      Pass a <code className="bg-muted px-1 rounded">templateId</code> and the template defines required checks and documents.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "templateId": 5,
  "subject": {
    "name": "Adebayo Ogunlesi",
    "email": "adebayo@example.com",
    "bvn": "22345678901",
    "nin": "12345678901"
  },
  "callbackUrl": "https://yourapp.com/kyc/callback",
  "metadata": {
    "employeeId": "EMP-001"
  }
}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Ad-hoc mode</h4>
                    <p className="text-xs text-muted-foreground">
                      Specify checks and documents directly without a template.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "subject": {
    "name": "Adebayo Ogunlesi",
    "email": "adebayo@example.com",
    "bvn": "22345678901"
  },
  "checks": ["bvn", "aml"],
  "requiredDocuments": ["government_id", "proof_of_address"],
  "callbackUrl": "https://yourapp.com/kyc/callback"
}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Response</h4>
                    <CodeBlock
                      language="json"
                      code={`{
  "requestId": 142,
  "status": "pending_invite",
  "type": "individual",
  "inviteToken": "abc123...",
  "expiresAt": "2026-04-01T00:00:00.000Z",
  "message": "Verification request created. Subject will receive an email invite."
}`}
                    />
                  </div>
                </EndpointSection>

                <EndpointSection
                  method="POST"
                  path="/api/v1/kyc/verify/supplier"
                  description="Submit supplier/corporate verification"
                >
                  <p className="text-sm text-muted-foreground">
                    Submit a corporate due diligence request. Include company details and optionally director information.
                  </p>
                  <CodeBlock
                    language="json"
                    code={`{
  "templateId": 8,
  "subject": {
    "name": "TechCorp Nigeria Ltd",
    "email": "compliance@techcorp.ng"
  },
  "company": {
    "companyName": "TechCorp Nigeria Ltd",
    "rcNumber": "RC-123456",
    "tinNumber": "TIN-789012",
    "contactPersonName": "Jane Doe",
    "contactPersonEmail": "jane@techcorp.ng",
    "contactPersonPhone": "+234 812 345 6789"
  },
  "directors": [
    {
      "fullName": "John Smith",
      "email": "john@techcorp.ng",
      "role": "Director",
      "requiresVerification": true
    }
  ],
  "callbackUrl": "https://yourapp.com/kyc/supplier-callback"
}`}
                  />
                </EndpointSection>
              </TabsContent>

              <TabsContent value="status" className="space-y-4 mt-4">
                <EndpointSection
                  method="GET"
                  path="/api/v1/kyc/requests/:requestId"
                  description="Get verification status and results"
                >
                  <p className="text-sm text-muted-foreground">
                    Retrieve the current status and results of a verification request.
                  </p>
                  <CodeBlock
                    language="json"
                    code={`{
  "id": 142,
  "type": "individual",
  "status": "verified",
  "riskScore": "green",
  "subjectName": "Adebayo Ogunlesi",
  "subjectEmail": "adebayo@example.com",
  "reviewedAt": "2026-03-15T10:30:00.000Z",
  "documents": [
    {
      "id": 45,
      "fileName": "passport.jpg",
      "status": "accepted",
      "expiryDate": "2028-06-15T00:00:00.000Z"
    }
  ],
  "createdAt": "2026-03-01T09:00:00.000Z"
}`}
                  />
                </EndpointSection>

                <EndpointSection
                  method="GET"
                  path="/api/v1/kyc/requests"
                  description="List all verification requests"
                >
                  <p className="text-sm text-muted-foreground">
                    List all verification requests for your organisation. Supports pagination and status filtering.
                  </p>
                  <h4 className="text-sm font-semibold">Query Parameters</h4>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Parameter</th>
                          <th className="text-left p-2 font-medium">Type</th>
                          <th className="text-left p-2 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t"><td className="p-2 font-mono text-xs">status</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Filter by status (pending_invite, under_review, verified, rejected)</td></tr>
                        <tr className="border-t"><td className="p-2 font-mono text-xs">type</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Filter by type (individual, supplier)</td></tr>
                        <tr className="border-t"><td className="p-2 font-mono text-xs">page</td><td className="p-2">integer</td><td className="p-2 text-muted-foreground">Page number (default: 1)</td></tr>
                        <tr className="border-t"><td className="p-2 font-mono text-xs">limit</td><td className="p-2">integer</td><td className="p-2 text-muted-foreground">Items per page (default: 20, max: 100)</td></tr>
                      </tbody>
                    </table>
                  </div>
                </EndpointSection>

                <EndpointSection
                  method="GET"
                  path="/api/v1/kyc/requests/:requestId/certificate"
                  description="Download audit certificate"
                >
                  <p className="text-sm text-muted-foreground">
                    Download the verification audit certificate as PDF or HTML. Only available for completed verifications.
                  </p>
                  <h4 className="text-sm font-semibold">Query Parameters</h4>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Parameter</th>
                          <th className="text-left p-2 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t"><td className="p-2 font-mono text-xs">format</td><td className="p-2 text-muted-foreground">Response format: <code className="bg-muted px-1 rounded">pdf</code> (default) or <code className="bg-muted px-1 rounded">html</code></td></tr>
                      </tbody>
                    </table>
                  </div>
                </EndpointSection>
              </TabsContent>

              <TabsContent value="templates" className="space-y-4 mt-4">
                <EndpointSection
                  method="GET"
                  path="/api/v1/kyc/templates"
                  description="List verification templates"
                >
                  <p className="text-sm text-muted-foreground">
                    Get all verification templates configured for your organisation.
                    Templates define which checks and documents are required.
                  </p>
                  <CodeBlock
                    language="json"
                    code={`[
  {
    "id": 5,
    "name": "Standard Employee",
    "type": "individual",
    "description": "Full identity verification for employees",
    "requireDirectorVerification": false,
    "documentRequirementIds": [1, 3, 7]
  },
  {
    "id": 8,
    "name": "IT Vendor",
    "type": "supplier",
    "description": "Due diligence for IT service providers",
    "requireDirectorVerification": true,
    "documentRequirementIds": [2, 4, 5, 6]
  }
]`}
                  />
                </EndpointSection>

                <EndpointSection
                  method="GET"
                  path="/api/v1/kyc/document-requirements/:templateId"
                  description="Get required documents for a template"
                >
                  <p className="text-sm text-muted-foreground">
                    Get the list of documents required by a specific verification template.
                  </p>
                  <CodeBlock
                    language="json"
                    code={`[
  {
    "id": 1,
    "documentName": "Government-issued ID",
    "documentCategory": "identity",
    "isMandatory": true,
    "hasExpiry": true
  },
  {
    "id": 3,
    "documentName": "Proof of Address",
    "documentCategory": "address",
    "isMandatory": true,
    "hasExpiry": false
  }
]`}
                  />
                </EndpointSection>
              </TabsContent>
            </Tabs>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-webhooks">
              <Webhook className="h-5 w-5" />
              Webhooks
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Register webhook URLs to receive real-time notifications when verification events occur.
              Configure webhooks in your organisation settings.
            </p>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Event Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Event</th>
                        <th className="text-left p-2 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t"><td className="p-2 font-mono text-xs">verification.completed</td><td className="p-2 text-muted-foreground">Verification approved by reviewer</td></tr>
                      <tr className="border-t"><td className="p-2 font-mono text-xs">verification.failed</td><td className="p-2 text-muted-foreground">Verification rejected by reviewer</td></tr>
                      <tr className="border-t"><td className="p-2 font-mono text-xs">document.expiring</td><td className="p-2 text-muted-foreground">Document expires within 30 days</td></tr>
                      <tr className="border-t"><td className="p-2 font-mono text-xs">document.expired</td><td className="p-2 text-muted-foreground">Document has expired</td></tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payload Format</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CodeBlock
                  language="json"
                  code={`{
  "event": "verification.completed",
  "timestamp": "2026-03-15T10:30:00.000Z",
  "data": {
    "requestId": 142,
    "type": "individual",
    "status": "verified",
    "riskScore": "green",
    "subjectName": "Adebayo Ogunlesi",
    "subjectEmail": "adebayo@example.com",
    "reviewedAt": "2026-03-15T10:30:00.000Z"
  }
}`}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signature Verification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Every webhook request includes an <code className="bg-muted px-1 rounded">X-Cellion-Signature</code> header
                  containing an HMAC-SHA256 signature of the request body, signed with your webhook secret.
                  Always verify this signature before processing webhooks.
                </p>
                <CodeBlock
                  language="javascript"
                  code={`const crypto = require('crypto');

function verifyWebhookSignature(body, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// In your webhook handler:
app.post('/kyc/callback', (req, res) => {
  const signature = req.headers['x-cellion-signature'];
  if (!verifyWebhookSignature(req.body, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  // Process the event...
  res.status(200).send('OK');
});`}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">Retry Policy</h3>
                <p className="text-sm text-muted-foreground">
                  Failed deliveries (non-2xx response) are retried up to <strong>3 times</strong> with exponential backoff:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>1st retry: after ~5 minutes</li>
                  <li>2nd retry: after ~25 minutes</li>
                  <li>3rd retry: after ~2 hours</li>
                </ul>
                <p className="text-sm text-muted-foreground">
                  Your endpoint must respond within 30 seconds with a 2xx status code.
                  You can view delivery logs and send test events from your organisation settings.
                </p>
              </CardContent>
            </Card>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-errors">
              <AlertTriangle className="h-5 w-5" />
              Error Codes
            </h2>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="text-left p-2 font-medium">Code</th>
                    <th className="text-left p-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t"><td className="p-2 font-mono">400</td><td className="p-2 font-mono text-xs">VALIDATION_ERROR</td><td className="p-2 text-muted-foreground">Invalid request body or parameters</td></tr>
                  <tr className="border-t"><td className="p-2 font-mono">401</td><td className="p-2 font-mono text-xs">INVALID_API_KEY</td><td className="p-2 text-muted-foreground">Missing, invalid, or expired API key</td></tr>
                  <tr className="border-t"><td className="p-2 font-mono">402</td><td className="p-2 font-mono text-xs">INSUFFICIENT_CREDITS</td><td className="p-2 text-muted-foreground">No credits remaining or credit limit exceeded</td></tr>
                  <tr className="border-t"><td className="p-2 font-mono">403</td><td className="p-2 font-mono text-xs">PERMISSION_DENIED</td><td className="p-2 text-muted-foreground">API key lacks required permissions</td></tr>
                  <tr className="border-t"><td className="p-2 font-mono">404</td><td className="p-2 font-mono text-xs">NOT_FOUND</td><td className="p-2 text-muted-foreground">Resource not found</td></tr>
                  <tr className="border-t"><td className="p-2 font-mono">429</td><td className="p-2 font-mono text-xs">RATE_LIMIT_EXCEEDED</td><td className="p-2 text-muted-foreground">Too many requests — wait and retry</td></tr>
                  <tr className="border-t"><td className="p-2 font-mono">500</td><td className="p-2 font-mono text-xs">INTERNAL_ERROR</td><td className="p-2 text-muted-foreground">Unexpected server error</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-examples">
              <Code2 className="h-5 w-5" />
              Code Examples
            </h2>

            <Tabs defaultValue="curl" className="w-full">
              <TabsList>
                <TabsTrigger value="curl" data-testid="tab-example-curl">cURL</TabsTrigger>
                <TabsTrigger value="node" data-testid="tab-example-node">Node.js</TabsTrigger>
                <TabsTrigger value="python" data-testid="tab-example-python">Python</TabsTrigger>
              </TabsList>

              <TabsContent value="curl" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Submit Individual Verification</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CodeBlock
                      language="bash"
                      code={`curl -X POST https://cellionone.com/api/v1/kyc/verify/individual \\
  -H "X-API-Key: co_live_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "templateId": 5,
    "subject": {
      "name": "Adebayo Ogunlesi",
      "email": "adebayo@example.com",
      "bvn": "22345678901"
    }
  }'`}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Check Verification Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CodeBlock
                      language="bash"
                      code={`curl -X GET https://cellionone.com/api/v1/kyc/requests/142 \\
  -H "X-API-Key: co_live_your_api_key_here"`}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="node" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Full Verification Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CodeBlock
                      language="javascript"
                      code={`const API_KEY = 'co_live_your_api_key_here';
const BASE_URL = 'https://cellionone.com/api/v1/kyc';

// 1. List available templates
const templates = await fetch(\`\${BASE_URL}/templates\`, {
  headers: { 'X-API-Key': API_KEY }
}).then(r => r.json());

console.log('Templates:', templates);

// 2. Submit individual verification
const verification = await fetch(\`\${BASE_URL}/verify/individual\`, {
  method: 'POST',
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    templateId: templates[0].id,
    subject: {
      name: 'Adebayo Ogunlesi',
      email: 'adebayo@example.com',
      bvn: '22345678901',
      nin: '12345678901'
    },
    metadata: { employeeId: 'EMP-001' }
  })
}).then(r => r.json());

console.log('Request ID:', verification.requestId);

// 3. Check status later
const status = await fetch(
  \`\${BASE_URL}/requests/\${verification.requestId}\`,
  { headers: { 'X-API-Key': API_KEY } }
).then(r => r.json());

console.log('Status:', status.status, 'Risk:', status.riskScore);`}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="python" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Full Verification Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CodeBlock
                      language="python"
                      code={`import requests

API_KEY = 'co_live_your_api_key_here'
BASE_URL = 'https://cellionone.com/api/v1/kyc'
HEADERS = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
}

# 1. List available templates
templates = requests.get(f'{BASE_URL}/templates', headers=HEADERS).json()
print(f"Found {len(templates)} templates")

# 2. Submit individual verification
response = requests.post(f'{BASE_URL}/verify/individual', headers=HEADERS, json={
    'templateId': templates[0]['id'],
    'subject': {
        'name': 'Adebayo Ogunlesi',
        'email': 'adebayo@example.com',
        'bvn': '22345678901',
        'nin': '12345678901'
    },
    'metadata': {'employeeId': 'EMP-001'}
})
result = response.json()
print(f"Request ID: {result['requestId']}")

# 3. Check status
status = requests.get(
    f"{BASE_URL}/requests/{result['requestId']}",
    headers=HEADERS
).json()
print(f"Status: {status['status']}, Risk: {status.get('riskScore', 'N/A')}")

# 4. Verify webhook signature
import hmac
import hashlib

def verify_signature(body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)`}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </section>

          <Separator />

          <section className="space-y-4 pb-12">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">Need help?</h3>
                    <p className="text-sm text-muted-foreground">
                      Contact our team at{" "}
                      <a href="mailto:service@cellionone.com" className="text-primary hover:underline">
                        service@cellionone.com
                      </a>{" "}
                      for API support and integration guidance.
                    </p>
                  </div>
                  <Link href="/login">
                    <Button data-testid="button-get-started">Get Started</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
