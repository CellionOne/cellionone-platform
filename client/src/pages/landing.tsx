import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Building2,
  Shield,
  Users,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Receipt,
  Stamp,
  MapPin,
  CalendarCheck,
  BadgeCheck,
  Landmark,
  UserCheck,
  Building,
  ShieldCheck,
  Send,
  Loader2,
  Mail,
  Menu,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Code2,
  Globe,
  Webhook,
  CreditCard,
  FileCode2,
  Bell,
  Award,
  X,
} from "lucide-react";
import { CelionLogo } from "@/components/celion-logo";

const statusColors: Record<string, string> = {
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const trustStats = [
  { value: "500+", label: "Companies Incorporated" },
  { value: "10,000+", label: "Verifications Completed" },
  { value: "50+", label: "Organisations Onboard" },
  { value: "99.9%", label: "Uptime" },
];

const services = [
  {
    icon: Receipt,
    title: "TIN Registration",
    description: "Get your Tax Identification Number from the Federal Inland Revenue Service (FIRS).",
    price: "₦20,000"
  },
  {
    icon: BadgeCheck,
    title: "SCUML Certificate",
    description: "Obtain your SCUML certificate from the EFCC for designated non-financial businesses.",
    price: "₦150,000"
  },
  {
    icon: Stamp,
    title: "Trademark Registration",
    description: "Protect your brand with official trademark registration handled in two stages.",
    price: "₦250,000"
  },
  {
    icon: MapPin,
    title: "Registered Office Address",
    description: "Premium business address in Ikoyi, Lagos with mail handling and forwarding.",
    price: "Available"
  },
  {
    icon: CalendarCheck,
    title: "Compliance Calendar",
    description: "Automated compliance deadlines tracking with email reminders so you never miss a filing.",
    price: "Included"
  },
  {
    icon: Landmark,
    title: "NGO Registration",
    description: "Register your Incorporated Trustees (NGO/Foundation) with the Corporate Affairs Commission.",
    price: "₦250,000"
  }
];

const pricingTiers = [
  {
    name: "Starter",
    sharecap: "₦1M Share Capital",
    price: "₦100,000",
    popular: false,
  },
  {
    name: "Growth",
    sharecap: "₦5M Share Capital",
    price: "₦150,000",
    popular: true,
  },
  {
    name: "Professional",
    sharecap: "₦10M Share Capital",
    price: "₦350,000",
    popular: false,
  },
  {
    name: "Enterprise",
    sharecap: "₦20M Share Capital",
    price: "₦550,000",
    popular: false,
  },
  {
    name: "Foreign Participation",
    sharecap: "₦100M Share Capital (per CAMA)",
    price: "₦3,000,000",
    popular: false,
  }
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
    question: "How much does it cost?",
    answer: "Company incorporation starts from ₦100,000 for a Starter package (up to ₦1M share capital). Employee verification is ₦10,000 per person, and supplier verification is ₦100,000 per company. Additional services like TIN registration, SCUML certification, and trademark registration are priced separately. All pricing is transparent with no hidden fees."
  },
  {
    question: "Is my personal data secure?",
    answer: "Absolutely. We use industry-standard encryption for all data at rest and in transit. Your documents are stored in a secure digital vault with strict access controls. Personal information is only shared with assigned lawyers handling your approved applications, and you can update or delete your data at any time."
  },
  {
    question: "What happens after my company is registered?",
    answer: "After registration, you receive your Certificate of Incorporation, CAC status report, and other statutory documents in your digital vault. We also deliver physical stamped originals to your doorstep via tracked courier. You can then proceed with add-on services like TIN registration, SCUML certification, and opening a corporate bank account."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept payments via Paystack, which supports Nigerian bank cards (Visa, Mastercard, Verve), bank transfers, and USSD. All payments are processed securely, and you receive a digital receipt for every transaction, accessible from your dashboard at any time."
  }
];

const productsDropdown = [
  { icon: Building2, label: "Company Incorporation", description: "Register your Nigerian company with CAC", href: "#pricing" },
  { icon: ShieldCheck, label: "KYC Verification", description: "Verify employees and suppliers", href: "#for-organisations" },
  { icon: Code2, label: "API Integration", description: "Programmatic verification via REST API", href: "/api-docs" },
];

const resourcesDropdown = [
  { icon: Sparkles, label: "Why Cellion One", description: "Our mission and differentiators", href: "/why-cellion-one" },
  { icon: Users, label: "How It Works", description: "Simple 4-step process", href: "#how-it-works" },
  { icon: Shield, label: "FAQ", description: "Common questions answered", href: "#faq" },
  { icon: Award, label: "Join as Lawyer", description: "Partner with us as a legal professional", href: "/apply-lawyer" },
];

function NavDropdown({ label, items, testId }: { label: string; items: typeof productsDropdown; testId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        data-testid={testId}
        onClick={() => setOpen(!open)}
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 pt-2 z-50" data-testid={`${testId}-menu`}>
          <div className="w-72 rounded-xl border bg-popover p-2 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150">
            {items.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted transition-colors"
                data-testid={`link-dropdown-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => setOpen(false)}
              >
                <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileNav() {
  const [productsOpen, setProductsOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>
              <CelionLogo />
            </SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" data-testid="button-mobile-close">
                <X className="h-5 w-5" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>
        <nav className="flex flex-col px-4 py-4 gap-1" data-testid="mobile-nav">
          <div>
            <button
              className="flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
              onClick={() => setProductsOpen(!productsOpen)}
              data-testid="button-mobile-products"
            >
              Products
              <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${productsOpen ? "rotate-90" : ""}`} />
            </button>
            {productsOpen && (
              <div className="ml-3 mt-1 space-y-1">
                {productsDropdown.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                    data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    onClick={() => setSheetOpen(false)}
                  >
                    <item.icon className="h-4 w-4 text-primary" />
                    {item.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <a
            href="#pricing"
            className="px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
            data-testid="link-mobile-pricing"
            onClick={() => setSheetOpen(false)}
          >
            Pricing
          </a>

          <div>
            <button
              className="flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
              onClick={() => setResourcesOpen(!resourcesOpen)}
              data-testid="button-mobile-resources"
            >
              Resources
              <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${resourcesOpen ? "rotate-90" : ""}`} />
            </button>
            {resourcesOpen && (
              <div className="ml-3 mt-1 space-y-1">
                {resourcesDropdown.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                    data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    onClick={() => setSheetOpen(false)}
                  >
                    <item.icon className="h-4 w-4 text-primary" />
                    {item.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <a
            href="#contact"
            className="px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
            data-testid="link-mobile-contact"
            onClick={() => setSheetOpen(false)}
          >
            Contact
          </a>

          <div className="border-t my-3" />

          <div className="flex flex-col gap-2 px-3">
            <Button variant="ghost" asChild className="justify-start" data-testid="link-mobile-login">
              <a href="/login" onClick={() => setSheetOpen(false)}>Sign In</a>
            </Button>
            <Button asChild data-testid="link-mobile-get-started">
              <a href="/register" onClick={() => setSheetOpen(false)}>Get Started</a>
            </Button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function ContactSection() {
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
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <CelionLogo />

            <div className="hidden md:flex items-center gap-8">
              <NavDropdown label="Products" items={productsDropdown} testId="nav-products" />
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-pricing">Pricing</a>
              <NavDropdown label="Resources" items={resourcesDropdown} testId="nav-resources" />
              <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-contact">Contact</a>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" asChild className="hidden sm:inline-flex" data-testid="link-login">
                <a href="/login">Sign In</a>
              </Button>
              <Button asChild className="hidden sm:inline-flex" data-testid="link-get-started">
                <a href="/register">Get Started</a>
              </Button>
              <MobileNav />
            </div>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium" data-testid="badge-africa">
                  <Globe className="h-4 w-4" />
                  Starting in Nigeria. Building for Africa.
                </div>

                <div data-testid="hero-text-container">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight" data-testid="hero-headline">
                    The Compliance Infrastructure{" "}
                    <span className="text-primary">for African Business</span>
                  </h1>
                </div>

                <p className="text-lg text-muted-foreground max-w-xl" data-testid="hero-subtitle">
                  Incorporate companies, verify identities, and manage compliance — all through one platform. Use our dashboard or integrate via API.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" asChild className="gap-2" data-testid="button-hero-primary">
                    <a href="/register">
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" asChild data-testid="button-hero-secondary">
                    <a href="/api-docs" className="gap-2">
                      <Code2 className="h-4 w-4" />
                      View API Docs
                    </a>
                  </Button>
                </div>

                <div className="flex items-center gap-6 pt-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm text-muted-foreground">Free consultation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm text-muted-foreground">Transparent pricing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm text-muted-foreground">Expert support</span>
                  </div>
                </div>
              </div>

              <div className="relative hidden lg:block">
                <div
                  className="relative z-10 rounded-2xl bg-card border shadow-2xl p-8"
                  data-testid="hero-preview-card"
                >
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Verification Dashboard</h3>
                        <p className="text-sm text-muted-foreground">Track all verifications</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {[
                        { name: "Adebayo Ogunlesi", status: "Verified", color: "green" },
                        { name: "Chidinma Eze", status: "In Progress", color: "blue" },
                        { name: "Femi Adeyemi", status: "Pending", color: "yellow" },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-sm">{item.name}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[item.color]}`}>{item.status}</span>
                        </div>
                      ))}
                    </div>

                    <Button className="w-full" variant="secondary">
                      View All Verifications
                    </Button>
                  </div>
                </div>
                <div className="absolute -bottom-4 -right-4 -z-0 w-full h-full rounded-2xl bg-primary/20 blur-xl" />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-b bg-muted/20 py-10 px-4 sm:px-6 lg:px-8" data-testid="trust-bar">
          <div className="max-w-7xl mx-auto">
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

        <section id="for-organisations" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <ShieldCheck className="h-4 w-4" />
                For Organisations
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Build Trust Through Verified Compliance
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Whether you're starting a company, verifying your workforce, or screening suppliers, Cellion One gives you the tools to stay compliant and credible.
              </p>
            </div>

            <div className="grid sm:grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="hover-elevate group" data-testid="card-offering-incorporate">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Incorporate a Company</h3>
                  <p className="text-muted-foreground text-sm mb-4 flex-1">
                    Register your Nigerian limited liability company with the CAC. Our licensed lawyers handle filings, follow-ups, and deliver your stamped originals.
                  </p>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-sm font-semibold text-primary">From ₦100,000</span>
                    <Button size="sm" asChild data-testid="button-offering-incorporate">
                      <a href="/register" className="gap-1.5">
                        Get Started <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate group" data-testid="card-offering-employees">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <UserCheck className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Verify Employees</h3>
                  <p className="text-muted-foreground text-sm mb-4 flex-1">
                    Run individual identity verification on employees and team members. Includes BVN/NIN validation, document checks, biometrics, and AML screening.
                  </p>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-sm font-semibold text-primary">₦10,000 / person</span>
                    <Button size="sm" asChild data-testid="button-offering-employees">
                      <a href="/register" className="gap-1.5">
                        Get Started <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate group" data-testid="card-offering-suppliers">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Building className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Verify Suppliers</h3>
                  <p className="text-muted-foreground text-sm mb-4 flex-1">
                    Comprehensive corporate due diligence for your vendors and suppliers. Verify company registration, directors, financials, and compliance status.
                  </p>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-sm font-semibold text-primary">₦100,000 / company</span>
                    <Button size="sm" asChild data-testid="button-offering-suppliers">
                      <a href="/register" className="gap-1.5">
                        Get Started <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-16" data-testid="integration-paths">
              <div className="text-center mb-10">
                <h3 className="text-2xl font-bold mb-3">Choose How You Integrate</h3>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Whether you prefer a visual dashboard or programmatic access, we've got you covered.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <Card className="hover-elevate group relative overflow-hidden" data-testid="card-path-dashboard">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <LayoutDashboard className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-semibold text-lg mb-2">Web Dashboard</h4>
                    <p className="text-muted-foreground text-sm mb-5">
                      Manage verifications, invite team members, review results, and download audit certificates through our intuitive interface.
                    </p>
                    <ul className="space-y-2.5 mb-6 flex-1">
                      {[
                        { icon: Users, text: "Team collaboration" },
                        { icon: Shield, text: "Document management" },
                        { icon: Bell, text: "Real-time notifications" },
                        { icon: Award, text: "Audit certificates" },
                      ].map((feat, i) => (
                        <li key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                          <feat.icon className="h-4 w-4 text-primary flex-shrink-0" />
                          {feat.text}
                        </li>
                      ))}
                    </ul>
                    <Button asChild className="w-full gap-2" data-testid="button-path-dashboard">
                      <a href="/register">
                        Get Started
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="hover-elevate group relative overflow-hidden" data-testid="card-path-api">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <Code2 className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-semibold text-lg mb-2">API Integration</h4>
                    <p className="text-muted-foreground text-sm mb-5">
                      Submit verification requests programmatically, receive webhook callbacks, and automate your compliance workflow.
                    </p>
                    <ul className="space-y-2.5 mb-6 flex-1">
                      {[
                        { icon: Globe, text: "REST API endpoints" },
                        { icon: Webhook, text: "Webhook callbacks" },
                        { icon: CreditCard, text: "Pre-paid or invoiced billing" },
                        { icon: FileCode2, text: "cURL, Node.js & Python examples" },
                      ].map((feat, i) => (
                        <li key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                          <feat.icon className="h-4 w-4 text-primary flex-shrink-0" />
                          {feat.text}
                        </li>
                      ))}
                    </ul>
                    <Button variant="outline" asChild className="w-full gap-2" data-testid="button-path-api">
                      <a href="/api-docs">
                        View API Docs
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Get your company registered in four simple steps
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { step: "1", title: "Create Account", desc: "Sign up and verify your identity once" },
                { step: "2", title: "Fill Application", desc: "Complete the digital intake form" },
                { step: "3", title: "Pay & Submit", desc: "Make payment and submit for processing" },
                { step: "4", title: "Receive Documents", desc: "Get your stamped originals delivered" }
              ].map((item, index) => (
                <div key={index} className="relative">
                  <div className="flex flex-col items-center text-center">
                    <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mb-4">
                      {item.step}
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                    <p className="text-muted-foreground">{item.desc}</p>
                  </div>
                  {index < 3 && (
                    <div className="hidden lg:block absolute top-7 left-[60%] w-[80%] border-t-2 border-dashed border-muted" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Company Incorporation Pricing</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Transparent, all-inclusive pricing for your Nigerian company registration. Choose the share capital tier that fits your business.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              {pricingTiers.map((tier, index) => (
                <Card key={index} className={`relative overflow-hidden ${tier.popular ? "border-primary shadow-lg" : ""}`} data-testid={`card-pricing-${index}`}>
                  {tier.popular && (
                    <div className="bg-primary text-primary-foreground text-center text-xs font-medium py-1">
                      Most Popular
                    </div>
                  )}
                  <CardContent className="p-6 flex flex-col items-center text-center">
                    <h3 className="font-semibold text-lg mb-1">{tier.name}</h3>
                    <p className="text-xs text-muted-foreground mb-4">{tier.sharecap}</p>
                    <p className="text-2xl font-bold text-primary mb-4">{tier.price}</p>
                    <ul className="text-xs text-muted-foreground space-y-2 mb-6">
                      <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" /> CAC Filing & Registration</li>
                      <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Expert Lawyer Assigned</li>
                      <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Stamped Originals Delivered</li>
                      <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Digital Document Vault</li>
                    </ul>
                    <Button size="sm" asChild className="w-full" variant={tier.popular ? "default" : "outline"} data-testid={`button-pricing-${index}`}>
                      <a href="/register">Get Started</a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <p className="text-center text-sm text-muted-foreground mt-8">
              All prices are in Nigerian Naira (NGN). A one-time identity verification fee of ₦10,000 per person applies to cover BVN/NIN validation, document verification, biometric checks, and AML screening.
            </p>

            <div className="max-w-3xl mx-auto mt-10 p-6 rounded-xl border border-border bg-card/50" data-testid="card-managed-service-note">
              <h3 className="text-sm font-semibold mb-2">Why use a managed service?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                While the Corporate Affairs Commission (CAC) and other Nigerian agencies have digitised parts of their processes, company registration in Nigeria still requires in-person follow-ups, portal submissions/physical document submissions, and coordination with regulatory offices. Many registrations — including SCUML, TIN, and trademark filings — can technically be done by registering online or visiting the relevant offices yourself, but they often involve multiple trips, long wait times, and bureaucratic delays. What you're paying for is a managed service: our network of licensed lawyers handles all filings, follow-ups, and correspondence on your behalf so you don't have to.
              </p>
            </div>
          </div>
        </section>

        <section id="services" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Products & Services</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Beyond incorporation — everything you need to set up and run your business in Nigeria.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service, index) => (
                <Card key={index} className="hover-elevate group" data-testid={`card-service-${index}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <service.icon className="h-6 w-6 text-primary" />
                      </div>
                      <Badge variant="secondary" className="text-xs">{service.price}</Badge>
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{service.title}</h3>
                    <p className="text-muted-foreground text-sm">{service.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Find answers to common questions about our services
              </p>
            </div>

            <Accordion type="single" collapsible className="w-full" data-testid="faq-accordion">
              {faqItems.map((item, index) => (
                <AccordionItem key={index} value={`faq-${index}`} data-testid={`faq-item-${index}`}>
                  <AccordionTrigger className="text-left" data-testid={`faq-trigger-${index}`}>
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent data-testid={`faq-content-${index}`}>
                    <p className="text-muted-foreground">{item.answer}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <ContactSection />

        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Whether you need to incorporate a company or verify your employees and suppliers, Cellion One makes compliance simple and reliable.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="gap-2" data-testid="button-cta-start">
                <a href="/register">
                  Get Started Today
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild className="gap-2" data-testid="button-cta-api">
                <a href="/api-docs">
                  <Code2 className="h-4 w-4" />
                  Explore the API
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <CelionLogo textClassName="font-bold text-xl" />
                <p className="text-sm text-muted-foreground mt-2">Starting in Nigeria. Building for Africa.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground" data-testid="footer-heading-products">Products</h4>
                <ul className="space-y-3">
                  <li><a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-incorporation">Company Incorporation</a></li>
                  <li><a href="#for-organisations" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-kyc">KYC Verification</a></li>
                  <li><a href="/api-docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-api-docs">API Documentation</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground" data-testid="footer-heading-company">Company</h4>
                <ul className="space-y-3">
                  <li><a href="/why-cellion-one" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-why">Why Cellion One</a></li>
                  <li><a href="/apply-lawyer" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-apply-lawyer">Join as Lawyer</a></li>
                  <li><a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-contact">Contact</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground" data-testid="footer-heading-legal">Legal</h4>
                <ul className="space-y-3">
                  <li><a href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-terms">Terms & Conditions</a></li>
                  <li><a href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-privacy">Privacy Policy</a></li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t">
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
