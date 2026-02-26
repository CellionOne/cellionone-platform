import { useState, useEffect, useCallback } from "react";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Building2, 
  Shield, 
  FileCheck, 
  Users, 
  Clock, 
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Receipt,
  Stamp,
  MapPin,
  CalendarCheck,
  BadgeCheck,
  Landmark,
  FileSignature,
  BriefcaseBusiness,
  UserCheck,
  Building,
  ShieldCheck,
  Send,
  Loader2,
  Mail
} from "lucide-react";
import { CelionLogo } from "@/components/celion-logo";

const heroSlides = [
  {
    headline: "Register Your Nigerian Company",
    accent: "With Confidence",
    subtitle: "Complete your company incorporation in Nigeria with a seamless digital experience. Verified lawyers handle your CAC filings while you focus on building your business.",
    primaryCta: { text: "Start Incorporation", href: "/register" },
    secondaryCta: { text: "View Pricing", href: "#pricing" },
    cardTitle: "Your Company Dashboard",
    cardSubtitle: "Track all your applications",
    cardIcon: Building2,
    cardItems: [
      { name: "TechStart Ventures Ltd", status: "Completed", color: "green" },
      { name: "GreenFood Nigeria Ltd", status: "Under Review", color: "blue" },
      { name: "FastLogix Enterprises", status: "Draft", color: "yellow" },
    ],
    cardAction: "View All Applications",
  },
  {
    headline: "Verify Your Employees",
    accent: "With Certainty",
    subtitle: "Run compliant identity verification on employees and team members. AI-powered document checks, BVN/NIN validation, and audit-ready certificates.",
    primaryCta: { text: "Start Verifying", href: "/register" },
    secondaryCta: { text: "Learn More", href: "#for-organisations" },
    cardTitle: "Verification Dashboard",
    cardSubtitle: "Track employee verifications",
    cardIcon: UserCheck,
    cardItems: [
      { name: "Adebayo Ogunlesi", status: "Verified", color: "green" },
      { name: "Chidinma Eze", status: "In Progress", color: "blue" },
      { name: "Femi Adeyemi", status: "Pending", color: "yellow" },
    ],
    cardAction: "View All Verifications",
  },
  {
    headline: "Onboard Suppliers",
    accent: "With Compliance",
    subtitle: "Comprehensive corporate due diligence for suppliers and vendors. Verify directors, check documents, and generate compliance reports automatically.",
    primaryCta: { text: "Verify Suppliers", href: "/register" },
    secondaryCta: { text: "Learn More", href: "#for-organisations" },
    cardTitle: "Supplier Verification",
    cardSubtitle: "Corporate due diligence tracker",
    cardIcon: ShieldCheck,
    cardItems: [
      { name: "Dangote Supplies Ltd", status: "Verified", color: "green" },
      { name: "Zenith Logistics Co", status: "Under Review", color: "blue" },
      { name: "Kobo Tech Solutions", status: "Pending", color: "yellow" },
    ],
    cardAction: "View All Suppliers",
  },
];

const statusColors: Record<string, string> = {
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const features = [
  {
    icon: FileCheck,
    title: "Single Digital Intake",
    description: "Complete your entire company registration through one seamless digital form. No paperwork, no hassle."
  },
  {
    icon: Shield,
    title: "Identity Verification",
    description: "Verify your identity once and reuse it across all your business registrations. Secure and compliant."
  },
  {
    icon: Users,
    title: "Expert Legal Support",
    description: "Work with verified Nigerian lawyers who handle your CAC filings and ensure everything is done right."
  },
  {
    icon: Clock,
    title: "Real-Time Tracking",
    description: "Track your application status from submission to completion. Stay informed every step of the way."
  },
  {
    icon: Building2,
    title: "Digital Vault",
    description: "Access all your company documents in one secure place. Certificates, receipts, and filings always available."
  },
  {
    icon: CheckCircle2,
    title: "Stamped Originals Delivery",
    description: "Receive your physical stamped originals delivered directly to your doorstep via tracked courier."
  }
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
    question: "What is Cellion One?",
    answer: "Cellion One is Nigeria's premier legal tech platform that simplifies company incorporation, identity verification, and regulatory compliance. We connect you with verified lawyers who handle all filings with the Corporate Affairs Commission (CAC) and other regulatory bodies, while you track progress through our digital dashboard."
  },
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
    question: "Can I verify employees and suppliers separately?",
    answer: "Yes. Our KYC verification service supports both individual (employee) and corporate (supplier) verification as separate workflows. You can run employee identity checks and supplier due diligence independently, each with their own dashboards, audit trails, and compliance certificates."
  },
  {
    question: "How do I track my application status?",
    answer: "Once you submit an application, you can track its status in real time from your dashboard. You'll see each stage of the process — from document review to CAC submission to final approval — along with any clarification requests from your assigned lawyer. You also receive email notifications at key milestones."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept payments via Paystack, which supports Nigerian bank cards (Visa, Mastercard, Verve), bank transfers, and USSD. All payments are processed securely, and you receive a digital receipt for every transaction, accessible from your dashboard at any time."
  }
];

const comingSoon = [
  { icon: Landmark, title: "Bank Account Opening", description: "Open corporate bank accounts seamlessly after incorporation" },
  { icon: FileSignature, title: "Annual Returns Filing", description: "Automated CAC annual returns preparation and filing" },
  { icon: BriefcaseBusiness, title: "Company Secretary Services", description: "Ongoing statutory compliance and company secretarial support" }
];

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
  const [activeSlide, setActiveSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const goToSlide = useCallback((index: number) => {
    if (index === activeSlide || isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      setActiveSlide(index);
      setTimeout(() => setIsAnimating(false), 50);
    }, 300);
  }, [activeSlide, isAnimating]);

  useEffect(() => {
    const timer = setInterval(() => {
      goToSlide((activeSlide + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeSlide, goToSlide]);

  const slide = heroSlides[activeSlide];
  const SlideIcon = slide.cardIcon;

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <CelionLogo />
            
            <div className="hidden md:flex items-center gap-8">
              <a href="/why-cellion-one" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-why">Why Cellion One</a>
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <a href="#for-organisations" className="text-sm text-muted-foreground hover:text-foreground transition-colors">For Organisations</a>
              <a href="#services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Services</a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
              <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a>
              <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-faq">FAQ</a>
            </div>
            
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
        <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          </div>
          
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  Nigeria's Premier Legal Tech Platform
                </div>
                
                <div className="min-h-[180px] sm:min-h-[160px]" data-testid="hero-text-container">
                  <div
                    key={activeSlide}
                    className="space-y-4 transition-all duration-500 ease-out"
                    style={{
                      opacity: isAnimating ? 0 : 1,
                      transform: isAnimating ? "translateY(16px)" : "translateY(0)",
                    }}
                  >
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight" data-testid="hero-headline">
                      {slide.headline}{" "}
                      <span className="text-primary">{slide.accent}</span>
                    </h1>
                  </div>
                </div>

                <div className="min-h-[72px]">
                  <p
                    key={`sub-${activeSlide}`}
                    className="text-lg text-muted-foreground max-w-xl transition-all duration-500 ease-out"
                    style={{
                      opacity: isAnimating ? 0 : 1,
                      transform: isAnimating ? "translateY(12px)" : "translateY(0)",
                    }}
                    data-testid="hero-subtitle"
                  >
                    {slide.subtitle}
                  </p>
                </div>
                
                <div
                  key={`cta-${activeSlide}`}
                  className="flex flex-col sm:flex-row gap-4 transition-all duration-500 ease-out"
                  style={{
                    opacity: isAnimating ? 0 : 1,
                    transform: isAnimating ? "translateY(8px)" : "translateY(0)",
                  }}
                >
                  <Button size="lg" asChild className="gap-2" data-testid="button-hero-primary">
                    <a href={slide.primaryCta.href}>
                      {slide.primaryCta.text}
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" asChild data-testid="button-hero-secondary">
                    <a href={slide.secondaryCta.href}>{slide.secondaryCta.text}</a>
                  </Button>
                </div>
                
                <div className="flex items-center gap-6 pt-4">
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

                <div className="flex items-center gap-2 pt-2" data-testid="hero-slide-dots">
                  {heroSlides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goToSlide(i)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        i === activeSlide 
                          ? "w-8 bg-primary" 
                          : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                      }`}
                      aria-label={`Go to slide ${i + 1}`}
                      data-testid={`button-slide-${i}`}
                    />
                  ))}
                </div>
              </div>
              
              <div className="relative hidden lg:block">
                <div
                  key={`card-${activeSlide}`}
                  className="relative z-10 rounded-2xl bg-card border shadow-2xl p-8 transition-all duration-500 ease-out"
                  style={{
                    opacity: isAnimating ? 0 : 1,
                    transform: isAnimating ? "translateY(16px)" : "translateY(0)",
                  }}
                  data-testid="hero-preview-card"
                >
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <SlideIcon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{slide.cardTitle}</h3>
                        <p className="text-sm text-muted-foreground">{slide.cardSubtitle}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {slide.cardItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-sm">{item.name}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[item.color]}`}>{item.status}</span>
                        </div>
                      ))}
                    </div>
                    
                    <Button className="w-full" variant="secondary">
                      {slide.cardAction}
                    </Button>
                  </div>
                </div>
                <div className="absolute -bottom-4 -right-4 -z-0 w-full h-full rounded-2xl bg-primary/20 blur-xl" />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything You Need to Incorporate</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                From document collection to stamped originals delivery, we handle every step of your company registration.
              </p>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="hover-elevate group">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
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
          </div>
        </section>

        <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
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

        <section id="coming-soon" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Coming Soon</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                More features on the way to help you run your business smoothly
              </p>
            </div>
            
            <div className="grid sm:grid-cols-1 md:grid-cols-3 gap-6">
              {comingSoon.map((item, index) => (
                <Card key={index} className="relative overflow-hidden" data-testid={`card-coming-soon-${index}`}>
                  <div className="absolute top-2 right-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                      Coming Soon
                    </span>
                  </div>
                  <CardContent className="p-6 pt-10 flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <item.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                      <p className="text-muted-foreground text-sm">{item.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
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
            <Button size="lg" asChild className="gap-2" data-testid="button-cta-start">
              <a href="/register">
                Get Started Today
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <CelionLogo textClassName="font-bold" />
              <div className="flex flex-wrap items-center gap-6">
                <a href="/why-cellion-one" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-why">
                  Why Cellion One
                </a>
                <a href="/apply-lawyer" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-apply-lawyer">
                  Join as Lawyer
                </a>
                <a href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-terms">
                  Terms & Conditions
                </a>
                <a href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-privacy">
                  Privacy Policy
                </a>
                <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-contact">
                  Contact
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
