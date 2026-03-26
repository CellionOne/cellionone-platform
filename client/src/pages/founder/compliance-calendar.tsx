import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  Building2,
} from "lucide-react";
import type { ComplianceDeadline, CompanyProfile } from "@shared/schema";
import { Link } from "wouter";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  overdue: { label: "Overdue", variant: "destructive" },
  due_soon: { label: "Due Soon", variant: "outline", className: "border-amber-500 text-amber-700 dark:text-amber-400" },
  upcoming: { label: "Upcoming", variant: "outline", className: "border-blue-500 text-blue-700 dark:text-blue-400" },
  completed: { label: "Completed", variant: "secondary", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
};

const RECURRENCE_LABELS: Record<string, string> = {
  yearly: "Yearly",
  quarterly: "Quarterly",
  monthly: "Monthly",
};

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDaysInfo(dueDate: string | Date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""} overdue`, isOverdue: true };
  } else if (diffDays === 0) {
    return { text: "Due today", isOverdue: false };
  } else {
    return { text: `${diffDays} day${diffDays !== 1 ? "s" : ""} remaining`, isOverdue: false };
  }
}

function DeadlineCard({ deadline, profileId }: { deadline: ComplianceDeadline; profileId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completionNotes, setCompletionNotes] = useState("");
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      const res = await apiRequest("PUT", `/api/founder/company-profiles/${profileId}/compliance/${deadline.id}`, { status, notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles", profileId, "compliance"] });
      toast({ title: "Deadline updated", description: "Compliance deadline has been updated." });
      setShowCompleteDialog(false);
      setCompletionNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const statusConfig = STATUS_CONFIG[deadline.status || "upcoming"] || STATUS_CONFIG.upcoming;
  const daysInfo = getDaysInfo(deadline.dueDate);
  const isCompleted = deadline.status === "completed";

  return (
    <>
      <Card
        className={isCompleted ? "opacity-60" : ""}
        data-testid={`card-deadline-${deadline.id}`}
      >
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={statusConfig.variant}
                  className={statusConfig.className}
                  data-testid={`badge-status-${deadline.id}`}
                >
                  {statusConfig.label}
                </Badge>
                {deadline.recurrenceRule && (
                  <Badge variant="outline" data-testid={`badge-recurrence-${deadline.id}`}>
                    {RECURRENCE_LABELS[deadline.recurrenceRule] || deadline.recurrenceRule}
                  </Badge>
                )}
              </div>
              {!isCompleted && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCompleteDialog(true)}
                  data-testid={`button-complete-${deadline.id}`}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Mark Complete
                </Button>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-sm" data-testid={`text-title-${deadline.id}`}>
                {deadline.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1" data-testid={`text-description-${deadline.id}`}>
                {deadline.description}
              </p>
            </div>

            <div className="flex items-center gap-4 flex-wrap text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span data-testid={`text-due-date-${deadline.id}`}>{formatDate(deadline.dueDate)}</span>
              </div>
              {!isCompleted && (
                <span
                  className={daysInfo.isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}
                  data-testid={`text-days-info-${deadline.id}`}
                >
                  {daysInfo.text}
                </span>
              )}
              {isCompleted && deadline.completedAt && (
                <span className="text-muted-foreground" data-testid={`text-completed-date-${deadline.id}`}>
                  Completed {formatDate(deadline.completedAt)}
                </span>
              )}
            </div>

            {deadline.notes && (
              <p className="text-sm text-muted-foreground italic" data-testid={`text-notes-${deadline.id}`}>
                Notes: {deadline.notes}
              </p>
            )}

            {deadline.penaltyInfo && (
              <div>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-sm text-muted-foreground"
                  data-testid={`button-toggle-penalty-${deadline.id}`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span>Penalty Information</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded && (
                  <p
                    className="mt-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md"
                    data-testid={`text-penalty-info-${deadline.id}`}
                  >
                    {deadline.penaltyInfo}
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent data-testid="dialog-complete-deadline">
          <DialogHeader>
            <DialogTitle>Mark Deadline as Complete</DialogTitle>
            <DialogDescription>
              Mark &quot;{deadline.title}&quot; as completed. You can add optional notes below.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Add optional notes about this completion..."
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
            data-testid="input-completion-notes"
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCompleteDialog(false)}
              data-testid="button-cancel-complete"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate({ status: "completed", notes: completionNotes || undefined })}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-complete"
            >
              {updateMutation.isPending ? <LoadingSpinner size="sm" /> : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ComplianceCalendarPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const profileIdParam = params.get("profileId");
  const { toast } = useToast();

  const { data: profiles, isLoading: profilesLoading } = useQuery<CompanyProfile[]>({
    queryKey: ["/api/founder/company-profiles"],
  });

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(profileIdParam);

  const effectiveProfileId = selectedProfileId || (profiles?.length === 1 ? String(profiles[0].id) : null);

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<ComplianceDeadline[]>({
    queryKey: ["/api/founder/company-profiles", effectiveProfileId, "compliance"],
    enabled: !!effectiveProfileId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/founder/company-profiles/${effectiveProfileId}/compliance/generate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles", effectiveProfileId, "compliance"] });
      toast({ title: "Deadlines generated", description: "Compliance deadlines have been created for your company." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const selectedProfile = profiles?.find((p) => String(p.id) === effectiveProfileId);

  const overdue = deadlines?.filter((d) => d.status === "overdue") || [];
  const dueSoon = deadlines?.filter((d) => d.status === "due_soon") || [];
  const upcoming = deadlines?.filter((d) => d.status === "upcoming") || [];
  const completed = deadlines?.filter((d) => d.status === "completed") || [];

  if (profilesLoading) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "Compliance Calendar" }]}>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profiles?.length) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "Compliance Calendar" }]}>
        <EmptyState
          icon={Calendar}
          title="No company profiles found"
          description="Compliance deadlines will appear once your company profile is created from a completed application."
        />
        <div className="flex justify-center mt-4">
          <Link href="/founder/applications">
            <Button data-testid="link-create-profile">View Applications</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Compliance Calendar" }]}>
      <div className="space-y-6" data-testid="compliance-calendar-page">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Compliance Calendar</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track regulatory deadlines and filing requirements
            </p>
          </div>
        </div>

        {profiles.length > 1 && (
          <div className="max-w-xs" data-testid="profile-selector">
            <Select
              value={effectiveProfileId || ""}
              onValueChange={(value) => setSelectedProfileId(value)}
            >
              <SelectTrigger data-testid="select-profile-trigger">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={String(profile.id)} data-testid={`select-profile-${profile.id}`}>
                    {profile.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!effectiveProfileId && profiles.length > 1 && (
          <EmptyState
            icon={Building2}
            title="Select a company"
            description="Choose a company profile to view its compliance deadlines."
          />
        )}

        {effectiveProfileId && deadlinesLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {effectiveProfileId && !deadlinesLoading && selectedProfile && !selectedProfile.incorporationDate && (!deadlines || deadlines.length === 0) && (
          <Card data-testid="card-missing-inc-date">
            <CardContent className="flex flex-col items-center justify-center py-10 gap-4 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/40" />
              <div>
                <h3 className="font-semibold">Incorporation date needed</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Your compliance deadlines are calculated from your incorporation date. Please add it to your company profile first.
                </p>
              </div>
              <Link href="/founder/company-profile">
                <Button variant="outline" data-testid="link-add-inc-date">
                  <Building2 className="h-4 w-4 mr-2" />
                  Update Company Profile
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {effectiveProfileId && !deadlinesLoading && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="summary-cards">
              <Card data-testid="card-summary-upcoming">
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
                  <Clock className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="count-upcoming">{upcoming.length}</div>
                </CardContent>
              </Card>
              <Card data-testid="card-summary-due-soon">
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Due Soon</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="count-due-soon">{dueSoon.length}</div>
                </CardContent>
              </Card>
              <Card data-testid="card-summary-overdue">
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive" data-testid="count-overdue">{overdue.length}</div>
                </CardContent>
              </Card>
              <Card data-testid="card-summary-completed">
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="count-completed">{completed.length}</div>
                </CardContent>
              </Card>
            </div>

            {(!deadlines || deadlines.length === 0) && (
              <Card data-testid="card-generate-deadlines">
                <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                  <Calendar className="h-12 w-12 text-muted-foreground" />
                  <div className="text-center">
                    <h3 className="font-semibold">No compliance deadlines</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Generate compliance deadlines based on your company&apos;s incorporation date.
                    </p>
                  </div>
                  <Button
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                    data-testid="button-generate-deadlines"
                  >
                    {generateMutation.isPending ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Generate Deadlines
                  </Button>
                </CardContent>
              </Card>
            )}

            {deadlines && deadlines.length > 0 && (
              <ScrollArea className="h-auto">
                <div className="space-y-6">
                  {overdue.length > 0 && (
                    <div data-testid="section-overdue">
                      <h2 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Overdue ({overdue.length})
                      </h2>
                      <div className="space-y-3">
                        {overdue.map((d) => (
                          <DeadlineCard key={d.id} deadline={d} profileId={effectiveProfileId} />
                        ))}
                      </div>
                    </div>
                  )}

                  {dueSoon.length > 0 && (
                    <div data-testid="section-due-soon">
                      <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Due Soon ({dueSoon.length})
                      </h2>
                      <div className="space-y-3">
                        {dueSoon.map((d) => (
                          <DeadlineCard key={d.id} deadline={d} profileId={effectiveProfileId} />
                        ))}
                      </div>
                    </div>
                  )}

                  {upcoming.length > 0 && (
                    <div data-testid="section-upcoming">
                      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Upcoming ({upcoming.length})
                      </h2>
                      <div className="space-y-3">
                        {upcoming.map((d) => (
                          <DeadlineCard key={d.id} deadline={d} profileId={effectiveProfileId} />
                        ))}
                      </div>
                    </div>
                  )}

                  {completed.length > 0 && (
                    <div data-testid="section-completed">
                      <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Completed ({completed.length})
                      </h2>
                      <div className="space-y-3">
                        {completed.map((d) => (
                          <DeadlineCard key={d.id} deadline={d} profileId={effectiveProfileId} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
