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
  CalendarCheck,
  Handshake,
  Send,
  Loader2,
  Mail,
  Code2,
  Globe,
} from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { usePageMeta } from "@/hooks/use-page-meta";

const trustStats = [
  { value: "500+", label: "Companies Incorporated" },
  { value: "10,000+", label: "Verifications Completed" },
  { value: "50+", label: "Organisations Onboard" },
  { value: "99.9%", label: "Uptime" },
];

const solutionPaths = [
  {
    icon: Building2,
    title: "Start a Company",
    description: "Register your Nigerian LLC. Licensed lawyers handle all CAC filings and deliver stamped originals.",
    price: "From ₦100,000",
    cta: "Start Incorporation",
    href: "/register",
  },
  {
    icon: ShieldCheck,
    title: "Verify People & Companies",
    description: "KYC for employees and suppliers — BVN/NIN, biometrics, document checks, and AML screening.",
    cta: "Start Verifying",
    href: "/register",
  },
  {
    icon: Handshake,
    title: "Procure with Trust",
    description: "RFQ marketplace, bid management, contracts, and invoicing — exclusively for verified organisations.",
    cta: "Explore Marketplace",
    href: "/procurement/marketplace",
  },
  {
    icon: MapPin,
    title: "Get a Virtual Office",
    description: "Premium registered address in Lagos with mail handling, forwarding, and proof-of-address for your company.",
    cta: "View Plans",
    href: "/register",
  },
  {
    icon: CalendarCheck,
    title: "Stay Compliant",
    description: "Automated compliance calendar, TIN registration, SCUML certification, and AI legal assistant.",
    cta: "Learn More",
    href: "/register",
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
    question: "How does the KYC verification service work?",
    answer: "Our KYC service lets organisations verify the identity of employees, suppliers, and other stakeholders. You create an organisation on the platform, invite team members, and submit verification requests. Each request goes through BVN/NIN validation, document checks, biometric verification, and AML screening, with results delivered as audit-ready certificates."
  },
  {
    question: "Is my personal data secure?",
    answer: "Absolutely. We use industry-standard encryption for all data at rest and in transit. Your documents are stored in a secure digital vault with strict access controls. Personal information is only shared with assigned lawyers handling your approved applications, and you can update or delete your data at any time."
  },
];

const steps = [
  { step: "1", title: "Create & Verify", desc: "Create your account and verify your identity in minutes" },
  { step: "2", title: "Choose Your Service", desc: "Incorporation, KYC, procurement, or virtual office" },
  { step: "3", title: "We Handle the Rest", desc: "Track everything from your dashboard while we deliver" },
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
  usePageMeta({
    title: "Cellion One — Company Incorporation & KYC Verification in Nigeria",
    description: "The compliance infrastructure for African business. Incorporate companies, verify identities, and manage compliance via dashboard or API. Trusted by 500+ companies in Nigeria.",
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
      description: "The compliance infrastructure for African business. Incorporate companies, verify identities, and manage compliance — all through one platform.",
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
        serviceType: "KYC Employee Verification",
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
      {
        "@context": "https://schema.org",
        "@type": "Service",
        serviceType: "KYC API Integration",
        provider: { "@type": "Organization", name: "Cellion One" },
        description: "Submit verification requests programmatically via REST API, receive webhook callbacks, and automate compliance workflows.",
        areaServed: { "@type": "Country", name: "Nigeria" },
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
              Starting in Nigeria. Building for Africa.
            </div>

            <div data-testid="hero-text-container">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight" data-testid="hero-headline">
                The Compliance Infrastructure{" "}
                <span className="text-primary">for African Business</span>
              </h1>
            </div>

            <p className="text-lg sm:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed" data-testid="hero-subtitle">
              Incorporate companies, verify identities, procure with trust, and stay compliant — all through one platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
              <Button size="lg" asChild className="gap-2 text-base px-8 h-12" data-testid="button-hero-primary">
                <a href="/register">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="ghost" asChild className="gap-2 text-base text-muted-foreground hover:text-foreground" data-testid="button-hero-secondary">
                <a href="/api-docs">
                  <Code2 className="h-4 w-4" />
                  View API Docs
                </a>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mt-8" data-testid="text-trust-line">
              Trusted by 500+ companies across Nigeria
            </p>
          </div>
        </section>

        <section id="solutions" className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight" data-testid="text-solutions-heading">
                What are you looking to do?
              </h2>
              <p className="text-muted-foreground mt-4 text-lg max-w-xl mx-auto">
                Choose the service that fits your needs. We'll guide you from there.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {solutionPaths.map((path, index) => (
                <Card
                  key={index}
                  className={`group relative border border-border/60 bg-card/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300 ${
                    index >= 3 ? "sm:col-span-1 lg:col-span-1" : ""
                  }`}
                  data-testid={`card-solution-${index}`}
                >
                  <CardContent className="p-8 flex flex-col h-full">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                      <path.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{path.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed flex-1">
                      {path.description}
                    </p>
                    {"price" in path && path.price && (
                      <p className="text-sm font-medium text-primary mt-3">{path.price}</p>
                    )}
                    <a
                      href={path.href}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary mt-4 group-hover:gap-2.5 transition-all"
                      data-testid={`link-solution-${index}`}
                    >
                      {path.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </CardContent>
                </Card>
              ))}
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
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">How It Works</h2>
              <p className="text-muted-foreground mt-4 text-lg">
                Three simple steps to get started
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-12 md:gap-8">
              {steps.map((item, index) => (
                <div key={index} className="relative text-center">
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

        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Ready to get started?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join hundreds of companies building with confidence on Cellion One.
            </p>
            <Button size="lg" asChild className="gap-2 text-base px-8 h-12" data-testid="button-cta-start">
              <a href="/register">
                Get Started Today
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <p className="text-sm text-muted-foreground mt-6">
              Have questions?{" "}
              <a href="mailto:hello@cellionone.com" className="text-primary hover:underline" data-testid="link-contact-email">
                hello@cellionone.com
              </a>
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
