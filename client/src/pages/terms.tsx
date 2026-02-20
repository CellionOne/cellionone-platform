import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft } from "lucide-react";
import { CelionLogo } from "@/components/celion-logo";
import { Link } from "wouter";

export default function TermsPage() {
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

          <h1 className="text-3xl sm:text-4xl font-bold mb-8">Terms and Conditions</h1>
          
          <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
            <p className="text-muted-foreground">
              <strong>Last Updated:</strong> February 2026
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">1. Introduction</h2>
              <p>
                Welcome to Celion One ("Platform", "Service", "we", "us", or "our"). These Terms and Conditions 
                ("Terms") govern your use of the Celion One platform, operated by <strong>Cellion Platforms Nigeria Limited</strong> 
                (RC Number pending), a company registered in Nigeria, in partnership with <strong>Disslio Limited</strong>, 
                a company registered in the United Kingdom.
              </p>
              <p>
                By accessing or using our Platform, you agree to be bound by these Terms. If you do not agree 
                to these Terms, please do not use our Service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">2. Services Description</h2>
              <p>
                Celion One provides a digital platform facilitating company incorporation services in Nigeria, 
                including but not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Digital application processing for company registration with the Corporate Affairs Commission (CAC)</li>
                <li>Identity verification services for directors and shareholders</li>
                <li>Document management and secure storage</li>
                <li>Connection with verified legal practitioners</li>
                <li>Payment processing for registration fees</li>
                <li>Delivery of stamped original documents</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">3. User Eligibility</h2>
              <p>To use our Service, you must:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Be at least 18 years of age</li>
                <li>Have the legal capacity to enter into binding contracts</li>
                <li>Provide accurate and complete information during registration</li>
                <li>Comply with all applicable Nigerian laws and regulations</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">4. User Accounts</h2>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials and for 
                all activities that occur under your account. You agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Notify us immediately of any unauthorized access to your account</li>
                <li>Not share your account credentials with third parties</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">5. Fees and Payment</h2>
              <p>
                Our Service fees are displayed on the Platform at the time of application. By submitting 
                an application, you agree to pay all applicable fees. Payment terms:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>All fees are quoted in Nigerian Naira (NGN) unless otherwise stated</li>
                <li>Payment is required before processing begins</li>
                <li>Fees include our service charges and applicable government levies</li>
                <li>Additional fees may apply for expedited processing or supplementary services</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">6. Refund Policy</h2>
              <p>Refunds are subject to the following conditions:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Full Refund:</strong> Available if you cancel before we submit your application to the CAC</li>
                <li><strong>Partial Refund:</strong> Available if cancellation occurs after submission but before CAC approval, 
                  less any non-recoverable government fees and processing costs incurred</li>
                <li><strong>No Refund:</strong> Once your application is approved by the CAC, no refunds will be issued</li>
                <li>Refund requests must be submitted in writing to service@cellionone.com</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">7. User Responsibilities</h2>
              <p>You agree to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide truthful and accurate information in all applications</li>
                <li>Upload authentic documents that have not been altered or forged</li>
                <li>Respond promptly to requests for additional information or clarification</li>
                <li>Not use the Service for any unlawful purpose</li>
                <li>Not attempt to circumvent any security measures</li>
                <li>Not upload malicious software or content</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">8. Legal Practitioners</h2>
              <p>
                Legal practitioners on our Platform are independent professionals licensed to practice law 
                in Nigeria. While we verify their credentials, we do not control their professional judgment 
                or actions. The relationship between you and any legal practitioner is separate from your 
                relationship with Celion One.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">9. Document Handling</h2>
              <p>We handle your documents with care and confidentiality:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Documents are stored securely using industry-standard encryption</li>
                <li>Access is limited to authorized personnel and assigned legal practitioners</li>
                <li>We retain documents for a period necessary to fulfill our services and legal obligations</li>
                <li>You may request deletion of your documents after your application is complete</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">10. Intellectual Property</h2>
              <p>
                All content on the Platform, including text, graphics, logos, and software, is the property 
                of Cellion Platforms Nigeria Limited or its licensors and is protected by intellectual property 
                laws. You may not reproduce, distribute, or create derivative works without our express permission.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">11. Limitation of Liability</h2>
              <p>To the maximum extent permitted by law:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>We are not liable for any indirect, incidental, special, or consequential damages</li>
                <li>Our total liability shall not exceed the amount you paid for our services</li>
                <li>We are not responsible for delays caused by the CAC or other government agencies</li>
                <li>We do not guarantee approval of any application by the CAC</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">12. Indemnification</h2>
              <p>
                You agree to indemnify and hold harmless Cellion Platforms Nigeria Limited, Disslio Limited, 
                and their officers, directors, employees, and agents from any claims, damages, losses, or 
                expenses arising from your use of the Service or violation of these Terms.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">13. Termination</h2>
              <p>
                We may suspend or terminate your access to the Service at any time for violation of these 
                Terms or for any other reason at our discretion. Upon termination, you remain liable for 
                any outstanding fees.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">14. Governing Law and Dispute Resolution</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the Federal 
                Republic of Nigeria. Any disputes arising from these Terms or your use of the Service shall 
                be resolved through:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Good faith negotiations between the parties</li>
                <li>If negotiations fail, mediation in Lagos, Nigeria</li>
                <li>If mediation fails, binding arbitration under the Arbitration and Conciliation Act</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">15. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. Changes will be effective upon 
                posting on the Platform. Your continued use of the Service after changes constitutes 
                acceptance of the modified Terms.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">16. Contact Information</h2>
              <p>For questions about these Terms, please contact us:</p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p><strong>Cellion Platforms Nigeria Limited</strong></p>
                <p>Email: service@cellionone.com</p>
                <p className="mt-2 text-sm text-muted-foreground">UK Partner: Disslio Limited</p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">17. Severability</h2>
              <p>
                If any provision of these Terms is found to be unenforceable, the remaining provisions 
                will continue in full force and effect.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">18. Entire Agreement</h2>
              <p>
                These Terms, together with our Privacy Policy, constitute the entire agreement between 
                you and Cellion Platforms Nigeria Limited regarding your use of the Service.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t">
            <p className="text-sm text-muted-foreground text-center">
              By using Celion One, you acknowledge that you have read, understood, and agree to these Terms and Conditions.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
