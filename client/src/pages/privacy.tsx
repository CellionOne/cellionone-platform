import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft } from "lucide-react";
import { CelionLogo } from "@/components/celion-logo";
import { Link } from "wouter";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/">
              <CelionLogo />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/">
            <a className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </a>
          </Link>

          <h1 className="text-3xl sm:text-4xl font-bold mb-8">Privacy Policy</h1>
          
          <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
            <p className="text-muted-foreground">
              <strong>Last Updated:</strong> February 2026
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">1. Introduction</h2>
              <p>
                <strong>Cellion Platforms Nigeria Limited</strong> ("we", "us", "our"), in partnership with 
                <strong> Disslio Limited</strong> (UK), operates the Cellion One platform. This Privacy Policy 
                explains how we collect, use, disclose, and protect your personal information when you use 
                our services.
              </p>
              <p>
                We are committed to protecting your privacy and ensuring compliance with the Nigeria Data 
                Protection Regulation (NDPR) and other applicable data protection laws.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">2. Information We Collect</h2>
              
              <h3 className="text-xl font-medium">2.1 Personal Information</h3>
              <p>We collect the following categories of personal information:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Identity Information:</strong> Full name, date of birth, nationality, gender</li>
                <li><strong>Contact Information:</strong> Email address, phone number, residential address</li>
                <li><strong>Identification Documents:</strong> Government-issued ID, passport, NIN, BVN</li>
                <li><strong>Business Information:</strong> Proposed company details, shareholding structure</li>
                <li><strong>Financial Information:</strong> Payment details, transaction history</li>
                <li><strong>Professional Information:</strong> Occupation, employer details (where applicable)</li>
              </ul>

              <h3 className="text-xl font-medium">2.2 Technical Information</h3>
              <p>We automatically collect:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>IP address and device information</li>
                <li>Browser type and version</li>
                <li>Usage data and interaction with our platform</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">3. How We Use Your Information</h2>
              <p>We use your personal information for:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Service Delivery:</strong> Processing company registration applications</li>
                <li><strong>Identity Verification:</strong> Verifying your identity as required by law</li>
                <li><strong>Communication:</strong> Sending updates about your application status</li>
                <li><strong>Payment Processing:</strong> Processing payments for our services</li>
                <li><strong>Legal Compliance:</strong> Meeting regulatory and legal requirements</li>
                <li><strong>Service Improvement:</strong> Enhancing our platform and user experience</li>
                <li><strong>Security:</strong> Detecting and preventing fraud and unauthorized access</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">4. Legal Basis for Processing</h2>
              <p>We process your personal data based on:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Contract:</strong> To fulfill our service agreement with you</li>
                <li><strong>Legal Obligation:</strong> To comply with Nigerian laws and CAC requirements</li>
                <li><strong>Consent:</strong> Where you have given explicit consent</li>
                <li><strong>Legitimate Interest:</strong> To improve our services and prevent fraud</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">5. Information Sharing</h2>
              <p>We share your information with:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Corporate Affairs Commission (CAC):</strong> For company registration processing</li>
                <li><strong>Legal Practitioners:</strong> Lawyers assigned to handle your application</li>
                <li><strong>Payment Processors:</strong> To process your payments securely</li>
                <li><strong>Identity Verification Services:</strong> To verify your identity documents</li>
                <li><strong>Disslio Limited (UK Partner):</strong> For technical and operational support</li>
                <li><strong>Law Enforcement:</strong> When required by law or court order</li>
              </ul>
              <p>
                We do not sell your personal information to third parties for marketing purposes.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">6. Data Security</h2>
              <p>We implement robust security measures including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure access controls and authentication</li>
                <li>Regular security assessments and audits</li>
                <li>Employee training on data protection</li>
                <li>Incident response procedures</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">7. Data Retention</h2>
              <p>We retain your personal data for:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Active Accounts:</strong> As long as your account is active</li>
                <li><strong>Completed Applications:</strong> For 7 years after completion (legal requirement)</li>
                <li><strong>Financial Records:</strong> For 6 years as required by tax regulations</li>
                <li><strong>Legal Disputes:</strong> Until resolution of any pending disputes</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">8. Your Rights</h2>
              <p>Under the NDPR, you have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
                <li><strong>Erasure:</strong> Request deletion of your data (subject to legal obligations)</li>
                <li><strong>Restriction:</strong> Limit how we process your data</li>
                <li><strong>Portability:</strong> Receive your data in a structured format</li>
                <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent where processing is based on consent</li>
              </ul>
              <p>
                To exercise these rights, contact us at service@cellionone.com.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">9. International Data Transfers</h2>
              <p>
                Your data may be transferred to and processed in the United Kingdom by our partner Disslio 
                Limited. We ensure appropriate safeguards are in place for such transfers, including 
                standard contractual clauses and data processing agreements.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">10. Cookies and Tracking</h2>
              <p>We use cookies and similar technologies to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Keep you signed in to your account</li>
                <li>Remember your preferences</li>
                <li>Understand how you use our platform</li>
                <li>Improve our services</li>
              </ul>
              <p>
                You can manage cookie preferences through your browser settings. Disabling certain cookies 
                may affect platform functionality.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">11. Children's Privacy</h2>
              <p>
                Our services are not intended for individuals under 18 years of age. We do not knowingly 
                collect personal information from children. If we become aware that we have collected data 
                from a child, we will take steps to delete it.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">12. Third-Party Links</h2>
              <p>
                Our platform may contain links to third-party websites. We are not responsible for the 
                privacy practices of these external sites. We encourage you to review their privacy policies.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">13. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of significant 
                changes by email or through our platform. Your continued use of the Service after changes 
                constitutes acceptance of the updated policy.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">14. Contact Us</h2>
              <p>For privacy-related inquiries or to exercise your rights:</p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p><strong>Data Protection Officer</strong></p>
                <p>Cellion Platforms Nigeria Limited</p>
                <p>Email: service@cellionone.com</p>
                <p className="mt-2 text-sm text-muted-foreground">UK Partner: Disslio Limited</p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">15. Complaints</h2>
              <p>
                If you are not satisfied with our response to your privacy concerns, you have the right to 
                lodge a complaint with the National Information Technology Development Agency (NITDA) or 
                other relevant supervisory authority.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t">
            <p className="text-sm text-muted-foreground text-center">
              By using Cellion One, you acknowledge that you have read and understood this Privacy Policy.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
