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
import NewApplication from "@/pages/applications/new";
import ApplicationDetails from "@/pages/applications/[id]";
import LawyerDashboard from "@/pages/lawyer/dashboard";
import LawyerApplications from "@/pages/lawyer/applications";
import LawyerApplicationDetail from "@/pages/lawyer/application-detail";
import LawyerPayouts from "@/pages/lawyer/payouts";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminApplications from "@/pages/admin/applications";
import AdminFeatureFlags from "@/pages/admin/feature-flags";
import AdminAuditLogs from "@/pages/admin/audit-logs";
import AdminAIEvents from "@/pages/admin/ai-events";
import AdminReceipts from "@/pages/admin/receipts";
import AdminLawyerApplications from "@/pages/admin/lawyer-applications";
import ApplyLawyerPage from "@/pages/apply-lawyer";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import ResetPasswordPage from "@/pages/auth/reset-password";
import VerifyEmailPage from "@/pages/auth/verify-email";

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
  
  // Check role-based access
  if (roles && roles.length > 0) {
    const userRoles = user?.roles || [];
    const hasRequiredRole = roles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      // Redirect to appropriate dashboard based on user role
      if (userRoles.includes("admin")) {
        window.location.href = "/admin/dashboard";
      } else if (userRoles.includes("lawyer")) {
        window.location.href = "/lawyer/dashboard";
      } else {
        window.location.href = "/founder/dashboard";
      }
      return <LoadingPage />;
    }
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
  } else if (roles.includes("founder")) {
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
      <Route path="/admin/lawyer-applications">
        <ProtectedRoute component={AdminLawyerApplications} roles={["admin"]} />
      </Route>
      
      <Route path="/apply-lawyer" component={ApplyLawyerPage} />
      
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      
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
