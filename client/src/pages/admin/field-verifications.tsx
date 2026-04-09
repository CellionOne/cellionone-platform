import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Navigation,
  Camera,
  Building2,
  PenLine,
} from "lucide-react";

interface FieldVerificationJob {
  id: number;
  applicationId: number;
  founderId: string;
  youverifyCandidateId: string | null;
  youverifyReferenceId: string | null;
  status: string;
  verdict: string | null;
  findingsJson: {
    taskStatus?: string;
    gpsCoordinates?: { latitude: number; longitude: number };
    buildingType?: string;
    buildingColor?: string;
    submissionDistanceInMeters?: number;
    agentPhotoUrl?: string;
    agentSignatureUrl?: string;
    summary?: string;
    rawPayload?: Record<string, unknown>;
  } | null;
  adminNotes: string | null;
  adminReviewedAt: string | null;
  adminReviewedBy: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  companyName: string | null;
  founderEmail: string | null;
  // detail view extras
  operatingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
  founderName?: string | null;
}

function statusBadge(status: string, verdict: string | null) {
  if (verdict === "verified") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
  if (verdict === "not_verified") return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"><XCircle className="h-3 w-3 mr-1" />Not Verified</Badge>;
  if (status === "submitted") return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"><Clock className="h-3 w-3 mr-1" />Submitted</Badge>;
  if (status === "agent_assigned") return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"><Navigation className="h-3 w-3 mr-1" />Agent Assigned</Badge>;
  if (status === "failed") return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"><AlertTriangle className="h-3 w-3 mr-1" />Failed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

type StatusFilter = "all" | "submitted" | "agent_assigned" | "completed" | "failed";

export default function AdminFieldVerifications() {
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<FieldVerificationJob | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [overrideVerdict, setOverrideVerdict] = useState<"verified" | "not_verified" | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: jobs, isLoading } = useQuery<FieldVerificationJob[]>({
    queryKey: ["/api/admin/field-verifications"],
  });

  const filteredJobs = jobs?.filter(j => {
    if (statusFilter === "all") return true;
    if (statusFilter === "completed") return j.status === "completed";
    return j.status === statusFilter;
  });

  const { data: jobDetail, isLoading: isDetailLoading } = useQuery<FieldVerificationJob>({
    queryKey: ["/api/admin/field-verifications", selectedJob?.id],
    enabled: !!selectedJob?.id,
  });

  const reviewMutation = useMutation({
    mutationFn: (data: { adminNotes?: string; verdict?: "verified" | "not_verified" }) =>
      apiRequest("PATCH", `/api/admin/field-verifications/${selectedJob!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/field-verifications"] });
      toast({ title: "Review saved", description: "Field verification job updated." });
      setDetailOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save review.", variant: "destructive" });
    },
  });

  function openDetail(job: FieldVerificationJob) {
    setSelectedJob(job);
    setAdminNotes(job.adminNotes || "");
    setOverrideVerdict(null);
    setDetailOpen(true);
  }

  function handleSaveReview() {
    const payload: { adminNotes?: string; verdict?: "verified" | "not_verified" } = {};
    if (adminNotes.trim()) payload.adminNotes = adminNotes.trim();
    if (overrideVerdict) payload.verdict = overrideVerdict;
    reviewMutation.mutate(payload);
  }

  const detail = jobDetail || selectedJob;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="page-title-field-verifications">
            Field Verifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Physical address verification jobs dispatched to Youverify field agents.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                All Jobs
                {jobs && (
                  <Badge variant="outline" className="ml-2">
                    {filteredJobs?.length ?? 0} / {jobs.length}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Filter by status</Label>
                <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="w-44" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="agent_assigned">Agent Assigned</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : !filteredJobs || filteredJobs.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title={statusFilter === "all" ? "No field verification jobs yet" : `No jobs with status "${statusFilter}"`}
                description={statusFilter === "all" ? "Jobs are auto-created when a founder completes payment for incorporation." : "Try changing the filter above."}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Founder</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Youverify Ref</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredJobs.map((job) => (
                      <TableRow key={job.id} data-testid={`row-field-verification-${job.id}`}>
                        <TableCell className="font-mono text-xs">{job.id}</TableCell>
                        <TableCell className="font-medium">
                          {job.companyName || <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {job.founderEmail || "—"}
                        </TableCell>
                        <TableCell>{statusBadge(job.status, job.verdict)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {job.youverifyReferenceId || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{fmtDate(job.submittedAt)}</TableCell>
                        <TableCell className="text-xs">{fmtDate(job.completedAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDetail(job)}
                            data-testid={`button-view-job-${job.id}`}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail / Review Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Field Verification Job #{selectedJob?.id}
            </DialogTitle>
            <DialogDescription>
              Review the agent findings and optionally override the verdict or add notes.
            </DialogDescription>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {/* Status + Verdict */}
              <div className="flex items-center gap-3">
                {statusBadge(detail.status, detail.verdict)}
                {detail.adminReviewedAt && (
                  <span className="text-xs text-muted-foreground">
                    Admin reviewed {fmtDate(detail.adminReviewedAt)}
                  </span>
                )}
              </div>

              {/* Company + Address */}
              <Card className="bg-muted/40">
                <CardContent className="pt-4 space-y-1">
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{detail.companyName || "Unknown Company"}</p>
                      <p className="text-xs text-muted-foreground">{detail.founderEmail}</p>
                    </div>
                  </div>
                  {detail.operatingAddress && (
                    <div className="flex items-start gap-2 mt-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p>{detail.operatingAddress.line1}</p>
                        {detail.operatingAddress.line2 && <p>{detail.operatingAddress.line2}</p>}
                        <p>{detail.operatingAddress.city}, {detail.operatingAddress.state}</p>
                        {detail.operatingAddress.postalCode && <p>{detail.operatingAddress.postalCode}</p>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Youverify Reference */}
              {detail.youverifyReferenceId && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Youverify Ref: </span>
                  <span className="font-mono">{detail.youverifyReferenceId}</span>
                </div>
              )}

              {/* Agent Findings */}
              {detail.findingsJson && (
                <Card className="border-border">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm">Agent Findings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {detail.findingsJson.taskStatus && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Task Status</span>
                        <span className="font-medium">{detail.findingsJson.taskStatus}</span>
                      </div>
                    )}
                    {detail.findingsJson.buildingType && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Building Type</span>
                        <span>{detail.findingsJson.buildingType}</span>
                      </div>
                    )}
                    {detail.findingsJson.buildingColor && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Building Colour</span>
                        <span>{detail.findingsJson.buildingColor}</span>
                      </div>
                    )}
                    {detail.findingsJson.submissionDistanceInMeters != null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Agent Distance</span>
                        <span>{detail.findingsJson.submissionDistanceInMeters} m</span>
                      </div>
                    )}
                    {detail.findingsJson.gpsCoordinates && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Navigation className="h-3 w-3" /> GPS
                        </span>
                        <a
                          href={`https://maps.google.com/?q=${detail.findingsJson.gpsCoordinates.latitude},${detail.findingsJson.gpsCoordinates.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline underline-offset-2 font-mono text-xs"
                          data-testid="link-gps-coordinates"
                        >
                          {detail.findingsJson.gpsCoordinates.latitude.toFixed(5)}, {detail.findingsJson.gpsCoordinates.longitude.toFixed(5)}
                        </a>
                      </div>
                    )}
                    {detail.findingsJson.agentPhotoUrl && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Camera className="h-3 w-3" /> Agent Photo</p>
                        <img
                          src={detail.findingsJson.agentPhotoUrl}
                          alt="Agent photo"
                          className="rounded-md max-h-48 object-cover border border-border"
                          data-testid="img-agent-photo"
                        />
                      </div>
                    )}
                    {detail.findingsJson.agentSignatureUrl && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><PenLine className="h-3 w-3" /> Agent Signature</p>
                        <img
                          src={detail.findingsJson.agentSignatureUrl}
                          alt="Agent signature"
                          className="rounded-md max-h-24 object-contain border border-border bg-white"
                          data-testid="img-agent-signature"
                        />
                      </div>
                    )}
                    {detail.findingsJson.summary && (
                      <div className="text-sm">
                        <span className="text-muted-foreground block mb-1">Summary</span>
                        <p className="bg-muted/50 rounded p-2 text-sm">{detail.findingsJson.summary}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Admin Notes */}
              <div className="space-y-1">
                <Label htmlFor="admin-notes" className="text-sm font-medium">Admin Notes</Label>
                <Textarea
                  id="admin-notes"
                  data-testid="textarea-admin-notes"
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes about this verification…"
                  rows={3}
                />
              </div>

              {/* Override Verdict */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Override Verdict</Label>
                <p className="text-xs text-muted-foreground">
                  Only use this to manually correct an agent's verdict after independent review.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant={overrideVerdict === "verified" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOverrideVerdict(v => v === "verified" ? null : "verified")}
                    className={overrideVerdict === "verified" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                    data-testid="button-override-verified"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Mark Verified
                  </Button>
                  <Button
                    variant={overrideVerdict === "not_verified" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOverrideVerdict(v => v === "not_verified" ? null : "not_verified")}
                    className={overrideVerdict === "not_verified" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                    data-testid="button-override-not-verified"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Mark Not Verified
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)} data-testid="button-cancel-review">
              Cancel
            </Button>
            <Button
              onClick={handleSaveReview}
              disabled={reviewMutation.isPending || (!adminNotes.trim() && !overrideVerdict)}
              data-testid="button-save-review"
            >
              {reviewMutation.isPending ? <LoadingSpinner className="h-4 w-4 mr-2" /> : null}
              Save Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
