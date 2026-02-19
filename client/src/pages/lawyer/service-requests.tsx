import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Clock, XCircle, ArrowRight, FileText, User } from "lucide-react";

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" /> Completed</Badge>;
    case "in_progress":
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> In Progress</Badge>;
    case "assigned":
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Assigned</Badge>;
    case "cancelled":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Cancelled</Badge>;
    case "queued":
    default:
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Queued</Badge>;
  }
}

function getServiceLabel(serviceType: string): string {
  const labels: Record<string, string> = {
    SCUML: "SCUML Registration",
    TM: "Trademark Registration",
    TIN: "TIN Registration",
  };
  return labels[serviceType] || serviceType;
}

interface ServiceRequestWithFounder {
  id: number;
  founderId: string;
  orderId: number | null;
  serviceType: string;
  status: string;
  assignedLawyerId: string | null;
  companyProfileId: number | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  founder: {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

export default function LawyerServiceRequestsPage() {
  const { data: requests, isLoading } = useQuery<ServiceRequestWithFounder[]>({
    queryKey: ["/api/lawyer/service-requests"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const assignedRequests = requests?.filter(r => r.assignedLawyerId && ["assigned", "in_progress"].includes(r.status)) || [];
  const queuedRequests = requests?.filter(r => r.status === "queued") || [];
  const completedRequests = requests?.filter(r => ["completed", "cancelled"].includes(r.status)) || [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-service-requests-title">Service Requests</h1>
        <p className="text-muted-foreground mt-1">Manage post-incorporation service requests from founders</p>
      </div>

      {assignedRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Your Active Requests</h2>
          {assignedRequests.map(renderRequestCard)}
        </div>
      )}

      {queuedRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Unassigned Queue</h2>
          {queuedRequests.map(renderRequestCard)}
        </div>
      )}

      {completedRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Completed / Cancelled</h2>
          {completedRequests.map(renderRequestCard)}
        </div>
      )}

      {!requests?.length && (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No service requests yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function renderRequestCard(request: ServiceRequestWithFounder) {
  const founderName = request.founder.firstName && request.founder.lastName
    ? `${request.founder.firstName} ${request.founder.lastName}`
    : request.founder.email || "Unknown";

  return (
    <Link key={request.id} href={`/lawyer/service-requests/${request.id}`}>
      <Card className="hover-elevate cursor-pointer" data-testid={`card-service-request-${request.id}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-md bg-muted flex-shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{getServiceLabel(request.serviceType)}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> {founderName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(request.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {request.companyProfileId ? (
                    <Badge variant="outline" className="text-xs"><CheckCircle2 className="h-3 w-3 mr-1" /> Docs Submitted</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" /> Awaiting Docs</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {getStatusBadge(request.status)}
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
