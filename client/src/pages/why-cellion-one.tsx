import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { CelionLogo } from "@/components/celion-logo";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Users,
  FileCheck,
  Building2,
  CalendarCheck,
  Bot,
  BadgeCheck,
  Headphones,
  AlertTriangle,
  Zap,
} from "lucide-react";

const comparisonItems = [
  {
    category: "Name Reservation",
    diy: "Navigate the CAC portal yourself. Common rejections due to naming rules you may not know.",
    cellion: "We check availability and advise on naming conventions before submission, reducing rejections.",
  },
  {
    category: "Document Preparation",
    diy: "Draft your own MEMART, object clauses, and share structure. Errors can delay registration by weeks.",
    cellion: "Our lawyers prepare all documents correctly the first time, tailored to your business type.",
  },
  {
    category: "Finding a Lawyer",
    diy: "You need a CAC-accredited lawyer to attest documents. Finding and vetting one is on you.",
    cellion: "We match you with a verified, licensed lawyer who handles your filing from start to finish.",
  },
  {
    category: "Identity Verification",
    diy: "Coordinate BVN/NIN verification for all directors separately.",
    cellion: "Built-in 4-step verification (BVN/NIN, biometric, document check, AML screening) for all directors in one place.",
  },
  {
    category: "Tracking Progress",
    diy: "Check the CAC portal repeatedly or call to follow up. No notifications or updates.",
    cellion: "Real-time dashboard tracking with notifications at every stage of your application.",
  },
  {
    category: "After Registration",
    diy: "Figure out TIN, SCUML, bank account opening, and compliance deadlines on your own.",
    cellion: "Post-incorporation checklist, compliance calendar with automated reminders, and add-on services all in one place.",
  },
];

const painPoints = [
  {
    icon: AlertTriangle,
    title: "Complex Government Portal",
    description: "The CAC portal was built for accredited agents, not first-time founders. The interface is confusing, and small mistakes lead to rejections.",
  },
  {
    icon: Clock,
    title: "Time-Consuming Process",
    description: "Between name searches, document preparation, lawyer coordination, and follow-ups, registration can take weeks of your time.",
  },
  {
    icon: XCircle,
    title: "Frequent Rejections",
    description: "Incorrect object clauses, naming conflicts, and document formatting issues cause applications to be rejected and resubmitted.",
  },
  {
    icon: Users,
    title: "Director Coordination",
    description: "Getting all directors verified, documents signed, and information aligned is a logistical challenge when done manually.",
  },
];

const beyondIncorporation = [
  {
    icon: CalendarCheck,
    title: "Compliance Calendar",
    description: "Never miss an annual return or filing deadline. Automated reminders keep you compliant.",
  },
  {
    icon: Bot,
    title: "AI Legal Assistant",
    description: "Get instant guidance on corporate activities, regulatory requirements, and next steps.",
  },
  {
    icon: BadgeCheck,
    title: "KYC-as-a-Service",
    description: "Verify employees and suppliers through a single platform. Built for Nigerian businesses.",
  },
  {
    icon: Building2,
    title: "Virtual Registered Office",
    description: "Premium Ikoyi, Lagos address with professional mail handling and forwarding.",
  },
  {
    icon: FileCheck,
    title: "Document Vault",
    description: "All your company documents — certificates, filings, receipts — stored securely and always accessible.",
  },
  {
    icon: Shield,
    title: "Data Sharing & Verification",
    description: "Share verified company data with banks and partners through secure, time-limited consent tokens.",
  },
];

export default function WhyCellionOne() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-md border-b z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4 flex-wrap">
            <a href="/" data-testid="link-home-logo">
              <CelionLogo textClassName="font-bold" />
            </a>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" asChild data-testid="link-login">
                <a href="/login">Sign In</a>
              </Button>
              <Button asChild data-testid="link-get-started">
                <a href="/register">Get Started</a>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight" data-testid="text-page-title">
              Why Use <span className="text-primary">Cellion One</span>?
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto" data-testid="text-page-subtitle">
              Yes, you can register a company directly on the CAC portal. But there's a reason most founders don't do it alone.
            </p>
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-3" data-testid="text-pain-points-title">The Reality of DIY Registration</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                The CAC portal exists, but it was designed for accredited agents and lawyers — not founders trying to register their first company.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              {painPoints.map((point, i) => (
                <Card key={i} className="border-destructive/20" data-testid={`card-pain-point-${i}`}>
                  <CardContent className="pt-6">
                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                        <point.icon className="h-5 w-5 text-destructive" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{point.title}</h3>
                        <p className="text-sm text-muted-foreground">{point.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-3" data-testid="text-comparison-title">DIY vs Cellion One</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                See exactly how using Cellion One compares to navigating the process on your own.
              </p>
            </div>
            <div className="space-y-4">
              {comparisonItems.map((item, i) => (
                <Card key={i} className="overflow-hidden" data-testid={`card-comparison-${i}`}>
                  <CardContent className="p-0">
                    <div className="p-4 bg-muted/50 border-b">
                      <h3 className="font-semibold">{item.category}</h3>
                    </div>
                    <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="h-4 w-4 text-destructive flex-shrink-0" aria-hidden="true" />
                          <span className="text-sm font-medium text-destructive">Doing It Yourself</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.diy}</p>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
                          <span className="text-sm font-medium text-primary">With Cellion One</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.cellion}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-3" data-testid="text-beyond-title">More Than Just Incorporation</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Registration is just the beginning. Cellion One supports your entire business lifecycle.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {beyondIncorporation.map((feature, i) => (
                <Card key={i} data-testid={`card-beyond-${i}`}>
                  <CardContent className="pt-6">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <Card className="border-primary/20 bg-primary/5" data-testid="card-analogy">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Think of It Like Tax Filing</h3>
                  <p className="text-muted-foreground">
                    You <em>can</em> file your taxes yourself — the government portal exists. But most people use professional services because the process is complex, mistakes are costly, and the time spent isn't worth it. Cellion One is that professional layer for business registration and compliance in Nigeria.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-3" data-testid="text-who-title">Who Is Cellion One For?</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              <Card data-testid="card-who-founders">
                <CardContent className="pt-6 text-center">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Founders</h3>
                  <p className="text-sm text-muted-foreground">First-time or experienced entrepreneurs who want a hassle-free registration process.</p>
                </CardContent>
              </Card>
              <Card data-testid="card-who-businesses">
                <CardContent className="pt-6 text-center">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Growing Businesses</h3>
                  <p className="text-sm text-muted-foreground">Companies that need ongoing compliance management, KYC services, and a professional registered address.</p>
                </CardContent>
              </Card>
              <Card data-testid="card-who-orgs">
                <CardContent className="pt-6 text-center">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Headphones className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Organisations</h3>
                  <p className="text-sm text-muted-foreground">Companies that need to verify employees and suppliers with audit-ready KYC documentation.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl font-bold" data-testid="text-cta-title">Ready to Simplify Your Business Journey?</h2>
            <p className="text-muted-foreground text-lg">
              Join founders who are choosing the smarter way to register and manage their Nigerian businesses.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild data-testid="button-cta-register">
                <a href="/register" className="gap-2">
                  Get Started <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild data-testid="button-cta-home">
                <a href="/">Back to Home</a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <CelionLogo textClassName="font-bold" />
              <div className="flex flex-wrap items-center gap-6">
                <a href="/apply-lawyer" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-apply-lawyer">
                  Join as Lawyer
                </a>
                <a href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-terms">
                  Terms & Conditions
                </a>
                <a href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-privacy">
                  Privacy Policy
                </a>
                <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back-to-top">
                  Back to Top
                </a>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} Cellion Platforms Nigeria Limited. All rights reserved.
              </p>
              <p className="text-xs text-muted-foreground">
                UK Partner: Disslio Limited
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
