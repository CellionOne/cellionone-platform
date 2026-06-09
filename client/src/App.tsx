import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { useDevAuth } from "@/hooks/use-dev-auth";
import { LoadingPage } from "@/components/loading-spinner";

// Eagerly loaded — needed for initial render / unauthenticated flows
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import ResetPasswordPage from "@/pages/auth/reset-password";
import VerifyEmailPage from "@/pages/auth/verify-email";

// Lazy-loaded — only downloaded when the user actually visits that route
const FounderDashboard = lazy(() => import("@/pages/founder/dashboard"));
const FounderApplications = lazy(() => import("@/pages/founder/applications"));
const FounderVault = lazy(() => import("@/pages/founder/vault"));
const FounderRegisteredOffice = lazy(() => import("@/pages/founder/registered-office"));
const FounderMail = lazy(() => import("@/pages/founder/mail"));
const FounderLegalAssistant = lazy(() => import("@/pages/founder/legal-assistant"));
const FounderCompanyProfile = lazy(() => import("@/pages/founder/company-profile"));
const FounderPostIncChecklist = lazy(() => import("@/pages/founder/post-inc-checklist"));
const FounderComplianceCalendar = lazy(() => import("@/pages/founder/compliance-calendar"));
const FounderCheckout = lazy(() => import("@/pages/founder/checkout"));
const FounderServiceRequestForm = lazy(() => import("@/pages/founder/service-request-form"));
const FounderAddDirectorForm = lazy(() => import("@/pages/founder/add-director-form"));
const FounderOrders = lazy(() => import("@/pages/founder/orders"));
const FounderOrderDetail = lazy(() => import("@/pages/founder/order-detail"));
const NewApplication = lazy(() => import("@/pages/applications/new"));
const ApplicationDetails = lazy(() => import("@/pages/applications/[id]"));
const LawyerDashboard = lazy(() => import("@/pages/lawyer/dashboard"));
const LawyerApplications = lazy(() => import("@/pages/lawyer/applications"));
const LawyerApplicationDetail = lazy(() => import("@/pages/lawyer/application-detail"));
const LawyerPayouts = lazy(() => import("@/pages/lawyer/payouts"));
const LawyerServiceRequests = lazy(() => import("@/pages/lawyer/service-requests"));
const LawyerServiceRequestDetail = lazy(() => import("@/pages/lawyer/service-request-detail"));
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminApplications = lazy(() => import("@/pages/admin/applications"));
const AdminApplicationDetail = lazy(() => import("@/pages/admin/application-detail"));
const AdminFeatureFlags = lazy(() => import("@/pages/admin/feature-flags"));
const AdminAuditLogs = lazy(() => import("@/pages/admin/audit-logs"));
const AdminAIEvents = lazy(() => import("@/pages/admin/ai-events"));
const AdminReceipts = lazy(() => import("@/pages/admin/receipts"));
const AdminLawyerApplications = lazy(() => import("@/pages/admin/lawyer-applications"));
const AdminMailroom = lazy(() => import("@/pages/admin/mailroom"));
const AdminOrders = lazy(() => import("@/pages/admin/orders"));
const AdminKycOverview = lazy(() => import("@/pages/admin/kyc-overview"));
const AdminFieldVerifications = lazy(() => import("@/pages/admin/field-verifications"));
const AdminProposals = lazy(() => import("@/pages/admin/proposals"));
const AdminRegisteredOffices = lazy(() => import("@/pages/admin/registered-offices"));
const AdminSecurity = lazy(() => import("@/pages/admin/security"));
const AdminEscrowDashboard = lazy(() => import("@/pages/admin/escrow-dashboard"));
const AdminBankingPartners = lazy(() => import("@/pages/admin/banking-partners"));
const AdminCieCockpit = lazy(() => import("@/pages/admin/cie"));
const AdminExistingCompanies = lazy(() => import("@/pages/admin/existing-companies"));
const CiePortal = lazy(() => import("@/pages/cie/index"));
const CieSecurities = lazy(() => import("@/pages/cie/securities"));
const CieSecurityDetail = lazy(() => import("@/pages/cie/security-detail"));
const CieSignals = lazy(() => import("@/pages/cie/signals"));
const CieApiKeys = lazy(() => import("@/pages/cie/api-keys"));
const CieSubscribePage = lazy(() => import("@/pages/cie/subscribe"));
const CieSubscribeSuccess = lazy(() => import("@/pages/cie/subscribe-success"));
const CieIntelligencePage = lazy(() => import("@/pages/cie-intelligence"));
const PlatformOverview = lazy(() => import("@/pages/platform-overview"));
const WhyCellionOne = lazy(() => import("@/pages/why-cellion-one"));
const ApiDocsPage = lazy(() => import("@/pages/api-docs"));
const ApplyLawyerPage = lazy(() => import("@/pages/apply-lawyer"));
const TermsPage = lazy(() => import("@/pages/terms"));
const PrivacyPage = lazy(() => import("@/pages/privacy"));
const PartnerWithUsPage = lazy(() => import("@/pages/partner-with-us"));
const ContactPage = lazy(() => import("@/pages/contact"));
const BankPortalLogin = lazy(() => import("@/pages/bank/login"));
const BankSetPasswordPage = lazy(() => import("@/pages/bank/set-password"));
const BankForgotPasswordPage = lazy(() => import("@/pages/bank/forgot-password"));
const BankResetPasswordPage = lazy(() => import("@/pages/bank/reset-password"));
const BankCompaniesPage = lazy(() => import("@/pages/bank/companies"));
const BankCompanyDetailPage = lazy(() => import("@/pages/bank/company-detail"));
const BankAccountPage = lazy(() => import("@/pages/bank/account"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const PersonalProfilePage = lazy(() => import("@/pages/personal-profile"));
const CompanyPeoplePage = lazy(() => import("@/pages/founder/company-people"));
const FounderDataSharing = lazy(() => import("@/pages/founder/data-sharing"));
const VerifyPage = lazy(() => import("@/pages/verify"));
const VerifyIdentityPage = lazy(() => import("@/pages/verify-identity"));
const InviteAcceptPage = lazy(() => import("@/pages/invite-accept"));
const DirectorBiometricPage = lazy(() => import("@/pages/director-biometric"));
const DirectorUploadPage = lazy(() => import("@/pages/director-upload"));
const DirectorConsentPage = lazy(() => import("@/pages/director-consent"));
const ShareholderConfirmPage = lazy(() => import("@/pages/shareholder-confirm"));
const CorporateDocUploadPage = lazy(() => import("@/pages/corporate-doc-upload"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
const PaymentCheckoutPage = lazy(() => import("@/pages/payment/checkout"));
const PaymentSuccessPage = lazy(() => import("@/pages/payment/success"));
const PaymentCancelPage = lazy(() => import("@/pages/payment/cancel"));
const KycTermsPage = lazy(() => import("@/pages/kyc-service/terms"));
const KycOrgsPage = lazy(() => import("@/pages/kyc-service/orgs"));
const KycOrgPortal = lazy(() => import("@/pages/kyc-service/org-portal"));
const KycVerificationDetail = lazy(() => import("@/pages/kyc-service/verification-detail"));
const KycVerifyRequestPage = lazy(() => import("@/pages/kyc-service/verify-request"));
const KycEmployeePortalPage = lazy(() => import("@/pages/kyc-service/employee-portal"));
const KycSupplierPortalPage = lazy(() => import("@/pages/kyc-service/supplier-portal"));
const KycOrgInviteAcceptPage = lazy(() => import("@/pages/kyc-service/org-invite-accept"));
const KycMyVerifications = lazy(() => import("@/pages/kyc-service/my-verifications"));
const KycSessionPage = lazy(() => import("@/pages/kyc-service/kyc-session"));
const ProcurementMarketplace = lazy(() => import("@/pages/procurement/marketplace"));
const ProcurementCreateRfq = lazy(() => import("@/pages/procurement/create-rfq"));
const ProcurementRfqDetail = lazy(() => import("@/pages/procurement/rfq-detail"));
const ProcurementMyRfqs = lazy(() => import("@/pages/procurement/my-rfqs"));
const ProcurementSubmitBid = lazy(() => import("@/pages/procurement/submit-bid"));
const ProcurementMyBids = lazy(() => import("@/pages/procurement/my-bids"));
const ProcurementBidTemplates = lazy(() => import("@/pages/procurement/bid-templates"));
const ProcurementMyContracts = lazy(() => import("@/pages/procurement/my-contracts"));
const ProcurementContractDetail = lazy(() => import("@/pages/procurement/contract-detail"));
const ProcurementMyInvoices = lazy(() => import("@/pages/procurement/my-invoices"));
const ProcurementCreateInvoice = lazy(() => import("@/pages/procurement/create-invoice"));
const ProcurementInvoiceDetail = lazy(() => import("@/pages/procurement/invoice-detail"));
const BuildingManagerDashboard = lazy(() => import("@/pages/building-manager/dashboard"));
const BuildingManagerUtilityBill = lazy(() => import("@/pages/building-manager/utility-bill"));
const BuildingManagerSubscribers = lazy(() => import("@/pages/building-manager/subscribers"));
const BuildingManagerMailIntake = lazy(() => import("@/pages/building-manager/mail-intake"));
const WelcomePage = lazy(() => import("@/pages/welcome"));
const ExistingCompanyPage = lazy(() => import("@/pages/founder/existing-company"));
const RegistrationsPage = lazy(() => import("@/pages/founder/registrations"));
const FounderRegistrationServicesPage = lazy(() => import("@/pages/founder/registration-services"));
// Developer portal
const DeveloperLanding = lazy(() => import("@/pages/developers/landing"));
const DeveloperRegister = lazy(() => import("@/pages/developers/register"));
const DeveloperLogin = lazy(() => import("@/pages/developers/login"));
const DeveloperVerifyEmail = lazy(() => import("@/pages/developers/verify-email"));
const DeveloperDashboard = lazy(() => import("@/pages/developers/dashboard"));
const DeveloperKeys = lazy(() => import("@/pages/developers/keys"));
const DeveloperUsage = lazy(() => import("@/pages/developers/usage"));
const DeveloperDocs = lazy(() => import("@/pages/developers/docs"));
const DeveloperSettings = lazy(() => import("@/pages/developers/settings"));
const AdminDevelopers = lazy(() => import("@/pages/admin/developers"));
const AdminIntelligence = lazy(() => import("@/pages/admin/intelligence"));

const INTENT_EXEMPT_PATHS = ["/welcome", "/settings", "/profile", "/notifications", "/login", "/register"];
const INTENT_EXEMPT_ROLES = ["admin", "lawyer", "building_manager"];

function ProtectedRoute({ 
  component: Component, 
  roles 
}: { 
  component: React.ComponentType; 
  roles?: string[];
}) {
  const { user, isLoading, isAuthenticated } = useAuth();
  
  if (isLoading) {
    return <LoadingPage />;
  }
  
  if (!isAuthenticated) {
    window.location.href = "/login";
    return <LoadingPage />;
  }

  const userRoles = user?.roles || [];
  
  // Check role-based access
  if (roles && roles.length > 0) {
    const hasRequiredRole = roles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      if (userRoles.includes("admin")) {
        window.location.href = "/admin/dashboard";
      } else if (userRoles.includes("lawyer")) {
        window.location.href = "/lawyer/dashboard";
      } else if (userRoles.includes("building_manager")) {
        window.location.href = "/building-manager/dashboard";
      } else {
        window.location.href = "/founder/dashboard";
      }
      return <LoadingPage />;
    }
  }

  // Intent gate: founders without a chosen intent are redirected to /welcome
  // (exempt: non-founder roles, the welcome page itself, and settings/profile pages)
  const isExemptRole = INTENT_EXEMPT_ROLES.some(r => userRoles.includes(r));
  const currentPath = window.location.pathname;
  const isExemptPath = INTENT_EXEMPT_PATHS.some(p => currentPath.startsWith(p));
  if (!isExemptRole && !isExemptPath && !user?.primaryIntent) {
    window.location.href = "/welcome";
    return <LoadingPage />;
  }
  
  return <Component />;
}

function DevProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useDevAuth();
  if (isLoading) return <LoadingPage />;
  if (!isAuthenticated) {
    window.location.href = "/developers/login";
    return <LoadingPage />;
  }
  return <Component />;
}

// Tier-aware route guard for CIE portal pages
// Redirects free users to /cie/subscribe when they try to access subscriber/pro content
function CieTierRoute({
  component: Component,
  minTier,
}: {
  component: React.ComponentType;
  minTier: "subscriber" | "pro";
}) {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { data: cieStatus, isLoading: tierLoading } = useQuery<{ tier: string; isPaid: boolean }>({
    queryKey: ["/api/cie-portal/status"],
    enabled: isAuthenticated,
  });

  if (authLoading || tierLoading) return <LoadingPage />;

  if (!isAuthenticated) {
    window.location.href = "/login";
    return <LoadingPage />;
  }

  const tierOrder: Record<string, number> = { free: 0, subscriber: 1, pro: 2 };
  const userTier = cieStatus?.tier ?? "free";
  const required = minTier === "pro" ? 2 : 1;

  if ((tierOrder[userTier] ?? 0) < required) {
    window.location.href = "/cie/subscribe";
    return <LoadingPage />;
  }

  return <Component />;
}

function RoleBasedRedirect() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingPage />;
  }
  
  const roles = user?.roles;
  
  // SECURITY GUARD: Never guess a dashboard if roles are missing
  // Roles must come from database (single source of truth)
  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    console.error("RoleBasedRedirect: No roles found for user - redirecting to login", { 
      userId: user?.id, 
      roles 
    });
    window.location.href = "/login";
    return <LoadingPage />;
  }
  
  if (roles.includes("admin")) {
    return <Redirect to="/admin/dashboard" />;
  } else if (roles.includes("lawyer")) {
    return <Redirect to="/lawyer/dashboard" />;
  } else if (roles.includes("building_manager")) {
    return <Redirect to="/building-manager/dashboard" />;
  } else if (roles.includes("founder")) {
    if (!user?.primaryIntent) {
      return <Redirect to="/welcome" />;
    }
    if (user.primaryIntent === "kyc_service") {
      return <Redirect to="/kyc/orgs" />;
    }
    if (user.primaryIntent === "procurement") {
      return <Redirect to="/procurement/marketplace" />;
    }
    if (user.primaryIntent === "founder_reg_services") {
      return <Redirect to="/founder/registration-services" />;
    }
    return <Redirect to="/founder/dashboard" />;
  } else {
    // Unknown role - log error and redirect to login
    console.error("RoleBasedRedirect: Unknown role type - redirecting to login", { roles });
    window.location.href = "/login";
    return <LoadingPage />;
  }
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  
  return (
    <Suspense fallback={<LoadingPage />}>
      <Switch>
        <Route path="/">
          {isLoading ? (
            <LoadingPage />
          ) : isAuthenticated ? (
            <RoleBasedRedirect />
          ) : (
            <LandingPage />
          )}
        </Route>
        
        <Route path="/welcome">
          <ProtectedRoute component={WelcomePage} />
        </Route>
        <Route path="/founder/existing-company">
          <ProtectedRoute component={ExistingCompanyPage} />
        </Route>
        <Route path="/founder/registrations">
          <ProtectedRoute component={RegistrationsPage} />
        </Route>
        <Route path="/founder/registration-services">
          <ProtectedRoute component={FounderRegistrationServicesPage} />
        </Route>
        <Route path="/founder/dashboard">
          <ProtectedRoute component={FounderDashboard} />
        </Route>
        <Route path="/founder/applications">
          <ProtectedRoute component={FounderApplications} />
        </Route>
        <Route path="/founder/vault">
          <ProtectedRoute component={FounderVault} />
        </Route>
        <Route path="/founder/registered-office">
          <ProtectedRoute component={FounderRegisteredOffice} />
        </Route>
        <Route path="/founder/mail">
          <ProtectedRoute component={FounderMail} />
        </Route>
        <Route path="/founder/legal-assistant">
          <ProtectedRoute component={FounderLegalAssistant} />
        </Route>
        <Route path="/founder/company-profile">
          <ProtectedRoute component={FounderCompanyProfile} />
        </Route>
        <Route path="/founder/post-inc-checklist">
          <ProtectedRoute component={FounderPostIncChecklist} />
        </Route>
        <Route path="/founder/compliance">
          <ProtectedRoute component={FounderComplianceCalendar} />
        </Route>
        <Route path="/founder/company-people">
          <ProtectedRoute component={CompanyPeoplePage} roles={["founder"]} />
        </Route>
        <Route path="/founder/data-sharing">
          <ProtectedRoute component={FounderDataSharing} roles={["founder"]} />
        </Route>
        <Route path="/founder/checkout">
          <ProtectedRoute component={FounderCheckout} />
        </Route>
        <Route path="/founder/service-request">
          <ProtectedRoute component={FounderServiceRequestForm} />
        </Route>
        <Route path="/founder/add-director">
          <ProtectedRoute component={FounderAddDirectorForm} />
        </Route>
        <Route path="/founder/orders">
          <ProtectedRoute component={FounderOrders} />
        </Route>
        <Route path="/founder/orders/:id">
          <ProtectedRoute component={FounderOrderDetail} />
        </Route>
        
        <Route path="/applications/new">
          <ProtectedRoute component={NewApplication} />
        </Route>
        <Route path="/applications/:id">
          <ProtectedRoute component={ApplicationDetails} />
        </Route>
        
        <Route path="/lawyer/dashboard">
          <ProtectedRoute component={LawyerDashboard} roles={["lawyer"]} />
        </Route>
        <Route path="/lawyer/applications">
          <ProtectedRoute component={LawyerApplications} roles={["lawyer"]} />
        </Route>
        <Route path="/lawyer/applications/:id">
          <ProtectedRoute component={LawyerApplicationDetail} roles={["lawyer"]} />
        </Route>
        <Route path="/lawyer/payouts">
          <ProtectedRoute component={LawyerPayouts} roles={["lawyer"]} />
        </Route>
        <Route path="/lawyer/service-requests">
          <ProtectedRoute component={LawyerServiceRequests} roles={["lawyer"]} />
        </Route>
        <Route path="/lawyer/service-requests/:id">
          <ProtectedRoute component={LawyerServiceRequestDetail} roles={["lawyer"]} />
        </Route>
        
        <Route path="/admin/dashboard">
          <ProtectedRoute component={AdminDashboard} roles={["admin"]} />
        </Route>
        <Route path="/admin/users">
          <ProtectedRoute component={AdminUsers} roles={["admin"]} />
        </Route>
        <Route path="/admin/applications/:id">
          <ProtectedRoute component={AdminApplicationDetail} roles={["admin"]} />
        </Route>
        <Route path="/admin/applications">
          <ProtectedRoute component={AdminApplications} roles={["admin"]} />
        </Route>
        <Route path="/admin/feature-flags">
          <ProtectedRoute component={AdminFeatureFlags} roles={["admin"]} />
        </Route>
        <Route path="/admin/audit-logs">
          <ProtectedRoute component={AdminAuditLogs} roles={["admin"]} />
        </Route>
        <Route path="/admin/ai-events">
          <ProtectedRoute component={AdminAIEvents} roles={["admin"]} />
        </Route>
        <Route path="/admin/receipts">
          <ProtectedRoute component={AdminReceipts} roles={["admin"]} />
        </Route>
        <Route path="/admin/mailroom">
          <ProtectedRoute component={AdminMailroom} roles={["admin"]} />
        </Route>
        <Route path="/admin/lawyer-applications">
          <ProtectedRoute component={AdminLawyerApplications} roles={["admin"]} />
        </Route>
        <Route path="/admin/orders">
          <ProtectedRoute component={AdminOrders} roles={["admin"]} />
        </Route>
        <Route path="/admin/kyc">
          <ProtectedRoute component={AdminKycOverview} roles={["admin"]} />
        </Route>
        <Route path="/admin/field-verifications">
          <ProtectedRoute component={AdminFieldVerifications} roles={["admin"]} />
        </Route>
        <Route path="/admin/proposals">
          <ProtectedRoute component={AdminProposals} roles={["admin"]} />
        </Route>
        <Route path="/admin/registered-offices">
          <ProtectedRoute component={AdminRegisteredOffices} roles={["admin"]} />
        </Route>
        <Route path="/admin/security">
          <ProtectedRoute component={AdminSecurity} roles={["admin"]} />
        </Route>
        <Route path="/admin/escrow-dashboard">
          <ProtectedRoute component={AdminEscrowDashboard} roles={["admin"]} />
        </Route>
        <Route path="/admin/banking-partners">
          <ProtectedRoute component={AdminBankingPartners} roles={["admin"]} />
        </Route>
        <Route path="/admin/cie">
          <ProtectedRoute component={AdminCieCockpit} roles={["admin", "cie_analyst"]} />
        </Route>
        <Route path="/admin/existing-companies">
          <ProtectedRoute component={AdminExistingCompanies} roles={["admin"]} />
        </Route>

        <Route path="/cie/subscribe/success">
          <ProtectedRoute component={CieSubscribeSuccess} />
        </Route>
        <Route path="/cie/subscribe" component={CieSubscribePage} />
        <Route path="/cie/api-keys">
          <CieTierRoute component={CieApiKeys} minTier="subscriber" />
        </Route>
        <Route path="/cie/signals">
          <CieTierRoute component={CieSignals} minTier="pro" />
        </Route>
        <Route path="/cie/securities/:ticker">
          <CieTierRoute component={CieSecurityDetail} minTier="subscriber" />
        </Route>
        <Route path="/cie/securities">
          <CieTierRoute component={CieSecurities} minTier="subscriber" />
        </Route>
        <Route path="/cie">
          <CiePortal />
        </Route>
        <Route path="/cie-intelligence">
          <CieIntelligencePage />
        </Route>

        <Route path="/building-manager/dashboard">
          <ProtectedRoute component={BuildingManagerDashboard} roles={["building_manager"]} />
        </Route>
        <Route path="/building-manager/utility-bill">
          <ProtectedRoute component={BuildingManagerUtilityBill} roles={["building_manager"]} />
        </Route>
        <Route path="/building-manager/subscribers">
          <ProtectedRoute component={BuildingManagerSubscribers} roles={["building_manager"]} />
        </Route>
        <Route path="/building-manager/mail-intake">
          <ProtectedRoute component={BuildingManagerMailIntake} roles={["building_manager"]} />
        </Route>
        
        <Route path="/profile">
          <ProtectedRoute component={PersonalProfilePage} />
        </Route>
        <Route path="/settings">
          <ProtectedRoute component={SettingsPage} />
        </Route>
        <Route path="/notifications">
          <ProtectedRoute component={NotificationsPage} />
        </Route>
        
        <Route path="/apply-lawyer" component={ApplyLawyerPage} />
        
        <Route path="/platform-overview" component={PlatformOverview} />
        <Route path="/why-cellion-one" component={WhyCellionOne} />
        <Route path="/api-docs" component={ApiDocsPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/partner-with-us" component={PartnerWithUsPage} />
        <Route path="/contact" component={ContactPage} />
        
        {/* Bank Portal Routes */}
        <Route path="/bank/login" component={BankPortalLogin} />
        <Route path="/bank/set-password" component={BankSetPasswordPage} />
        <Route path="/bank/forgot-password" component={BankForgotPasswordPage} />
        <Route path="/bank/reset-password" component={BankResetPasswordPage} />
        <Route path="/bank/account" component={BankAccountPage} />
        <Route path="/bank/companies/:id" component={BankCompanyDetailPage} />
        <Route path="/bank/companies" component={BankCompaniesPage} />
        <Route path="/bank" component={BankPortalLogin} />

        {/* Developer Portal Routes */}
        <Route path="/developers/register" component={DeveloperRegister} />
        <Route path="/developers/login" component={DeveloperLogin} />
        <Route path="/developers/verify-email" component={DeveloperVerifyEmail} />
        <Route path="/developers/dashboard">
          <DevProtectedRoute component={DeveloperDashboard} />
        </Route>
        <Route path="/developers/keys">
          <DevProtectedRoute component={DeveloperKeys} />
        </Route>
        <Route path="/developers/usage">
          <DevProtectedRoute component={DeveloperUsage} />
        </Route>
        <Route path="/developers/docs">
          <DevProtectedRoute component={DeveloperDocs} />
        </Route>
        <Route path="/developers/settings">
          <DevProtectedRoute component={DeveloperSettings} />
        </Route>
        <Route path="/developers" component={DeveloperLanding} />
        <Route path="/admin/developers">
          <ProtectedRoute component={AdminDevelopers} roles={["admin"]} />
        </Route>
        <Route path="/admin/intelligence">
          <ProtectedRoute component={AdminIntelligence} roles={["admin", "cie_analyst"]} />
        </Route>

        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/verify-identity">
          <ProtectedRoute component={VerifyIdentityPage} roles={["founder"]} />
        </Route>
        <Route path="/founder/identity">
          <ProtectedRoute component={VerifyIdentityPage} roles={["founder"]} />
        </Route>
        <Route path="/invite/:token" component={InviteAcceptPage} />
        <Route path="/director-biometric" component={DirectorBiometricPage} />
        <Route path="/director-upload/:token" component={DirectorUploadPage} />
        <Route path="/director-consent/:token" component={DirectorConsentPage} />
        <Route path="/shareholder-confirm/:token" component={ShareholderConfirmPage} />
        <Route path="/corporate-doc-upload/:token" component={CorporateDocUploadPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/verify-email" component={VerifyEmailPage} />
        <Route path="/consent/:token" component={VerifyPage} />
        <Route path="/verify/:token" component={KycSessionPage} />
        <Route path="/kyc/terms" component={KycTermsPage} />
        <Route path="/kyc/orgs">
          <ProtectedRoute component={KycOrgsPage} />
        </Route>
        <Route path="/kyc/org/:id/requests/:reqId">
          <ProtectedRoute component={KycVerificationDetail} />
        </Route>
        <Route path="/kyc/org/:id/verifications">
          <ProtectedRoute component={KycOrgPortal} />
        </Route>
        <Route path="/kyc/org/:id/sessions">
          <ProtectedRoute component={KycOrgPortal} />
        </Route>
        <Route path="/kyc/org/:id/users">
          <ProtectedRoute component={KycOrgPortal} />
        </Route>
        <Route path="/kyc/org/:id/monitoring">
          <ProtectedRoute component={KycOrgPortal} />
        </Route>
        <Route path="/kyc/org/:id/analytics">
          <ProtectedRoute component={KycOrgPortal} />
        </Route>
        <Route path="/kyc/org/:id/developers">
          <ProtectedRoute component={KycOrgPortal} />
        </Route>
        <Route path="/kyc/org/:id/billing">
          <ProtectedRoute component={KycOrgPortal} />
        </Route>
        <Route path="/kyc/org/:id/team">
          <ProtectedRoute component={KycOrgPortal} />
        </Route>
        <Route path="/kyc/org/:id/settings">
          <ProtectedRoute component={KycOrgPortal} />
        </Route>
        <Route path="/kyc/org/:id">
          <ProtectedRoute component={KycOrgPortal} />
        </Route>
        <Route path="/kyc/my-verifications">
          <ProtectedRoute component={KycMyVerifications} />
        </Route>
        <Route path="/kyc/org-invite/:token" component={KycOrgInviteAcceptPage} />
        <Route path="/kyc/verify/:token" component={KycVerifyRequestPage} />
        <Route path="/kyc/session/:token" component={KycSessionPage} />
        <Route path="/kyc/:slug/employees" component={KycEmployeePortalPage} />
        <Route path="/kyc/:slug/suppliers" component={KycSupplierPortalPage} />

        <Route path="/procurement/marketplace">
          <ProtectedRoute component={ProcurementMarketplace} />
        </Route>
        <Route path="/procurement/rfqs/new">
          <ProtectedRoute component={ProcurementCreateRfq} />
        </Route>
        <Route path="/procurement/rfqs/:id">
          <ProtectedRoute component={ProcurementRfqDetail} />
        </Route>
        <Route path="/procurement/my-rfqs">
          <ProtectedRoute component={ProcurementMyRfqs} />
        </Route>
        <Route path="/procurement/rfqs/:rfqId/bid">
          <ProtectedRoute component={ProcurementSubmitBid} />
        </Route>
        <Route path="/procurement/my-bids">
          <ProtectedRoute component={ProcurementMyBids} />
        </Route>
        <Route path="/procurement/bid-templates">
          <ProtectedRoute component={ProcurementBidTemplates} />
        </Route>
        <Route path="/procurement/contracts">
          <ProtectedRoute component={ProcurementMyContracts} />
        </Route>
        <Route path="/procurement/contracts/:id">
          <ProtectedRoute component={ProcurementContractDetail} />
        </Route>
        <Route path="/procurement/invoices">
          <ProtectedRoute component={ProcurementMyInvoices} />
        </Route>
        <Route path="/procurement/contracts/:contractId/invoice/new">
          <ProtectedRoute component={ProcurementCreateInvoice} />
        </Route>
        <Route path="/procurement/invoices/:id">
          <ProtectedRoute component={ProcurementInvoiceDetail} />
        </Route>
        
        <Route path="/payment/checkout">
          <ProtectedRoute component={PaymentCheckoutPage} />
        </Route>
        <Route path="/payment/success">
          <ProtectedRoute component={PaymentSuccessPage} />
        </Route>
        <Route path="/payment/cancel">
          <ProtectedRoute component={PaymentCancelPage} />
        </Route>
        
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
