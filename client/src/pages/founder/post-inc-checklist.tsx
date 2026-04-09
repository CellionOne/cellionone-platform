import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  CheckCircle2,
  Circle,
  Clock,
  SkipForward,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Building2,
  Lightbulb,
  Landmark,
  ExternalLink,
} from "lucide-react";
import type { PostIncorporationTask, CompanyProfile } from "@shared/schema";
import { Link } from "wouter";

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Circle; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  not_started: { label: "Not Started", icon: Circle, variant: "outline" },
  in_progress: { label: "In Progress", icon: Clock, variant: "default" },
  completed: { label: "Completed", icon: CheckCircle2, variant: "secondary" },
  skipped: { label: "Skipped", icon: SkipForward, variant: "outline" },
};

export default function PostIncChecklistPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const profileId = params.get("profileId");
  const { toast } = useToast();

  const { data: profiles, isLoading: profilesLoading } = useQuery<CompanyProfile[]>({
    queryKey: ["/api/founder/company-profiles"],
  });

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(profileId);

  const effectiveProfileId = selectedProfileId || (profiles?.length === 1 ? String(profiles[0].id) : null);

  const { data: tasks, isLoading: tasksLoading } = useQuery<PostIncorporationTask[]>({
    queryKey: ["/api/founder/company-profiles", effectiveProfileId, "checklist"],
    enabled: !!effectiveProfileId,
    retry: (failCount, err: any) => {
      // Don't retry 403s — they mean the company isn't verified yet (gated server-side)
      if (err?.message?.startsWith("403:")) return false;
      return failCount < 2;
    },
  });

  const selectedProfile = profiles?.find(p => String(p.id) === effectiveProfileId);

  // Is this a verified existing company? Surface BANK_ACCOUNT option when yes.
  const isVerifiedExisting = selectedProfile?.isExistingCompany && selectedProfile.existingCompanyStatus === "verified";

  if (profilesLoading) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "Post-Incorporation Checklist" }]}>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profiles?.length) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "Post-Incorporation Checklist" }]}>
        <EmptyState
          icon={ClipboardList}
          title="No company profiles found"
          description="A post-incorporation checklist will appear once your company profile is created from a completed application."
        />
      </DashboardLayout>
    );
  }

  if (!effectiveProfileId && profiles.length > 1) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "Post-Incorporation Checklist" }]}>
        <div className="space-y-6" data-testid="checklist-select-profile">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-checklist-title">Post-Incorporation Checklist</h1>
            <p className="text-sm text-muted-foreground mt-1">Select a company to view its checklist</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((p) => (
              <Card
                key={p.id}
                className="cursor-pointer hover-elevate"
                onClick={() => setSelectedProfileId(String(p.id))}
                data-testid={`card-select-profile-${p.id}`}
              >
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {p.companyName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">{p.companyType || "LTD"}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const completedCount = tasks?.filter(t => t.status === "completed").length || 0;
  const totalCount = tasks?.length || 0;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const activeTasks = tasks?.filter(t => t.status !== "completed" && t.status !== "skipped") || [];
  const completedTasks = tasks?.filter(t => t.status === "completed" || t.status === "skipped") || [];

  // Service gating: existing companies must be verified before accessing post-inc services
  const isExistingUnverified = selectedProfile?.isExistingCompany && selectedProfile.existingCompanyStatus !== "verified";

  return (
    <DashboardLayout role="founder" breadcrumbs={[
      { label: "Company Profiles", href: "/founder/company-profile" },
      { label: selectedProfile?.companyName || "Checklist" },
    ]}>
      <div className="space-y-6" data-testid="post-inc-checklist-page">

        {isExistingUnverified && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-4 flex items-start gap-3" data-testid="banner-service-locked">
            <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Post-incorporation services are locked
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                {selectedProfile?.existingCompanyStatus === "pending_review" || selectedProfile?.existingCompanyStatus === "documents_under_review"
                  ? "Your company is under review. Post-incorporation services will unlock once verification is complete (typically 1–2 business days)."
                  : "Complete your company verification to unlock post-incorporation services."}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-checklist-title">
              Post-Incorporation Checklist
            </h1>
            {selectedProfile && (
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-checklist-company">
                {selectedProfile.companyName}
              </p>
            )}
          </div>
          <Link href="/founder/company-profile">
            <Button variant="outline" data-testid="button-back-to-profiles">
              <Building2 className="h-4 w-4 mr-2" />
              Company Profile
            </Button>
          </Link>
        </div>

        <Card data-testid="card-progress">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4 mb-3">
              <p className="text-sm font-medium" data-testid="text-progress-label">
                {completedCount} of {totalCount} tasks completed
              </p>
              <span className="text-sm text-muted-foreground" data-testid="text-progress-pct">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" data-testid="progress-bar" />
          </CardContent>
        </Card>

        {tasksLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="space-y-6">
            {activeTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide" data-testid="text-active-section">
                  Active Tasks ({activeTasks.length})
                </h2>
                {activeTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    profileId={effectiveProfileId!}
                    toast={toast}
                  />
                ))}
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide" data-testid="text-completed-section">
                  Completed / Skipped ({completedTasks.length})
                </h2>
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    profileId={effectiveProfileId!}
                    toast={toast}
                  />
                ))}
              </div>
            )}

            {!activeTasks.length && !completedTasks.length && (
              <EmptyState
                icon={ClipboardList}
                title="No checklist tasks"
                description="No post-incorporation tasks have been generated for this company."
              />
            )}
          </div>
        )}

        {/* BANK_ACCOUNT — surfaced for verified existing companies as an additional service */}
        {isVerifiedExisting && (
          <div className="space-y-3 pt-2" data-testid="section-additional-services">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Additional Services
            </h2>
            <Card className="border-primary/20" data-testid="card-bank-account-service">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                    <Landmark className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm" data-testid="text-bank-account-title">Corporate Bank Account Opening</p>
                      <Badge variant="secondary" className="text-xs">Manual Pricing</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Open a corporate bank account at our partner banks. Fee varies by bank — our team will contact you with options and pricing after you submit your interest.
                    </p>
                    <div className="mt-3">
                      <Link href="/founder/service-request?service=BANK_ACCOUNT">
                        <Button size="sm" variant="outline" data-testid="button-request-bank-account">
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Request Bank Account Opening
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function TaskCard({
  task,
  profileId,
  toast,
}: {
  task: PostIncorporationTask;
  profileId: string;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(task.notes || "");

  const statusConfig = STATUS_CONFIG[task.status || "not_started"];
  const StatusIcon = statusConfig?.icon || Circle;
  const isCompleted = task.status === "completed";
  const isSkipped = task.status === "skipped";

  const updateMutation = useMutation({
    mutationFn: async (data: { status?: string; notes?: string }) => {
      const res = await apiRequest("PUT", `/api/founder/company-profiles/${profileId}/checklist/${task.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles", profileId, "checklist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles"] });
      toast({ title: "Updated", description: "Task updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleStatusChange = (newStatus: string) => {
    updateMutation.mutate({ status: newStatus });
  };

  const handleSaveNotes = () => {
    updateMutation.mutate({ notes });
    setShowNotes(false);
  };

  return (
    <Card
      className={isCompleted || isSkipped ? "opacity-70" : ""}
      data-testid={`card-task-${task.taskKey}`}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <StatusIcon
              className={`h-5 w-5 ${isCompleted ? "text-green-600 dark:text-green-400" : isSkipped ? "text-muted-foreground" : "text-muted-foreground"}`}
              data-testid={`icon-status-${task.taskKey}`}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${isCompleted ? "line-through" : ""}`}
                  data-testid={`text-task-title-${task.taskKey}`}
                >
                  {task.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-task-desc-${task.taskKey}`}>
                  {task.description}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select
                  value={task.status || "not_started"}
                  onValueChange={handleStatusChange}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger className="w-[140px]" data-testid={`select-status-${task.taskKey}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="skipped">Skipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {task.guidance && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground"
                  onClick={() => setExpanded(!expanded)}
                  data-testid={`button-guidance-toggle-${task.taskKey}`}
                >
                  <Lightbulb className="h-3 w-3 mr-1" />
                  {expanded ? "Hide guidance" : "Show guidance"}
                  {expanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                </Button>
                {expanded && (
                  <div
                    className="mt-2 p-3 rounded-md bg-muted/50 text-xs leading-relaxed"
                    data-testid={`text-guidance-${task.taskKey}`}
                  >
                    {task.guidance}
                  </div>
                )}
              </div>
            )}

            <div>
              {showNotes ? (
                <div className="space-y-2">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add your notes here..."
                    className="text-sm"
                    rows={3}
                    data-testid={`textarea-notes-${task.taskKey}`}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={updateMutation.isPending}
                      data-testid={`button-save-notes-${task.taskKey}`}
                    >
                      Save Notes
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowNotes(false);
                        setNotes(task.notes || "");
                      }}
                      data-testid={`button-cancel-notes-${task.taskKey}`}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground"
                  onClick={() => setShowNotes(true)}
                  data-testid={`button-add-notes-${task.taskKey}`}
                >
                  {task.notes ? "Edit notes" : "Add notes"}
                </Button>
              )}
              {!showNotes && task.notes && (
                <p className="text-xs text-muted-foreground mt-1 italic" data-testid={`text-notes-${task.taskKey}`}>
                  {task.notes}
                </p>
              )}
            </div>

            {task.completedAt && (
              <p className="text-xs text-muted-foreground" data-testid={`text-completed-at-${task.taskKey}`}>
                Completed {new Date(task.completedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
