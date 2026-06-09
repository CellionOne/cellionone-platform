import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Building2,
  ShieldCheck,
  ArrowRight,
  MapPin,
  BadgeCheck,
  Stamp,
  Building,
  Send,
  Loader2,
  Mail,
  Code2,
  Globe,
  Lock,
  Users,
  Terminal,
  Fingerprint,
  BarChart3,
} from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { usePageMeta } from "@/hooks/use-page-meta";

const trustStats = [
  { value: "50+", label: "Platforms & fintechs" },
  { value: "10,000+", label: "Identities verified" },
  { value: "500+", label: "Companies formed" },
  { value: "99.9%", label: "API uptime" },
];

const businessSolutions = [
  {
    icon: Building2,
    title: "Incorporate Your Company",
    description: "Register your LLC or NGO with the CAC. Licensed lawyers handle all filings and deliver stamped originals.",
    price: "From ₦100,000",
    cta: "Start Incorporation",
    href: "/register",
  },
  {
    icon: MapPin,
    title: "Registered Office Address",
    description: "Business address subscription in Lagos with mail handling, forwarding, and proof-of-address for CAC and FIRS filings.",
    cta: "View Plans",
    href: "/register",
  },
  {
    icon: BadgeCheck,
    title: "SCUML Certification",
    description: "Get your SCUML certificate from the EFCC — required for designated non-financial businesses and institutions.",
    price: "₦150,000",
    cta: "Get Certified",
    href: "/register",
  },
  {
    icon: Stamp,
    title: "Trademark Registration",
    description: "Protect your brand with official trademark registration at the Trademarks Registry, handled in two stages.",
    price: "₦250,000",
    cta: "Register Trademark",
    href: "/register",
  },
  {
    icon: ShieldCheck,
    title: "Identity Verification",
    description: "Verify employees, directors, and stakeholders — BVN/NIN validation, biometrics, document checks, and AML screening, with audit-ready certificates.",
    price: "₦10,000/person",
    cta: "Start Verifying",
    href: "/register",
  },
  {
    icon: Building,
    title: "Supplier Verification",
    description: "Comprehensive corporate due diligence for your vendors and suppliers. Verify registration, directors, financials, and compliance status.",
    price: "₦100,000/company",
    cta: "Verify Suppliers",
    href: "/register",
  },
];

const platformSolutions = [
  {
    icon: Fingerprint,
    title: "KYC-as-a-Service API",
    description: "Add identity verification to any product with a few API calls. BVN/NIN validation, document checks, AML screening, and hosted verification sessions — all via REST.",
    cta: "Read the Docs",
    href: "/api-docs",
  },
  {
    icon: Lock,
    title: "Escrow-as-a-Service API",
    description: "Hold and release funds programmatically for any transaction your platform handles. Auto-generates Paystack payment links and delivers webhook confirmations on every status change.",
    cta: "Read the Docs",
    href: "/api-docs",
  },
  {
    icon: BarChart3,
    title: "CIE — NGX Equity Intelligence",
    description: "Real-time equity scores, analyst signals, dividend calendars, and model-driven recommendations for every security listed on the Nigerian Exchange Group. Subscribe for instant access.",
    price: "From ₦5,000/month",
    cta: "Explore CIE",
    href: "/cie-intelligence",
  },
  {
    icon: BarChart3,
    title: "ClearLedger Bureau API",
    description: "Score any individual or business by BVN, NIN, or CLR ID. Returns a verified score (0–100), band, suggested credit limit, and full signal breakdown. No other Nigerian bureau has NGX settlement data as a scoring signal.",
    cta: "Request access",
    href: "/clearledger",
  },
  {
    icon: Code2,
    title: "Developer Portal",
    description: "Self-service API keys, sandbox environment, usage dashboard, and full documentation. Integrate KYC, escrow, bureau, or formation APIs into your product in minutes.",
    cta: "Open developer portal",
    href: "/developers",
  },
];

const faqItems = [
  {
    question: "How long does company incorporation take?",
    answer: "Typical company incorporation takes 7–14 business days from the point of submitting a complete application with all required documents. Timelines may vary depending on CAC processing times, name availability checks, and the completeness of your application. We keep you updated at every stage."
  },
  {
    question: "What documents do I need to register a company?",
    answer: "You'll need valid government-issued IDs (International Passport, Driver's Licence, or National ID) for all directors and shareholders, passport photographs, proof of address (utility bill or bank statement), and your proposed company details including preferred names, share capital structure, and registered office address."
  },
  {
    question: "Can I integrate Cellion One's KYC service into my own platform?",
    answer: "Yes. Our KYC-as-a-Service API lets you submit verification requests programmatically, track statuses via webhooks, and generate hosted verification sessions — shareable links where your users complete identity verification without needing a Cellion One account. You manage everything from an organisation dashboard with prepaid API credits. See the API Docs for full details on endpoints, authentication, and pricing."
  },
  {
    question: "What is Escrow-as-a-Service?",
    answer: "Escrow-as-a-Service lets your platform hold buyer funds in a protected escrow account until both parties confirm fulfilment. You create a transaction via our API, share the Paystack payment link with the buyer, and release funds to the seller when the service or goods are delivered — or raise a dispute if something goes wrong. A 1.5% service fee (min ₦1,500, max ₦50,000) applies per transaction."
  },
  {
    question: "How does the KYC verification service work?",
    answer: "Our KYC service lets organisations verify the identity of employees, suppliers, and other stakeholders. You create an organisation on the platform, invite team members, and submit verification requests. Each request goes through BVN/NIN validation, document checks, biometric verification, and AML screening, with results delivered as audit-ready certificates."
  },
  {
    question: "Is my personal data secure?",
    answer: "Absolutely. We use industry-standard encryption for all data at rest and in transit. Your documents are stored in a secure digital vault with strict access controls. Personal information is only shared with assigned lawyers handling your approved applications, and you can update or delete your data at any time."
  },
];

const businessSteps = [
  { step: "1", title: "Apply", desc: "Create your account and submit your application in minutes — identity verification included at sign-up." },
  { step: "2", title: "Get Verified", desc: "Our licensed lawyers and compliance team handle all filings, follow-ups, and regulatory submissions on your behalf." },
  { step: "3", title: "Stay Compliant", desc: "Auto-scheduled compliance tasks, deadline reminders, and annual return tracking keep your business on track year-round." },
];

const developerSteps = [
  { step: "1", title: "Create developer account", desc: "Register at cellionone.com/developers, verify your email, and get instant sandbox API keys. No approval needed for sandbox." },
  { step: "2", title: "Integrate in minutes", desc: "Call our REST API — KYC verification, escrow transactions, bureau scoring, company formation, and webhooks are fully documented with code examples." },
  { step: "3", title: "Go live", desc: "Request live access, top up API credits, and monitor usage in your developer dashboard. We review live access applications within 2 business days." },
];

export function ContactSection() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactSubject || !contactMessage) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/contact", {
        name: contactName,
        email: contactEmail,
        subject: contactSubject,
        message: contactMessage,
      });
      toast({ title: "Message sent", description: "We'll get back to you shortly." });
      setContactName("");
      setContactEmail("");
      setContactSubject("");
      setContactMessage("");
    } catch (error: any) {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Mail className="h-4 w-4" />
            Get In Touch
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" data-testid="text-contact-heading">Contact Us</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Have a question or need help? Fill out the form below and our team will get back to you as soon as possible.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">Name</Label>
                    <Input
                      id="contact-name"
                      placeholder="Your full name"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      required
                      data-testid="input-contact-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="you@example.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      required
                      data-testid="input-contact-email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-subject">Subject</Label>
                  <Select value={contactSubject} onValueChange={setContactSubject}>
                    <SelectTrigger data-testid="select-contact-subject">
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General Inquiry">General Inquiry</SelectItem>
                      <SelectItem value="Incorporation Help">Incorporation Help</SelectItem>
                      <SelectItem value="KYC/Verification">KYC/Verification</SelectItem>
                      <SelectItem value="API Integration">API Integration</SelectItem>
                      <SelectItem value="Partnership Enquiry">Partnership Enquiry</SelectItem>
                      <SelectItem value="Technical Support">Technical Support</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-message">Message</Label>
                  <Textarea
                    id="contact-message"
                    placeholder="How can we help you?"
                    rows={5}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    required
                    className="resize-none"
                    data-testid="input-contact-message"
                  />
                </div>

                <Button type="submit" className="w-full gap-2" disabled={isSubmitting} data-testid="button-contact-submit">
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isSubmitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const [howItWorksTab, setHowItWorksTab] = useState<"business" | "developer">("developer");

  usePageMeta({
    title: "Cellion One — Nigeria's Digital Infrastructure for Trust, Compliance & Commerce",
    description: "KYC-as-a-Service, Escrow-as-a-Service, company incorporation, and compliance tools — the digital infrastructure powering Nigerian businesses and the platforms that serve them.",
    canonicalPath: "/",
  });

  useEffect(() => {
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Cellion One",
      legalName: "Cellion Platforms Nigeria Limited",
      url: "https://cellionone.com",
      logo: "https://cellionone.com/icon-512.svg",
      description: "Nigeria's digital infrastructure for trust, compliance, and verified commerce. KYC-as-a-Service, Escrow-as-a-Service, company incorporation, AML monitoring, and compliance tools — all accessible via dashboard or public API.",
      contactPoint: {
        "@type": "ContactPoint",
        email: "hello@cellionone.com",
        contactType: "customer support",
      },
      address: {
        "@type": "PostalAddress",
        addressCountry: "NG",
        addressLocality: "Lagos",
        addressRegion: "Lagos",
      },
    };

    const webSiteSchema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Cellion One",
      url: "https://cellionone.com",
    };

    const faqPageSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    };

    const serviceSchemas = [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        serviceType: "Company Incorporation",
        provider: { "@type": "Organization", name: "Cellion One" },
        description: "Register your Nigerian limited liability company with the CAC. Licensed lawyers handle filings, follow-ups, and deliver stamped originals.",
        areaServed: { "@type": "Country", name: "Nigeria" },
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "NGN",
          lowPrice: "100000",
          highPrice: "3000000",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "Service",
        serviceType: "KYC-as-a-Service API",
        provider: { "@type": "Organization", name: "Cellion One" },
        description: "Submit identity verification requests programmatically via REST API, receive webhook callbacks, generate hosted verification sessions, and automate compliance workflows.",
        areaServed: { "@type": "Country", name: "Nigeria" },
      },
      {
        "@context": "https://schema.org",
        "@type": "Service",
        serviceType: "Escrow-as-a-Service API",
        provider: { "@type": "Organization", name: "Cellion One" },
        description: "Hold and release funds programmatically for any transaction via REST API. Creates Paystack payment links and delivers webhook notifications on funding, release, and dispute events.",
        areaServed: { "@type": "Country", name: "Nigeria" },
        offers: {
          "@type": "Offer",
          priceCurrency: "NGN",
          description: "1.5% service fee per transaction (min ₦1,500, max ₦50,000)",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "Service",
        serviceType: "KYC Identity Verification",
        provider: { "@type": "Organization", name: "Cellion One" },
        description: "Individual identity verification including BVN/NIN validation, document checks, biometrics, and AML screening.",
        areaServed: { "@type": "Country", name: "Nigeria" },
        offers: {
          "@type": "Offer",
          priceCurrency: "NGN",
          price: "10000",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "Service",
        serviceType: "KYC Supplier Verification",
        provider: { "@type": "Organization", name: "Cellion One" },
        description: "Comprehensive corporate due diligence for vendors and suppliers including company registration, directors, financials, and compliance status verification.",
        areaServed: { "@type": "Country", name: "Nigeria" },
        offers: {
          "@type": "Offer",
          priceCurrency: "NGN",
          price: "100000",
        },
      },
    ];

    const schemas = [organizationSchema, webSiteSchema, faqPageSchema, ...serviceSchemas];
    const scriptElements: HTMLScriptElement[] = [];

    schemas.forEach((schema) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
      scriptElements.push(script);
    });

    return () => {
      scriptElements.forEach((script) => {
        document.head.removeChild(script);
      });
    };
  }, []);

  const activeSteps = howItWorksTab === "business" ? businessSteps : developerSteps;

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      <main>
        <section className="relative pt-36 pb-24 px-4 sm:px-6 lg:px-8">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[120px]" />
            <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />
          </div>

          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8" data-testid="badge-africa">
              <Globe className="h-4 w-4" />
              API infrastructure · KYC · Escrow · Bureau · Formation
            </div>

            <div data-testid="hero-text-container">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight" data-testid="hero-headline">
                Build on Nigeria's{" "}
                <span className="text-primary">compliance infrastructure</span>
              </h1>
            </div>

            <p className="text-lg sm:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed" data-testid="hero-subtitle">
              KYC, escrow, bureau scoring, and company formation — as API modules. Used by fintechs, brokers, and banks building on Nigerian financial rails.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
              <Button size="lg" asChild className="gap-2 text-base px-8 h-12" data-testid="button-hero-primary">
                <a href="/developers">
                  Start building
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="ghost" asChild className="gap-2 text-base text-muted-foreground hover:text-foreground" data-testid="button-hero-secondary">
                <a href="/register">
                  <Building2 className="h-4 w-4" />
                  Register your company
                </a>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mt-8" data-testid="text-trust-line">
              Trusted by 50+ platforms · 500+ businesses · 10,000+ identities verified
            </p>
          </div>
        </section>

        <section id="solutions" className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight" data-testid="text-solutions-heading">
                One platform. Five infrastructure modules.
              </h2>
              <p className="text-muted-foreground mt-4 text-lg max-w-xl mx-auto">
                Every module is available as a dashboard product and a REST API. Use what you need. Pay for what you use.
              </p>
            </div>

            <div className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Terminal className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-lg font-semibold" data-testid="text-platform-solutions-heading">For developers & fintechs</h3>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {platformSolutions.map((path, index) => (
                  <Card
                    key={index}
                    className="group relative border border-border/60 bg-card/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
                    data-testid={`card-platform-solution-${index}`}
                  >
                    <CardContent className="p-6 flex flex-col h-full">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                        <path.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-base mb-2">{path.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed flex-1">
                        {path.description}
                      </p>
                      {"price" in path && path.price && (
                        <p className="text-sm font-medium text-primary mt-3">{path.price}</p>
                      )}
                      <a
                        href={path.href}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary mt-4 group-hover:gap-2.5 transition-all"
                        data-testid={`link-platform-solution-${index}`}
                      >
                        {path.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-lg font-semibold" data-testid="text-business-solutions-heading">For founders & businesses</h3>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {businessSolutions.map((path, index) => (
                  <Card
                    key={index}
                    className="group relative border border-border/60 bg-card/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
                    data-testid={`card-business-solution-${index}`}
                  >
                    <CardContent className="p-6 flex flex-col h-full">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                        <path.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-base mb-2">{path.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed flex-1">
                        {path.description}
                      </p>
                      {"price" in path && path.price && (
                        <p className="text-sm font-medium text-primary mt-3">{path.price}</p>
                      )}
                      <a
                        href={path.href}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary mt-4 group-hover:gap-2.5 transition-all"
                        data-testid={`link-business-solution-${index}`}
                      >
                        {path.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Built on Cellion One */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Built on Cellion One
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Products already running on this infrastructure
              </h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              <Card>
                <CardContent className="p-6">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">Icon eTrade</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    NGX-regulated retail brokerage platform. KYC, trading via NaYa OEMS,
                    and portfolio management — built for Icon Securities.
                  </p>
                  <p className="text-xs text-muted-foreground mt-3 font-medium">
                    KYC · Escrow · Formation
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">ClearLedger</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Nigeria's financial identity bureau. Scores individuals and businesses
                    using KYC, NGX trading history, and banking signals.
                  </p>
                  <p className="text-xs text-muted-foreground mt-3 font-medium">
                    Bureau · KYC · Formation
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Globe className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">Aprisys</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Capital markets intelligence for Nigerian brokers and institutional
                    investors. NGX100 data, deal flow signals, and OTC execution tools.
                  </p>
                  <p className="text-xs text-muted-foreground mt-3 font-medium">
                    Intelligence · KYC · Escrow
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="text-center mt-8">
              <a href="/labs" className="text-sm text-primary hover:underline font-medium">
                Learn about Cellion Labs — our application building arm →
              </a>
            </div>
          </div>
        </section>

        <section className="border-t border-b border-border/40 py-12 px-4 sm:px-6 lg:px-8" data-testid="trust-bar">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {trustStats.map((stat, idx) => (
                <div key={idx} className="text-center" data-testid={`trust-stat-${idx}`}>
                  <div className="text-2xl sm:text-3xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">How It Works</h2>
              <p className="text-muted-foreground mt-4 text-lg">
                Three steps — whether you're a business or a developer
              </p>
            </div>

            {/* Tab toggle */}
            <div className="flex justify-center mb-12">
              <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1 gap-1">
                <button
                  onClick={() => setHowItWorksTab("developer")}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                    howItWorksTab === "developer"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="tab-how-developer"
                >
                  <Terminal className="h-4 w-4" />
                  For Developers
                </button>
                <button
                  onClick={() => setHowItWorksTab("business")}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                    howItWorksTab === "business"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="tab-how-business"
                >
                  <Users className="h-4 w-4" />
                  For Founders
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-12 md:gap-8">
              {activeSteps.map((item, index) => (
                <div key={`${howItWorksTab}-${index}`} className="relative text-center">
                  <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-5">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                  {index < 2 && (
                    <div className="hidden md:block absolute top-7 left-[60%] w-[80%] border-t-2 border-dashed border-border" />
                  )}
                </div>
              ))}
            </div>

            {howItWorksTab === "developer" && (
              <div className="mt-10 text-center">
                <Button variant="outline" asChild className="gap-2" data-testid="button-how-view-api-docs">
                  <a href="/api-docs">
                    <Code2 className="h-4 w-4" />
                    View Full API Documentation
                  </a>
                </Button>
              </div>
            )}
          </div>
        </section>

        <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/20">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Frequently Asked Questions</h2>
              <p className="text-muted-foreground mt-4 text-lg">
                Quick answers to common questions
              </p>
            </div>

            <Accordion type="single" collapsible className="w-full" data-testid="faq-accordion">
              {faqItems.map((item, index) => (
                <AccordionItem key={index} value={`faq-${index}`} data-testid={`faq-item-${index}`}>
                  <AccordionTrigger className="text-left" data-testid={`faq-trigger-${index}`}>
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent data-testid={`faq-content-${index}`}>
                    <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Ready to start building?
            </h2>
            <p className="text-primary-foreground/80 mb-8 text-lg">
              Get sandbox API keys in minutes. No approval required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild className="gap-2" data-testid="button-cta-start">
                <a href="/developers">
                  Open developer portal
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="ghost" asChild
                className="text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/10" data-testid="button-cta-api-docs">
                <a href="/register">Register your company</a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
