import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  CreditCard,
  Eye,
  Loader2,
} from "lucide-react";

interface CompanyProfile {
  id: number;
  companyName: string | null;
  rcNumber: string | null;
  isExistingCompany: boolean;
  existingCompanyStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  directors: { name: string; role: string }[] | null;
}

function statusConfig(status: string | null) {
  switch (status) {
    case "draft":
      return { label: "Draft", variant: "secondary" as const, icon: Clock, description: "Not yet submitted for payment" };
    case "pending_payment":
      return { label: "Pending Payment", variant: "outline" as const, icon: CreditCard, description: "Awaiting payment to begin verification" };
    case "pending_review":
      return { label: "Verifying…", variant: "outline" as const, icon: Loader2, description: "Payment received — automated verification running. This page will update automatically." };
    case "under_review":
      return { label: "Under Review", variant: "outline" as const, icon: AlertCircle, description: "Verification flagged — admin is reviewing" };
    case "verified":
      return { label: "Verified", variant: "default" as const, icon: CheckCircle2, description: "Company fully verified" };
    case "rejected":
      return { label: "Rejected", variant: "destructive" as const, icon: XCircle, description: "Verification was unsuccessful" };
    default:
      return { label: status || "Unknown", variant: "secondary" as const, icon: Clock, description: "" };
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function RegistrationsPage() {
  const [, navigate] = useLocation();

  const { data: allProfiles, isLoading } = useQuery<CompanyProfile[]>({
    queryKey: ["/api/founder/company-profiles"],
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasPending = Array.isArray(data) && data.some(p => p.existingCompanyStatus === "pending_review");
      return hasPending ? 4000 : false;
    },
  });

  const profiles = (allProfiles || []).filter(p => p.isExistingCompany);

  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[
        { label: "Dashboard", href: "/founder/dashboard" },
        { label: "My Registrations" },
      ]}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">My Registrations</h1>
              <p className="text-sm text-muted-foreground">Track your existing company registrations</p>
            </div>
          </div>
          <Button onClick={() => navigate("/founder/existing-company")} data-testid="button-new-registration">
            <Plus className="h-4 w-4 mr-1.5" />
            New Registration
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No registrations yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Bring your already-incorporated Nigerian company onto Cellion One to access banking services, legal tools, and verified company profiles.
              </p>
              <Button onClick={() => navigate("/founder/existing-company")} data-testid="button-start-registration">
                <Plus className="h-4 w-4 mr-1.5" />
                Register an Existing Company
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {profiles.map(profile => {
              const cfg = statusConfig(profile.existingCompanyStatus);
              const StatusIcon = cfg.icon;
              const isResumable = profile.existingCompanyStatus === "draft" || profile.existingCompanyStatus === "pending_payment";
              const isViewable = !isResumable;

              return (
                <Card key={profile.id} data-testid={`card-registration-${profile.id}`} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm" data-testid={`text-company-name-${profile.id}`}>
                            {profile.companyName || "Unnamed Company"}
                          </h3>
                          <Badge variant={cfg.variant} className="text-xs" data-testid={`badge-status-${profile.id}`}>
                            <StatusIcon className={`h-3 w-3 mr-1 ${profile.existingCompanyStatus === "pending_review" ? "animate-spin" : ""}`} />
                            {cfg.label}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          {profile.rcNumber && (
                            <span data-testid={`text-rc-${profile.id}`}>RC: {profile.rcNumber}</span>
                          )}
                          <span>Started: {formatDate(profile.createdAt)}</span>
                          {profile.directors && Array.isArray(profile.directors) && profile.directors.length > 0 && (
                            <span>{profile.directors.length} director{profile.directors.length !== 1 ? "s" : ""}</span>
                          )}
                        </div>

                        {cfg.description && (
                          <p className="text-xs text-muted-foreground mt-1">{cfg.description}</p>
                        )}
                      </div>

                      <div className="flex gap-2 shrink-0">
                        {isResumable && (
                          <>
                            {profile.existingCompanyStatus === "pending_payment" && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => navigate(`/founder/existing-company?profileId=${profile.id}&step=5`)}
                                data-testid={`button-pay-${profile.id}`}
                              >
                                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                                Pay Now
                              </Button>
                            )}
                            {profile.existingCompanyStatus === "draft" && (
                              <Button
                                size="sm"
                                onClick={() => navigate(`/founder/existing-company?profileId=${profile.id}&step=4`)}
                                data-testid={`button-resume-${profile.id}`}
                              >
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                Resume
                              </Button>
                            )}
                          </>
                        )}
                        {isViewable && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate("/founder/company-profile")}
                            data-testid={`button-view-${profile.id}`}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {profiles.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              If you need help with any registration, contact{" "}
              <a href="mailto:support@cellionone.com" className="underline text-primary">support@cellionone.com</a>.
              Include your company name and RC number.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </DashboardLayout>
  );
}
