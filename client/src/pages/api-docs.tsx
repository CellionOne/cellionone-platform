import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  Key,
  Shield,
  CreditCard,
  Webhook,
  Code2,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  FileCheck,
  AlertCircle,
  Timer,
  ExternalLink,
  Download,
  Zap,
  GitCompare,
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

const sidebarSections = [
  { id: "getting-started", label: "Getting Started" },
  { id: "authentication", label: "Authentication" },
  { id: "billing", label: "Billing" },
  { id: "which-approach", label: "Which Approach?" },
  {
    id: "endpoints",
    label: "Endpoints",
    children: [
      { id: "endpoints-verification", label: "Verification" },
      { id: "endpoints-status", label: "Status & Results" },
      { id: "endpoints-templates", label: "Templates" },
    ],
  },
  { id: "instant-lookups", label: "Instant ID Lookups" },
  { id: "hosted-sessions", label: "Hosted Sessions" },
  { id: "status-lifecycle", label: "Status Lifecycle" },
  { id: "webhooks", label: "Webhooks" },
  { id: "errors", label: "Error Codes" },
  { id: "examples", label: "Code Examples" },
];

function DocsSidebar({ activeSection }: { activeSection: string }) {
  return (
    <nav className="hidden lg:block" data-testid="docs-sidebar">
      <div className="sticky top-20 max-h-[calc(100vh-5rem)] overflow-y-auto pr-4">
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">On this page</h3>
        <ul className="space-y-1">
          {sidebarSections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={`block px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeSection === section.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                data-testid={`sidebar-link-${section.id}`}
              >
                {section.label}
              </a>
              {section.children && (
                <ul className="ml-4 mt-1 space-y-1">
                  {section.children.map((child) => (
                    <li key={child.id}>
                      <a
                        href={`#${child.id}`}
                        className={`block px-3 py-1 text-xs rounded-md transition-colors ${
                          activeSection === child.id
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        data-testid={`sidebar-link-${child.id}`}
                      >
                        {child.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function ParamTable({ params, title }: { params: { field: string; type: string; required: string; description: string }[]; title: string }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium">Field</th>
              <th className="text-left p-2 font-medium">Type</th>
              <th className="text-left p-2 font-medium">Required</th>
              <th className="text-left p-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p, i) => (
              <tr key={i} className="border-t">
                <td className="p-2 font-mono text-xs">{p.field}</td>
                <td className="p-2 text-xs">{p.type}</td>
                <td className="p-2">
                  {p.required === "Yes" ? (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">Required</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">{p.required}</span>
                  )}
                </td>
                <td className="p-2 text-muted-foreground text-xs">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ApiDocsPage() {
  usePageMeta({
    title: "API Documentation \u2014 Cellion One KYC & Verification API",
    description: "Integrate KYC verification into your application with the Cellion One REST API. Documentation for identity verification, corporate due diligence, and compliance endpoints.",
    canonicalPath: "/api-docs",
  });

  const [activeSection, setActiveSection] = useState("getting-started");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const allIds = sidebarSections.flatMap((s) =>
      s.children ? [s.id, ...s.children.map((c) => c.id)] : [s.id]
    );

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const sorted = visible.sort((a, b) => {
            const ai = allIds.indexOf(a.target.id);
            const bi = allIds.indexOf(b.target.id);
            return ai - bi;
          });
          setActiveSection(sorted[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
    );

    allIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      <div className="container mx-auto px-4 pt-24 pb-8 lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        <DocsSidebar activeSection={activeSection} />

        <div className="space-y-8 min-w-0 api-docs-print-content">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold" data-testid="heading-api-docs">API Documentation</h1>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="border-0">v1.0</Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                data-testid="button-download-docs"
                className="print:hidden"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download
              </Button>
            </div>
          </div>

          <section id="getting-started" className="space-y-4 scroll-mt-24">
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

          <section id="authentication" className="space-y-4 scroll-mt-24">
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

          <section id="billing" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-billing">
              <CreditCard className="h-5 w-5" />
              Billing
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Cellion One uses a credit-based model — 1 credit = 1 verification, deducted automatically
              when a session completes. Credits are pre-purchased via Paystack in NGN.
              High-volume organisations can apply for invoiced billing.
            </p>

            {/* Pricing tiers */}
            <div>
              <h3 className="text-base font-semibold mb-3">Verification Pricing</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    id: "identity_only",
                    label: "Identity Check",
                    price: "₦5,000",
                    per: "per credit",
                    timing: "Instant result",
                    timingColor: "text-violet-600 dark:text-violet-400",
                    borderColor: "border-violet-200 dark:border-violet-800",
                    bgColor: "bg-violet-50/60 dark:bg-violet-950/20",
                    checks: [
                      "AML & sanctions screening",
                      "Name-based fraud check",
                    ],
                    note: "Best for quick background checks where you already hold ID documents.",
                  },
                  {
                    id: "individual",
                    label: "Full Individual KYC",
                    price: "₦15,000",
                    per: "per credit",
                    timing: "~2–5 min (webhook)",
                    timingColor: "text-amber-600 dark:text-amber-400",
                    borderColor: "border-amber-200 dark:border-amber-800",
                    bgColor: "bg-amber-50/60 dark:bg-amber-950/20",
                    checks: [
                      "Government-issued ID verification",
                      "Liveness selfie & biometric match",
                      "AML & sanctions screening",
                    ],
                    note: "Full onboarding KYC for individuals. Result delivered via webhook.",
                  },
                  {
                    id: "supplier",
                    label: "Supplier / Corporate",
                    price: "₦75,000",
                    per: "per credit",
                    timing: "~1 business day",
                    timingColor: "text-blue-600 dark:text-blue-400",
                    borderColor: "border-blue-200 dark:border-blue-800",
                    bgColor: "bg-blue-50/60 dark:bg-blue-950/20",
                    checks: [
                      "Corporate entity verification",
                      "Director & shareholder KYC",
                      "AML & sanctions screening",
                    ],
                    note: "Comprehensive due-diligence for suppliers and corporate counterparties.",
                  },
                ].map((tier) => (
                  <Card key={tier.id} className={`${tier.bgColor} ${tier.borderColor}`}>
                    <CardContent className="pt-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight">{tier.label}</p>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-foreground leading-none">{tier.price}</p>
                          <p className="text-xs text-muted-foreground">{tier.per}</p>
                        </div>
                      </div>
                      <ul className="space-y-1.5">
                        {tier.checks.map((c) => (
                          <li key={c} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="text-primary mt-0.5">✓</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                      <div className={`text-xs font-medium ${tier.timingColor}`}>⏱ {tier.timing}</div>
                      <p className="text-xs text-muted-foreground border-t pt-2">{tier.note}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Billing modes */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pre-paid Credits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>Purchase credits upfront via Paystack (NGN)</li>
                    <li>Minimum 10 credits per purchase</li>
                    <li>1 credit = 1 verification at the rate for its type</li>
                    <li>Credits never expire</li>
                    <li>Deducted automatically on session completion</li>
                  </ul>
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
                    Apply through your organisation settings or contact{" "}
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
                  session completion will return <code className="bg-muted px-1 rounded">402 Payment Required</code>:
                </p>
                <CodeBlock
                  language="json"
                  code={`{
  "message": "Insufficient verification credits. Please top up your account to continue.",
  "code": "INSUFFICIENT_CREDITS",
  "verificationType": "individual"
}`}
                />
              </CardContent>
            </Card>
          </section>

          <Separator />

          <section id="which-approach" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-which-approach">
              <GitCompare className="h-5 w-5" />
              Which Approach is Right for You?
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Cellion One offers two verification styles. Choose based on what you need to check and how quickly you need the result.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Instant ID Lookup",
                  icon: Zap,
                  color: "border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/20",
                  iconColor: "text-violet-600 dark:text-violet-400",
                  timing: "Instant · ~1 second",
                  price: "₦5,000 / credit",
                  permission: "verify:identity",
                  points: [
                    "You already hold BVN, NIN, passport or licence numbers",
                    "You need a quick background check",
                    "No biometric matching required",
                    "Synchronous — result in the API response",
                  ],
                  example: "POST /api/v1/kyc/lookup/bvn",
                },
                {
                  title: "Hosted Session (Photo KYC)",
                  icon: FileCheck,
                  color: "border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20",
                  iconColor: "text-amber-600 dark:text-amber-400",
                  timing: "~2–5 min via webhook",
                  price: "₦15,000 / credit",
                  permission: "verify:individual",
                  points: [
                    "You need the subject to submit their own documents",
                    "You want biometric photo matching (selfie vs ID)",
                    "Zero-friction — no Cellion account needed",
                    "Result delivered via webhook",
                  ],
                  example: "POST /api/v1/kyc/sessions",
                },
                {
                  title: "Corporate / Supplier KYC",
                  icon: Shield,
                  color: "border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20",
                  iconColor: "text-blue-600 dark:text-blue-400",
                  timing: "~1 business day",
                  price: "₦75,000 / credit",
                  permission: "verify:supplier",
                  points: [
                    "Verifying a company as a supplier or counterparty",
                    "Need full entity + director verification",
                    "Compliance due-diligence",
                    "Result delivered via webhook",
                  ],
                  example: "POST /api/v1/kyc/verify/supplier",
                },
              ].map((card) => (
                <Card key={card.title} className={card.color}>
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                      <p className="font-semibold text-sm">{card.title}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground">Best when…</p>
                      <ul className="space-y-1">
                        {card.points.map((p) => (
                          <li key={p} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="border-t pt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Timing</span>
                        <span className={`font-medium ${card.iconColor}`}>{card.timing}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Price</span>
                        <span className="font-medium">{card.price}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Permission</span>
                        <code className="bg-muted px-1 rounded text-[10px]">{card.permission}</code>
                      </div>
                    </div>
                    <code className="block text-[10px] text-muted-foreground bg-muted/60 rounded px-2 py-1 font-mono">{card.example}</code>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <Separator />

          <section id="endpoints" className="space-y-4 scroll-mt-24">
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

              <TabsContent value="verification" className="space-y-4 mt-4" id="endpoints-verification">
                <EndpointSection
                  method="POST"
                  path="/api/v1/kyc/verify/individual"
                  description="Submit individual identity verification"
                >
                  <p className="text-sm text-muted-foreground">
                    Submit a request to verify an individual's identity. Supports two modes:
                    template-based (pass a <code className="bg-muted px-1 rounded">templateId</code>) or ad-hoc (specify <code className="bg-muted px-1 rounded">checks</code> and <code className="bg-muted px-1 rounded">requiredDocuments</code> directly).
                  </p>
                  <ParamTable
                    title="Request Body"
                    params={[
                      { field: "templateId", type: "integer", required: "No*", description: "Template ID for template-based verification mode" },
                      { field: "subject.name", type: "string", required: "Yes", description: "Full legal name of the individual" },
                      { field: "subject.email", type: "string", required: "Yes", description: "Email address (verification invite is sent here)" },
                      { field: "subject.bvn", type: "string", required: "No", description: "Bank Verification Number (11 digits)" },
                      { field: "subject.nin", type: "string", required: "No", description: "National Identity Number (11 digits)" },
                      { field: "checks", type: "string[]", required: "No*", description: 'Ad-hoc checks: "bvn", "nin", "aml", "biometric"' },
                      { field: "requiredDocuments", type: "string[]", required: "No*", description: 'Ad-hoc document types: "government_id", "proof_of_address", etc.' },
                      { field: "callbackUrl", type: "string", required: "No", description: "Per-request webhook URL (overrides org default)" },
                      { field: "metadata", type: "object", required: "No", description: "Custom key-value pairs returned in webhooks" },
                    ]}
                  />
                  <p className="text-xs text-muted-foreground italic">
                    * Either <code className="bg-muted px-1 rounded">templateId</code> or <code className="bg-muted px-1 rounded">checks</code>/<code className="bg-muted px-1 rounded">requiredDocuments</code> must be provided.
                  </p>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Example: Template-based</h4>
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
  "metadata": { "employeeId": "EMP-001" }
}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Example: Ad-hoc</h4>
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
                  <ParamTable
                    title="Response"
                    params={[
                      { field: "requestId", type: "integer", required: "-", description: "Unique verification request ID" },
                      { field: "status", type: "string", required: "-", description: 'Initial status: "pending_invite"' },
                      { field: "type", type: "string", required: "-", description: '"individual"' },
                      { field: "inviteToken", type: "string", required: "-", description: "Token included in the subject's email invite" },
                      { field: "expiresAt", type: "ISO 8601", required: "-", description: "Invite expiration date" },
                      { field: "message", type: "string", required: "-", description: "Confirmation message" },
                    ]}
                  />
                </EndpointSection>

                <EndpointSection
                  method="POST"
                  path="/api/v1/kyc/verify/supplier"
                  description="Submit supplier/corporate verification"
                >
                  <p className="text-sm text-muted-foreground">
                    Submit a corporate due diligence request. Include company details and optionally director information
                    for individual verification of each director.
                  </p>
                  <ParamTable
                    title="Request Body"
                    params={[
                      { field: "templateId", type: "integer", required: "No*", description: "Template ID for template-based verification" },
                      { field: "subject.name", type: "string", required: "Yes", description: "Company or entity name" },
                      { field: "subject.email", type: "string", required: "Yes", description: "Primary contact email" },
                      { field: "company.companyName", type: "string", required: "Yes", description: "Registered company name" },
                      { field: "company.rcNumber", type: "string", required: "No", description: "CAC Registration number (RC-XXXXXX)" },
                      { field: "company.tinNumber", type: "string", required: "No", description: "Tax Identification Number" },
                      { field: "company.contactPersonName", type: "string", required: "No", description: "Contact person full name" },
                      { field: "company.contactPersonEmail", type: "string", required: "No", description: "Contact person email" },
                      { field: "company.contactPersonPhone", type: "string", required: "No", description: "Contact person phone" },
                      { field: "directors[]", type: "array", required: "No", description: "List of directors to verify individually" },
                      { field: "directors[].fullName", type: "string", required: "Yes", description: "Director full name" },
                      { field: "directors[].email", type: "string", required: "Yes", description: "Director email (invite sent here)" },
                      { field: "directors[].role", type: "string", required: "No", description: 'Role title (e.g. "Director", "CEO")' },
                      { field: "directors[].requiresVerification", type: "boolean", required: "No", description: "Whether to create individual verification (default: true)" },
                      { field: "callbackUrl", type: "string", required: "No", description: "Per-request webhook URL" },
                      { field: "metadata", type: "object", required: "No", description: "Custom key-value pairs" },
                    ]}
                  />
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Example</h4>
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
                  </div>
                </EndpointSection>
              </TabsContent>

              <TabsContent value="status" className="space-y-4 mt-4" id="endpoints-status">
                <EndpointSection
                  method="GET"
                  path="/api/v1/kyc/requests/:requestId"
                  description="Get verification status and results"
                >
                  <p className="text-sm text-muted-foreground">
                    Retrieve the current status and results of a verification request.
                  </p>
                  <ParamTable
                    title="Response Fields"
                    params={[
                      { field: "id", type: "integer", required: "-", description: "Verification request ID" },
                      { field: "type", type: "string", required: "-", description: '"individual" or "supplier"' },
                      { field: "status", type: "string", required: "-", description: "Current status (see Status Lifecycle below)" },
                      { field: "riskScore", type: "string", required: "-", description: '"green", "amber", or "red" (see Risk Scores below)' },
                      { field: "subjectName", type: "string", required: "-", description: "Name of the person/company being verified" },
                      { field: "subjectEmail", type: "string", required: "-", description: "Email of the subject" },
                      { field: "reviewedAt", type: "ISO 8601", required: "-", description: "When the review was completed (null if pending)" },
                      { field: "documents", type: "array", required: "-", description: "Submitted documents with status and expiry" },
                      { field: "createdAt", type: "ISO 8601", required: "-", description: "When the request was created" },
                    ]}
                  />
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Example Response</h4>
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
                  </div>
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

              <TabsContent value="templates" className="space-y-4 mt-4" id="endpoints-templates">
                <EndpointSection
                  method="GET"
                  path="/api/v1/kyc/templates"
                  description="List verification templates"
                >
                  <p className="text-sm text-muted-foreground">
                    Get all verification templates configured for your organisation.
                    Templates define which checks and documents are required.
                  </p>
                  <ParamTable
                    title="Response Fields (array)"
                    params={[
                      { field: "id", type: "integer", required: "-", description: "Template ID (use in verify requests)" },
                      { field: "name", type: "string", required: "-", description: 'Template name (e.g. "Standard Employee")' },
                      { field: "type", type: "string", required: "-", description: '"individual" or "supplier"' },
                      { field: "description", type: "string", required: "-", description: "Human-readable template description" },
                      { field: "requireDirectorVerification", type: "boolean", required: "-", description: "Whether supplier directors require individual verification" },
                      { field: "documentRequirementIds", type: "integer[]", required: "-", description: "IDs of required document types" },
                    ]}
                  />
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Example Response</h4>
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
                  </div>
                </EndpointSection>

                <EndpointSection
                  method="GET"
                  path="/api/v1/kyc/document-requirements/:templateId"
                  description="Get required documents for a template"
                >
                  <p className="text-sm text-muted-foreground">
                    Get the list of documents required by a specific verification template.
                  </p>
                  <ParamTable
                    title="Response Fields (array)"
                    params={[
                      { field: "id", type: "integer", required: "-", description: "Document requirement ID" },
                      { field: "documentName", type: "string", required: "-", description: 'Display name (e.g. "Government-issued ID")' },
                      { field: "documentCategory", type: "string", required: "-", description: '"identity", "address", "financial", "corporate", "other"' },
                      { field: "isMandatory", type: "boolean", required: "-", description: "Whether the document is required or optional" },
                      { field: "hasExpiry", type: "boolean", required: "-", description: "Whether the document has an expiration date" },
                    ]}
                  />
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Example Response</h4>
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
                  </div>
                </EndpointSection>
              </TabsContent>
            </Tabs>
          </section>

          <Separator />

          <section id="instant-lookups" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-instant-lookups">
              <Zap className="h-5 w-5" />
              Instant ID Lookups
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Synchronous endpoints that look up a Nigerian identity number and return the result immediately in the API response.
              No webhook required. 1 <strong>Identity Check</strong> credit (₦5,000) is deducted per call.
              All endpoints require the <code className="bg-muted px-1 rounded">verify:identity</code> permission.
            </p>

            <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/10">
              <CardContent className="pt-5 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Request format — all lookup endpoints</p>
                <p>Send a <code className="bg-muted px-1 rounded">POST</code> request with <code className="bg-muted px-1 rounded">idNumber</code> in the body. The response is synchronous (HTTP 200) with a <code className="bg-muted px-1 rounded">verified</code> boolean.</p>
                <p>A <code className="bg-muted px-1 rounded">verified: false</code> response is <em>not</em> an error — it means the ID was not matched. HTTP errors (4xx/5xx) indicate request problems.</p>
              </CardContent>
            </Card>

            <EndpointSection method="POST" path="/api/v1/kyc/lookup/bvn" description="Verify a Bank Verification Number (BVN)">
              <ParamTable title="Request Body" params={[
                { field: "idNumber", type: "string", required: "Yes", description: "11-digit BVN" },
              ]} />
              <CodeBlock language="json" code={`// Request
{ "idNumber": "22345678901" }

// Response (match)
{
  "verified": true,
  "idType": "BVN",
  "fullName": "ADEBAYO OGUNLESI",
  "dob": "1990-01-15",
  "gender": "Male",
  "referenceId": "id_lookup_7_1711977600000_a1b2c3d4",
  "requestId": 215
}

// Response (no match)
{
  "verified": false,
  "idType": "BVN",
  "reason": "ID could not be verified",
  "referenceId": "id_lookup_7_1711977600001_e5f6g7h8",
  "requestId": 216
}`} />
            </EndpointSection>

            <EndpointSection method="POST" path="/api/v1/kyc/lookup/nin" description="Verify a National Identity Number (NIN)">
              <ParamTable title="Request Body" params={[
                { field: "idNumber", type: "string", required: "Yes", description: "11-digit NIN" },
              ]} />
              <CodeBlock language="json" code={`{ "idNumber": "12345678901" }`} />
            </EndpointSection>

            <EndpointSection method="POST" path="/api/v1/kyc/lookup/drivers-licence" description="Verify a Nigerian driver's licence number">
              <ParamTable title="Request Body" params={[
                { field: "idNumber", type: "string", required: "Yes", description: "Driver's licence number (3–30 characters)" },
              ]} />
              <CodeBlock language="json" code={`{ "idNumber": "LAG-AB-1234567" }`} />
            </EndpointSection>

            <EndpointSection method="POST" path="/api/v1/kyc/lookup/voter-id" description="Verify a Voter Identification Number (VIN)">
              <ParamTable title="Request Body" params={[
                { field: "idNumber", type: "string", required: "Yes", description: "Voter ID number (3–30 characters)" },
              ]} />
              <CodeBlock language="json" code={`{ "idNumber": "71A1B234567" }`} />
            </EndpointSection>

            <EndpointSection method="POST" path="/api/v1/kyc/lookup/passport" description="Verify an international passport number">
              <ParamTable title="Request Body" params={[
                { field: "idNumber", type: "string", required: "Yes", description: "Passport number (3–20 characters)" },
              ]} />
              <CodeBlock language="json" code={`{ "idNumber": "A12345678" }`} />
            </EndpointSection>

            <EndpointSection method="POST" path="/api/v1/kyc/lookup/aml" description="Name-based AML & sanctions screening">
              <p className="text-sm text-muted-foreground">
                Screens a full name against PEP lists, sanctions lists, and adverse media databases.
                Returns <code className="bg-muted px-1 rounded">isHit: false</code> when no matches are found (good outcome).
              </p>
              <ParamTable title="Request Body" params={[
                { field: "fullName", type: "string", required: "Yes", description: "Full legal name to screen (2–255 characters)" },
              ]} />
              <CodeBlock language="json" code={`// Request
{ "fullName": "Adebayo Ogunlesi" }

// Response (clean — no AML hits)
{
  "isHit": false,
  "hitTypes": [],
  "matchCount": 0,
  "referenceId": "aml_7_1711977600000_i9j0k1l2",
  "requestId": 220
}

// Response (flagged)
{
  "isHit": true,
  "hitTypes": ["PEP", "Sanction"],
  "matchCount": 2,
  "referenceId": "aml_7_1711977600001_m3n4o5p6",
  "requestId": 221
}`} />
            </EndpointSection>

            <Card>
              <CardContent className="pt-5">
                <table className="w-full text-sm border rounded-md overflow-hidden">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Endpoint</th>
                      <th className="text-left p-2 font-medium">ID Type</th>
                      <th className="text-left p-2 font-medium">Format</th>
                      <th className="text-left p-2 font-medium">Credit Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { path: "/lookup/bvn", id: "BVN", format: "11 digits", cost: "1 Identity" },
                      { path: "/lookup/nin", id: "NIN", format: "11 digits", cost: "1 Identity" },
                      { path: "/lookup/drivers-licence", id: "Driver's Licence", format: "3–30 chars", cost: "1 Identity" },
                      { path: "/lookup/voter-id", id: "Voter ID", format: "3–30 chars", cost: "1 Identity" },
                      { path: "/lookup/passport", id: "Passport", format: "3–20 chars", cost: "1 Identity" },
                      { path: "/lookup/aml", id: "AML Screen", format: "Full name", cost: "1 Identity" },
                    ].map((row) => (
                      <tr key={row.path} className="border-t">
                        <td className="p-2 font-mono text-xs text-violet-600 dark:text-violet-400">/api/v1/kyc{row.path}</td>
                        <td className="p-2 text-xs">{row.id}</td>
                        <td className="p-2 text-xs text-muted-foreground">{row.format}</td>
                        <td className="p-2 text-xs text-muted-foreground">{row.cost} (₦5,000)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>

          <Separator />

          <section id="hosted-sessions" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-hosted-sessions">
              <ExternalLink className="h-5 w-5" />
              Hosted Verification Sessions
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Hosted sessions let you generate a unique, time-limited verification link for a subject
              without them needing a Cellion One account. Share the link via email or SMS; the subject
              completes all steps in a mobile-friendly wizard. Requires the <code className="bg-muted px-1 rounded">verify:individual</code> permission.
            </p>

            <EndpointSection method="POST" path="/api/v1/kyc/sessions" badge="Hosted Sessions" description="Create a new hosted verification session and receive a shareable session link. The wizard shown to the subject adapts based on your organisation's Integration Profile and any prefill data you supply.">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Request body</p>
                  <CodeBlock language="json" code={`{
  "subjectName": "Ngozi Adeyemi",
  "subjectEmail": "ngozi@example.com",
  "returnUrl": "https://yourapp.com/kyc-done",
  "expiresInHours": 48,
  "prefill": {
    "firstName": "Ngozi",
    "lastName": "Adeyemi",
    "dateOfBirth": "1990-05-14",
    "documentType": "national_id",
    "idNumber": "11234567890"
  },
  "requiredSteps": ["documents", "selfie"]
}`} />
                  <table className="w-full text-sm mt-3 border rounded-md overflow-hidden">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Field</th>
                        <th className="text-left p-2 font-medium">Type</th>
                        <th className="text-left p-2 font-medium">Required</th>
                        <th className="text-left p-2 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="p-2 font-mono text-xs">subjectName</td>
                        <td className="p-2 text-muted-foreground">string</td>
                        <td className="p-2 text-muted-foreground">Yes</td>
                        <td className="p-2 text-muted-foreground">Full name of the subject</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2 font-mono text-xs">subjectEmail</td>
                        <td className="p-2 text-muted-foreground">string</td>
                        <td className="p-2 text-muted-foreground">Yes</td>
                        <td className="p-2 text-muted-foreground">Email address for session notifications</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2 font-mono text-xs">returnUrl</td>
                        <td className="p-2 text-muted-foreground">string (URL)</td>
                        <td className="p-2 text-muted-foreground">No</td>
                        <td className="p-2 text-muted-foreground">
                          URL to redirect to after session completes. Cellion One appends <code className="bg-muted px-1 rounded text-xs">?session_id=X&status=completed</code> so your app can confirm completion without polling.
                        </td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2 font-mono text-xs">expiresInHours</td>
                        <td className="p-2 text-muted-foreground">number</td>
                        <td className="p-2 text-muted-foreground">No</td>
                        <td className="p-2 text-muted-foreground">Link expiry in hours (default: 48, max: 168). When expired, a <code className="bg-muted px-1 rounded text-xs">session.expired</code> webhook is fired.</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2 font-mono text-xs">prefill</td>
                        <td className="p-2 text-muted-foreground">object</td>
                        <td className="p-2 text-muted-foreground">No</td>
                        <td className="p-2 text-muted-foreground">
                          Data your system already holds. Prefilled fields are shown as read-only confirmations in the wizard and are not re-entered by the subject.
                          Accepted keys: <code className="bg-muted px-1 rounded text-xs">firstName</code>, <code className="bg-muted px-1 rounded text-xs">lastName</code>, <code className="bg-muted px-1 rounded text-xs">dateOfBirth</code> (YYYY-MM-DD), <code className="bg-muted px-1 rounded text-xs">documentType</code>, <code className="bg-muted px-1 rounded text-xs">idNumber</code>, <code className="bg-muted px-1 rounded text-xs">idDocumentUrl</code> (URL of an already-uploaded ID document image — skips the document step).
                        </td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2 font-mono text-xs">requiredSteps</td>
                        <td className="p-2 text-muted-foreground">string[]</td>
                        <td className="p-2 text-muted-foreground">No</td>
                        <td className="p-2 text-muted-foreground">
                          Override the steps shown to the subject for this session only. Accepted values: <code className="bg-muted px-1 rounded text-xs">"identity"</code>, <code className="bg-muted px-1 rounded text-xs">"documents"</code>, <code className="bg-muted px-1 rounded text-xs">"selfie"</code>. If omitted, steps are derived from your organisation's Integration Profile.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground text-sm">Integration Profiles</p>
                  <p>Configure a default step set for all sessions in your organisation's Settings → Integration tab. Four profiles are available:</p>
                  <ul className="list-disc list-inside space-y-0.5 mt-1">
                    <li><strong>Full Hosted</strong> — subject completes identity details, document upload, and selfie (webhook, ~2–5 min)</li>
                    <li><strong>Prefill + Selfie</strong> — you supply name/DOB, subject uploads document and takes selfie (webhook, ~1–2 min)</li>
                    <li><strong>Selfie Only</strong> — you supply all document data, subject takes a selfie only (webhook, ~30 sec)</li>
                    <li><strong>Data Collection</strong> — subject provides identity details and uploads their ID document, no selfie (instant result)</li>
                  </ul>
                  <p className="mt-1">Per-session <code className="bg-muted px-1 rounded">requiredSteps</code> always overrides the profile. The <code className="bg-muted px-1 rounded">resultTiming</code> in the response reflects whether biometric processing is involved.</p>
                </div>

                <div>
                  <p className="text-sm font-medium mb-3">Profile-specific request examples</p>
                  <div className="space-y-4">
                    <div className="rounded-lg border overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b">
                        <p className="text-xs font-semibold">Full Hosted — no prior data</p>
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Webhook · ~2–5 min</span>
                      </div>
                      <CodeBlock language="json" code={`// POST /api/v1/kyc/sessions
// Subject completes: identity details → document upload → selfie
{
  "subjectName": "Amara Okafor",
  "subjectEmail": "amara@example.com",
  "returnUrl": "https://yourapp.com/kyc-done",
  "expiresInHours": 48
  // No prefill — wizard shows all three steps
}

// Response
{
  "sessionId": 101,
  "sessionUrl": "https://cellionone.com/verify/tok_abc...",
  "resultTiming": "webhook",
  "requiredSteps": ["identity", "documents", "selfie"]
}`} />
                    </div>

                    <div className="rounded-lg border overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b">
                        <p className="text-xs font-semibold">Prefill + Selfie — you have name &amp; DOB</p>
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Webhook · ~1–2 min</span>
                      </div>
                      <CodeBlock language="json" code={`// POST /api/v1/kyc/sessions
// Subject completes: document upload → selfie (identity skipped)
{
  "subjectName": "Amara Okafor",
  "subjectEmail": "amara@example.com",
  "prefill": {
    "firstName": "Amara",
    "lastName": "Okafor",
    "dateOfBirth": "1992-08-21",
    "documentType": "national_id",
    "idNumber": "19283746501"
  }
}

// Response
{
  "sessionId": 102,
  "sessionUrl": "https://cellionone.com/verify/tok_def...",
  "resultTiming": "webhook",
  "requiredSteps": ["documents", "selfie"]
}`} />
                    </div>

                    <div className="rounded-lg border overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b">
                        <p className="text-xs font-semibold">Selfie Only — you have all document data</p>
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">Webhook · ~30 sec</span>
                      </div>
                      <CodeBlock language="json" code={`// POST /api/v1/kyc/sessions
// Subject completes: selfie only (identity + document steps skipped)
{
  "subjectName": "Amara Okafor",
  "subjectEmail": "amara@example.com",
  "prefill": {
    "firstName": "Amara",
    "lastName": "Okafor",
    "dateOfBirth": "1992-08-21",
    "documentType": "national_id",
    "idNumber": "19283746501",
    "idDocumentUrl": "https://storage.yourapp.com/docs/amara-id.jpg"
  }
}

// Response
{
  "sessionId": 103,
  "sessionUrl": "https://cellionone.com/verify/tok_ghi...",
  "resultTiming": "webhook",
  "requiredSteps": ["selfie"]
}`} />
                    </div>

                    <div className="rounded-lg border overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b">
                        <p className="text-xs font-semibold">Data Collection — no biometric matching</p>
                        <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">Instant result</span>
                      </div>
                      <CodeBlock language="json" code={`// POST /api/v1/kyc/sessions
// Subject completes: identity details → document upload (no selfie)
{
  "subjectName": "Amara Okafor",
  "subjectEmail": "amara@example.com",
  "requiredSteps": ["identity", "documents"]
  // resultTiming will be "instant" — no biometric processing
}

// Response
{
  "sessionId": 104,
  "sessionUrl": "https://cellionone.com/verify/tok_jkl...",
  "resultTiming": "instant",
  "requiredSteps": ["identity", "documents"]
}`} />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Response <span className="text-muted-foreground font-normal">201 Created</span></p>
                  <CodeBlock language="json" code={`{
  "sessionId": 42,
  "sessionToken": "tok_a1b2c3d4e5f6...",
  "sessionUrl": "https://cellionone.com/verify/tok_a1b2c3d4e5f6...",
  "expiresAt": "2026-03-28T10:00:00.000Z",
  "status": "pending",
  "resultTiming": "webhook",
  "requiredSteps": ["documents", "selfie"]
}`} />
                  <table className="w-full text-sm mt-3 border rounded-md overflow-hidden">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Field</th>
                        <th className="text-left p-2 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="p-2 font-mono text-xs">resultTiming</td>
                        <td className="p-2 text-muted-foreground"><code className="bg-muted px-1 rounded text-xs">"instant"</code> when no selfie is required (identity details and/or document collection only); <code className="bg-muted px-1 rounded text-xs">"webhook"</code> when a selfie is required (biometric matching runs asynchronously and takes a few seconds).</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2 font-mono text-xs">requiredSteps</td>
                        <td className="p-2 text-muted-foreground">The resolved step list for this session (after applying the integration profile and any per-session override).</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </EndpointSection>

            <EndpointSection method="GET" path="/api/v1/kyc/sessions" badge="Hosted Sessions" description="List all hosted sessions created by your organisation.">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Response <span className="text-muted-foreground font-normal">200 OK</span></p>
                  <CodeBlock language="json" code={`{
  "sessions": [
    {
      "id": 42,
      "subjectName": "Ngozi Adeyemi",
      "subjectEmail": "ngozi@example.com",
      "status": "completed",
      "expiresAt": "2026-03-28T10:00:00.000Z",
      "createdAt": "2026-03-25T10:00:00.000Z"
    }
  ]
}`} />
                </div>
              </div>
            </EndpointSection>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Session Status Lifecycle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-0">
                  {[
                    { status: "pending", color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", label: "Pending", description: "Session created. Link has been shared but the subject has not yet started." },
                    { status: "in_progress", color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/30", label: "In Progress", description: "Subject has opened the session link and is actively completing verification steps." },
                    { status: "completed", color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/30", label: "Completed", description: "Subject completed all steps. A verification request is created automatically in your dashboard." },
                    { status: "expired", color: "text-gray-500", bg: "bg-gray-100 dark:bg-gray-900/30", label: "Expired", description: "The link expired before the subject completed verification. Create a new session to retry." },
                  ].map((step, i, arr) => (
                    <div key={step.status} className="flex items-start gap-4" data-testid={`session-status-step-${step.status}`}>
                      <div className="flex flex-col items-center">
                        <div className={`h-10 w-10 rounded-full ${step.bg} flex items-center justify-center flex-shrink-0`}>
                          <span className={`text-xs font-bold ${step.color}`}>{step.status === "completed" ? "✓" : step.status === "expired" ? "✕" : "●"}</span>
                        </div>
                        {i < arr.length - 1 && <div className="w-px h-8 bg-border" />}
                      </div>
                      <div className="pt-1.5 pb-4">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-medium">{step.status}</code>
                          <span className="text-sm text-muted-foreground">— {step.label}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-muted">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong className="text-foreground">Session links are single-use per subject.</strong> Once a session is <code className="bg-muted px-1 rounded">completed</code> or <code className="bg-muted px-1 rounded">expired</code>, the link no longer works. Create a new session to re-verify.</p>
                    <p>Completed sessions automatically create a verification request in your dashboard, visible under the <strong className="text-foreground">Requests</strong> tab.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <Separator />

          <section id="status-lifecycle" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-status-lifecycle">
              <Clock className="h-5 w-5" />
              Verification Status Lifecycle
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Every verification request progresses through a series of statuses. Understanding this flow
              helps you build correct integrations and handle webhook events appropriately.
            </p>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-0">
                  {[
                    { status: "pending_invite", icon: Mail, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", label: "Pending Invite", description: "Request created. Subject receives an email invite to begin verification." },
                    { status: "pending_submission", icon: FileCheck, color: "text-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-900/30", label: "Pending Submission", description: "Subject accepted the invite and is completing their profile and uploading documents." },
                    { status: "under_review", icon: Clock, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/30", label: "Under Review", description: "All documents submitted. Awaiting review by an organisation reviewer." },
                    { status: "verified", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/30", label: "Verified", description: "Approved by reviewer. Triggers verification.completed webhook." },
                    { status: "rejected", icon: XCircle, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30", label: "Rejected", description: "Rejected by reviewer with reason. Triggers verification.failed webhook." },
                    { status: "expired", icon: Timer, color: "text-gray-500", bg: "bg-gray-100 dark:bg-gray-900/30", label: "Expired", description: "Invite expired before the subject completed verification. No credit is refunded." },
                  ].map((step, i, arr) => (
                    <div key={step.status} className="flex items-start gap-4" data-testid={`status-step-${step.status}`}>
                      <div className="flex flex-col items-center">
                        <div className={`h-10 w-10 rounded-full ${step.bg} flex items-center justify-center flex-shrink-0`}>
                          <step.icon className={`h-5 w-5 ${step.color}`} />
                        </div>
                        {i < arr.length - 1 && (
                          <div className="w-px h-8 bg-border" />
                        )}
                      </div>
                      <div className="pt-1.5 pb-4">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-medium">{step.status}</code>
                          <span className="text-sm text-muted-foreground">— {step.label}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Risk Scores</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Completed verifications receive a risk score based on document completeness and validity:
                </p>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Score</th>
                        <th className="text-left p-2 font-medium">Level</th>
                        <th className="text-left p-2 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="p-2"><Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">green</Badge></td>
                        <td className="p-2 font-medium">Low Risk</td>
                        <td className="p-2 text-muted-foreground">All required documents present and valid. No AML flags.</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2"><Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">amber</Badge></td>
                        <td className="p-2 font-medium">Moderate Risk</td>
                        <td className="p-2 text-muted-foreground">Some optional documents missing or documents expiring within 30 days.</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2"><Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">red</Badge></td>
                        <td className="p-2 font-medium">High Risk</td>
                        <td className="p-2 text-muted-foreground">Critical mandatory documents missing, expired, or AML screening flagged.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>

          <Separator />

          <section id="webhooks" className="space-y-4 scroll-mt-24">
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

          <section id="errors" className="space-y-4 scroll-mt-24">
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

          <section id="examples" className="space-y-4 scroll-mt-24">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Testing
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    You can send test webhook events from the <strong>Webhooks</strong> tab in your organisation settings
                    to verify your integration handles payloads correctly. Note that the platform does not currently
                    offer a sandbox or test mode — all verification requests consume real credits.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    API Versioning
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    The API is currently at <strong>v1</strong>. The version is included in the URL prefix
                    (<code className="bg-muted px-1 rounded">/api/v1/kyc</code>). Breaking changes will be
                    introduced under a new version prefix (e.g. <code className="bg-muted px-1 rounded">/api/v2/kyc</code>).
                    Existing versions will continue to be supported with advance notice.
                  </p>
                </CardContent>
              </Card>
            </div>

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
                  <Link href="/register">
                    <Button data-testid="button-get-started">Get Started</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
