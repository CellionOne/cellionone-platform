import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Mail,
  Package,
  Search,
  Plus,
  Eye,
  Forward,
  Trash2,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  User,
  Building2,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MailItem {
  id: number;
  subscriptionId: number;
  status: string;
  receivedAt: string;
  senderLabel: string | null;
  itemType: string;
  scannedFileUrl: string | null;
  forwardedAt: string | null;
  trackingNumber: string | null;
  isSensitive: boolean;
  notes: string | null;
  subscription?: {
    userId: number;
    userEmail: string;
    userName: string;
  };
}

interface Subscription {
  id: number;
  userId: number;
  tier: string;
  status: string;
  userEmail: string;
  userName: string;
}

interface MailroomStats {
  pendingIntake: number;
  pendingApproval: number;
  pendingScan: number;
  pendingForward: number;
  totalActive: number;
}

export default function AdminMailroom() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [intakeDialogOpen, setIntakeDialogOpen] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MailItem | null>(null);
  const [betaDialogOpen, setBetaDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

  // Intake form state
  const [intakeForm, setIntakeForm] = useState({
    subscriptionId: "",
    senderLabel: "",
    itemType: "letter",
    isSensitive: false,
    notes: "",
  });

  // Forward form state
  const [forwardForm, setForwardForm] = useState({
    trackingNumber: "",
    notes: "",
  });

  const { data: stats, isLoading: loadingStats } = useQuery<MailroomStats>({
    queryKey: ["/api/admin/mailroom/stats"],
  });

  const { data: mailItems, isLoading: loadingMail } = useQuery<MailItem[]>({
    queryKey: ["/api/admin/mailroom/items"],
  });

  const { data: subscriptions, isLoading: loadingSubscriptions } = useQuery<Subscription[]>({
    queryKey: ["/api/admin/mailroom/subscriptions"],
  });

  const intakeMutation = useMutation({
    mutationFn: async (data: typeof intakeForm) => {
      return apiRequest("POST", "/api/admin/mailroom/intake", {
        ...data,
        subscriptionId: parseInt(data.subscriptionId),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mailroom"] });
      toast({ title: "Mail item recorded" });
      setIntakeDialogOpen(false);
      setIntakeForm({ subscriptionId: "", senderLabel: "", itemType: "letter", isSensitive: false, notes: "" });
    },
    onError: () => {
      toast({ title: "Failed to record mail item", variant: "destructive" });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async ({ itemId, fileUrl }: { itemId: number; fileUrl: string }) => {
      return apiRequest("POST", `/api/admin/mailroom/${itemId}/scan`, { fileUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mailroom"] });
      toast({ title: "Scan recorded" });
      setScanDialogOpen(false);
      setSelectedItem(null);
    },
    onError: () => {
      toast({ title: "Failed to record scan", variant: "destructive" });
    },
  });

  const forwardMutation = useMutation({
    mutationFn: async ({ itemId, trackingNumber, notes }: { itemId: number; trackingNumber: string; notes: string }) => {
      return apiRequest("POST", `/api/admin/mailroom/${itemId}/forward`, { trackingNumber, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mailroom"] });
      toast({ title: "Mail forwarded" });
      setForwardDialogOpen(false);
      setSelectedItem(null);
      setForwardForm({ trackingNumber: "", notes: "" });
    },
    onError: () => {
      toast({ title: "Failed to forward mail", variant: "destructive" });
    },
  });

  const discardMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return apiRequest("POST", `/api/admin/mailroom/${itemId}/discard`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mailroom"] });
      toast({ title: "Mail discarded" });
    },
    onError: () => {
      toast({ title: "Failed to discard mail", variant: "destructive" });
    },
  });

  const betaActivateMutation = useMutation({
    mutationFn: async (subscriptionId: number) => {
      return apiRequest("POST", `/api/admin/registered-office/${subscriptionId}/beta-activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mailroom/subscriptions"] });
      toast({ title: "Subscription activated" });
      setBetaDialogOpen(false);
      setSelectedSubscription(null);
    },
    onError: () => {
      toast({ title: "Failed to activate subscription", variant: "destructive" });
    },
  });

  const isLoading = loadingStats || loadingMail || loadingSubscriptions;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "received":
        return <Badge variant="secondary" className="gap-1"><Package className="h-3 w-3" />Received</Badge>;
      case "pending_approval":
        return <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600"><Clock className="h-3 w-3" />Pending Approval</Badge>;
      case "approved_scan":
        return <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" />To Scan</Badge>;
      case "approved_forward":
        return <Badge variant="secondary" className="gap-1"><Forward className="h-3 w-3" />To Forward</Badge>;
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

  const filteredItems = mailItems?.filter((item) => {
    const matchesSearch = !searchQuery ||
      item.senderLabel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subscription?.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subscription?.userEmail?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "pending_scan") return item.status === "approved_scan" && matchesSearch;
    if (activeTab === "pending_forward") return (item.status === "approved_forward" || item.status === "received") && matchesSearch;
    if (activeTab === "completed") return (item.status === "scanned" || item.status === "forwarded") && matchesSearch;
    return matchesSearch;
  }) || [];

  const pendingSubscriptions = subscriptions?.filter(s => s.status === "pending_payment") || [];

  if (isLoading) {
    return (
      <DashboardLayout
        role="admin"
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Mailroom" },
        ]}
      >
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="admin"
      breadcrumbs={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Mailroom" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" />
              Mailroom Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage mail intake, scanning, and forwarding for registered office subscribers
            </p>
          </div>
          <Button onClick={() => setIntakeDialogOpen(true)} className="gap-2" data-testid="button-new-intake">
            <Plus className="h-4 w-4" />
            Record Mail
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Subscribers</CardDescription>
              <CardTitle className="text-2xl">{stats?.totalActive ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>New Mail</CardDescription>
              <CardTitle className="text-2xl">{stats?.pendingIntake ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Approval</CardDescription>
              <CardTitle className="text-2xl">{stats?.pendingApproval ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>To Scan</CardDescription>
              <CardTitle className="text-2xl">{stats?.pendingScan ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>To Forward</CardDescription>
              <CardTitle className="text-2xl">{stats?.pendingForward ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {pendingSubscriptions.length > 0 && (
          <Card className="border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <Zap className="h-5 w-5" />
                Pending Beta Activations
              </CardTitle>
              <CardDescription className="text-yellow-700 dark:text-yellow-300">
                These subscriptions are awaiting payment or beta activation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingSubscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between bg-background rounded-lg p-3 border"
                    data-testid={`pending-sub-${sub.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{sub.userName}</p>
                        <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                      </div>
                      <Badge variant="secondary">{sub.tier === "office_plus_mail" ? "Office + Mail" : "Office Only"}</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedSubscription(sub);
                        setBetaDialogOpen(true);
                      }}
                      data-testid={`button-activate-${sub.id}`}
                    >
                      <Zap className="h-4 w-4 mr-1" />
                      Beta Activate
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="inbox" data-testid="tab-inbox">All Mail</TabsTrigger>
              <TabsTrigger value="pending_scan" data-testid="tab-pending-scan">
                To Scan {(stats?.pendingScan ?? 0) > 0 && <Badge variant="secondary" className="ml-1">{stats?.pendingScan}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="pending_forward" data-testid="tab-pending-forward">
                To Forward {(stats?.pendingForward ?? 0) > 0 && <Badge variant="secondary" className="ml-1">{stats?.pendingForward}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
            </TabsList>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-mail"
              />
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-4">
            {filteredItems.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="No mail items"
                description={activeTab === "inbox" ? "No mail has been recorded yet." : "No items in this category."}
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {filteredItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 hover-elevate"
                        data-testid={`mail-row-${item.id}`}
                      >
                        <div className="flex items-start gap-4">
                          {item.itemType === "letter" ? (
                            <FileText className="h-8 w-8 text-muted-foreground p-1.5 bg-muted rounded" />
                          ) : (
                            <Package className="h-8 w-8 text-muted-foreground p-1.5 bg-muted rounded" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{item.senderLabel || "Unknown Sender"}</p>
                              {item.isSensitive && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Sensitive
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {item.subscription?.userName} ({item.subscription?.userEmail})
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Received: {new Date(item.receivedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(item.status)}
                          <div className="flex items-center gap-1">
                            {(item.status === "approved_scan" || item.status === "received") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setScanDialogOpen(true);
                                }}
                                data-testid={`button-scan-${item.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {(item.status === "approved_forward" || item.status === "received") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setForwardDialogOpen(true);
                                }}
                                data-testid={`button-forward-${item.id}`}
                              >
                                <Forward className="h-4 w-4" />
                              </Button>
                            )}
                            {item.status === "received" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => discardMutation.mutate(item.id)}
                                disabled={discardMutation.isPending}
                                data-testid={`button-discard-${item.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={intakeDialogOpen} onOpenChange={setIntakeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record New Mail</DialogTitle>
            <DialogDescription>Enter details about the received mail item</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subscriber</Label>
              <Select
                value={intakeForm.subscriptionId}
                onValueChange={(v) => setIntakeForm({ ...intakeForm, subscriptionId: v })}
              >
                <SelectTrigger data-testid="select-subscription">
                  <SelectValue placeholder="Select subscriber" />
                </SelectTrigger>
                <SelectContent>
                  {subscriptions?.filter(s => s.status === "active" && s.tier === "office_plus_mail").map((sub) => (
                    <SelectItem key={sub.id} value={sub.id.toString()}>
                      {sub.userName} ({sub.userEmail})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sender</Label>
              <Input
                placeholder="Sender name or label"
                value={intakeForm.senderLabel}
                onChange={(e) => setIntakeForm({ ...intakeForm, senderLabel: e.target.value })}
                data-testid="input-sender"
              />
            </div>
            <div className="space-y-2">
              <Label>Item Type</Label>
              <Select
                value={intakeForm.itemType}
                onValueChange={(v) => setIntakeForm({ ...intakeForm, itemType: v })}
              >
                <SelectTrigger data-testid="select-item-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">Letter</SelectItem>
                  <SelectItem value="package">Package</SelectItem>
                  <SelectItem value="legal_notice">Legal Notice</SelectItem>
                  <SelectItem value="government">Government Document</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Sensitive Mail</Label>
                <p className="text-xs text-muted-foreground">Mark as requiring escalation</p>
              </div>
              <Switch
                checked={intakeForm.isSensitive}
                onCheckedChange={(v) => setIntakeForm({ ...intakeForm, isSensitive: v })}
                data-testid="switch-sensitive"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes..."
                value={intakeForm.notes}
                onChange={(e) => setIntakeForm({ ...intakeForm, notes: e.target.value })}
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIntakeDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => intakeMutation.mutate(intakeForm)}
              disabled={!intakeForm.subscriptionId || intakeMutation.isPending}
              data-testid="button-submit-intake"
            >
              {intakeMutation.isPending ? <LoadingSpinner size="sm" /> : "Record Mail"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Scan</DialogTitle>
            <DialogDescription>
              Upload the scanned document for: {selectedItem?.senderLabel || "Unknown"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Scanned File URL</Label>
              <Input
                placeholder="https://storage.example.com/scan.pdf"
                id="scan-url"
                data-testid="input-scan-url"
              />
              <p className="text-xs text-muted-foreground">
                Upload the scan to object storage and paste the URL here
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScanDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const url = (document.getElementById("scan-url") as HTMLInputElement)?.value;
                if (selectedItem && url) {
                  scanMutation.mutate({ itemId: selectedItem.id, fileUrl: url });
                }
              }}
              disabled={scanMutation.isPending}
              data-testid="button-submit-scan"
            >
              {scanMutation.isPending ? <LoadingSpinner size="sm" /> : "Save Scan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forward Mail</DialogTitle>
            <DialogDescription>
              Record forwarding details for: {selectedItem?.senderLabel || "Unknown"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tracking Number</Label>
              <Input
                placeholder="Courier tracking number"
                value={forwardForm.trackingNumber}
                onChange={(e) => setForwardForm({ ...forwardForm, trackingNumber: e.target.value })}
                data-testid="input-tracking"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Forwarding notes..."
                value={forwardForm.notes}
                onChange={(e) => setForwardForm({ ...forwardForm, notes: e.target.value })}
                data-testid="input-forward-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForwardDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedItem) {
                  forwardMutation.mutate({
                    itemId: selectedItem.id,
                    trackingNumber: forwardForm.trackingNumber,
                    notes: forwardForm.notes,
                  });
                }
              }}
              disabled={forwardMutation.isPending}
              data-testid="button-submit-forward"
            >
              {forwardMutation.isPending ? <LoadingSpinner size="sm" /> : "Record Forward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={betaDialogOpen} onOpenChange={setBetaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Beta Activate Subscription</DialogTitle>
            <DialogDescription>
              Activate subscription for {selectedSubscription?.userName} without payment during beta period.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              This will immediately activate the registered office subscription and give the user access to the full address details. This action is typically used during beta testing.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBetaDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedSubscription) {
                  betaActivateMutation.mutate(selectedSubscription.id);
                }
              }}
              disabled={betaActivateMutation.isPending}
              data-testid="button-confirm-beta"
            >
              {betaActivateMutation.isPending ? <LoadingSpinner size="sm" /> : "Activate Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
