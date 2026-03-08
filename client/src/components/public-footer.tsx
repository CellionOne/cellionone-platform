import { CelionLogo } from "@/components/celion-logo";

export function PublicFooter() {
  return (
    <footer className="border-t py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <a href="/" data-testid="link-footer-home">
                <CelionLogo textClassName="font-bold text-xl" />
              </a>
              <p className="text-sm text-muted-foreground mt-2">Starting in Nigeria. Building for Africa.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            <div>
              <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground" data-testid="footer-heading-products">Products</h4>
              <ul className="space-y-3">
                <li><a href="/#solutions" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-incorporation">Company Incorporation</a></li>
                <li><a href="/#solutions" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-kyc">KYC Verification</a></li>
                <li><a href="/procurement/marketplace" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-procurement">Procurement</a></li>
                <li><a href="/#solutions" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-virtual-office">Virtual Office</a></li>
                <li><a href="/api-docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-api-docs">API Documentation</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground" data-testid="footer-heading-company">Company</h4>
              <ul className="space-y-3">
                <li><a href="/why-cellion-one" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-why">Why Cellion One</a></li>
                <li><a href="/apply-lawyer" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-apply-lawyer">Join as Lawyer</a></li>
                <li><a href="mailto:hello@cellionone.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-contact">Contact</a></li>
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
  );
}
