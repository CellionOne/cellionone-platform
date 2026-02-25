import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Share2,
  Shield,
  Copy,
  ExternalLink,
  XCircle,
  Clock,
  CheckCircle2,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Plus,
  FileText,
  User,
  Building2,
  FolderOpen,
  MapPin,
  Loader2,
} from "lucide-react";

interface DataScope {
  personal: boolean;
  verification: boolean;
  company: boolean;
  documents: boolean;
  proofOfAddress: boolean;
}

interface Consent {
  id: number;
  founderId: string;
  applicationId: number | null;
  partnerName: string;
  partnerType: string;
  consentToken: string;
  consentText: string;
  dataScope: DataScope;
  status: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

interface AccessLog {
  id: number;
  consentId: number;
  accessType: string;
  accessedBy: string;
  ipAddress: string;
  userAgent: string;
  dataReturned: any;
  createdAt: string;
}

const scopeLabels: Record<keyof DataScope, { label: string; icon: any; description: string }> = {
  personal: { label: "Personal Info", icon: User, description: "Name, email, phone, address, nationality" },
  verification: { label: "Verification Results", icon: Shield, description: "Smile ID checks, BVN/NIN status, liveness score" },
  company: { label: "Company Details", icon: Building2, description: "Company name, RC number, directors, shareholders" },
  documents: { label: "Documents", icon: FolderOpen, description: "Passport photo, signature, ID document" },
  proofOfAddress: { label: "Proof of Address", icon: MapPin, description: "Virtual office utility bill" },
};

const partnerTypeLabels: Record<string, string> = {
  bank: "Bank",
  insurance: "Insurance",
  government: "Government",
  other: "Other",
};

export default function FounderDataSharing() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState<Consent | null>(null);
  const [showAccessLog, setShowAccessLog] = useState<number | null>(null);
  const [showExpired, setShowExpired] = useState(false);

  const [partnerName, setPartnerName] = useState("");
  const [partnerType, setPartnerType] = useState("bank");
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [dataScope, setDataScope] = useState<DataScope>({
    personal: true,
    verification: true,
    company: false,
    documents: false,
    proofOfAddress: false,
  });

  const { data: consentsData, isLoading } = useQuery<{ consents: Consent[] }>({
    queryKey: ["/api/data-sharing/consents"],
  });

  const accessLogQuery = useQuery<{ logs: AccessLog[] }>({
    queryKey: ["/api/data-sharing/consents", showAccessLog, "access-log"],
    enabled: showAccessLog !== null,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/data-sharing/create-consent", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sharing/consents"] });
      setShowCreateDialog(false);
      resetForm();
      navigator.clipboard.writeText(data.shareableLink).catch(() => {});
      toast({ title: "Consent created", description: "The shareable link has been copied to your clipboard." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create consent", variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (consentId: number) => {
      const res = await apiRequest("POST", `/api/data-sharing/consents/${consentId}/revoke`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sharing/consents"] });
      setShowRevokeDialog(null);
      toast({ title: "Consent revoked", description: "The partner can no longer access your data." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to revoke consent", variant: "destructive" });
    },
  });

  function resetForm() {
    setPartnerName("");
    setPartnerType("bank");
    setExpiresInDays(90);
    setDataScope({ personal: true, verification: true, company: false, documents: false, proofOfAddress: false });
  }

  function copyLink(token: string) {
    const link = `${window.location.origin}/verify/${token}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: "Link copied", description: "Verification link copied to clipboard." });
    }).catch(() => {
      toast({ title: "Error", description: "Failed to copy link", variant: "destructive" });
    });
  }

  const consents = consentsData?.consents || [];
  const activeConsents = consents.filter(c => c.status === "active");
  const inactiveConsents = consents.filter(c => c.status !== "active");

  const selectedScopes = Object.entries(dataScope).filter(([_, v]) => v).map(([k]) => k as keyof DataScope);
  const consentPreviewText = selectedScopes.length > 0
    ? `I authorise Cellion One to share my ${selectedScopes.map(k => scopeLabels[k].label.toLowerCase()).join(", ")} with ${partnerName || "[partner]"} for the purpose of ${partnerType === "bank" ? "corporate account opening" : partnerType === "insurance" ? "insurance application" : "verification"}.`
    : "";

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="data-sharing-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Data Sharing</h1>
            <p className="text-muted-foreground mt-1">
              Share your verified data with banks, insurers, and other partners securely.
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-consent">
            <Plus className="w-4 h-4 mr-2" />
            Share Data
          </Button>
        </div>

        {activeConsents.length === 0 && inactiveConsents.length === 0 && (
          <EmptyState
            icon={Share2}
            title="No data shares yet"
            description="Create a data share to securely send your verified information to banks, insurers, or other partners."
          />
        )}

        {activeConsents.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Active Shares ({activeConsents.length})
            </h2>
            <div className="grid gap-4">
              {activeConsents.map(consent => (
                <ConsentCard
                  key={consent.id}
                  consent={consent}
                  onCopyLink={() => copyLink(consent.consentToken)}
                  onRevoke={() => setShowRevokeDialog(consent)}
                  onViewLog={() => setShowAccessLog(consent.id)}
                />
              ))}
            </div>
          </div>
        )}

        {inactiveConsents.length > 0 && (
          <Collapsible open={showExpired} onOpenChange={setShowExpired}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 text-muted-foreground" data-testid="button-toggle-expired">
                {showExpired ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Revoked & Expired ({inactiveConsents.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              {inactiveConsents.map(consent => (
                <ConsentCard
                  key={consent.id}
                  consent={consent}
                  onCopyLink={() => {}}
                  onRevoke={() => {}}
                  onViewLog={() => setShowAccessLog(consent.id)}
                  disabled
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Verified Data</DialogTitle>
            <DialogDescription>
              Create a secure, time-limited link to share your verified identity and company data with a partner.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="partnerName">Partner / Organisation Name</Label>
              <Input
                id="partnerName"
                placeholder="e.g. Access Bank, AXA Mansard"
                value={partnerName}
                onChange={e => setPartnerName(e.target.value)}
                data-testid="input-partner-name"
              />
            </div>

            <div>
              <Label htmlFor="partnerType">Partner Type</Label>
              <Select value={partnerType} onValueChange={setPartnerType}>
                <SelectTrigger data-testid="select-partner-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="government">Government Agency</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="expiry">Expiry (days)</Label>
              <Select value={expiresInDays.toString()} onValueChange={v => setExpiresInDays(parseInt(v))}>
                <SelectTrigger data-testid="select-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-3 block">Data to Share</Label>
              <div className="space-y-3">
                {(Object.keys(scopeLabels) as Array<keyof DataScope>).map(key => {
                  const { label, icon: Icon, description } = scopeLabels[key];
                  return (
                    <div key={key} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <Checkbox
                        id={`scope-${key}`}
                        checked={dataScope[key]}
                        onCheckedChange={(checked) => setDataScope(prev => ({ ...prev, [key]: !!checked }))}
                        data-testid={`checkbox-scope-${key}`}
                      />
                      <div className="flex-1">
                        <label htmlFor={`scope-${key}`} className="flex items-center gap-2 font-medium cursor-pointer text-sm">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          {label}
                        </label>
                        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {consentPreviewText && partnerName && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">Consent Statement</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">{consentPreviewText}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }} data-testid="button-cancel-consent">
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate({ partnerName, partnerType, dataScope, expiresInDays })}
              disabled={!partnerName || selectedScopes.length === 0 || createMutation.isPending}
              data-testid="button-confirm-consent"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              I Agree & Create Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRevokeDialog !== null} onOpenChange={() => setShowRevokeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Data Sharing Consent</DialogTitle>
            <DialogDescription>
              {showRevokeDialog && (
                <>Are you sure you want to revoke access for <strong>{showRevokeDialog.partnerName}</strong>? They will no longer be able to view or download your data.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeDialog(null)} data-testid="button-cancel-revoke">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showRevokeDialog && revokeMutation.mutate(showRevokeDialog.id)}
              disabled={revokeMutation.isPending}
              data-testid="button-confirm-revoke"
            >
              {revokeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Revoke Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAccessLog !== null} onOpenChange={() => setShowAccessLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Access History</DialogTitle>
            <DialogDescription>
              A log of every time this data was accessed.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-3">
            {accessLogQuery.isLoading && <LoadingSpinner />}
            {accessLogQuery.data?.logs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No access recorded yet.</p>
            )}
            {accessLogQuery.data?.logs.map(log => (
              <div key={log.id} className="p-3 border rounded-lg text-sm" data-testid={`access-log-${log.id}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{log.accessedBy}</span>
                  <Badge variant="outline" className="text-xs">
                    {log.accessType === "api_call" ? "API" : log.accessType === "certificate_download" ? "Certificate" : log.accessType === "package_download" ? "Package" : log.accessType}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString("en-GB")} · IP: {log.ipAddress}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function ConsentCard({
  consent,
  onCopyLink,
  onRevoke,
  onViewLog,
  disabled = false,
}: {
  consent: Consent;
  onCopyLink: () => void;
  onRevoke: () => void;
  onViewLog: () => void;
  disabled?: boolean;
}) {
  const scope = consent.dataScope;
  const isActive = consent.status === "active";
  const isRevoked = consent.status === "revoked";

  const statusColor = isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
    isRevoked ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";

  return (
    <Card className={disabled ? "opacity-60" : ""} data-testid={`consent-card-${consent.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {consent.partnerName}
              <Badge className={`${statusColor} border-0 text-xs`}>
                {consent.status.charAt(0).toUpperCase() + consent.status.slice(1)}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              {partnerTypeLabels[consent.partnerType] || consent.partnerType} · Created {new Date(consent.createdAt).toLocaleDateString("en-GB")}
              {consent.expiresAt && ` · Expires ${new Date(consent.expiresAt).toLocaleDateString("en-GB")}`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {(Object.keys(scopeLabels) as Array<keyof DataScope>).map(key => {
            if (!scope[key]) return null;
            const { label, icon: Icon } = scopeLabels[key];
            return (
              <Badge key={key} variant="secondary" className="text-xs gap-1">
                <Icon className="w-3 h-3" />
                {label}
              </Badge>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {isActive && (
            <>
              <Button size="sm" variant="outline" onClick={onCopyLink} data-testid={`button-copy-link-${consent.id}`}>
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copy Link
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/verify/${consent.consentToken}`, "_blank")}
                data-testid={`button-preview-${consent.id}`}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Preview
              </Button>
              <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={onRevoke} data-testid={`button-revoke-${consent.id}`}>
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Revoke
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={onViewLog} data-testid={`button-access-log-${consent.id}`}>
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Access Log
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
