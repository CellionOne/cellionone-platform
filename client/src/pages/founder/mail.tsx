import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Mail,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  ExternalLink,
  Settings,
  Shield,
  Inbox,
  Eye,
  Forward,
  Trash2,
  Building2,
  Info,
  FileCheck,
  Calendar,
} from "lucide-react";

interface MailPreference {
  id: number;
  preferenceType: "scan_all" | "approve_before_scan" | "forward_only";
  forwardingAddress: string | null;
  sensitiveAutoEscalate: boolean;
}

interface MailItem {
  id: number;
  status: string;
  receivedAt: string;
  senderLabel: string | null;
  itemType: string;
  scannedFileUrl: string | null;
  forwardedAt: string | null;
  trackingNumber: string | null;
}

interface MailData {
  preferences: MailPreference | null;
  mailItems: MailItem[];
  pendingApprovals: number;
}

interface SubscriptionData {
  subscription: {
    tier: string;
    status: string;
  } | null;
}

interface ServicePolicy {
  mailItemsIncluded: number;
  storageRetentionDays: number;
  officialMailOnly: boolean;
}

const preferenceOptions = [
  {
    value: "scan_all",
    title: "Scan All Mail",
    description: "Automatically scan and deliver all mail digitally to your inbox",
    icon: Eye,
  },
  {
    value: "approve_before_scan",
    title: "Approve Before Scan",
    description: "Review mail before deciding to scan, forward, or discard",
    icon: CheckCircle2,
  },
  {
    value: "forward_only",
    title: "Forward Only",
    description: "Forward all mail to a physical address without scanning",
    icon: Forward,
  },
];

export default function FounderMailPage() {
  const { toast } = useToast();
  const [selectedPreference, setSelectedPreference] = useState<string>("");
  const [sensitiveEscalate, setSensitiveEscalate] = useState(false);

  const { data: subscription, isLoading: loadingSubscription } = useQuery<SubscriptionData>({
    queryKey: ["/api/registered-office/subscription"],
  });

  const { data: mailData, isLoading: loadingMail } = useQuery<MailData>({
    queryKey: ["/api/registered-office/mail"],
    enabled: subscription?.subscription?.tier === "office_plus_mail" && subscription?.subscription?.status === "active",
  });

  const { data: servicePolicy } = useQuery<ServicePolicy>({
    queryKey: ["/api/registered-office/service-policy"],
  });

  const updatePreferenceMutation = useMutation({
    mutationFn: async (data: { preferenceType: string; sensitiveAutoEscalate: boolean }) => {
      return apiRequest("POST", "/api/registered-office/preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/registered-office/mail"] });
      toast({
        title: "Preferences updated",
        description: "Your mail handling preferences have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ itemId, action }: { itemId: number; action: string }) => {
      return apiRequest("POST", `/api/registered-office/mail/${itemId}/approve`, { action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/registered-office/mail"] });
      toast({
        title: "Action completed",
        description: "Mail item has been processed.",
      });
    },
    onError: () => {
      toast({
        title: "Action failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const isLoading = loadingSubscription || loadingMail;
  const hasMailService = subscription?.subscription?.tier === "office_plus_mail" && subscription?.subscription?.status === "active";

  // Set initial state from loaded preferences
  if (mailData?.preferences && !selectedPreference) {
    setSelectedPreference(mailData.preferences.preferenceType);
    setSensitiveEscalate(mailData.preferences.sensitiveAutoEscalate);
  }

  const handleSavePreferences = () => {
    if (!selectedPreference) return;
    updatePreferenceMutation.mutate({
      preferenceType: selectedPreference,
      sensitiveAutoEscalate: sensitiveEscalate,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "received":
        return <Badge variant="secondary" className="gap-1"><Package className="h-3 w-3" />Received</Badge>;
      case "pending_approval":
        return <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600"><Clock className="h-3 w-3" />Pending Approval</Badge>;
      case "approved_scan":
        return <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" />To Scan</Badge>;
      case "scanned":
        return <Badge className="gap-1 bg-primary"><CheckCircle2 className="h-3 w-3" />Scanned</Badge>;
      case "forwarded":
        return <Badge variant="secondary" className="gap-1"><Forward className="h-3 w-3" />Forwarded</Badge>;
      case "discarded":
        return <Badge variant="destructive" className="gap-1"><Trash2 className="h-3 w-3" />Discarded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout
        role="founder"
        breadcrumbs={[
          { label: "Dashboard", href: "/founder/dashboard" },
          { label: "Mail Handling" },
        ]}
      >
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (!hasMailService) {
    return (
      <DashboardLayout
        role="founder"
        breadcrumbs={[
          { label: "Dashboard", href: "/founder/dashboard" },
          { label: "Mail Handling" },
        ]}
      >
        <div className="max-w-2xl mx-auto">
          <EmptyState
            icon={Mail}
            title="Mail Handling Not Available"
            description="Mail handling requires an active Office + Mail subscription."
            action={
              <Link href="/founder/registered-office">
                <Button className="gap-2" data-testid="link-upgrade-subscription">
                  <Building2 className="h-4 w-4" />
                  Upgrade Subscription
                </Button>
              </Link>
            }
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[
        { label: "Dashboard", href: "/founder/dashboard" },
        { label: "Mail Handling" },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            Mail Handling
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage how mail to your registered office is processed
          </p>
        </div>

        {servicePolicy && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Info className="h-5 w-5 text-blue-600" />
                Service Policy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <Package className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium">{servicePolicy.mailItemsIncluded} items/month</p>
                    <p className="text-muted-foreground text-xs">Included in plan</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium">{servicePolicy.storageRetentionDays} days retention</p>
                    <p className="text-muted-foreground text-xs">Mail storage period</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FileCheck className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium">{servicePolicy.officialMailOnly ? "Official mail only" : "All mail accepted"}</p>
                    <p className="text-muted-foreground text-xs">Government, bank, legal, commercial</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Mail Preferences
              </CardTitle>
              <CardDescription>
                Choose how incoming mail should be handled
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={selectedPreference}
                onValueChange={setSelectedPreference}
                className="space-y-3"
              >
                {preferenceOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`flex items-start gap-3 border rounded-lg p-4 cursor-pointer hover-elevate ${
                      selectedPreference === option.value ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => setSelectedPreference(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={`pref-${option.value}`} data-testid={`radio-pref-${option.value}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4 text-primary" />
                        <Label htmlFor={`pref-${option.value}`} className="font-medium cursor-pointer">
                          {option.title}
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>

              <div className="flex items-center justify-between border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <Label className="font-medium">Sensitive Mail Escalation</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically escalate mail marked as sensitive (legal notices, court documents)
                    </p>
                  </div>
                </div>
                <Switch
                  checked={sensitiveEscalate}
                  onCheckedChange={setSensitiveEscalate}
                  data-testid="switch-sensitive-escalate"
                />
              </div>

              <Button
                onClick={handleSavePreferences}
                disabled={!selectedPreference || updatePreferenceMutation.isPending}
                className="w-full"
                data-testid="button-save-preferences"
              >
                {updatePreferenceMutation.isPending ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  "Save Preferences"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5 text-primary" />
                Mail Inbox
                {(mailData?.pendingApprovals ?? 0) > 0 && (
                  <Badge variant="destructive">{mailData?.pendingApprovals} pending</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Recent mail received at your registered office
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!mailData?.mailItems?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No mail items yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mailData.mailItems.slice(0, 10).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between border rounded-lg p-3 hover-elevate"
                      data-testid={`mail-item-${item.id}`}
                    >
                      <div className="flex items-start gap-3">
                        {item.itemType === "letter" ? (
                          <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{item.senderLabel || "Unknown Sender"}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.receivedAt).toLocaleDateString()}
                          </p>
                          <div className="mt-1">{getStatusBadge(item.status)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "pending_approval" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approvalMutation.mutate({ itemId: item.id, action: "scan" })}
                              disabled={approvalMutation.isPending}
                              data-testid={`button-approve-scan-${item.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approvalMutation.mutate({ itemId: item.id, action: "forward" })}
                              disabled={approvalMutation.isPending}
                              data-testid={`button-approve-forward-${item.id}`}
                            >
                              <Forward className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => approvalMutation.mutate({ itemId: item.id, action: "discard" })}
                              disabled={approvalMutation.isPending}
                              data-testid={`button-discard-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {item.scannedFileUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            data-testid={`button-view-scan-${item.id}`}
                          >
                            <a href={item.scannedFileUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
