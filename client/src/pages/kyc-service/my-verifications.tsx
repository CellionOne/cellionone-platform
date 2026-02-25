import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ShieldCheck, Clock, CheckCircle, AlertTriangle, ExternalLink, User, Building2, FileText } from "lucide-react";

function getStatusBadge(status: string) {
  switch (status) {
    case "pending_invite":
    case "pending_payment":
      return <Badge variant="outline" data-testid={`badge-status-${status}`}><Clock className="h-3 w-3 mr-1" />{status.replace("_", " ")}</Badge>;
    case "in_progress":
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200" data-testid="badge-status-in-progress"><FileText className="h-3 w-3 mr-1" />In Progress</Badge>;
    case "under_review":
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200" data-testid="badge-status-under-review"><Clock className="h-3 w-3 mr-1" />Under Review</Badge>;
    case "verified":
      return <Badge className="bg-green-500/10 text-green-600 border-green-200" data-testid="badge-status-verified"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>;
    case "rejected":
      return <Badge variant="destructive" data-testid="badge-status-rejected"><AlertTriangle className="h-3 w-3 mr-1" />Rejected</Badge>;
    case "expired":
      return <Badge variant="secondary" data-testid="badge-status-expired">Expired</Badge>;
    default:
      return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
  }
}

function getTypeBadge(type: string) {
  if (type === "individual") {
    return <Badge variant="outline" className="gap-1" data-testid="badge-type-individual"><User className="h-3 w-3" />Individual</Badge>;
  }
  return <Badge variant="outline" className="gap-1" data-testid="badge-type-supplier"><Building2 className="h-3 w-3" />Supplier</Badge>;
}

interface VerificationRequest {
  id: number;
  orgId: number;
  type: string;
  status: string;
  subjectName: string;
  subjectEmail: string;
  paymentStatus: string;
  paymentResponsibility: string;
  inviteToken: string;
  riskScore: string | null;
  createdAt: string;
  updatedAt: string;
  orgName: string | null;
}

export default function MyVerificationsPage() {
  const { user } = useAuth();
  const role = user?.roles?.includes("admin") ? "admin" : user?.roles?.includes("lawyer") ? "lawyer" : "founder";

  const { data: verifications, isLoading } = useQuery<VerificationRequest[]>({
    queryKey: ["/api/kyc-service/my-verifications"],
  });

  return (
    <DashboardLayout role={role} pageTitle="My Verifications">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">My Verifications</h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-description">
            Track verification requests where you are the subject
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4" data-testid="loading-skeleton">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : !verifications || verifications.length === 0 ? (
          <Card data-testid="card-empty-state">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ShieldCheck className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No verification requests yet</h3>
              <p className="text-muted-foreground max-w-md">
                When an organisation sends you a verification request, it will appear here. You can track all your verifications in one place.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {verifications.map(v => (
              <Card key={v.id} className="hover:border-primary/30 transition-colors" data-testid={`card-verification-${v.id}`}>
                <CardContent className="flex items-center justify-between p-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold" data-testid={`text-org-name-${v.id}`}>{v.orgName || "Unknown Organisation"}</h3>
                      {getTypeBadge(v.type)}
                      {getStatusBadge(v.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span data-testid={`text-subject-${v.id}`}>{v.subjectName}</span>
                      <span>•</span>
                      <span data-testid={`text-date-${v.id}`}>
                        {new Date(v.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {v.paymentResponsibility === "subject" && v.paymentStatus !== "paid" && (
                        <>
                          <span>•</span>
                          <Badge variant="destructive" className="text-xs" data-testid={`badge-payment-${v.id}`}>Payment Required</Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <Link href={`/kyc/verify/${v.inviteToken}`}>
                    <Button variant="outline" size="sm" className="gap-1" data-testid={`button-view-${v.id}`}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      View
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}