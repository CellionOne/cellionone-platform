import { useState } from "react";
import { DevLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Download } from "lucide-react";

const BASE_URL = "https://cellionone.com/api/v1";

type Method = "GET" | "POST" | "DELETE" | "PATCH";

interface Endpoint {
  method: Method;
  path: string;
  desc: string;
  scope: string;
  requestExample?: string;
  responseExample: string;
}

interface Module {
  name: string;
  scope: string;
  description: string;
  pdfRoute?: string;
  endpoints: Endpoint[];
}

const MODULES: Module[] = [
  {
    name: "Identity",
    scope: "verify:identity",
    description: "Verify Nigerian identities via BVN, NIN, driver's licence, and voter ID against government databases.",
    pdfRoute: "/api/docs/kyc-api.pdf",
    endpoints: [
      {
        method: "POST", path: "/kyc/lookup/bvn", scope: "verify:identity",
        desc: "Verify a BVN against NIBSS. Returns name, DOB, phone, gender, photo.",
        requestExample: `{\n  "idNumber": "22200000000",\n  "firstName": "Emeka",\n  "lastName": "Okoro",\n  "dateOfBirth": "1990-01-15"\n}`,
        responseExample: `{\n  "verified": true,\n  "idType": "BVN",\n  "fullName": "EMEKA OKORO",\n  "dob": "1990-01-15",\n  "phone": "080XXXXXXXX"\n}`,
      },
      {
        method: "POST", path: "/kyc/lookup/nin", scope: "verify:identity",
        desc: "Verify a NIN against NIMC.",
        responseExample: `{\n  "verified": true,\n  "idType": "NIN",\n  "fullName": "NGOZI ADEYEMI"\n}`,
      },
    ],
  },
  {
    name: "Escrow",
    scope: "escrow:read | escrow:write",
    description: "DVA-backed escrow transactions for B2B payments. Buyers pay to a Dedicated Virtual Account; funds released by your platform.",
    pdfRoute: "/api/docs/escrow-api.pdf",
    endpoints: [
      {
        method: "POST", path: "/escrow/transactions", scope: "escrow:write",
        desc: "Create a new escrow transaction with a unique DVA for the buyer.",
        requestExample: `{\n  "amount": 50000000,\n  "description": "Supply contract",\n  "buyerName": "Emeka Obi",\n  "buyerEmail": "emeka@buyer.ng",\n  "beneficiaryName": "ValvesTech Ltd",\n  "beneficiaryAccountNumber": "0123456789",\n  "beneficiaryBankCode": "058"\n}`,
        responseExample: `{\n  "reference": "CO-ESC-2026-A3F7D2B1",\n  "status": "pending_payment",\n  "dvaAccountNumber": "9101234567",\n  "dvaBankName": "Titan Trust Bank"\n}`,
      },
      {
        method: "GET", path: "/escrow/transactions", scope: "escrow:read",
        desc: "List all escrow transactions for your organisation.",
        responseExample: `{\n  "transactions": [...],\n  "count": 12\n}`,
      },
      {
        method: "POST", path: "/escrow/transactions/:reference/release", scope: "escrow:write",
        desc: "Release funds to the seller after conditions are met.",
        responseExample: `{\n  "status": "pending_transfer",\n  "transferReference": "co_esc_rel_..."\n}`,
      },
    ],
  },
  {
    name: "Intelligence",
    scope: "intelligence:read",
    description: "Real-time Nigerian Exchange (NGX) market data — ASI index, equities, analyst signals, and sector rotation.",
    endpoints: [
      {
        method: "GET", path: "/intelligence/pulse", scope: "intelligence:read",
        desc: "Latest NGX All-Share Index, Brent crude, and NGN/USD rate.",
        responseExample: `{\n  "available": true,\n  "asiIndex": 98542.5,\n  "brentCrudeUsd": 72.4,\n  "ngnPerUsd": 1620.0,\n  "commentary": "Mixed session...",\n  "updatedAt": "2026-06-09T16:30:00Z"\n}`,
      },
    ],
  },
  {
    name: "Formation",
    scope: "formation:read",
    description: "CAC company registry lookups by RC number. Returns name, directors, registration date, and company status.",
    pdfRoute: "/api/docs/kyb-api.pdf",
    endpoints: [
      {
        method: "POST", path: "/formation/lookup", scope: "formation:read",
        desc: "Live CAC registry lookup by RC number.",
        requestExample: `{\n  "rcNumber": "9228748",\n  "businessType": "co"\n}`,
        responseExample: `{\n  "status": "found",\n  "companyName": "CELLION PLATFORMS NIGERIA LTD",\n  "registrationDate": "2022-08-15",\n  "companyStatus": "ACTIVE",\n  "directors": [{"name": "EMEKA OKORO", "role": "DIRECTOR"}]\n}`,
      },
      {
        method: "GET", path: "/formation/lookup?rcNumber=9228748", scope: "formation:read",
        desc: "Cache-first formation lookup (returns cached result if available).",
        responseExample: `{\n  "status": "found",\n  "companyName": "CELLION PLATFORMS NIGERIA LTD",\n  "cached": true\n}`,
      },
    ],
  },
  {
    name: "Bureau",
    scope: "bureau:read | bureau:write",
    description: "ClearLedger alternative credit scoring. Build profiles from identity, cash flow, obligations, and capital markets data.",
    endpoints: [
      {
        method: "POST", path: "/bureau/profile", scope: "bureau:read",
        desc: "Query a ClearLedger credit profile by BVN, NIN, or CLR ID.",
        requestExample: `{\n  "identifier_type": "bvn",\n  "identifier": "22200000000"\n}`,
        responseExample: `{\n  "found": true,\n  "clearledger_id": "CLR-01024",\n  "score": 72,\n  "score_band": "NEAR_PRIME",\n  "recommendation": {\n    "decision": "APPROVE_WITH_CONDITIONS",\n    "suggested_limit_ngn": 1500000\n  },\n  "cost_ngn": 900\n}`,
      },
      {
        method: "POST", path: "/bureau/event", scope: "bureau:write",
        desc: "Submit an enrichment event (obligation, cash flow, etc.) to update a profile score.",
        requestExample: `{\n  "identifier_type": "bvn",\n  "identifier": "22200000000",\n  "event_type": "missed_payment",\n  "event_category": "obligation",\n  "payload": { "loan_id": "LN-001" },\n  "occurred_at": "2026-06-01T00:00:00Z"\n}`,
        responseExample: `{\n  "success": true,\n  "clearledger_id": "CLR-01024",\n  "message": "Event recorded. Score recalculation queued."\n}`,
      },
    ],
  },
];

const METHOD_COLOR: Record<Method, string> = {
  GET: "text-blue-600 bg-blue-50 dark:bg-blue-900/30",
  POST: "text-green-600 bg-green-50 dark:bg-green-900/30",
  DELETE: "text-destructive bg-destructive/10",
  PATCH: "text-orange-600 bg-orange-50 dark:bg-orange-900/30",
};

function CodeBlock({ code }: { code: string }) {
  const { toast } = useToast();
  return (
    <div className="relative">
      <pre className="bg-muted rounded-md px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre">{code}</pre>
      <Button size="sm" variant="ghost" className="absolute top-1.5 right-1.5 h-6 w-6 p-0"
        onClick={() => { navigator.clipboard.writeText(code); toast({ title: "Copied!" }); }}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

function curlSnippet(method: Method, path: string, body?: string): string {
  const lines = [`curl -X ${method} ${BASE_URL}${path} \\`, `  -H "X-API-Key: co1_live_your_key" \\`, `  -H "Content-Type: application/json"`];
  if (body) lines.push(`  -d '${body.replace(/\n\s*/g, " ")}'`);
  return lines.join("\n");
}

function nodeSnippet(method: Method, path: string, body?: string): string {
  return `const res = await fetch("${BASE_URL}${path}", {
  method: "${method}",
  headers: {
    "X-API-Key": process.env.CELLION_API_KEY,
    "Content-Type": "application/json",
  },${body ? `\n  body: JSON.stringify(${body}),` : ""}
});
const data = await res.json();`;
}

export default function DeveloperDocs() {
  const [activeModule, setActiveModule] = useState("Identity");
  const [codeTab, setCodeTab] = useState<"curl" | "node">("curl");
  const mod = MODULES.find(m => m.name === activeModule) ?? MODULES[0];

  return (
    <DevLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">API Documentation</h1>
        <p className="text-sm text-muted-foreground">
          Authentication: <code className="bg-muted px-1 rounded text-xs">X-API-Key: co1_live_...</code> header on every request.
          Base URL: <code className="bg-muted px-1 rounded text-xs">{BASE_URL}</code>
        </p>
      </div>

      {/* Module tabs */}
      <div className="flex gap-1 flex-wrap mb-6">
        {MODULES.map(m => (
          <button key={m.name}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              activeModule === m.name
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            onClick={() => setActiveModule(m.name)}>
            {m.name}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-base mb-1">{mod.name} API</h2>
                <p className="text-sm text-muted-foreground mb-2">{mod.description}</p>
                <Badge variant="outline" className="text-xs">Scope: {mod.scope}</Badge>
              </div>
              {mod.pdfRoute && (
                <a href={mod.pdfRoute} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2 shrink-0">
                    <Download className="h-3.5 w-3.5" /> PDF Guide
                  </Button>
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Code snippet language selector */}
        <div className="flex gap-1">
          {(["curl", "node"] as const).map(tab => (
            <button key={tab}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                codeTab === tab ? "bg-foreground text-background font-medium" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              onClick={() => setCodeTab(tab)}>
              {tab === "curl" ? "cURL" : "Node.js"}
            </button>
          ))}
        </div>

        {mod.endpoints.map((ep, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${METHOD_COLOR[ep.method]}`}>{ep.method}</span>
                <code className="text-sm font-mono text-foreground">{BASE_URL}{ep.path}</code>
                <Badge variant="outline" className="text-xs ml-auto">{ep.scope}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{ep.desc}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {ep.requestExample && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Request</p>
                  <CodeBlock code={ep.requestExample} />
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Response</p>
                <CodeBlock code={ep.responseExample} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  {codeTab === "curl" ? "cURL" : "Node.js"} example
                </p>
                <CodeBlock code={
                  codeTab === "curl"
                    ? curlSnippet(ep.method, ep.path, ep.requestExample)
                    : nodeSnippet(ep.method, ep.path, ep.requestExample)
                } />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DevLayout>
  );
}
