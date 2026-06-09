import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Building2,
  Shield,
  Users,
  Sparkles,
  ShieldCheck,
  Code2,
  Menu,
  ChevronDown,
  ChevronRight,
  Award,
  Handshake,
  MapPin,
  X,
  FlaskConical,
  BarChart3,
} from "lucide-react";
import { CelionLogo } from "@/components/celion-logo";

const productsDropdown = [
  { icon: Building2, label: "Company Incorporation", description: "Register your Nigerian company with CAC", href: "/#solutions" },
  { icon: ShieldCheck, label: "KYC Verification", description: "Verify employees and suppliers", href: "/#solutions" },
  { icon: Handshake, label: "Verified Procurement", description: "RFQ marketplace for verified organisations", href: "/procurement/marketplace" },
  { icon: MapPin, label: "Virtual Office", description: "Premium registered address in Lagos", href: "/#solutions" },
  { icon: Code2, label: "API Integration", description: "Programmatic verification via REST API", href: "/api-docs" },
  { icon: BarChart3, label: "ClearLedger Bureau", description: "Score any individual or business by BVN or NIN", href: "/clearledger" },
  { icon: FlaskConical, label: "Cellion Labs", description: "We build financial applications for Africa", href: "/labs" },
];

const resourcesDropdown = [
  { icon: Sparkles, label: "Why Cellion One", description: "Our mission and differentiators", href: "/why-cellion-one" },
  { icon: Users, label: "How It Works", description: "Simple 3-step process", href: "/#how-it-works" },
  { icon: Shield, label: "FAQ", description: "Common questions answered", href: "/#faq" },
  { icon: Award, label: "Join as Lawyer", description: "Partner with us as a legal professional", href: "/apply-lawyer" },
  { icon: Handshake, label: "Partner With Us", description: "Verification and banking partnerships", href: "/partner-with-us" },
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
            href="/#solutions"
            className="px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
            data-testid="link-mobile-pricing"
            onClick={() => setSheetOpen(false)}
          >
            Solutions
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
            href="/developers"
            className="px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
            data-testid="link-mobile-developers"
            onClick={() => setSheetOpen(false)}
          >
            Developers
          </a>
          <a
            href="/contact"
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

export function PublicNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <a href="/" data-testid="link-home-logo">
            <CelionLogo />
          </a>

          <div className="hidden md:flex items-center gap-8">
            <NavDropdown label="Products" items={productsDropdown} testId="nav-products" />
            <a href="/#solutions" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-pricing">Solutions</a>
            <a href="/developers" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-developers">Developers</a>
            <NavDropdown label="Resources" items={resourcesDropdown} testId="nav-resources" />
            <a href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-contact">Contact</a>
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
  );
}
