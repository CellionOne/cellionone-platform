import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft } from "lucide-react";
import { CelionLogo } from "@/components/celion-logo";
import { Link } from "wouter";

export const KYC_TERMS_VERSION = "1.0";

export default function KycTermsPage() {
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
            <a className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8" data-testid="link-back-home">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </a>
          </Link>

          <h1 className="text-3xl sm:text-4xl font-bold mb-4" data-testid="text-page-title">KYC Service Terms &amp; Conditions</h1>
          <p className="text-muted-foreground mb-8">
            <strong>Version:</strong> {KYC_TERMS_VERSION} &mdash; <strong>Last Updated:</strong> February 2026
          </p>

          <nav className="mb-10 border rounded-md p-4" data-testid="nav-table-of-contents">
            <p className="font-semibold mb-3">Contents</p>
            <ul className="space-y-1 text-sm">
              <li>
                <a href="#section-1" className="text-muted-foreground hover:text-foreground">Section 1: KYC Service Agreement (for Organisations)</a>
              </li>
              <li>
                <a href="#section-2" className="text-muted-foreground hover:text-foreground">Section 2: Verification Consent &amp; Terms (for Individuals / Suppliers)</a>
              </li>
            </ul>
          </nav>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">

            <div id="section-1" data-testid="section-org-agreement">
              <h2 className="text-2xl font-bold mb-6 border-b pb-2">Section 1: KYC Service Agreement (for Organisations)</h2>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">1.1 Service Description</h3>
                <p>
                  Cellion One (&quot;Platform&quot;) is a technology platform operated by <strong>Cellion Platforms Nigeria Limited</strong> that facilitates
                  Know-Your-Customer (KYC) verification services on behalf of organisations. Cellion One is <strong>not</strong> a verification
                  authority. The Platform provides technology infrastructure to manage the verification workflow, document collection,
                  and result aggregation. Organisations using the KYC Service are responsible for their own compliance decisions
                  based on the verification results provided.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">1.2 Third-Party Identity Verification (Smile ID)</h3>
                <p>
                  Identity verification services, including BVN validation, NIN validation, document verification, biometric
                  selfie matching, liveness detection, and Anti-Money Laundering (AML) screening, are performed by
                  <strong> Smile ID</strong>, a licensed third-party identity verification provider. Cellion One integrates with
                  Smile ID to facilitate these checks but does not independently perform identity verification. The accuracy and
                  completeness of identity verification results are subject to Smile ID&apos;s systems, data sources, and processes.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">1.3 AI Document Extraction Disclaimer</h3>
                <p>
                  The Platform uses artificial intelligence (AI) technology to extract data from uploaded documents (such as CAC
                  certificates, tax clearance certificates, and identification documents). AI-extracted data is provided on an
                  &quot;as-is&quot; basis and may contain inaccuracies. <strong>The organisation is solely responsible for reviewing,
                  verifying, and confirming the accuracy of all extracted data</strong> before making any decisions based on it.
                  Cellion One makes no warranty as to the accuracy, completeness, or reliability of AI-extracted data.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">1.4 Data Processing Roles</h3>
                <p>
                  For the purposes of the Nigeria Data Protection Act (NDPA) and its implementing regulations, the organisation
                  using the KYC Service is the <strong>Data Controller</strong>. Cellion One acts as a <strong>Data Processor</strong>,
                  processing personal data on behalf of and under the instructions of the organisation. The organisation is responsible
                  for ensuring lawful basis for data processing and for informing verification subjects of their rights under the NDPA.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">1.5 Verification Validity</h3>
                <p>
                  Verification results have a stated validity period, which may vary depending on the type of verification and the
                  documents reviewed. Organisations should not rely on verification results beyond their stated expiry date. The
                  Platform provides document expiry tracking and renewal alerts to assist organisations in maintaining current
                  verifications, but the organisation remains responsible for ensuring verification currency.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">1.6 Organisation Obligations</h3>
                <p>By using the KYC Service, the organisation agrees to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Use verification results only for the stated purpose disclosed to the verification subject</li>
                  <li>Not share verification results with unauthorised personnel or third parties without the subject&apos;s consent</li>
                  <li>Comply with the NDPA and all applicable data protection laws</li>
                  <li>Ensure that all team members with access to verification data are bound by appropriate confidentiality obligations</li>
                  <li>Promptly report any data breach involving verification data to Cellion One and relevant authorities as required by law</li>
                  <li>Not use the Platform for unlawful discrimination, harassment, or any purpose contrary to Nigerian law</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">1.7 Payment Terms</h3>
                <p>The KYC Service is priced on a per-verification basis:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Individual Identity Verification:</strong> &#x20A6;10,000 per person</li>
                  <li><strong>Corporate / Supplier Verification:</strong> &#x20A6;100,000 per company (plus &#x20A6;10,000 per director if director verification is required)</li>
                </ul>
                <p>
                  Fees are non-refundable once the verification process has been initiated (i.e., the subject has accepted the invite
                  and begun uploading documents). Payment may be made by the organisation or by the verification subject, as
                  configured per request. All fees are quoted in Nigerian Naira (NGN) and are inclusive of applicable taxes unless
                  stated otherwise.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">1.8 Indemnification</h3>
                <p>
                  The organisation agrees to indemnify and hold harmless Cellion Platforms Nigeria Limited, its officers,
                  directors, employees, and agents from and against any claims, damages, losses, liabilities, costs, or expenses
                  (including reasonable legal fees) arising from or related to:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Decisions made by the organisation based on verification results</li>
                  <li>The organisation&apos;s failure to comply with applicable data protection laws</li>
                  <li>Unauthorised sharing or misuse of verification data by the organisation or its personnel</li>
                  <li>Any breach of these terms by the organisation</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">1.9 Limitation of Liability</h3>
                <p>To the maximum extent permitted by law:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Cellion One&apos;s total liability under or in connection with the KYC Service shall not exceed the total fees paid by the organisation in the twelve (12) months preceding the claim</li>
                  <li>Cellion One shall not be liable for errors, omissions, or inaccuracies in verification results provided by Smile ID</li>
                  <li>Cellion One shall not be liable for inaccuracies in data extracted using AI technology</li>
                  <li>Cellion One shall not be liable for any decisions made by the organisation based on verification results, including but not limited to hiring, contracting, or procurement decisions</li>
                  <li>Cellion One shall not be liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits, revenue, or business opportunities</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">1.10 Data Retention</h3>
                <p>
                  Verification data (including submitted documents, extracted data, and verification results) is retained for
                  <strong> seven (7) years</strong> from the date of verification completion, in accordance with regulatory compliance
                  requirements. Earlier deletion may be requested by the organisation, subject to legal permissibility. Upon
                  expiry of the retention period, data is securely destroyed.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">1.11 Termination</h3>
                <p>
                  Either party may terminate this agreement with <strong>thirty (30) days</strong> written notice to the other party.
                  Upon termination:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>All existing verifications that have been completed remain valid until their stated expiry date</li>
                  <li>Pending verifications may be completed within the notice period</li>
                  <li>No refunds will be issued for verifications already initiated</li>
                  <li>Data retention obligations continue as stated in Section 1.10</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">1.12 Governing Law &amp; Dispute Resolution</h3>
                <p>
                  This agreement shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria.
                  Any disputes arising from or in connection with this agreement shall be subject to the exclusive jurisdiction of
                  the courts of Lagos State, Nigeria. The parties agree to attempt good-faith negotiation and, if unsuccessful,
                  mediation before pursuing litigation.
                </p>
              </section>
            </div>

            <hr className="my-12 border-t-2" />

            <div id="section-2" data-testid="section-subject-consent">
              <h2 className="text-2xl font-bold mb-6 border-b pb-2">Section 2: Verification Consent &amp; Terms (for Individuals / Suppliers)</h2>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">2.1 About This Verification</h3>
                <p>
                  You have been invited (or have registered) to complete a verification process through Cellion One on behalf of
                  an organisation (&quot;Requesting Organisation&quot;). This section explains what the verification involves, how your
                  data will be handled, and your rights.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">2.2 What Checks Are Performed</h3>
                <p>Depending on the type of verification requested, the following checks may be performed via <strong>Smile ID</strong>, a licensed third-party identity verification provider:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>BVN Validation:</strong> Verification of your Bank Verification Number against the national BVN database</li>
                  <li><strong>NIN Validation:</strong> Verification of your National Identification Number against the NIMC database</li>
                  <li><strong>Document Verification:</strong> Authentication of government-issued identification documents</li>
                  <li><strong>Biometric Selfie Matching:</strong> Comparison of a live selfie photo against your identification document photo</li>
                  <li><strong>Liveness Detection:</strong> Verification that you are a real, live person (not a photo or video)</li>
                  <li><strong>AML Screening:</strong> Screening against anti-money laundering and sanctions databases</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">2.3 Document Upload &amp; AI Processing</h3>
                <p>
                  As part of the verification, you will be asked to upload supporting documents (such as identification documents,
                  certificates, or proof of address). These documents will be:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Stored securely on the Cellion One platform using encryption at rest (AES-256-GCM) and in transit (TLS)</li>
                  <li>Processed using artificial intelligence (AI) technology to automatically extract relevant data fields (such as names, dates, identification numbers)</li>
                  <li>Made available for review by the Requesting Organisation&apos;s authorised personnel</li>
                </ul>
                <p>
                  You will have the opportunity to review and confirm the accuracy of AI-extracted data before final submission.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">2.4 Biometric Consent</h3>
                <p>
                  By proceeding with this verification, you <strong>explicitly consent</strong> to the collection and processing
                  of your biometric data, including:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>A selfie photograph for identity matching purposes</li>
                  <li>Liveness detection data to confirm you are a live person</li>
                </ul>
                <p>
                  This biometric data is processed by Smile ID in accordance with their privacy policy and applicable data
                  protection laws. Biometric data is used solely for the purpose of identity verification and is not used for
                  any other purpose.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">2.5 Data Sharing Consent</h3>
                <p>
                  By completing this verification, you understand and agree that your verified data — including verification
                  results, submitted documents, and extracted data — will be shared with the Requesting Organisation. The
                  Requesting Organisation will use this data for the purpose disclosed to you (e.g., employment verification,
                  supplier due diligence). You may contact the Requesting Organisation directly for details on how they will
                  use your data.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">2.6 Data Controller &amp; Processor</h3>
                <p>
                  The <strong>Requesting Organisation</strong> is the Data Controller — they determine why and how your personal
                  data is processed. <strong>Cellion One</strong> acts as the Data Processor, processing your data on behalf of and
                  under the instructions of the Requesting Organisation. Smile ID acts as a sub-processor for identity
                  verification services.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">2.7 Your Rights Under the NDPA</h3>
                <p>Under the Nigeria Data Protection Act (NDPA), you have the following rights:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Right of Access:</strong> You may request a copy of the personal data held about you</li>
                  <li><strong>Right to Rectification:</strong> You may request correction of inaccurate or incomplete personal data</li>
                  <li><strong>Right to Erasure:</strong> You may request deletion of your personal data, subject to legal and regulatory retention requirements</li>
                  <li><strong>Right to Withdraw Consent:</strong> You may withdraw your consent at any time. However, if consent is withdrawn before verification is complete, the verification cannot proceed and will be marked as &quot;withdrawn&quot;</li>
                  <li><strong>Right to Lodge a Complaint:</strong> You may lodge a complaint with the National Information Technology Development Agency (NITDA) if you believe your data protection rights have been violated</li>
                </ul>
                <p>
                  To exercise any of these rights, contact the Requesting Organisation (as Data Controller) or email Cellion One
                  at <strong>service@cellionone.com</strong>.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">2.8 Data Retention</h3>
                <p>
                  Your personal data, including submitted documents, extracted data, and verification results, will be retained
                  for the duration of the verification process plus <strong>seven (7) years</strong> for regulatory compliance purposes.
                  After the retention period, your data will be securely destroyed. You may request earlier deletion, subject to
                  legal permissibility and the Requesting Organisation&apos;s consent.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">2.9 Security</h3>
                <p>
                  Your data is protected with industry-standard security measures:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Encryption at rest:</strong> AES-256-GCM encryption for all stored data</li>
                  <li><strong>Encryption in transit:</strong> TLS encryption for all data transmissions</li>
                  <li><strong>Access controls:</strong> Only authorised personnel of the Requesting Organisation and Cellion One operations team can access your data</li>
                  <li><strong>Audit logging:</strong> All access to your data is logged and auditable</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">2.10 Right to Withdraw</h3>
                <p>
                  You may withdraw from the verification process at any time by contacting Cellion One at
                  service@cellionone.com or the Requesting Organisation directly. Please note:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>If verification is incomplete, it will be marked as &quot;withdrawn&quot; and cannot be resumed</li>
                  <li>Data already shared with the Requesting Organisation prior to withdrawal cannot be recalled by Cellion One</li>
                  <li>Any fees already paid for the verification are non-refundable once the process has been initiated</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-semibold">2.11 Limitation of Liability</h3>
                <p>
                  Cellion One facilitates the verification process but is <strong>not responsible</strong> for how the Requesting
                  Organisation uses verification results. Any decisions made by the Requesting Organisation based on your
                  verification (including but not limited to employment, contracting, or procurement decisions) are solely the
                  responsibility of that organisation. Cellion One shall not be liable for any loss, damage, or adverse
                  consequences arising from the Requesting Organisation&apos;s use of your verification results.
                </p>
              </section>
            </div>

          </div>

          <div className="mt-12 pt-8 border-t">
            <p className="text-sm text-muted-foreground text-center" data-testid="text-terms-footer">
              By using the Cellion One KYC Service, you acknowledge that you have read, understood, and agree to these Terms and Conditions (Version {KYC_TERMS_VERSION}).
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
