import { Link } from "wouter";
import { Code2, Shield, Zap, Building2, ArrowRight, Key } from "lucide-react";
import { Button } from "@/components/ui/button";

const MODULES = [
  { name: "Identity", icon: Shield, desc: "BVN/NIN verification, biometric KYC, liveness detection" },
  { name: "Formation", icon: Building2, desc: "CAC company registry lookups by RC number" },
  { name: "Escrow", icon: Key, desc: "DVA-backed escrow transactions for B2B payments" },
  { name: "Intelligence", icon: Zap, desc: "NGX market pulse — ASI, equities, analyst signals" },
  { name: "Bureau", icon: Code2, desc: "ClearLedger credit scoring from alternative data" },
];

export default function DeveloperLanding() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Cellion One API</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/developers/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/developers/register">
              <Button size="sm">Get API access</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Build on Nigeria's legal-tech API platform
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Cellion One gives fintechs, lenders, and enterprise platforms programmatic access to
          identity verification, credit scoring, escrow, and company registry — all via a single REST API.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/developers/register">
            <Button size="lg" className="gap-2">
              Start building <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/developers/docs">
            <Button size="lg" variant="outline">View docs</Button>
          </Link>
        </div>
      </section>

      {/* Modules */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="text-xl font-semibold mb-6 text-center">API Modules</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.name} className="border border-border/60 rounded-lg p-5 hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{m.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
