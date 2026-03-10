import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  ShieldCheck,
  Building2,
  Users,
  FileCheck,
  Fingerprint,
  Search,
  Send,
  CheckCircle,
  ArrowRight,
  Loader2,
  Landmark,
  CreditCard,
  UserCheck,
  FileText,
  Globe,
  Lock,
} from "lucide-react";

const enquirySchema = z.object({
  name: z.string().min(1, "Name is required"),
  company: z.string().min(1, "Company name is required"),
  email: z.string().email("Please enter a valid email address"),
  partnershipType: z.string().min(1, "Please select a partnership type"),
  message: z.string().min(10, "Please provide at least 10 characters"),
});

type EnquiryForm = z.infer<typeof enquirySchema>;

const verificationBenefits = [
  { icon: Fingerprint, title: "BVN/NIN Validation", description: "Real-time identity number verification against government databases" },
  { icon: FileCheck, title: "Document Verification", description: "Automated document authenticity checks with expiry tracking" },
  { icon: Users, title: "Biometric Matching", description: "Facial recognition and liveness detection for identity confirmation" },
  { icon: Search, title: "AML Screening", description: "Sanctions, PEP, and adverse media screening in one pipeline" },
];

const bankingBenefits = [
  { icon: UserCheck, title: "Pre-Verified Customers", description: "Complete document packages including CAC cert, TIN, SCUML, verified IDs, and proof of address" },
  { icon: CreditCard, title: "Referral Pipeline", description: "Steady flow of newly incorporated businesses ready for banking services" },
  { icon: FileText, title: "Compliance-Ready Docs", description: "All KYC documentation pre-verified and audit-ready for account opening" },
  { icon: Globe, title: "API Integration", description: "Seamless integration for automated account opening workflows" },
];

const howItWorksSteps = [
  { step: "01", title: "Reach Out", description: "Fill in the enquiry form below or email us at hello@cellionone.com to start the conversation." },
  { step: "02", title: "We Scope the Integration", description: "Our partnerships team works with you to define volumes, integration approach, and commercial terms." },
  { step: "03", title: "Go Live", description: "We onboard your team, connect systems, and begin delivering verified data to your workflows." },
];

export default function PartnerWithUsPage() {
  usePageMeta({
    title: "Partner With Cellion One — Verification & Banking Partnerships",
    description: "Discover partnership opportunities with Cellion One. White-label KYC verification for corporates and fintechs, or pre-verified customer pipelines for banks.",
    canonicalPath: "/partner-with-us",
  });

  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<EnquiryForm>({
    resolver: zodResolver(enquirySchema),
    defaultValues: {
      name: "",
      company: "",
      email: "",
      partnershipType: "",
      message: "",
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (data: EnquiryForm) => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/contact", {
        name: data.name,
        email: data.email,
        subject: "Partnership Enquiry",
        message: `[Partnership Type: ${data.partnershipType}]\n[Company: ${data.company}]\n\n${data.message}`,
      });
      setSubmitted(true);
      toast({ title: "Enquiry sent", description: "We'll be in touch shortly." });
    } catch (error: any) {
      toast({
        title: "Failed to send enquiry",
        description: error?.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicNav />

      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-medium text-primary mb-3" data-testid="text-partner-badge">Partnership Opportunities</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4" data-testid="text-partner-headline">
            Partner With Cellion One
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-partner-subtitle">
            We help corporates, fintechs, and banks access verified identity and compliance infrastructure.
            Whether you need white-label KYC or a pipeline of pre-verified customers, we have a partnership model for you.
          </p>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card data-testid="card-verification-partner">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-xl">Verification Partner</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                For corporates, HR firms, fintechs, and insurance companies that need scalable identity verification.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-3">What we offer</h4>
                <div className="space-y-4">
                  {verificationBenefits.map((item) => (
                    <div key={item.title} className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-2">Why partner with us</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    Pre-built infrastructure — no need to integrate multiple providers
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    Audit-ready verification certificates for every check
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    BVN, NIN, biometrics, and AML screening in one pipeline
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    White-label dashboard and REST API available
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-banking-partner">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Landmark className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-xl">Banking Partner</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                For commercial banks, digital banks, and microfinance banks seeking pre-verified business customers.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-3">What we offer</h4>
                <div className="space-y-4">
                  {bankingBenefits.map((item) => (
                    <div key={item.title} className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-2">Why partner with us</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    Reduce onboarding friction with pre-verified customer data
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    Verified pipeline of newly incorporated businesses
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    Compliance-ready documentation (CAC, TIN, SCUML, IDs)
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    API integration for seamless account opening
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10" data-testid="text-how-it-works">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howItWorksSteps.map((step) => (
              <div key={step.step} className="text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary font-bold text-lg mb-4">
                  {step.step}
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold mb-4" data-testid="text-cta-heading">Interested? Get in touch</h2>
            <p className="text-muted-foreground mb-6">
              Tell us about your organisation and what you're looking for. Our partnerships team will get back to you within 2 business days.
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Secure Infrastructure</p>
                  <p className="text-xs text-muted-foreground">End-to-end encryption, access controls, and NDPR compliance</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">REST API Available</p>
                  <p className="text-xs text-muted-foreground">Programmatic access for high-volume verification workflows</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Audit-Ready Output</p>
                  <p className="text-xs text-muted-foreground">Every verification produces downloadable certificates and reports</p>
                </div>
              </div>
            </div>
          </div>

          <Card data-testid="card-enquiry-form">
            <CardContent className="pt-6">
              {submitted ? (
                <div className="text-center py-8 space-y-4">
                  <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold" data-testid="text-enquiry-success">Enquiry Sent</h3>
                  <p className="text-sm text-muted-foreground">
                    Thank you for your interest. Our partnerships team will be in touch within 2 business days.
                  </p>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane Doe" data-testid="input-partner-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company</FormLabel>
                          <FormControl>
                            <Input placeholder="Your organisation" data-testid="input-partner-company" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="you@company.com" data-testid="input-partner-email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="partnershipType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Partnership Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-partner-type">
                                <SelectValue placeholder="Select partnership type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="verification">Verification Partner</SelectItem>
                              <SelectItem value="banking">Banking Partner</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Tell us about your needs and how we can work together..."
                              className="resize-none min-h-[100px]"
                              data-testid="input-partner-message"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                      data-testid="button-submit-enquiry"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send Enquiry
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
