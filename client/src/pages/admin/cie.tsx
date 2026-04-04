import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  BarChart3, Upload, Settings2, Banknote, Zap, TrendingUp,
  RefreshCw, Plus, Trash2, CheckCircle2,
  Users, DollarSign, Activity, Star, ArrowUpDown,
  Save, Send, Power,
} from "lucide-react";
// ─── Types ────────────────────────────────────────────────────────────────────

interface Security {
  id: number; symbol: string; name: string; sector: string;
  isActive: boolean; exchange: string;
}

interface SecurityScore {
  securityId: number; symbol: string; name: string; sector: string;
  ias: number | null; rs: number | null; cs: number | null;
  recommendation: string | null; scoreDate: string;
}

interface IngestionLog {
  id: number; filename: string; rowsAccepted: number; rowsRejected: number;
  status: string; createdAt: string;
}

interface ModelVersion {
  id: number; version: string; status: string; weights: Record<string, number>;
  notes: string | null; createdAt: string; activatedAt: string | null;
}

interface Dividend {
  id: number; securityId: number; exDividendDate: string;
  paymentDate: string | null; amountPerShareKobo: number; notes: string | null;
  symbol: string; name: string;
}

interface Signal {
  id: number; ticker: string | null; type: string; sentiment: string;
  credibility: string; headline: string; body: string | null;
  isPublished: boolean; publishedAt: string | null; createdAt: string;
}

interface Revenue {
  subscriberCount: number; proCount: number; totalActive: number;
  mrrNaira: number; churnLast30Days: number;
  subscribers: Array<{
    id: number; email: string; name: string; tier: string;
    renewalDate: string; cancelAtPeriodEnd: boolean;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function tierBadge(tier: string) {
  const cfg: Record<string, string> = {
    subscriber: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    pro: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    free: "bg-muted text-muted-foreground",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg[tier] ?? cfg.free}`}>{tier}</span>;
}

function recoBadge(rec: string | null) {
  if (!rec) return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, string> = {
    "Strong Buy": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "Accumulate": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    "Hold": "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    "Reduce": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    "Sell": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[rec] ?? "bg-muted text-muted-foreground"}`}>{rec}</span>;
}

// ─── Securities Tab ───────────────────────────────────────────────────────────

function SecuritiesTab() {
  const { toast } = useToast();
  const [newTicker, setNewTicker] = useState("");
  const [newName, setNewName] = useState("");
  const [newSector, setNewSector] = useState("");

  const { data: securitiesData, isLoading } = useQuery<{ securities: Security[] }>({
    queryKey: ["/api/admin/cie/securities"],
  });

  const { data: scoresData } = useQuery<{ scores: SecurityScore[] }>({
    queryKey: ["/api/admin/cie/scores"],
  });

  const scoreMap = new Map<number, SecurityScore>(
    (scoresData?.scores ?? []).map(s => [s.securityId, s]),
  );

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PUT", `/api/admin/cie/securities/${id}`, { isActive }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/securities"] }); },
    onError: () => { toast({ title: "Failed to update security", variant: "destructive" }); },
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/cie/securities", {
      symbol: newTicker.toUpperCase(), name: newName, sector: newSector,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/securities"] });
      toast({ title: "Security added" });
      setNewTicker(""); setNewName(""); setNewSector("");
    },
    onError: (e: any) => { toast({ title: e?.message ?? "Failed to add security", variant: "destructive" }); },
  });

  const securities = securitiesData?.securities ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add New Security</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-4 gap-3">
            <Input placeholder="Ticker (e.g. MTNN)" value={newTicker} onChange={e => setNewTicker(e.target.value)} data-testid="input-new-ticker" />
            <Input placeholder="Company name" value={newName} onChange={e => setNewName(e.target.value)} data-testid="input-new-name" />
            <Input placeholder="Sector" value={newSector} onChange={e => setNewSector(e.target.value)} data-testid="input-new-sector" />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newTicker || !newName || createMutation.isPending}
              className="gap-2"
              data-testid="button-add-security"
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">NGX Securities ({securities.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><LoadingSpinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead className="text-center">IAS</TableHead>
                    <TableHead className="text-center">RS</TableHead>
                    <TableHead>Recommendation</TableHead>
                    <TableHead>Score Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {securities.map(s => {
                    const sc = scoreMap.get(s.id);
                    return (
                      <TableRow key={s.id} data-testid={`row-security-${s.id}`}>
                        <TableCell className="font-mono font-semibold text-primary">{s.symbol}</TableCell>
                        <TableCell className="text-sm">{s.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.sector}</TableCell>
                        <TableCell className="text-center text-sm">{sc?.ias?.toFixed(1) ?? "—"}</TableCell>
                        <TableCell className="text-center text-sm">{sc?.rs?.toFixed(1) ?? "—"}</TableCell>
                        <TableCell>{recoBadge(sc?.recommendation ?? null)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(sc?.scoreDate)}</TableCell>
                        <TableCell>
                          <Badge variant={s.isActive ? "default" : "secondary"} data-testid={`badge-active-${s.id}`}>
                            {s.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => toggleMutation.mutate({ id: s.id, isActive: !s.isActive })}
                            disabled={toggleMutation.isPending}
                            data-testid={`button-toggle-security-${s.id}`}
                          >
                            {s.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Price Upload Tab ─────────────────────────────────────────────────────────

function PriceUploadTab() {
  const { toast } = useToast();
  const [preview, setPreview] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: logsData } = useQuery<{ logs: IngestionLog[] }>({
    queryKey: ["/api/admin/cie/ingest/logs"],
  });

  const scoreMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/cie/scores/run", {}),
    onSuccess: () => toast({ title: "Score recomputation triggered" }),
    onError: () => toast({ title: "Failed to trigger recomputation", variant: "destructive" }),
  });

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/cie/ingest/preview", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setPreview(data);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [toast]);

  const confirmMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/cie/ingest/confirm", {
      previewToken: preview?.previewToken,
      acceptedRowIndices: preview?.rows?.map((_: any, i: number) => i) ?? [],
    }),
    onSuccess: () => {
      toast({ title: "Data ingested successfully" });
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/ingest/logs"] });
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed to confirm", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Upload End-of-Day Prices</CardTitle>
            <CardDescription className="text-xs">Accepts CSV or XLSX with headers: ticker, trade_date, open, high, low, close, volume</CardDescription>
          </CardHeader>
          <CardContent>
            <label
              htmlFor="price-file-input"
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors border-border hover:border-primary/50"
              data-testid="dropzone-price-upload"
            >
              <input
                id="price-file-input"
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-file-upload"
              />
              <Upload className="h-8 w-8 text-muted-foreground mb-3" />
              {isUploading ? (
                <p className="text-sm text-muted-foreground">Processing…</p>
              ) : (
                <p className="text-sm text-muted-foreground">Click to browse CSV / XLSX</p>
              )}
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Score Engine</CardTitle>
            <CardDescription className="text-xs">Manually trigger a full IAS/RS/CS recomputation across all active securities</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full gap-2" variant="outline"
              onClick={() => scoreMutation.mutate()}
              disabled={scoreMutation.isPending}
              data-testid="button-recompute-scores"
            >
              {scoreMutation.isPending ? <LoadingSpinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
              Recompute All Scores
            </Button>
          </CardContent>
        </Card>
      </div>

      {preview && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-sm">Preview — {preview.rowCount} rows</CardTitle>
            <CardDescription className="text-xs">{preview.filename} · {preview.validRows} valid · {preview.invalidRows} invalid</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-y-auto mb-4 text-xs font-mono bg-muted rounded p-3 space-y-1">
              {(preview.rows ?? []).slice(0, 10).map((row: any, i: number) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground w-4">{i + 1}</span>
                  <span>{JSON.stringify(row)}</span>
                </div>
              ))}
              {(preview.rows ?? []).length > 10 && (
                <div className="text-muted-foreground">…and {preview.rows.length - 10} more</div>
              )}
            </div>
            <div className="flex gap-3">
              <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending} className="gap-2" data-testid="button-confirm-upload">
                <CheckCircle2 className="h-4 w-4" /> Confirm & Ingest
              </Button>
              <Button variant="outline" onClick={() => setPreview(null)} data-testid="button-cancel-upload">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Recent Ingestion Logs</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead className="text-center">Accepted</TableHead>
                <TableHead className="text-center">Rejected</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logsData?.logs ?? []).slice(0, 10).map(log => (
                <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                  <TableCell className="text-sm font-mono">{log.filename}</TableCell>
                  <TableCell className="text-center text-green-600">{log.rowsAccepted}</TableCell>
                  <TableCell className="text-center text-red-500">{log.rowsRejected}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === "completed" ? "default" : "secondary"}>{log.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</TableCell>
                </TableRow>
              ))}
              {!logsData?.logs?.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">No ingestion logs yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Model Editor Tab ─────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS = { momentum: 0.20, liquidity: 0.15, valuation: 0.20, quality: 0.15, growth: 0.15, financial_strength: 0.15 };
const PILLAR_LABELS: Record<string, string> = {
  momentum: "Momentum", liquidity: "Liquidity", valuation: "Valuation",
  quality: "Quality", growth: "Growth", financial_strength: "Financial Strength",
};

function ModelEditorTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = (user?.roles ?? []).includes("super_admin");
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS);
  const [notes, setNotes] = useState("");

  const { data: versionsData, isLoading } = useQuery<{ versions: ModelVersion[] }>({
    queryKey: ["/api/admin/cie/model-versions"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/cie/model-versions", { weights, notes: notes || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/model-versions"] });
      toast({ title: "Draft saved" });
      setNotes("");
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/cie/model-versions/${id}/submit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/model-versions"] });
      toast({ title: "Version submitted for approval" });
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/cie/model-versions/${id}/activate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/model-versions"] });
      toast({ title: "Model version activated" });
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
  });

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const isValid = Math.abs(total - 1.0) < 0.001;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pillar Weights</CardTitle>
          <CardDescription className="text-xs">Weights must sum to 1.0. Current total: <span className={isValid ? "text-green-600" : "text-red-500"}>{total.toFixed(3)}</span></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {Object.entries(weights).map(([key, val]) => (
              <div key={key}>
                <Label className="text-xs font-medium mb-1 block">{PILLAR_LABELS[key] ?? key}</Label>
                <Input
                  type="number" step="0.01" min="0" max="1"
                  value={val}
                  onChange={e => setWeights(w => ({ ...w, [key]: parseFloat(e.target.value) || 0 }))}
                  data-testid={`input-weight-${key}`}
                />
              </div>
            ))}
          </div>
          <Textarea
            placeholder="Version notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="mb-4"
            data-testid="textarea-model-notes"
          />
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!isValid || createMutation.isPending}
            className="gap-2"
            data-testid="button-save-draft"
          >
            <Save className="h-4 w-4" /> Save Draft
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Model Version History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Activated</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(versionsData?.versions ?? []).map(v => (
                  <TableRow key={v.id} data-testid={`row-model-${v.id}`}>
                    <TableCell className="font-mono text-sm">{v.version}</TableCell>
                    <TableCell>
                      <Badge variant={v.status === "active" ? "default" : v.status === "pending" ? "secondary" : "outline"}>
                        {v.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{v.notes ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(v.createdAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(v.activatedAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {v.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => submitMutation.mutate(v.id)} disabled={submitMutation.isPending} data-testid={`button-submit-${v.id}`}>
                            <Send className="h-3 w-3 mr-1" /> Submit
                          </Button>
                        )}
                        {v.status === "pending" && isSuperAdmin && (
                          <Button size="sm" onClick={() => activateMutation.mutate(v.id)} disabled={activateMutation.isPending} data-testid={`button-activate-${v.id}`}>
                            <Power className="h-3 w-3 mr-1" /> Activate
                          </Button>
                        )}
                        {v.status === "pending" && !isSuperAdmin && (
                          <span className="text-xs text-muted-foreground italic" title="Super-admin required to activate">Super-admin required</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!versionsData?.versions?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">No model versions yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Dividends Tab ────────────────────────────────────────────────────────────

function DividendsTab() {
  const { toast } = useToast();
  const [secId, setSecId] = useState("");
  const [exDate, setExDate] = useState("");
  const [payDate, setPayDate] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { data: dividendsData, isLoading } = useQuery<{ dividends: Dividend[]; count: number }>({
    queryKey: ["/api/admin/cie/dividends"],
  });

  const { data: securitiesData } = useQuery<{ securities: Security[] }>({
    queryKey: ["/api/admin/cie/securities"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/cie/dividends", {
      securityId: parseInt(secId), exDividendDate: exDate,
      paymentDate: payDate || undefined, amountPerShareNaira: parseFloat(amount),
      notes: notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/dividends"] });
      toast({ title: "Dividend added" });
      setSecId(""); setExDate(""); setPayDate(""); setAmount(""); setNotes("");
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/cie/dividends/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/dividends"] });
      toast({ title: "Dividend deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const securities = securitiesData?.securities ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-sm">Add Dividend Record</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
            <div>
              <Label className="text-xs mb-1 block">Security</Label>
              <Select value={secId} onValueChange={setSecId}>
                <SelectTrigger data-testid="select-dividend-security">
                  <SelectValue placeholder="Select ticker" />
                </SelectTrigger>
                <SelectContent>
                  {securities.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.symbol} — {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Ex-Dividend Date</Label>
              <Input type="date" value={exDate} onChange={e => setExDate(e.target.value)} data-testid="input-ex-date" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Payment Date (optional)</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} data-testid="input-pay-date" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Amount per Share (₦)</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} data-testid="input-dividend-amount" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Notes (optional)</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} data-testid="input-dividend-notes" />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!secId || !exDate || !amount || createMutation.isPending}
                className="gap-2 w-full"
                data-testid="button-add-dividend"
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Dividend Records ({dividendsData?.count ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Ex-Dividend Date</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Amount/Share</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dividendsData?.dividends ?? []).map(d => (
                  <TableRow key={d.id} data-testid={`row-dividend-${d.id}`}>
                    <TableCell className="font-mono font-semibold text-primary">{d.symbol}</TableCell>
                    <TableCell className="text-sm">{d.exDividendDate}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.paymentDate ?? "—"}</TableCell>
                    <TableCell className="text-sm">₦{(d.amountPerShareKobo / 100).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.notes ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => deleteMutation.mutate(d.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-dividend-${d.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!dividendsData?.dividends?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">No dividend records</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Signals Tab ──────────────────────────────────────────────────────────────

function SignalsTab() {
  const { toast } = useToast();
  const [ticker, setTicker] = useState("");
  const [type, setType] = useState("trade_call");
  const [sentiment, setSentiment] = useState("bullish");
  const [credibility, setCredibility] = useState("medium");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");

  const { data: signalsData, isLoading } = useQuery<{ signals: Signal[] }>({
    queryKey: ["/api/admin/cie/signals"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/cie/signals", {
      ticker: ticker || undefined, type, sentiment, credibility,
      headline, body: body || undefined, isPublished: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/signals"] });
      toast({ title: "Signal published" });
      setTicker(""); setHeadline(""); setBody("");
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/cie/signals/${id}`, undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/signals"] }); toast({ title: "Signal deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const sentimentColor: Record<string, string> = {
    bullish: "text-green-600", bearish: "text-red-500", neutral: "text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-sm">Publish Analyst Signal</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <Input placeholder="Ticker (optional)" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} data-testid="input-signal-ticker" />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-signal-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trade_call">Trade Call</SelectItem>
                <SelectItem value="news">News</SelectItem>
                <SelectItem value="rumour">Rumour</SelectItem>
                <SelectItem value="sector_rotation">Sector Rotation</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sentiment} onValueChange={setSentiment}>
              <SelectTrigger data-testid="select-signal-sentiment"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bullish">Bullish</SelectItem>
                <SelectItem value="bearish">Bearish</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
              </SelectContent>
            </Select>
            <Select value={credibility} onValueChange={setCredibility}>
              <SelectTrigger data-testid="select-signal-credibility"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Headline" value={headline} onChange={e => setHeadline(e.target.value)} className="mb-3" data-testid="input-signal-headline" />
          <Textarea placeholder="Body (optional)" value={body} onChange={e => setBody(e.target.value)} rows={3} className="mb-3" data-testid="textarea-signal-body" />
          <Button onClick={() => createMutation.mutate()} disabled={!headline || createMutation.isPending} className="gap-2" data-testid="button-publish-signal">
            <Zap className="h-4 w-4" /> Publish Signal
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Published Signals</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>Credibility</TableHead>
                  <TableHead>Headline</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(signalsData?.signals ?? []).map(s => (
                  <TableRow key={s.id} data-testid={`row-signal-${s.id}`}>
                    <TableCell className="font-mono text-primary font-semibold">{s.ticker ?? "—"}</TableCell>
                    <TableCell className="text-xs capitalize">{s.type.replace("_", " ")}</TableCell>
                    <TableCell className={`text-xs font-medium capitalize ${sentimentColor[s.sentiment] ?? ""}`}>{s.sentiment}</TableCell>
                    <TableCell className="text-xs capitalize">{s.credibility}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{s.headline}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(s.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-signal-${s.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!signalsData?.signals?.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">No signals published</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Revenue Tab ──────────────────────────────────────────────────────────────

function RevenueTab() {
  const { data: rev, isLoading } = useQuery<Revenue>({
    queryKey: ["/api/admin/cie/revenue"],
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>;

  const mrr = rev?.mrrNaira ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Subscribers", value: rev?.subscriberCount ?? 0, icon: Users, color: "text-blue-600" },
          { label: "Active Pro", value: rev?.proCount ?? 0, icon: Star, color: "text-purple-600" },
          { label: "Monthly Recurring Revenue", value: `₦${mrr.toLocaleString()}`, icon: DollarSign, color: "text-green-600" },
          { label: "Churn (last 30d)", value: rev?.churnLast30Days ?? 0, icon: Activity, color: "text-amber-600" },
        ].map((m, i) => (
          <Card key={i} data-testid={`card-revenue-metric-${i}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <m.icon className={`h-5 w-5 ${m.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{m.value}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Active Subscribers ({rev?.totalActive ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Renewal Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rev?.subscribers ?? []).map(s => (
                <TableRow key={s.id} data-testid={`row-subscriber-${s.id}`}>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{s.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{tierBadge(s.tier)}</TableCell>
                  <TableCell className="text-sm">{formatDate(s.renewalDate)}</TableCell>
                  <TableCell>
                    {s.cancelAtPeriodEnd ? (
                      <span className="text-xs text-amber-600">Cancels at period end</span>
                    ) : (
                      <span className="text-xs text-green-600">Active</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!(rev?.subscribers?.length) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">No active subscribers</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminCieCockpit() {
  return (
    <DashboardLayout role="admin" breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "CIE Engine" }]}>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-cie-cockpit-heading">Cellion Intelligence Engine</h1>
            <p className="text-sm text-muted-foreground">Admin research cockpit — securities, scores, models, signals</p>
          </div>
        </div>

        <Tabs defaultValue="securities">
          <TabsList className="mb-6 flex-wrap h-auto gap-1" data-testid="tabs-cie-cockpit">
            <TabsTrigger value="securities" className="gap-2" data-testid="tab-securities"><ArrowUpDown className="h-4 w-4" />Securities</TabsTrigger>
            <TabsTrigger value="prices" className="gap-2" data-testid="tab-prices"><Upload className="h-4 w-4" />Price Upload</TabsTrigger>
            <TabsTrigger value="model" className="gap-2" data-testid="tab-model"><Settings2 className="h-4 w-4" />Model Editor</TabsTrigger>
            <TabsTrigger value="dividends" className="gap-2" data-testid="tab-dividends"><Banknote className="h-4 w-4" />Dividends</TabsTrigger>
            <TabsTrigger value="signals" className="gap-2" data-testid="tab-signals"><Zap className="h-4 w-4" />Signals</TabsTrigger>
            <TabsTrigger value="revenue" className="gap-2" data-testid="tab-revenue"><TrendingUp className="h-4 w-4" />Revenue</TabsTrigger>
          </TabsList>

          <TabsContent value="securities"><SecuritiesTab /></TabsContent>
          <TabsContent value="prices"><PriceUploadTab /></TabsContent>
          <TabsContent value="model"><ModelEditorTab /></TabsContent>
          <TabsContent value="dividends"><DividendsTab /></TabsContent>
          <TabsContent value="signals"><SignalsTab /></TabsContent>
          <TabsContent value="revenue"><RevenueTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
