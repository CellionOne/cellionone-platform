import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  Building2, 
  Shield, 
  FileCheck, 
  Users, 
  Clock, 
  CheckCircle2,
  ArrowRight,
  Sparkles
} from "lucide-react";

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

const comingSoon = [
  { title: "TIN Registration", description: "Get your Tax Identification Number" },
  { title: "Bank Account Opening", description: "Open corporate bank accounts easily" },
  { title: "Registered Address", description: "Virtual office address services" },
  { title: "Compliance Reminders", description: "Never miss a filing deadline" }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl">Celion One</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
              <a href="#coming-soon" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Coming Soon</a>
            </div>
            
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" asChild data-testid="link-login">
                <a href="/api/login">Sign In</a>
              </Button>
              <Button asChild data-testid="link-get-started">
                <a href="/api/login">Get Started</a>
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
                  Nigeria's Premier Incorporation Platform
                </div>
                
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                  Register Your Nigerian Company{" "}
                  <span className="text-primary">With Confidence</span>
                </h1>
                
                <p className="text-lg text-muted-foreground max-w-xl">
                  Complete your company incorporation in Nigeria with a seamless digital experience. 
                  Verified lawyers handle your CAC filings while you focus on building your business.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" asChild className="gap-2" data-testid="button-start-incorporation">
                    <a href="/api/login">
                      Start Incorporation
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" asChild data-testid="button-view-pricing">
                    <a href="#pricing">View Pricing</a>
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
              </div>
              
              <div className="relative hidden lg:block">
                <div className="relative z-10 rounded-2xl bg-card border shadow-2xl p-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Your Company Dashboard</h3>
                        <p className="text-sm text-muted-foreground">Track all your applications</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm">TechStart Ventures Ltd</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Completed</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm">GreenFood Nigeria Ltd</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Under Review</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm">FastLogix Enterprises</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Draft</span>
                      </div>
                    </div>
                    
                    <Button className="w-full" variant="secondary">
                      View All Applications
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

        <section id="coming-soon" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Coming Soon</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                More features to help you run your business smoothly
              </p>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {comingSoon.map((item, index) => (
                <Card key={index} className="relative overflow-hidden">
                  <div className="absolute top-2 right-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                      Coming Soon
                    </span>
                  </div>
                  <CardContent className="p-6 pt-10">
                    <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                    <p className="text-muted-foreground text-sm">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to Register Your Company?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of entrepreneurs who have successfully registered their Nigerian companies through Celion One.
            </p>
            <Button size="lg" asChild className="gap-2" data-testid="button-cta-start">
              <a href="/api/login">
                Get Started Today
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold">Celion One</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Cellion Platforms. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
