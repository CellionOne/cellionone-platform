import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { LoadingPage } from "@/components/loading-spinner";

import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import FounderDashboard from "@/pages/founder/dashboard";
import FounderIdentity from "@/pages/founder/identity";
import FounderApplications from "@/pages/founder/applications";
import FounderVault from "@/pages/founder/vault";
import FounderRegisteredOffice from "@/pages/founder/registered-office";
import FounderMail from "@/pages/founder/mail";
import FounderLegalAssistant from "@/pages/founder/legal-assistant";
import FounderCompanyProfile from "@/pages/founder/company-profile";
import FounderPostIncChecklist from "@/pages/founder/post-inc-checklist";
import FounderComplianceCalendar from "@/pages/founder/compliance-calendar";
import FounderCheckout from "@/pages/founder/checkout";
import FounderServiceRequestForm from "@/pages/founder/service-request-form";
import FounderAddDirectorForm from "@/pages/founder/add-director-form";
import FounderOrders from "@/pages/founder/orders";
import FounderOrderDetail from "@/pages/founder/order-detail";
import NewApplication from "@/pages/applications/new";
import ApplicationDetails from "@/pages/applications/[id]";
import LawyerDashboard from "@/pages/lawyer/dashboard";
import LawyerApplications from "@/pages/lawyer/applications";
import LawyerApplicationDetail from "@/pages/lawyer/application-detail";
import LawyerPayouts from "@/pages/lawyer/payouts";
import LawyerServiceRequests from "@/pages/lawyer/service-requests";
import LawyerServiceRequestDetail from "@/pages/lawyer/service-request-detail";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminApplications from "@/pages/admin/applications";
import AdminFeatureFlags from "@/pages/admin/feature-flags";
import AdminAuditLogs from "@/pages/admin/audit-logs";
import AdminAIEvents from "@/pages/admin/ai-events";
import AdminReceipts from "@/pages/admin/receipts";
import AdminLawyerApplications from "@/pages/admin/lawyer-applications";
import AdminMailroom from "@/pages/admin/mailroom";
import AdminOrders from "@/pages/admin/orders";
import AdminKycOverview from "@/pages/admin/kyc-overview";
import AdminProposals from "@/pages/admin/proposals";
import AdminRegisteredOffices from "@/pages/admin/registered-offices";
import AdminSecurity from "@/pages/admin/security";
import AdminEscrowDashboard from "@/pages/admin/escrow-dashboard";
import AdminBankingPartners from "@/pages/admin/banking-partners";
import AdminCieCockpit from "@/pages/admin/cie";
import CiePortal from "@/pages/cie/index";
import CieSubscribeSuccess from "@/pages/cie/subscribe-success";
import CieIntelligencePage from "@/pages/cie-intelligence";
import PlatformOverview from "@/pages/platform-overview";
import WhyCellionOne from "@/pages/why-cellion-one";
import ApiDocsPage from "@/pages/api-docs";
import ApplyLawyerPage from "@/pages/apply-lawyer";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import PartnerWithUsPage from "@/pages/partner-with-us";
import ContactPage from "@/pages/contact";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import ResetPasswordPage from "@/pages/auth/reset-password";
import VerifyEmailPage from "@/pages/auth/verify-email";
import SettingsPage from "@/pages/settings";
import PersonalProfilePage from "@/pages/personal-profile";
import CompanyPeoplePage from "@/pages/founder/company-people";
import FounderDataSharing from "@/pages/founder/data-sharing";
import VerifyPage from "@/pages/verify";
import InviteAcceptPage from "@/pages/invite-accept";
import NotificationsPage from "@/pages/notifications";
import PaymentCheckoutPage from "@/pages/payment/checkout";
import PaymentSuccessPage from "@/pages/payment/success";
import PaymentCancelPage from "@/pages/payment/cancel";
import KycTermsPage from "@/pages/kyc-service/terms";
import KycOrgsPage from "@/pages/kyc-service/orgs";
import KycOrgPortal from "@/pages/kyc-service/org-portal";
import KycVerificationDetail from "@/pages/kyc-service/verification-detail";
import KycVerifyRequestPage from "@/pages/kyc-service/verify-request";
import KycEmployeePortalPage from "@/pages/kyc-service/employee-portal";
import KycSupplierPortalPage from "@/pages/kyc-service/supplier-portal";
import KycOrgInviteAcceptPage from "@/pages/kyc-service/org-invite-accept";
import KycMyVerifications from "@/pages/kyc-service/my-verifications";
import KycSessionPage from "@/pages/kyc-service/kyc-session";
import ProcurementMarketplace from "@/pages/procurement/marketplace";
import ProcurementCreateRfq from "@/pages/procurement/create-rfq";
import ProcurementRfqDetail from "@/pages/procurement/rfq-detail";
import ProcurementMyRfqs from "@/pages/procurement/my-rfqs";
import ProcurementSubmitBid from "@/pages/procurement/submit-bid";
import ProcurementMyBids from "@/pages/procurement/my-bids";
import ProcurementBidTemplates from "@/pages/procurement/bid-templates";
import ProcurementMyContracts from "@/pages/procurement/my-contracts";
import ProcurementContractDetail from "@/pages/procurement/contract-detail";
import ProcurementMyInvoices from "@/pages/procurement/my-invoices";
import ProcurementCreateInvoice from "@/pages/procurement/create-invoice";
import ProcurementInvoiceDetail from "@/pages/procurement/invoice-detail";
import BuildingManagerDashboard from "@/pages/building-manager/dashboard";
import BuildingManagerUtilityBill from "@/pages/building-manager/utility-bill";
import BuildingManagerSubscribers from "@/pages/building-manager/subscribers";
import BuildingManagerMailIntake from "@/pages/building-manager/mail-intake";
import WelcomePage from "@/pages/welcome";
import ExistingCompanyPage from "@/pages/founder/existing-company";

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
      <Route path="/founder/dashboard">
        <ProtectedRoute component={FounderDashboard} />
      </Route>
      <Route path="/founder/identity">
        <ProtectedRoute component={FounderIdentity} />
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
        <ProtectedRoute component={AdminCieCockpit} roles={["admin"]} />
      </Route>

      <Route path="/cie/subscribe/success">
        <ProtectedRoute component={CieSubscribeSuccess} />
      </Route>
      <Route path="/cie">
        <ProtectedRoute component={CiePortal} />
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
      
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/invite/:token" component={InviteAcceptPage} />
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
