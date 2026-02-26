import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Mail,
  Plus,
  Search,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Building2,
} from "lucide-react";

interface MailItemEntry {
  id: number;
  senderName: string | null;
  senderType: string | null;
  status: string;
  receivedAt: string;
  isSensitive: boolean;
  notes: string | null;
  founderName: string;
  founderEmail: string;
  subscriptionId: number;
}

interface Subscriber {
  id: number;
  founderId: string;
  founderName: string;
  founderEmail: string;
  companyName: string | null;
  tier: string;
  status: string;
}

export default function BuildingManagerMailIntake() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [intakeDialogOpen, setIntakeDialogOpen] = useState(false);
  const [intakeForm, setIntakeForm] = useState({
    subscriptionId: "",
    senderName: "",
    senderType: "unknown",
    isSensitive: false,
    notes: "",
  });

  const { data: mailItems, isLoading: loadingMail } = useQuery<MailItemEntry[]>({
    queryKey: ["/api/building-manager/mail"],
  });

  const { data: subscribers, isLoading: loadingSubs } = useQuery<Subscriber[]>({
    queryKey: ["/api/building-manager/subscribers"],
  });

  const intakeMutation = useMutation({
    mutationFn: async (data: typeof intakeForm) => {
      return apiRequest("POST", "/api/building-manager/mail/intake", {
        ...data,
        subscriptionId: parseInt(data.subscriptionId),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/building-manager/mail"] });
      toast({ title: "Mail item recorded successfully" });
      setIntakeDialogOpen(false);
      setIntakeForm({ subscriptionId: "", senderName: "", senderType: "unknown", isSensitive: false, notes: "" });
    },
    onError: () => {
      toast({ title: "Failed to record mail item", variant: "destructive" });
    },
  });

  const isLoading = loadingMail || loadingSubs;

  if (isLoading) {
    return (
      <DashboardLayout
        role="building_manager"
        breadcrumbs={[
          { label: "Dashboard", href: "/building-manager/dashboard" },
          { label: "Mail Intake" },
        ]}
      >
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  const activeSubscribers = (subscribers || []).filter(s => s.status === "active");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "received":
        return <Badge variant="secondary" className="gap-1"><Package className="h-3 w-3" />Received</Badge>;
      case "pending_approval":
        return <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600"><Clock className="h-3 w-3" />Pending Approval</Badge>;
      case "scanned":
        return <Badge className="gap-1 bg-primary"><CheckCircle2 className="h-3 w-3" />Scanned</Badge>;
      case "forwarded":
        return <Badge variant="secondary" className="gap-1"><Mail className="h-3 w-3" />Forwarded</Badge>;
      case "discarded":
        return <Badge variant="destructive" className="gap-1">Discarded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSenderTypeBadge = (type: string | null) => {
    if (!type) return null;
    const labels: Record<string, string> = {
      government: "Government",
      bank: "Bank",
      legal: "Legal",
      commercial: "Commercial",
      personal: "Personal",
      unknown: "Unknown",
    };
    return <Badge variant="outline" className="text-xs">{labels[type] || type}</Badge>;
  };

  const filtered = (mailItems || []).filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.senderName?.toLowerCase().includes(q) ||
      item.founderName?.toLowerCase().includes(q) ||
      item.founderEmail?.toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout
      role="building_manager"
      breadcrumbs={[
        { label: "Dashboard", href: "/building-manager/dashboard" },
        { label: "Mail Intake" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Mail className="h-6 w-6 text-primary" />
              Mail Intake
            </h1>
            <p className="text-muted-foreground mt-1">
              Record and manage incoming mail for subscribers at your location
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-56"
                data-testid="input-search-mail"
              />
            </div>
            <Button onClick={() => setIntakeDialogOpen(true)} className="gap-2" data-testid="button-record-mail">
              <Plus className="h-4 w-4" />
              Record Mail
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No Mail Items"
            description={searchQuery ? "No mail items match your search." : "No mail items have been recorded at this location yet."}
            action={
              <Button onClick={() => setIntakeDialogOpen(true)} className="gap-2" data-testid="button-record-mail-empty">
                <Plus className="h-4 w-4" />
                Record First Mail Item
              </Button>
            }
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 p-4"
                    data-testid={`mail-row-${item.id}`}
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="rounded-full bg-muted p-2 shrink-0">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium" data-testid={`text-sender-${item.id}`}>
                            {item.senderName || "Unknown Sender"}
                          </p>
                          {item.isSensitive && (
                            <Badge variant="outline" className="gap-1 border-red-500 text-red-600">
                              <AlertTriangle className="h-3 w-3" />
                              Sensitive
                            </Badge>
                          )}
                          {getSenderTypeBadge(item.senderType)}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.founderName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Received: {new Date(item.receivedAt).toLocaleString()}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {getStatusBadge(item.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={intakeDialogOpen} onOpenChange={setIntakeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Incoming Mail</DialogTitle>
            <DialogDescription>
              Log a new mail item received at your location
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subscriber">Recipient Subscriber</Label>
              <Select
                value={intakeForm.subscriptionId}
                onValueChange={(val) => setIntakeForm(f => ({ ...f, subscriptionId: val }))}
              >
                <SelectTrigger data-testid="select-subscriber">
                  <SelectValue placeholder="Select subscriber" />
                </SelectTrigger>
                <SelectContent>
                  {activeSubscribers.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id.toString()}>
                      <span className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        {sub.founderName}
                        {sub.companyName && (
                          <span className="text-muted-foreground">({sub.companyName})</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sender">Sender</Label>
              <Input
                id="sender"
                placeholder="e.g. FIRS, Access Bank, Court Registry"
                value={intakeForm.senderName}
                onChange={(e) => setIntakeForm(f => ({ ...f, senderName: e.target.value }))}
                data-testid="input-sender"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senderType">Sender Type</Label>
              <Select
                value={intakeForm.senderType}
                onValueChange={(val) => setIntakeForm(f => ({ ...f, senderType: val }))}
              >
                <SelectTrigger data-testid="select-sender-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Description / Notes</Label>
              <Textarea
                id="notes"
                placeholder="Brief description of the mail item..."
                value={intakeForm.notes}
                onChange={(e) => setIntakeForm(f => ({ ...f, notes: e.target.value }))}
                data-testid="input-notes"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="sensitive"
                checked={intakeForm.isSensitive}
                onCheckedChange={(checked) => setIntakeForm(f => ({ ...f, isSensitive: checked }))}
                data-testid="switch-sensitive"
              />
              <Label htmlFor="sensitive" className="cursor-pointer">
                Mark as sensitive
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIntakeDialogOpen(false)}
              data-testid="button-cancel-intake"
            >
              Cancel
            </Button>
            <Button
              onClick={() => intakeMutation.mutate(intakeForm)}
              disabled={!intakeForm.subscriptionId || intakeMutation.isPending}
              data-testid="button-submit-intake"
            >
              {intakeMutation.isPending ? (
                <LoadingSpinner size="sm" />
              ) : (
                "Record Mail"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
