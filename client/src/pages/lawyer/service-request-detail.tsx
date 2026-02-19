import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Loader2, ArrowLeft, CheckCircle2, Clock, XCircle, FileText,
  User, Building2, Download,
} from "lucide-react";
import { useState } from "react";

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

export default function LawyerServiceRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const srId = params.id;
  const { toast } = useToast();
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery<{
    serviceRequest: {
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
    };
    profile: {
      id: number;
      registeredName: string;
      incorporationNumber: string;
      category: string;
      cacRegistrationType: string;
      sector: string | null;
      mainBusinessObjectives: string | null;
      dateIncorporated: string | null;
      tinNumber: string | null;
      headOfficeAddress: string | null;
      state: string | null;
      bankName: string | null;
      accountNumber: string | null;
      accountName: string | null;
      organizationPhone: string | null;
      organizationEmail: string | null;
      contactPersonName: string | null;
      contactPersonNin: string | null;
      contactPersonAddress: string | null;
      contactPersonEmail: string | null;
      contactPersonMobile: string | null;
    } | null;
    documents: Array<{
      id: number;
      docType: string;
      filename: string;
      storagePath: string;
      sizeBytes: number | null;
      mimeType: string | null;
    }>;
    founder: {
      email: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  }>({
    queryKey: ["/api/lawyer/service-requests", srId],
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, notes: n }: { status: string; notes?: string }) => {
      const res = await apiRequest("PUT", `/api/lawyer/service-requests/${srId}/status`, { status, notes: n });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lawyer/service-requests", srId] });
      queryClient.invalidateQueries({ queryKey: ["/api/lawyer/service-requests"] });
      toast({ title: "Status updated", description: "Service request status has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Service request not found.</p>
            <Link href="/lawyer/service-requests">
              <Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { serviceRequest: sr, profile, documents, founder } = data;
  const founderName = founder.firstName && founder.lastName
    ? `${founder.firstName} ${founder.lastName}`
    : founder.email || "Unknown";

  const docTypeLabels: Record<string, string> = {
    certificate_of_incorporation: "Certificate of Incorporation",
    memart: "MEMART",
    status_report: "Status Report",
    tin_printout: "TIN Printout",
    proof_of_address: "Proof of Address",
    additional_certificate: "Additional Certificate",
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/lawyer/service-requests">
          <Button variant="ghost" size="sm" data-testid="button-back-requests">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold" data-testid="text-sr-title">{getServiceLabel(sr.serviceType)}</h1>
        {getStatusBadge(sr.status)}
      </div>

      <Card data-testid="card-founder-info">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Founder Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{founderName}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{founder.email || "N/A"}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Order</span>
            <span className="text-sm font-medium">#{sr.orderId}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Submitted</span>
            <span className="text-sm font-medium">
              {new Date(sr.createdAt).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>
        </CardContent>
      </Card>

      {profile ? (
        <Card data-testid="card-company-profile">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Company Profile
            </CardTitle>
            <CardDescription>{profile.registeredName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              ["Registration Type", profile.cacRegistrationType],
              ["Incorporation No.", profile.incorporationNumber],
              ["Category", profile.category],
              ["Sector", profile.sector],
              ["Date Incorporated", profile.dateIncorporated],
              ["TIN", profile.tinNumber],
              ["Head Office", profile.headOfficeAddress],
              ["State", profile.state],
              ["Bank", profile.bankName ? `${profile.bankName} - ${profile.accountNumber} (${profile.accountName})` : null],
              ["Org Phone", profile.organizationPhone],
              ["Org Email", profile.organizationEmail],
            ].filter(([, val]) => val).map(([label, val]) => (
              <div key={label as string} className="flex items-start justify-between gap-4">
                <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
                <span className="text-sm font-medium text-right">{val}</span>
              </div>
            ))}
            {profile.contactPersonName && (
              <>
                <Separator />
                <p className="text-sm font-medium">Contact Person</p>
                {[
                  ["Name", profile.contactPersonName],
                  ["NIN", profile.contactPersonNin],
                  ["Email", profile.contactPersonEmail],
                  ["Phone", profile.contactPersonMobile],
                  ["Address", profile.contactPersonAddress],
                ].filter(([, val]) => val).map(([label, val]) => (
                  <div key={label as string} className="flex items-start justify-between gap-4">
                    <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
                    <span className="text-sm font-medium text-right">{val}</span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Founder has not submitted company details yet.</p>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-documents">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Documents
          </CardTitle>
          <CardDescription>
            {documents.length > 0
              ? `${documents.length} document${documents.length > 1 ? "s" : ""} uploaded`
              : "No documents uploaded yet"}
          </CardDescription>
        </CardHeader>
        {documents.length > 0 && (
          <CardContent className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border"
                data-testid={`doc-${doc.id}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {docTypeLabels[doc.docType] || doc.docType}
                    {doc.sizeBytes && ` \u00B7 ${(doc.sizeBytes / 1024).toFixed(0)} KB`}
                  </p>
                </div>
                <a href={`/api/founder/service-profiles/${profile?.id}/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">
                  <Button size="icon" variant="ghost" data-testid={`button-download-doc-${doc.id}`}>
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      <Card data-testid="card-actions">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Update the status of this service request</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sr.notes && (
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{sr.notes}</p>
            </div>
          )}

          <Textarea
            placeholder="Add notes (optional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="resize-none"
            data-testid="input-notes"
          />

          <div className="flex items-center gap-3 flex-wrap">
            {sr.status === "queued" && (
              <Button
                onClick={() => statusMutation.mutate({ status: "assigned", notes: notes || undefined })}
                disabled={statusMutation.isPending}
                data-testid="button-accept-request"
              >
                {statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Accept Request
              </Button>
            )}
            {["queued", "assigned"].includes(sr.status) && (
              <Button
                onClick={() => statusMutation.mutate({ status: "in_progress", notes: notes || undefined })}
                disabled={statusMutation.isPending}
                data-testid="button-start-work"
              >
                {statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Start Working
              </Button>
            )}
            {["assigned", "in_progress"].includes(sr.status) && (
              <Button
                variant="default"
                onClick={() => statusMutation.mutate({ status: "completed", notes: notes || undefined })}
                disabled={statusMutation.isPending}
                data-testid="button-mark-completed"
              >
                {statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                <CheckCircle2 className="h-4 w-4 mr-1" /> Mark as Completed
              </Button>
            )}
            {!["completed", "cancelled"].includes(sr.status) && (
              <Button
                variant="destructive"
                onClick={() => statusMutation.mutate({ status: "cancelled", notes: notes || undefined })}
                disabled={statusMutation.isPending}
                data-testid="button-cancel-request"
              >
                Cancel Request
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
