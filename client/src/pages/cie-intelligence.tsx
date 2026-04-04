import { usePageMeta } from "@/hooks/use-page-meta";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import {
  BarChart3, TrendingUp, Zap, Banknote, Lock, Star, CheckCircle2,
  ArrowRight, Activity, Globe, Cpu, Database, Bell,
} from "lucide-react";

const tiers = [
  {
    name: "Free",
    price: "₦0",
    period: "/month",
    description: "Market Pulse — macro-level NGX overview accessible to all registered users.",
    features: [
      "Daily NGX market summary",
      "Sector performance heatmap",
      "Top 5 movers & shakers",
      "Macro economic indicators",
    ],
    cta: "Get Started Free",
    href: "/register",
    highlight: false,
  },
  {
    name: "Subscriber",
    price: "₦5,000",
    period: "/month",
    description: "Full security-level intelligence — scores, recommendations, dividends, and API access.",
    features: [
      "Everything in Free",
      "IAS & RS equity scores for all securities",
      "Analyst recommendations (Strong Buy → Sell)",
      "Dividend calendar & corporate actions",
      "Security deep-dive pages",
      "API access (read-only, 100 req/min)",
    ],
    cta: "Subscribe Now",
    href: "/cie",
    highlight: true,
  },
  {
    name: "Pro",
    price: "₦10,000",
    period: "/month",
    description: "Real-time analyst signals, sector rotation alerts, and priority API access.",
    features: [
      "Everything in Subscriber",
      "Analyst trade calls & signals",
      "Sector rotation alerts",
      "Credibility-rated intelligence feed",
      "Priority API (300 req/min)",
      "Dedicated support",
    ],
    cta: "Go Pro",
    href: "/cie",
    highlight: false,
  },
];

const pillars = [
  { icon: TrendingUp, title: "Momentum", desc: "Price trend and relative strength versus the NGX ASI over 20, 50, and 200-day windows." },
  { icon: Activity, title: "Liquidity", desc: "Bid–ask spread analysis, average daily volume, and market depth relative to sector peers." },
  { icon: BarChart3, title: "Valuation", desc: "P/E, P/B, EV/EBITDA, and dividend yield benchmarked against sector medians." },
  { icon: Star, title: "Quality", desc: "Return on equity, earnings consistency, and board governance disclosure score." },
  { icon: Globe, title: "Growth", desc: "Revenue and EBITDA CAGR over 3 years, analyst earnings revision direction." },
  { icon: Cpu, title: "Financial Strength", desc: "Interest coverage, net debt/EBITDA, current ratio, and Altman Z-score proxy." },
];

const faq = [
  {
    q: "What is the Integrated Aggregate Score (IAS)?",
    a: "The IAS is a composite 0–100 score derived from six weighted pillars — Momentum, Liquidity, Valuation, Quality, Growth, and Financial Strength. A higher IAS indicates a more fundamentally and technically attractive security. Scores are recomputed daily after market close.",
  },
  {
    q: "What is the Relative Score (RS)?",
    a: "The RS measures a security's IAS relative to its sector peers, expressed on a 0–100 scale. An RS above 75 means the security ranks in the top quartile within its sector. Use RS to compare securities across very different sectors without bias.",
  },
  {
    q: "How are analyst signals generated?",
    a: "Signals are published by Cellion's equity research team and are available exclusively to Pro subscribers. Each signal includes a sentiment (bullish/bearish/neutral), credibility rating (high/medium/low), and optional security ticker. Trade calls carry specific entry and rationale information.",
  },
  {
    q: "Can I access CIE data via API?",
    a: "Yes. Subscriber and Pro plans include API access with a dedicated key. Subscriber keys support read-only endpoints (market pulse, scores, dividends) at 100 req/min. Pro keys also unlock the signals feed at 300 req/min. Full API documentation is available at /api-docs.",
  },
  {
    q: "How do I cancel or downgrade my subscription?",
    a: "You can cancel at any time from your CIE portal. Your access continues until the end of the current billing period — no immediate cut-off. Cancellations are handled automatically via Paystack and reflected in your subscription dashboard.",
  },
];

export default function CieIntelligencePage() {
  usePageMeta({
    title: "CIE — NGX Equity Intelligence | Cellion One",
    description: "Access institutional-grade equity research for every NGX-listed security. Scores, signals, dividend calendars, and API access — from ₦5,000/month.",
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6" data-testid="badge-cie-hero">
            <BarChart3 className="h-4 w-4" />
            Cellion Intelligence Engine
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6" data-testid="text-cie-hero-heading">
            Institutional-grade equity<br className="hidden sm:block" /> intelligence for the NGX
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10" data-testid="text-cie-hero-desc">
            Composite equity scores, analyst signals, corporate action calendars, and model-driven recommendations
            — covering every listed security on the Nigerian Exchange Group.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/cie">
              <Button size="lg" className="gap-2 min-w-[180px]" data-testid="button-cie-get-access">
                Get Access <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="outline" className="min-w-[180px]" data-testid="button-cie-free-start">
                Start for Free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Score pillars */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-3" data-testid="text-pillars-heading">The CIE scoring model</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              Six research pillars aggregated into a single Integrated Aggregate Score (IAS), recomputed after every trading session.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {pillars.map((pillar, i) => (
              <Card key={i} className="border-border/60 hover:border-primary/30 hover:shadow-md transition-all" data-testid={`card-pillar-${i}`}>
                <CardContent className="p-5 flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <pillar.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{pillar.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{pillar.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl font-bold mb-3" data-testid="text-pricing-heading">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-sm">Cancel anytime. Access continues until end of billing period.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {tiers.map((tier, i) => (
              <Card
                key={i}
                className={`relative border transition-all ${tier.highlight ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]" : "border-border/60"}`}
                data-testid={`card-tier-${i}`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">Most Popular</span>
                  </div>
                )}
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="mb-6">
                    <h3 className="font-bold text-lg mb-1">{tier.name}</h3>
                    <div className="flex items-end gap-1 mb-3">
                      <span className="text-3xl font-bold">{tier.price}</span>
                      <span className="text-muted-foreground text-sm mb-1">{tier.period}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{tier.description}</p>
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {tier.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={tier.href}>
                    <Button
                      className="w-full"
                      variant={tier.highlight ? "default" : "outline"}
                      data-testid={`button-tier-cta-${i}`}
                    >
                      {tier.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* API callout */}
      <section className="py-14 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Database className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg font-bold mb-2" data-testid="text-api-callout-heading">Use CIE data in your own app</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Subscriber and Pro plans include an API key. Fetch scores, signals, and dividends via REST — ideal for quantitative models, fintech dashboards, and wealth-management platforms.
              </p>
              <Link href="/api-docs">
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-api-docs-cie">
                  View API Docs <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-center mb-10" data-testid="text-faq-heading">Frequently asked questions</h2>
          <div className="space-y-4">
            {faq.map((item, i) => (
              <Card key={i} className="border-border/60" data-testid={`card-faq-${i}`}>
                <CardContent className="p-5">
                  <h4 className="font-semibold text-sm mb-2">{item.q}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
