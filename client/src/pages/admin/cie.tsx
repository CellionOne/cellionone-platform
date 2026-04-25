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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, getCsrfToken } from "@/lib/queryClient";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  BarChart3, Upload, Settings2, Banknote, Zap, TrendingUp,
  RefreshCw, Plus, Trash2, CheckCircle2,
  Users, DollarSign, Activity, Star, ArrowUpDown,
  Save, Send, Power, Handshake, Copy, Check, KeyRound, Edit2, Sparkles, Download,
  AlertTriangle,
} from "lucide-react";
// ─── Types ────────────────────────────────────────────────────────────────────

interface Security {
  id: number; symbol: string; name: string; sector: string;
  isActive: boolean; exchange: string;
  // Analyst-maintained intelligence fields
  divBehaviourPattern?: string | null;
  entryZoneLowKobo?: number | null;
  entryZoneHighKobo?: number | null;
  targetPriceKobo?: number | null;
}

interface MarketContext {
  id?: number;
  contextDate: string;
  asiCloseKobo?: number | null;
  asiChangePctBps?: number | null;
  brentUsdCents?: number | null;
  ngnPerUsd?: number | null;
  cbnMprBps?: number | null;
  gainersCount?: number | null;
  losersCount?: number | null;
  notes?: string | null;
}

interface SecurityScore {
  securityId: number; symbol: string; name: string; sector: string;
  ias: number | null; rs: number | null; cs: number | null;
  recommendation: string | null; scoreDate: string;
}

interface IngestionLog {
  id: number; filename: string; rowsAccepted: number; rowsRejected: number;
  status: string; dataType?: string; createdAt: string; committedAt?: string | null;
}

interface ModelVersion {
  id: number; versionLabel: string; status: string; weights: Record<string, number>;
  notes: string | null; createdAt: string; activatedAt: string | null;
}

interface Dividend {
  id: number; securityId: number; exDividendDate: string;
  paymentDate: string | null; amountPerShareKobo: number; notes: string | null;
  symbol: string; name: string;
}

interface Signal {
  id: number; securityId: number | null; type: string; sentiment: string | null;
  credibility: number | null; content: string;
  isPublished: boolean; publishedAt: string | null; createdAt: string;
}

interface Revenue {
  subscriberCount: number; proCount: number; totalActive: number;
  mrrNaira: number; churnLast30Days: number; churnRatePct: number;
  subscribers: Array<{
    id: number; email: string; name: string; tier: string;
    renewalDate: string; cancelAtPeriodEnd: boolean;
  }>;
}

interface RejectedRow {
  rawSymbol: string;
  rawDate: string;
  rawClose: string;
  reason: string;
  source: "csv" | "xlsx" | "pdf";
}

interface PreviewResult {
  previewToken: string;
  filename: string;
  rowsExtracted: number;
  rowsAccepted: number;
  rowsRejected: number;
  acceptedRows: Array<{ rowIndex: number; [key: string]: string | number | null }>;
  previewRows: Array<Record<string, string | number | boolean | null> & { lowConfidence?: boolean }>;
  rejectedRows: RejectedRow[];
}

interface CiePartner {
  id: number;
  orgName: string;
  contactName: string | null;
  contactEmail: string | null;
  cellionRevenueSharePct: number;
  tier: string;
  status: string;
  notes: string | null;
  createdAt: string;
  activeKeyPrefix: string | null;
  mtdCalls: number;
}

interface PartnerRevenue {
  partnerId: number;
  orgName: string;
  tier: string;
  cellionRevenueSharePct: number;
  partnerRevenueSharePct: number;
  mtdCalls: number;
}

interface KeyRevealState {
  open: boolean;
  partnerName: string;
  plaintextKey: string;
}

function toErrorMessage(err: unknown, fallback = "An error occurred"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
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

const DIV_BEHAVIOUR_OPTIONS = [
  { value: "UNKNOWN", label: "Unknown" },
  { value: "HEAVY_SELL", label: "Heavy Sell (sell after ex-div)" },
  { value: "MODERATE", label: "Moderate (some sell-off)" },
  { value: "HOLDER", label: "Holder (price holds post-div)" },
  { value: "HOLDER_PLUS", label: "Holder+ (price rises post-div)" },
];

function divBehaviourBadge(pattern: string | null | undefined) {
  if (!pattern || pattern === "UNKNOWN") return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, string> = {
    HEAVY_SELL: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    MODERATE: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    HOLDER: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    HOLDER_PLUS: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  };
  const labels: Record<string, string> = { HEAVY_SELL: "Heavy Sell", MODERATE: "Moderate", HOLDER: "Holder", HOLDER_PLUS: "Holder+" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[pattern] ?? "bg-muted text-muted-foreground"}`}>{labels[pattern] ?? pattern}</span>;
}

// ─── Securities Tab ───────────────────────────────────────────────────────────

function SecuritiesTab() {
  const { toast } = useToast();
  const [newTicker, setNewTicker] = useState("");
  const [newName, setNewName] = useState("");
  const [newSector, setNewSector] = useState("");
  const [editingSec, setEditingSec] = useState<Security | null>(null);
  const [editBehaviour, setEditBehaviour] = useState("UNKNOWN");
  const [editEntryLow, setEditEntryLow] = useState("");
  const [editEntryHigh, setEditEntryHigh] = useState("");
  const [editTarget, setEditTarget] = useState("");

  const { data: securitiesData, isLoading } = useQuery<{ securities: Security[] }>({
    queryKey: ["/api/admin/cie/securities", "all"],
    queryFn: () => fetch("/api/admin/cie/securities?activeOnly=false", { credentials: "include" }).then(r => r.json()),
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
    onError: (err: unknown) => { toast({ title: toErrorMessage(err, "Failed to add security"), variant: "destructive" }); },
  });

  const updateIntelMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/admin/cie/securities/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/securities"] });
      toast({ title: "Intelligence fields updated" });
      setEditingSec(null);
    },
    onError: (err: unknown) => { toast({ title: toErrorMessage(err, "Failed to update"), variant: "destructive" }); },
  });

  const openEdit = (sec: Security) => {
    setEditingSec(sec);
    setEditBehaviour(sec.divBehaviourPattern ?? "UNKNOWN");
    setEditEntryLow(sec.entryZoneLowKobo ? String(sec.entryZoneLowKobo / 100) : "");
    setEditEntryHigh(sec.entryZoneHighKobo ? String(sec.entryZoneHighKobo / 100) : "");
    setEditTarget(sec.targetPriceKobo ? String(sec.targetPriceKobo / 100) : "");
  };

  const saveIntel = () => {
    if (!editingSec) return;
    updateIntelMutation.mutate({
      id: editingSec.id,
      data: {
        divBehaviourPattern: editBehaviour === "UNKNOWN" ? null : editBehaviour,
        entryZoneLowKobo: editEntryLow ? Math.round(parseFloat(editEntryLow) * 100) : null,
        entryZoneHighKobo: editEntryHigh ? Math.round(parseFloat(editEntryHigh) * 100) : null,
        targetPriceKobo: editTarget ? Math.round(parseFloat(editTarget) * 100) : null,
      },
    });
  };

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
          <CardDescription className="text-xs">Click the Edit icon on any security to set dividend behaviour pattern, entry zone, and target price.</CardDescription>
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
                    <TableHead>Rec</TableHead>
                    <TableHead>Div Behaviour</TableHead>
                    <TableHead>Entry Zone (₦)</TableHead>
                    <TableHead>Target (₦)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {securities.map(s => {
                    const sc = scoreMap.get(s.id);
                    const entryLow = s.entryZoneLowKobo ? (s.entryZoneLowKobo / 100).toFixed(2) : null;
                    const entryHigh = s.entryZoneHighKobo ? (s.entryZoneHighKobo / 100).toFixed(2) : null;
                    const target = s.targetPriceKobo ? (s.targetPriceKobo / 100).toFixed(2) : null;
                    return (
                      <TableRow key={s.id} data-testid={`row-security-${s.id}`}>
                        <TableCell className="font-mono font-semibold text-primary">{s.symbol}</TableCell>
                        <TableCell className="text-sm">{s.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.sector}</TableCell>
                        <TableCell className="text-center text-sm">{sc?.ias?.toFixed(1) ?? "—"}</TableCell>
                        <TableCell>{recoBadge(sc?.recommendation ?? null)}</TableCell>
                        <TableCell>{divBehaviourBadge(s.divBehaviourPattern)}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {entryLow && entryHigh ? `${entryLow}–${entryHigh}` : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {target ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.isActive ? "default" : "secondary"} data-testid={`badge-active-${s.id}`}>
                            {s.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={() => openEdit(s)}
                              data-testid={`button-edit-intel-${s.id}`}
                              title="Edit intelligence fields"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm" variant="outline"
                              onClick={() => toggleMutation.mutate({ id: s.id, isActive: !s.isActive })}
                              disabled={toggleMutation.isPending}
                              data-testid={`button-toggle-security-${s.id}`}
                            >
                              {s.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
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

      {/* Edit Intelligence Fields Dialog */}
      <Dialog open={!!editingSec} onOpenChange={open => { if (!open) setEditingSec(null); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-edit-intel">
          <DialogHeader>
            <DialogTitle>Edit Intel Fields — {editingSec?.symbol}</DialogTitle>
            <DialogDescription className="text-xs">Set dividend behaviour pattern, entry zone, and analyst target price. These fields are used in the Alpha Intel report and the public API.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Dividend Behaviour Pattern</Label>
              <Select value={editBehaviour} onValueChange={setEditBehaviour} data-testid="select-div-behaviour">
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIV_BEHAVIOUR_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Entry Zone Low (₦)</Label>
                <Input
                  type="number" step="0.01" placeholder="e.g. 42.50"
                  value={editEntryLow} onChange={e => setEditEntryLow(e.target.value)}
                  className="h-9 text-sm" data-testid="input-entry-low"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Entry Zone High (₦)</Label>
                <Input
                  type="number" step="0.01" placeholder="e.g. 48.00"
                  value={editEntryHigh} onChange={e => setEditEntryHigh(e.target.value)}
                  className="h-9 text-sm" data-testid="input-entry-high"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Analyst Target Price (₦)</Label>
              <Input
                type="number" step="0.01" placeholder="e.g. 65.00"
                value={editTarget} onChange={e => setEditTarget(e.target.value)}
                className="h-9 text-sm" data-testid="input-target-price"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={saveIntel}
                disabled={updateIntelMutation.isPending}
                className="flex-1 gap-2"
                data-testid="button-save-intel"
              >
                {updateIntelMutation.isPending ? <LoadingSpinner size="sm" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
              <Button variant="outline" onClick={() => setEditingSec(null)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Price Upload Tab ─────────────────────────────────────────────────────────

type WhatChangedItem = { ticker: string; field: string; oldVal: string; newVal: string };

function colourForClose(close: number | null | undefined, open: number | null | undefined) {
  if (close == null || open == null || open === 0) return "";
  if (close > open) return "text-green-600 dark:text-green-400 font-semibold";
  if (close < open) return "text-red-600 dark:text-red-400 font-semibold";
  return "text-muted-foreground";
}

interface DividendPreviewRow {
  rowIndex: number;
  ticker: string;
  exDividendDate: string;
  paymentDate: string | null;
  amountPerShareNaira: number;
  confidence: number;
  lowConfidence: boolean;
  error?: string;
}

interface DividendParsePreview {
  previewToken: string;
  rowsAccepted: number;
  rowsRejected: number;
  acceptedRows: DividendPreviewRow[];
  rejectedRows: Array<{ raw: string; reason: string }>;
}

function PriceUploadTab({ logsData }: { logsData?: { logs: IngestionLog[] } }) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [whatChanged, setWhatChanged] = useState<WhatChangedItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Price input mode: file upload vs paste text
  const [priceInputMode, setPriceInputMode] = useState<"file" | "paste">("file");
  const [pasteText, setPasteText] = useState("");
  const [isPasting, setIsPasting] = useState(false);

  // Dividend section state
  const [divMode, setDivMode] = useState<"csv" | "ai-file" | "ai-paste">("csv");
  const [divDragging, setDivDragging] = useState(false);
  const [divFileName, setDivFileName] = useState<string | null>(null);
  const [divUploading, setDivUploading] = useState(false);
  const [divResults, setDivResults] = useState<{ added: number; errors: string[] } | null>(null);
  const [divPasteText, setDivPasteText] = useState("");
  const [divAiPreview, setDivAiPreview] = useState<DividendParsePreview | null>(null);
  const [divConfirming, setDivConfirming] = useState(false);
  const [divSelectedRows, setDivSelectedRows] = useState<Set<number>>(new Set());
  const divFileRef = useRef<HTMLInputElement>(null);

  // Handle paste-text price preview
  const handlePastePreview = useCallback(async () => {
    if (!pasteText.trim()) return;
    setIsPasting(true);
    setIsConfirmed(false);
    setWhatChanged([]);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch("/api/admin/cie/ingest/preview-text", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ text: pasteText }),
      });
      const data: PreviewResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data);
    } catch (err: unknown) {
      toast({ title: toErrorMessage(err, "Preview failed"), variant: "destructive" });
    } finally {
      setIsPasting(false);
    }
  }, [pasteText, toast]);

  // Handle CSV dividend upload (legacy fast path)
  const handleDivCsvFile = useCallback(async (file: File) => {
    setDivUploading(true);
    setDivFileName(file.name);
    setDivResults(null);
    try {
      const text = await file.text();
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error("File must have a header row and at least one data row.");
      const header = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));
      const rows = lines.slice(1);
      let added = 0;
      const errors: string[] = [];
      const csrfToken = await getCsrfToken();
      for (const row of rows) {
        const cols = row.split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
        const get = (keys: string[]) => { for (const k of keys) { const i = header.indexOf(k); if (i >= 0) return cols[i]; } return ""; };
        const ticker = get(["ticker", "symbol"]);
        const amtStr = get(["amount_per_share", "amount", "dividend"]);
        const exDate = get(["ex_dividend_date", "ex_date", "exdate"]);
        const payDate = get(["payment_date", "pay_date", "paydate"]);
        if (!ticker || !amtStr || !exDate) { errors.push(`Row skipped (missing ticker/amount/ex_date): ${row.slice(0, 40)}`); continue; }
        const amount = parseFloat(amtStr);
        if (isNaN(amount) || amount <= 0) { errors.push(`${ticker}: invalid amount "${amtStr}"`); continue; }
        try {
          const res = await fetch("/api/admin/cie/dividends", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
            body: JSON.stringify({ ticker, amountPerShareNaira: amount, exDividendDate: exDate, paymentDate: payDate || undefined }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            errors.push(`${ticker}: ${err.error ?? res.statusText}`);
          } else { added++; }
        } catch (e) { errors.push(`${ticker}: network error`); }
      }
      setDivResults({ added, errors });
      if (added > 0) {
        toast({ title: `Dividend upload: ${added} record${added !== 1 ? "s" : ""} added${errors.length ? `, ${errors.length} errors` : ""}` });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/dividends"] });
      } else {
        toast({ title: "Dividend upload: no records added", variant: "destructive" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast({ title: msg, variant: "destructive" });
    } finally { setDivUploading(false); }
  }, [toast]);

  // Handle AI dividend document parsing (PDF/DOCX file)
  const handleDivAiFile = useCallback(async (file: File) => {
    setDivUploading(true);
    setDivFileName(file.name);
    setDivAiPreview(null);
    setDivResults(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const csrfToken = await getCsrfToken();
      const res = await fetch("/api/admin/cie/dividends/parse-document", {
        method: "POST",
        body: form,
        credentials: "include",
        headers: { "X-CSRF-Token": csrfToken },
      });
      const data: DividendParsePreview & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parsing failed");
      setDivAiPreview(data);
      setDivSelectedRows(new Set(data.acceptedRows.map(r => r.rowIndex)));
      if (data.rowsAccepted === 0) toast({ title: "No dividend records found in document", variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: toErrorMessage(err, "Dividend parsing failed"), variant: "destructive" });
    } finally { setDivUploading(false); }
  }, [toast]);

  // Handle AI dividend paste text
  const handleDivAiPaste = useCallback(async () => {
    if (!divPasteText.trim()) return;
    setDivUploading(true);
    setDivAiPreview(null);
    setDivResults(null);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch("/api/admin/cie/dividends/parse-document", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ text: divPasteText }),
      });
      const data: DividendParsePreview & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parsing failed");
      setDivAiPreview(data);
      setDivSelectedRows(new Set(data.acceptedRows.map(r => r.rowIndex)));
      if (data.rowsAccepted === 0) toast({ title: "No dividend records found in text", variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: toErrorMessage(err, "Dividend parsing failed"), variant: "destructive" });
    } finally { setDivUploading(false); }
  }, [divPasteText, toast]);

  // Commit AI-extracted dividends
  const handleDivAiConfirm = useCallback(async () => {
    if (!divAiPreview) return;
    setDivConfirming(true);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch("/api/admin/cie/dividends/confirm-parsed", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          previewToken: divAiPreview.previewToken,
          acceptedRowIndices: [...divSelectedRows],
        }),
      });
      const data: { committed: number; skipped: number; errors: string[]; message: string; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Commit failed");
      setDivResults({ added: data.committed, errors: data.errors ?? [] });
      setDivAiPreview(null);
      setDivSelectedRows(new Set());
      toast({ title: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/dividends"] });
    } catch (err: unknown) {
      toast({ title: toErrorMessage(err, "Failed to commit dividends"), variant: "destructive" });
    } finally { setDivConfirming(false); }
  }, [divAiPreview, divSelectedRows, toast]);

  const handleDivFile = useCallback(async (file: File) => {
    const fn = file.name.toLowerCase();
    if (divMode === "csv" || fn.endsWith(".csv")) {
      return handleDivCsvFile(file);
    }
    return handleDivAiFile(file);
  }, [divMode, handleDivCsvFile, handleDivAiFile]);

  // Market Context inputs
  const [ctxDate, setCtxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ctxAsi, setCtxAsi] = useState("");
  const [ctxAsiChange, setCtxAsiChange] = useState("");
  const [ctxBrent, setCtxBrent] = useState("");
  const [ctxNgn, setCtxNgn] = useState("");
  const [ctxMpr, setCtxMpr] = useState("");
  const [ctxGainers, setCtxGainers] = useState("");
  const [ctxLosers, setCtxLosers] = useState("");
  const [ctxNotes, setCtxNotes] = useState("");

  const { data: latestCtxRaw } = useQuery<MarketContext | null>({
    queryKey: ["/api/admin/cie/market-context/latest"],
    staleTime: 60 * 1000,
  });
  const latestCtx = { context: latestCtxRaw ?? null };

  const { data: aiStatus } = useQuery<{ available: boolean }>({
    queryKey: ["/api/cie-portal/ai-status"],
    staleTime: 5 * 60 * 1000,
  });
  const aiAvailable = aiStatus?.available !== false;

  const scoreMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/cie/scores/run", {}),
    onSuccess: () => {
      toast({ title: "Score engine triggered — results update in ~30 seconds" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/scores"] });
    },
    onError: (err: unknown) => toast({ title: toErrorMessage(err, "Failed to trigger score engine"), variant: "destructive" }),
  });

  const aiCommentaryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/cie/market-pulse/ai-commentary", {});
      return res.json() as Promise<{ commentary: string }>;
    },
    onSuccess: () => toast({ title: "AI market commentary regenerated" }),
    onError: (err: unknown) => toast({ title: toErrorMessage(err, "AI commentary failed"), variant: "destructive" }),
  });

  const ctxMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/cie/market-context", {
      contextDate: ctxDate,
      asiClose: ctxAsi ? parseFloat(ctxAsi) : undefined,
      asiChangePct: ctxAsiChange ? parseFloat(ctxAsiChange) : undefined,
      brentUsd: ctxBrent ? parseFloat(ctxBrent) : undefined,
      ngnPerUsd: ctxNgn ? parseFloat(ctxNgn) : undefined,
      cbnMpr: ctxMpr ? parseFloat(ctxMpr) : undefined,
      gainersCount: ctxGainers ? parseInt(ctxGainers) : undefined,
      losersCount: ctxLosers ? parseInt(ctxLosers) : undefined,
      notes: ctxNotes || undefined,
    }),
    onSuccess: () => {
      toast({ title: "Market context saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/market-context/latest"] });
    },
    onError: (err: unknown) => toast({ title: toErrorMessage(err, "Failed to save context"), variant: "destructive" }),
  });

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setIsConfirmed(false);
    setWhatChanged([]);
    try {
      const form = new FormData();
      form.append("file", file);
      const csrfToken = await getCsrfToken();
      const res = await fetch("/api/admin/cie/ingest/preview", {
        method: "POST",
        body: form,
        credentials: "include",
        headers: { "X-CSRF-Token": csrfToken },
      });
      const data: PreviewResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setPreview(data);
    } catch (err: unknown) {
      toast({ title: toErrorMessage(err, "Upload failed"), variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!preview?.previewToken) throw new Error("Preview token missing. Please upload the file again.");
      const res = await apiRequest("POST", "/api/admin/cie/ingest/confirm", {
        previewToken: preview.previewToken,
        acceptedRowIndices: (preview.acceptedRows ?? []).map(r => r.rowIndex),
      });
      return res.json() as Promise<{ whatChanged?: WhatChangedItem[] }>;
    },
    onSuccess: (data) => {
      toast({ title: `${preview?.rowsAccepted ?? 0} rows ingested successfully` });
      setWhatChanged(data?.whatChanged ?? []);
      setIsConfirmed(true);
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/ingest/logs"] });
    },
    onError: (err: unknown) => toast({ title: toErrorMessage(err, "Failed to confirm"), variant: "destructive" }),
  });

  // Download Alpha Intel report
  const downloadReport = async () => {
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch("/api/admin/cie/report/latest", {
        credentials: "include",
        headers: { "X-CSRF-Token": csrfToken },
      });
      if (!res.ok) throw new Error("Report generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `Alpha_Intel_NGX_${date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Alpha Intel report downloaded" });
    } catch (err: unknown) {
      toast({ title: toErrorMessage(err, "Failed to download report"), variant: "destructive" });
    }
  };

  // Preview table columns derived from actual row keys (exclude internal flags)
  const EXCLUDED_COLS = new Set(["lowConfidence", "rowIndex", "confidence", "source", "error"]);
  const previewCols = preview?.previewRows?.[0]
    ? Object.keys(preview.previewRows[0]).filter(k => !EXCLUDED_COLS.has(k))
    : [];

  // Template CSV downloads
  const downloadTemplate = useCallback((name: string, headers: string[], exampleRow: string[]) => {
    const csv = [headers.join(","), exampleRow.join(",")].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="space-y-6">

      {/* ── Daily Upload Card ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-sm">Daily Upload</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Drop the NGX end-of-day price file then fill in the market context for today. Deadline: <strong>18:30 WAT</strong>.
              </CardDescription>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              <Button
                variant="outline" size="sm" className="gap-1.5 text-xs"
                onClick={downloadReport}
                data-testid="button-download-report"
              >
                <Download className="h-3.5 w-3.5" /> Alpha Intel Report
              </Button>
              <Button
                variant="outline" size="sm" className="gap-1.5 text-xs"
                onClick={() => scoreMutation.mutate()}
                disabled={scoreMutation.isPending}
                data-testid="button-recompute-scores"
              >
                {scoreMutation.isPending ? <LoadingSpinner size="sm" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Run Score Engine
              </Button>
              <Button
                variant="outline" size="sm" className="gap-1.5 text-xs"
                onClick={() => aiCommentaryMutation.mutate()}
                disabled={aiCommentaryMutation.isPending || !aiAvailable}
                title={!aiAvailable ? "AI unavailable — OPENAI_API_KEY not configured" : undefined}
                data-testid="button-regenerate-commentary"
              >
                {aiCommentaryMutation.isPending ? <LoadingSpinner size="sm" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
                AI Commentary
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Price input mode tabs */}
          <div className="flex gap-1 border-b border-border mb-3">
            <button
              className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${priceInputMode === "file" ? "bg-primary/10 text-primary border border-b-0 border-border" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setPriceInputMode("file"); setPreview(null); }}
              data-testid="tab-price-file"
            ><Upload className="inline h-3 w-3 mr-1" />Upload File</button>
            <button
              className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${priceInputMode === "paste" ? "bg-primary/10 text-primary border border-b-0 border-border" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setPriceInputMode("paste"); setPreview(null); }}
              data-testid="tab-price-paste"
            ><Sparkles className="inline h-3 w-3 mr-1" />Paste Text</button>
          </div>

          {priceInputMode === "file" ? (
            /* Drop zone */
            <label
              htmlFor="price-file-input"
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              data-testid="dropzone-price-upload"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                id="price-file-input"
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.pdf,.docx"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-file-upload"
              />
              <Upload className={`h-8 w-8 mb-3 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
              {isUploading ? (
                <><LoadingSpinner size="sm" /><p className="text-sm text-muted-foreground mt-2">Extracting rows…</p></>
              ) : isDragging ? (
                <p className="text-sm text-primary font-medium">Drop to preview</p>
              ) : (
                <>
                  <p className="text-sm font-medium">Drag & drop CSV / XLSX / PDF / DOCX here</p>
                  <p className="text-xs text-muted-foreground mt-1">NGX lists, Nairametrics tables, broker reports — any format</p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                  <div className="flex gap-2 mt-3" onClick={e => e.preventDefault()}>
                    <Button
                      type="button" variant="outline" size="sm" className="gap-1 text-xs h-7 px-2"
                      onClick={() => downloadTemplate("prices_template.csv",
                        ["ticker","trade_date","open","high","low","close","volume"],
                        ["DANGCEM","2026-04-22","450.50","455.00","448.00","452.00","1200000"])}
                      data-testid="button-template-prices"
                    ><Download className="h-3 w-3" /> Prices Template</Button>
                    <Button
                      type="button" variant="outline" size="sm" className="gap-1 text-xs h-7 px-2"
                      onClick={() => downloadTemplate("dividends_template.csv",
                        ["ticker","amount_per_share","ex_dividend_date","payment_date"],
                        ["DANGCEM","3.50","2026-05-10","2026-05-31"])}
                      data-testid="button-template-dividends"
                    ><Download className="h-3 w-3" /> Dividends Template</Button>
                  </div>
                </>
              )}
            </label>
          ) : (
            /* Paste text input */
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Paste price data from Nairametrics, NSE, broker notes, or any market source. AI will extract the rows.</p>
              <Textarea
                placeholder="Paste price table or market report text here…"
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                className="min-h-[140px] text-xs font-mono"
                data-testid="textarea-price-paste"
              />
              <div className="flex justify-end">
                <Button
                  size="sm" className="gap-2 text-xs"
                  onClick={handlePastePreview}
                  disabled={isPasting || !pasteText.trim()}
                  data-testid="button-paste-preview"
                >
                  {isPasting ? <LoadingSpinner size="sm" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {isPasting ? "Extracting…" : "Extract & Preview"}
                </Button>
              </div>
            </div>
          )}

          {/* Market Context inputs */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Market Context</p>
              {latestCtx?.context && (
                <span className="text-xs text-muted-foreground">Last saved: {formatDate(latestCtx.context.contextDate)}</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={ctxDate} onChange={e => setCtxDate(e.target.value)} className="h-8 text-xs" data-testid="input-ctx-date" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ASI Close (₦)</Label>
                <Input type="number" step="0.01" placeholder="e.g. 98242.15" value={ctxAsi} onChange={e => setCtxAsi(e.target.value)} className="h-8 text-xs" data-testid="input-ctx-asi" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ASI Change %</Label>
                <Input type="number" step="0.01" placeholder="e.g. -0.45" value={ctxAsiChange} onChange={e => setCtxAsiChange(e.target.value)} className="h-8 text-xs" data-testid="input-ctx-asi-change" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gainers / Losers</Label>
                <div className="flex gap-1">
                  <Input type="number" placeholder="G" value={ctxGainers} onChange={e => setCtxGainers(e.target.value)} className="h-8 text-xs w-full" data-testid="input-ctx-gainers" />
                  <Input type="number" placeholder="L" value={ctxLosers} onChange={e => setCtxLosers(e.target.value)} className="h-8 text-xs w-full" data-testid="input-ctx-losers" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Brent Crude (USD)</Label>
                <Input type="number" step="0.01" placeholder="e.g. 74.20" value={ctxBrent} onChange={e => setCtxBrent(e.target.value)} className="h-8 text-xs" data-testid="input-ctx-brent" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">NGN/USD Rate</Label>
                <Input type="number" step="0.01" placeholder="e.g. 1595.00" value={ctxNgn} onChange={e => setCtxNgn(e.target.value)} className="h-8 text-xs" data-testid="input-ctx-ngn" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CBN MPR %</Label>
                <Input type="number" step="0.25" placeholder="e.g. 27.50" value={ctxMpr} onChange={e => setCtxMpr(e.target.value)} className="h-8 text-xs" data-testid="input-ctx-mpr" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Analyst notes</Label>
                <Input placeholder="Optional headline" value={ctxNotes} onChange={e => setCtxNotes(e.target.value)} className="h-8 text-xs" data-testid="input-ctx-notes" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm" className="gap-2 text-xs"
                onClick={() => ctxMutation.mutate()}
                disabled={ctxMutation.isPending}
                data-testid="button-save-market-context"
              >
                {ctxMutation.isPending ? <LoadingSpinner size="sm" /> : <Save className="h-3.5 w-3.5" />}
                Save Market Context
              </Button>
            </div>
          </div>

          {/* Dividend Data Section */}
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Optional: Dividend Data</p>
              <div className="flex gap-1">
                {(["csv","ai-file","ai-paste"] as const).map(m => (
                  <button key={m}
                    className={`px-2 py-0.5 text-xs rounded transition-colors ${divMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground border border-border"}`}
                    onClick={() => { setDivMode(m); setDivAiPreview(null); setDivResults(null); setDivFileName(null); }}
                    data-testid={`tab-div-${m}`}
                  >{m === "csv" ? "CSV Template" : m === "ai-file" ? "PDF / DOCX" : "Paste Text"}</button>
                ))}
              </div>
            </div>

            {divMode === "csv" && (
              <label
                htmlFor="div-file-input"
                className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                  divDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 bg-background"
                }`}
                data-testid="dropzone-dividend-upload"
                onDragOver={e => { e.preventDefault(); setDivDragging(true); }}
                onDragLeave={() => setDivDragging(false)}
                onDrop={e => { e.preventDefault(); setDivDragging(false); const f = e.dataTransfer.files[0]; if (f) handleDivFile(f); }}
              >
                <input
                  id="div-file-input"
                  ref={divFileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleDivFile(f); e.target.value = ""; }}
                  data-testid="input-dividend-file-upload"
                />
                {divUploading ? <LoadingSpinner size="sm" /> : <Upload className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                <span className="text-xs text-muted-foreground">
                  {divUploading ? "Processing…" : divFileName ? divFileName : "Drop CSV or click to browse (ticker, amount_per_share, ex_dividend_date, payment_date)"}
                </span>
              </label>
            )}

            {divMode === "ai-file" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Upload a dividend announcement PDF or Word document. AI will extract the records for your review.</p>
                <label
                  htmlFor="div-ai-file-input"
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                    divDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 bg-background"
                  }`}
                  data-testid="dropzone-dividend-ai-upload"
                  onDragOver={e => { e.preventDefault(); setDivDragging(true); }}
                  onDragLeave={() => setDivDragging(false)}
                  onDrop={e => { e.preventDefault(); setDivDragging(false); const f = e.dataTransfer.files[0]; if (f) handleDivAiFile(f); }}
                >
                  <input
                    id="div-ai-file-input"
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleDivAiFile(f); e.target.value = ""; }}
                    data-testid="input-dividend-ai-file-upload"
                  />
                  {divUploading ? <LoadingSpinner size="sm" /> : <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                  <span className="text-xs text-muted-foreground">
                    {divUploading ? "Extracting with AI…" : divFileName ? divFileName : "Drop PDF or DOCX or click to browse"}
                  </span>
                </label>
              </div>
            )}

            {divMode === "ai-paste" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Paste a dividend announcement from Nairametrics, NSE, or any source. AI will extract ticker, ex-date, payment date, and amount.</p>
                <Textarea
                  placeholder="Paste dividend announcement text here…"
                  value={divPasteText}
                  onChange={e => setDivPasteText(e.target.value)}
                  className="min-h-[100px] text-xs font-mono"
                  data-testid="textarea-dividend-paste"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm" className="gap-2 text-xs"
                    onClick={handleDivAiPaste}
                    disabled={divUploading || !divPasteText.trim()}
                    data-testid="button-dividend-paste-extract"
                  >
                    {divUploading ? <LoadingSpinner size="sm" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {divUploading ? "Extracting…" : "Extract & Review"}
                  </Button>
                </div>
              </div>
            )}

            {/* AI dividend preview table */}
            {divAiPreview && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">
                    {divAiPreview.rowsAccepted} record{divAiPreview.rowsAccepted !== 1 ? "s" : ""} found
                    {divAiPreview.rowsRejected > 0 && <span className="text-red-500 ml-1">({divAiPreview.rowsRejected} rejected)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{divSelectedRows.size} selected</p>
                </div>
                <div className="rounded-md border overflow-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted/50 text-left">
                      <th className="px-2 py-1 font-medium w-6"></th>
                      <th className="px-2 py-1 font-medium">Ticker</th>
                      <th className="px-2 py-1 font-medium">Ex-Date</th>
                      <th className="px-2 py-1 font-medium">Pay Date</th>
                      <th className="px-2 py-1 font-medium text-right">Amount (₦)</th>
                      <th className="px-2 py-1 font-medium">Conf.</th>
                    </tr></thead>
                    <tbody>
                      {divAiPreview.acceptedRows.map(row => (
                        <tr key={row.rowIndex} className={`border-t ${row.lowConfidence ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                          <td className="px-2 py-1">
                            <input type="checkbox" checked={divSelectedRows.has(row.rowIndex)}
                              onChange={e => {
                                const s = new Set(divSelectedRows);
                                if (e.target.checked) s.add(row.rowIndex); else s.delete(row.rowIndex);
                                setDivSelectedRows(s);
                              }}
                              data-testid={`checkbox-div-row-${row.rowIndex}`}
                            />
                          </td>
                          <td className="px-2 py-1 font-mono font-semibold">{row.ticker}</td>
                          <td className="px-2 py-1">{row.exDividendDate}</td>
                          <td className="px-2 py-1">{row.paymentDate ?? "—"}</td>
                          <td className="px-2 py-1 text-right">{row.amountPerShareNaira.toFixed(2)}</td>
                          <td className={`px-2 py-1 ${row.lowConfidence ? "text-amber-600" : "text-green-600"}`}>{(row.confidence * 100).toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {divAiPreview.rejectedRows.length > 0 && (
                  <div className="space-y-0.5">
                    {divAiPreview.rejectedRows.slice(0, 3).map((r, i) => (
                      <p key={i} className="text-xs text-red-600 dark:text-red-400">{r.raw}: {r.reason}</p>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => { setDivAiPreview(null); setDivFileName(null); }} data-testid="button-dividend-ai-cancel">Cancel</Button>
                  <Button size="sm" className="gap-2 text-xs" onClick={handleDivAiConfirm} disabled={divConfirming || divSelectedRows.size === 0} data-testid="button-dividend-ai-confirm">
                    {divConfirming ? <LoadingSpinner size="sm" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Commit {divSelectedRows.size} Record{divSelectedRows.size !== 1 ? "s" : ""}
                  </Button>
                </div>
              </div>
            )}

            {divResults && !divAiPreview && (
              <div className="text-xs space-y-1">
                <p className={divResults.added > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                  {divResults.added} dividend record{divResults.added !== 1 ? "s" : ""} added
                </p>
                {divResults.errors.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-red-600 dark:text-red-400">{err}</p>
                ))}
                {divResults.errors.length > 5 && (
                  <p className="text-muted-foreground">…and {divResults.errors.length - 5} more errors</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Colour-coded Preview Table ─────────────────────────── */}
      {preview && (
        <Card className="border-primary/40">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm">
                  Preview — {preview.rowsExtracted} rows
                  <span className="ml-2 text-xs font-normal text-green-600 dark:text-green-400">{preview.rowsAccepted} accepted</span>
                  {preview.rowsRejected > 0 && (
                    <span className="ml-1 text-xs font-normal text-red-600 dark:text-red-400">{preview.rowsRejected} rejected</span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">{preview.filename}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Row legend */}
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-100 dark:bg-green-950 border border-green-300 dark:border-green-800 flex-shrink-0" />Accepted</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 flex-shrink-0" />Low confidence / unrecognized symbol</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-800 flex-shrink-0" />Rejected (see below)</span>
            </div>

            {/* Accepted rows table */}
            {(preview.previewRows ?? []).length > 0 && (
              <div className="rounded-md border overflow-x-auto max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableHead className="text-xs py-2 h-auto w-6">#</TableHead>
                      {previewCols.map(col => (
                        <TableHead key={col} className="text-xs py-2 h-auto capitalize">{col.replace(/_/g, " ")}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(preview.previewRows ?? []).slice(0, 20).map((row, i) => {
                      const rowBg = row.lowConfidence
                        ? "bg-amber-50 dark:bg-amber-950/30"
                        : "bg-green-50/40 dark:bg-green-950/20";
                      return (
                        <TableRow key={i} data-testid={`row-preview-${i}`} className={`text-xs ${rowBg}`}>
                          <TableCell className="py-1.5 text-muted-foreground font-mono">{i + 1}</TableCell>
                          {previewCols.map(col => {
                            const isClose = col === "close";
                            const open = typeof row.open === "number" ? row.open : null;
                            const val = row[col];
                            return (
                              <TableCell
                                key={col}
                                className={`py-1.5 font-mono ${isClose ? colourForClose(typeof val === "number" ? val : null, open) : ""}`}
                              >
                                {val ?? "—"}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                    {(preview.previewRows ?? []).length > 20 && (
                      <TableRow>
                        <TableCell colSpan={previewCols.length + 1} className="text-center text-xs text-muted-foreground py-2">
                          …and {preview.previewRows.length - 20} more rows
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Rejected rows accordion */}
            {(preview.rowsRejected ?? 0) > 0 && (
              <Accordion type="single" collapsible className="rounded-md border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 px-3" data-testid="accordion-rejected-rows">
                <AccordionItem value="rejected" className="border-0">
                  <AccordionTrigger className="text-xs font-semibold text-red-700 dark:text-red-400 hover:no-underline py-3" data-testid="trigger-rejected-rows">
                    <span className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs font-bold">
                        {preview.rowsRejected}
                      </span>
                      Rejected rows {(preview.rejectedRows?.length ?? 0) < preview.rowsRejected ? `(showing ${preview.rejectedRows?.length ?? 0})` : ""}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {(preview.rejectedRows?.length ?? 0) > 0 ? (
                      <>
                        <div className="overflow-x-auto rounded border border-red-100 dark:border-red-900">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-red-100/60 dark:bg-red-950/40">
                                <TableHead className="text-xs py-2 h-auto">#</TableHead>
                                <TableHead className="text-xs py-2 h-auto">Symbol</TableHead>
                                <TableHead className="text-xs py-2 h-auto">Date</TableHead>
                                <TableHead className="text-xs py-2 h-auto">Close</TableHead>
                                <TableHead className="text-xs py-2 h-auto">Reason</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {preview.rejectedRows.map((row, i) => (
                                <TableRow key={i} data-testid={`row-rejected-${i}`} className="text-xs">
                                  <TableCell className="py-1.5 text-muted-foreground font-mono">{i + 1}</TableCell>
                                  <TableCell className="py-1.5 font-mono font-semibold">{row.rawSymbol || "—"}</TableCell>
                                  <TableCell className="py-1.5 font-mono">{row.rawDate || "—"}</TableCell>
                                  <TableCell className="py-1.5 font-mono">{row.rawClose || "—"}</TableCell>
                                  <TableCell className="py-1.5 text-red-600 dark:text-red-400">{row.reason}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm" variant="outline" className="gap-2 text-xs"
                            data-testid="button-download-rejected-csv"
                            onClick={() => {
                              const headers = ["#", "Symbol", "Date", "Close", "Reason"];
                              const rows = preview.rejectedRows.map((r, i) =>
                                [i + 1, r.rawSymbol, r.rawDate, r.rawClose, r.reason].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
                              );
                              const csv = [headers.join(","), ...rows].join("\n");
                              const blob = new Blob([csv], { type: "text/csv" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `${preview.filename.replace(/\.[^.]+$/, "")}_rejected.csv`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                          >
                            <Download className="h-3.5 w-3.5" /> Download rejected CSV
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground pb-2">Row details not available for this preview.</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {preview.rowsAccepted === 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400" data-testid="warning-no-rows">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>No rows could be extracted. Check file format — unsupported column names, scanned PDF, or no price data. Contact support if the issue persists.</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending || preview.rowsAccepted === 0}
                className="gap-2"
                data-testid="button-confirm-upload"
              >
                {confirmMutation.isPending ? <LoadingSpinner size="sm" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirm & Ingest
              </Button>
              <Button variant="outline" onClick={() => setPreview(null)} data-testid="button-cancel-upload">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── What Changed Panel ─────────────────────────────────── */}
      {isConfirmed && (
        <Card className="border-green-500/40 bg-green-50/30 dark:bg-green-950/10">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-sm text-green-700 dark:text-green-400">Upload Complete</CardTitle>
                <CardDescription className="text-xs">Prices committed. Run the Score Engine to update IAS/RS/CS and generate fresh signals.</CardDescription>
              </div>
              <Button
                className="gap-2 shrink-0"
                onClick={() => scoreMutation.mutate()}
                disabled={scoreMutation.isPending}
                data-testid="button-run-engine-post-confirm"
              >
                {scoreMutation.isPending ? <LoadingSpinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
                Run Score Engine
              </Button>
            </div>
          </CardHeader>
          {whatChanged.length > 0 && (
            <CardContent className="pt-0">
              <p className="text-xs font-semibold mb-2 text-foreground">Threshold crossings detected ({whatChanged.length})</p>
              <div className="rounded-md border overflow-x-auto max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableHead className="text-xs py-2 h-auto">Ticker</TableHead>
                      <TableHead className="text-xs py-2 h-auto">Field</TableHead>
                      <TableHead className="text-xs py-2 h-auto">Previous</TableHead>
                      <TableHead className="text-xs py-2 h-auto">New</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {whatChanged.map((item, i) => (
                      <TableRow key={i} className="text-xs" data-testid={`row-changed-${i}`}>
                        <TableCell className="py-1.5 font-mono font-semibold text-primary">{item.ticker}</TableCell>
                        <TableCell className="py-1.5 text-muted-foreground">{item.field}</TableCell>
                        <TableCell className="py-1.5 font-mono text-red-600 dark:text-red-400">{item.oldVal}</TableCell>
                        <TableCell className="py-1.5 font-mono text-green-600 dark:text-green-400">{item.newVal}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
          {whatChanged.length === 0 && isConfirmed && (
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">No recommendation threshold crossings on this upload.</p>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Ingestion Log ─────────────────────────────────────── */}
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
                  <TableCell className="text-center text-green-600 dark:text-green-400">{log.rowsAccepted}</TableCell>
                  <TableCell className="text-center text-red-500">{log.rowsRejected}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === "committed" ? "default" : log.status === "completed" ? "default" : "secondary"}>{log.status}</Badge>
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

const DEFAULT_WEIGHTS = { momentum: 0.20, liquidity: 0.15, valuation: 0.20, quality: 0.15, growth: 0.15, financialStrength: 0.15 };
const PILLAR_LABELS: Record<string, string> = {
  momentum: "Momentum", liquidity: "Liquidity", valuation: "Valuation",
  quality: "Quality", growth: "Growth", financialStrength: "Financial Strength",
};

function ModelEditorTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = (user?.roles ?? []).includes("super_admin");
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS);
  const [versionLabel, setVersionLabel] = useState("");
  const [notes, setNotes] = useState("");

  const { data: versionsData, isLoading } = useQuery<{ versions: ModelVersion[] }>({
    queryKey: ["/api/admin/cie/model-versions"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/cie/model-versions", { versionLabel: versionLabel.trim(), weights, notes: notes || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/model-versions"] });
      toast({ title: "Draft saved" });
      setVersionLabel(""); setNotes("");
    },
    onError: (err: unknown) => toast({ title: toErrorMessage(err, "Failed"), variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/cie/model-versions/${id}/submit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/model-versions"] });
      toast({ title: "Version submitted for approval" });
    },
    onError: (err: unknown) => toast({ title: toErrorMessage(err, "Failed"), variant: "destructive" }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/cie/model-versions/${id}/activate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/model-versions"] });
      toast({ title: "Model version activated" });
    },
    onError: (err: unknown) => toast({ title: toErrorMessage(err, "Failed"), variant: "destructive" }),
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
          <Input
            placeholder="Version label (e.g. v2.1-momentum-boost)"
            value={versionLabel}
            onChange={e => setVersionLabel(e.target.value)}
            className="mb-3"
            data-testid="input-model-version-label"
          />
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
            disabled={!isValid || versionLabel.trim().length < 2 || createMutation.isPending}
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
                    <TableCell className="font-mono text-sm">{v.versionLabel}</TableCell>
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
    onError: (err: unknown) => toast({ title: toErrorMessage(err, "Failed"), variant: "destructive" }),
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

interface CieSignalDraft {
  content: string;
  suggestedType: string;
  suggestedSentiment: string;
  suggestedCredibility: number;
  suggestedTags: string[];
}

function SignalsTab() {
  const { toast } = useToast();
  const [type, setType] = useState("trade_call");
  const [sentiment, setSentiment] = useState("bullish");
  const [credibility, setCredibility] = useState("3");
  const [content, setContent] = useState("");

  // AI draft state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTicker, setAiTicker] = useState("");
  const [aiSignalType, setAiSignalType] = useState("trade_call");
  const [aiDraft, setAiDraft] = useState<CieSignalDraft | null>(null);

  const { data: aiStatus } = useQuery<{ available: boolean }>({
    queryKey: ["/api/cie-portal/ai-status"],
    staleTime: 5 * 60 * 1000,
  });
  const aiAvailable = aiStatus?.available !== false;

  const { data: signalsData, isLoading } = useQuery<{ signals: Signal[] }>({
    queryKey: ["/api/admin/cie/signals"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/cie/signals", {
      type, sentiment, credibility: parseInt(credibility, 10),
      content, isPublished: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/signals"] });
      toast({ title: "Signal published" });
      setContent("");
    },
    onError: (err: unknown) => toast({ title: toErrorMessage(err, "Failed"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/cie/signals/${id}`, undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/signals"] }); toast({ title: "Signal deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const aiDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/cie/signals/ai-draft", {
        prompt: aiPrompt,
        ticker: aiTicker || undefined,
        signalType: aiSignalType,
      });
      return res.json() as Promise<{ draft: CieSignalDraft }>;
    },
    onSuccess: (res) => {
      setAiDraft(res.draft);
    },
    onError: (err: unknown) => toast({ title: toErrorMessage(err, "AI draft failed"), variant: "destructive" }),
  });

  function applyAiDraft() {
    if (!aiDraft) return;
    setContent(aiDraft.content);
    if (["trade_call", "news", "rumour", "sector_rotation"].includes(aiDraft.suggestedType)) {
      setType(aiDraft.suggestedType);
    }
    if (["bullish", "bearish", "neutral"].includes(aiDraft.suggestedSentiment)) {
      setSentiment(aiDraft.suggestedSentiment);
    }
    if (aiDraft.suggestedCredibility >= 1 && aiDraft.suggestedCredibility <= 5) {
      setCredibility(String(aiDraft.suggestedCredibility));
    }
    setShowAiPanel(false);
    setAiDraft(null);
    toast({ title: "AI draft applied — review before publishing" });
  }

  const sentimentColor: Record<string, string> = {
    bullish: "text-green-600", bearish: "text-red-500", neutral: "text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      {showAiPanel && (
        <Card className="border-primary/30 bg-primary/5" data-testid="card-ai-draft-panel">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Signal Writing Assistant
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => { setShowAiPanel(false); setAiDraft(null); }} className="h-7 text-xs">
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs text-muted-foreground mb-1 block">Brief / Notes for the signal</Label>
                <Textarea
                  placeholder="e.g. Q3 earnings beat for GTCO — strong NIR growth, dividend increase expected"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  rows={3}
                  data-testid="textarea-ai-prompt"
                />
              </div>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Signal Type</Label>
                  <Select value={aiSignalType} onValueChange={setAiSignalType}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-ai-signal-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trade_call">Trade Call</SelectItem>
                      <SelectItem value="news">News</SelectItem>
                      <SelectItem value="rumour">Rumour</SelectItem>
                      <SelectItem value="sector_rotation">Sector Rotation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Ticker (optional)</Label>
                  <Input
                    placeholder="e.g. GTCO"
                    value={aiTicker}
                    onChange={e => setAiTicker(e.target.value.toUpperCase())}
                    data-testid="input-ai-ticker"
                  />
                </div>
              </div>
            </div>
            <Button
              onClick={() => aiDraftMutation.mutate()}
              disabled={(aiPrompt.length > 0 && aiPrompt.length < 5) || (!aiPrompt && !aiTicker) || aiDraftMutation.isPending}
              size="sm"
              className="gap-2"
              data-testid="button-generate-ai-draft"
            >
              {aiDraftMutation.isPending ? <><LoadingSpinner className="h-3 w-3" /> Generating…</> : <><Sparkles className="h-3 w-3" /> Generate Draft</>}
            </Button>

            {aiDraft && (
              <div className="mt-3 space-y-3 border rounded-lg p-3 bg-background">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-muted px-2 py-0.5 rounded capitalize">{aiDraft.suggestedType.replace("_", " ")}</span>
                  <span className={`px-2 py-0.5 rounded capitalize font-medium ${aiDraft.suggestedSentiment === "bullish" ? "text-green-700 bg-green-50 dark:bg-green-900/20" : aiDraft.suggestedSentiment === "bearish" ? "text-red-700 bg-red-50 dark:bg-red-900/20" : "bg-muted text-muted-foreground"}`}>
                    {aiDraft.suggestedSentiment}
                  </span>
                  <span className="bg-muted px-2 py-0.5 rounded">Credibility {aiDraft.suggestedCredibility}/5</span>
                  {aiDraft.suggestedTags?.map(tag => (
                    <span key={tag} className="bg-primary/10 text-primary px-2 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-ai-draft-content">{aiDraft.content}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={applyAiDraft} className="gap-1.5 text-xs" data-testid="button-apply-ai-draft">
                    <Check className="h-3 w-3" /> Apply to Form
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => aiDraftMutation.mutate()} disabled={aiDraftMutation.isPending} className="gap-1.5 text-xs" data-testid="button-regenerate-ai-draft">
                    <RefreshCw className="h-3 w-3" /> Regenerate
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Publish Analyst Signal</CardTitle>
            {!showAiPanel && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAiPanel(true)}
                className="gap-1.5 text-xs h-7"
                disabled={!aiAvailable}
                title={!aiAvailable ? "AI assistant unavailable — OPENAI_API_KEY not configured" : undefined}
                data-testid="button-open-ai-draft"
              >
                <Sparkles className="h-3 w-3 text-primary" /> AI Draft
                {!aiAvailable && <span className="text-[10px] text-muted-foreground ml-1">(unavailable)</span>}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-3 mb-3">
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
                <SelectItem value="5">5 — Very High</SelectItem>
                <SelectItem value="4">4 — High</SelectItem>
                <SelectItem value="3">3 — Medium</SelectItem>
                <SelectItem value="2">2 — Low</SelectItem>
                <SelectItem value="1">1 — Very Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea placeholder="Signal content (min 10 characters)" value={content} onChange={e => setContent(e.target.value)} rows={4} className="mb-3" data-testid="textarea-signal-content" />
          <Button onClick={() => createMutation.mutate()} disabled={content.length < 10 || createMutation.isPending} className="gap-2" data-testid="button-publish-signal">
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
                  <TableHead>Type</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead className="text-center">Cred.</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(signalsData?.signals ?? []).map(s => (
                  <TableRow key={s.id} data-testid={`row-signal-${s.id}`}>
                    <TableCell className="text-xs capitalize">{s.type.replace("_", " ")}</TableCell>
                    <TableCell className={`text-xs font-medium capitalize ${sentimentColor[s.sentiment ?? ""] ?? ""}`}>{s.sentiment ?? "—"}</TableCell>
                    <TableCell className="text-xs text-center">{s.credibility ?? "—"}/5</TableCell>
                    <TableCell className="text-sm max-w-[240px] truncate">{s.content}</TableCell>
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
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">No signals published</TableCell>
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

// ─── Key Reveal Dialog ────────────────────────────────────────────────────────

function KeyRevealDialog({ state, onClose }: { state: KeyRevealState; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(state.plaintextKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied!", description: "API key copied to clipboard." });
    });
  };

  return (
    <Dialog open={state.open} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            API Key Generated — {state.partnerName}
          </DialogTitle>
          <DialogDescription>
            This key is shown <strong>once only</strong>. Copy it now and hand it securely to the partner. It cannot be retrieved again.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 p-3 bg-muted rounded-md font-mono text-xs break-all border border-border">
          {state.plaintextKey}
        </div>
        <div className="flex gap-2 mt-2">
          <Button onClick={handleCopy} className="flex-1 gap-2" data-testid="button-copy-partner-key">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Key"}
          </Button>
          <Button variant="outline" onClick={onClose} data-testid="button-close-key-reveal">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Partners Tab ─────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const cfg: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    inactive: "bg-muted text-muted-foreground",
    suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg[status] ?? cfg.inactive}`}>{status}</span>;
}

function PartnersTab() {
  const { toast } = useToast();
  const { data: partners = [], isLoading } = useQuery<CiePartner[]>({
    queryKey: ["/api/admin/cie/partners"],
  });

  const [showForm, setShowForm] = useState(false);
  const [editPartner, setEditPartner] = useState<CiePartner | null>(null);
  const [keyReveal, setKeyReveal] = useState<KeyRevealState>({ open: false, partnerName: "", plaintextKey: "" });

  // Form state
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [cellionShare, setCellionShare] = useState("60");
  const [tier, setTier] = useState("subscriber");
  const [notes, setNotes] = useState("");
  const [editStatus, setEditStatus] = useState("active");

  function resetForm() {
    setOrgName(""); setContactName(""); setContactEmail("");
    setCellionShare("60"); setTier("subscriber"); setNotes(""); setEditStatus("active");
    setEditPartner(null); setShowForm(false);
  }

  function openEdit(p: CiePartner) {
    setOrgName(p.orgName);
    setContactName(p.contactName ?? "");
    setContactEmail(p.contactEmail ?? "");
    setCellionShare(String(p.cellionRevenueSharePct));
    setTier(p.tier);
    setNotes(p.notes ?? "");
    setEditStatus(p.status);
    setEditPartner(p);
    setShowForm(true);
  }

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/cie/partners", {
      orgName, contactName: contactName || undefined, contactEmail: contactEmail || undefined,
      cellionRevenueSharePct: parseInt(cellionShare), tier, notes: notes || undefined,
    }),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/partners/revenue"] });
      resetForm();
      setKeyReveal({ open: true, partnerName: data.partner.orgName, plaintextKey: data.plaintextKey });
    },
    onError: (err) => toast({ title: "Error", description: toErrorMessage(err), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/cie/partners/${editPartner!.id}`, {
      orgName, contactName: contactName || null, contactEmail: contactEmail || null,
      cellionRevenueSharePct: parseInt(cellionShare), tier, status: editStatus, notes: notes || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/partners/revenue"] });
      resetForm();
      toast({ title: "Partner updated" });
    },
    onError: (err) => toast({ title: "Error", description: toErrorMessage(err), variant: "destructive" }),
  });

  const regenMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/cie/partners/${id}/regenerate-key`, {}),
    onSuccess: async (res, id) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/partners"] });
      const p = partners.find(x => x.id === id);
      setKeyReveal({ open: true, partnerName: p?.orgName ?? "Partner", plaintextKey: data.plaintextKey });
    },
    onError: (err) => toast({ title: "Error", description: toErrorMessage(err), variant: "destructive" }),
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      <KeyRevealDialog state={keyReveal} onClose={() => setKeyReveal(s => ({ ...s, open: false }))} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Partner Programme</h2>
          <p className="text-xs text-muted-foreground">White-label resellers with revenue-share API access</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { resetForm(); setShowForm(s => !s); }} data-testid="button-add-partner">
          <Plus className="h-4 w-4" />{showForm && !editPartner ? "Cancel" : "Add Partner"}
        </Button>
      </div>

      {showForm && (
        <Card data-testid="card-partner-form">
          <CardHeader>
            <CardTitle className="text-sm">{editPartner ? `Edit — ${editPartner.orgName}` : "New Partner"}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Organisation Name *</Label>
              <Input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Icon eTrade" data-testid="input-partner-org-name" />
            </div>
            <div className="space-y-1">
              <Label>Contact Name</Label>
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g. Emeka Obi" data-testid="input-partner-contact-name" />
            </div>
            <div className="space-y-1">
              <Label>Contact Email</Label>
              <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="e.g. api@iconetrade.com" data-testid="input-partner-contact-email" />
            </div>
            <div className="space-y-1">
              <Label>Cellion Revenue Share %</Label>
              <Input type="number" min={0} max={100} value={cellionShare} onChange={e => setCellionShare(e.target.value)} data-testid="input-partner-revenue-share" />
              <p className="text-xs text-muted-foreground">Partner retains {100 - (parseInt(cellionShare) || 0)}%</p>
            </div>
            <div className="space-y-1">
              <Label>Access Tier</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger data-testid="select-partner-tier"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscriber">Subscriber (500 req/min)</SelectItem>
                  <SelectItem value="pro">Pro (1,000 req/min)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editPartner && (
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger data-testid="select-partner-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional internal notes" data-testid="textarea-partner-notes" />
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <Button variant="outline" onClick={resetForm} data-testid="button-partner-cancel">Cancel</Button>
              <Button
                onClick={() => editPartner ? updateMutation.mutate() : createMutation.mutate()}
                disabled={!orgName.trim() || createMutation.isPending || updateMutation.isPending}
                className="gap-2"
                data-testid="button-partner-save"
              >
                <Save className="h-4 w-4" />
                {editPartner ? "Save Changes" : "Create Partner & Generate Key"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-center">Cellion Share</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">MTD Calls</TableHead>
                <TableHead>Key Prefix</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map(p => (
                <TableRow key={p.id} data-testid={`row-partner-${p.id}`}>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{p.orgName}</p>
                      {p.contactEmail && <p className="text-xs text-muted-foreground">{p.contactEmail}</p>}
                    </div>
                  </TableCell>
                  <TableCell>{tierBadge(p.tier)}</TableCell>
                  <TableCell className="text-center text-sm">{p.cellionRevenueSharePct}%</TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
                  <TableCell className="text-right text-sm font-mono">{p.mtdCalls.toLocaleString()}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{p.activeKeyPrefix ? `${p.activeKeyPrefix}…` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)} title="Edit partner" data-testid={`button-edit-partner-${p.id}`}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => regenMutation.mutate(p.id)}
                        disabled={regenMutation.isPending}
                        title="Regenerate API key"
                        data-testid={`button-regen-key-${p.id}`}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {partners.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-sm">
                    No partners yet. Click "Add Partner" to onboard the first reseller.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
  const { data: partnerRevenue = [] } = useQuery<PartnerRevenue[]>({
    queryKey: ["/api/admin/cie/partners/revenue"],
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
          { label: "Churn Rate (30d)", value: rev ? `${rev.churnRatePct.toFixed(1)}%` : "0.0%", icon: Activity, color: "text-amber-600" },
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

      {/* Partner Revenue */}
      <Card data-testid="card-partner-revenue">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Handshake className="h-4 w-4 text-primary" />
            Partner Revenue — Month to Date
          </CardTitle>
          <CardDescription className="text-xs">
            API call volume per active partner. Revenue share is estimated based on agreed Cellion %.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">MTD API Calls</TableHead>
                <TableHead className="text-center">Cellion Share</TableHead>
                <TableHead className="text-center">Partner Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partnerRevenue.map(p => (
                <TableRow key={p.partnerId} data-testid={`row-partner-revenue-${p.partnerId}`}>
                  <TableCell className="text-sm font-medium">{p.orgName}</TableCell>
                  <TableCell>{tierBadge(p.tier)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{p.mtdCalls.toLocaleString()}</TableCell>
                  <TableCell className="text-center text-sm">{p.cellionRevenueSharePct}%</TableCell>
                  <TableCell className="text-center text-sm">{p.partnerRevenueSharePct}%</TableCell>
                </TableRow>
              ))}
              {partnerRevenue.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">No active partners</TableCell>
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
  const { user } = useAuth();
  const userRoles = user?.roles ?? [];
  const isFullAdmin = userRoles.includes("admin");
  const isCieAnalyst = userRoles.includes("cie_analyst") && !isFullAdmin;

  const [activeTab, setActiveTab] = useState<string>(isCieAnalyst ? "prices" : "securities");

  const { data: logsData, isSuccess: logsLoaded } = useQuery<{ logs: IngestionLog[] }>({
    queryKey: ["/api/admin/cie/ingest/logs"],
  });

  const committedPriceLogs = (logsData?.logs ?? []).filter(
    l => l.status === "committed" && l.dataType === "prices"
  );
  const noDataEver = logsLoaded && committedPriceLogs.length === 0;
  const latestCommittedAt = committedPriceLogs[0]?.committedAt
    ? new Date(committedPriceLogs[0].committedAt)
    : null;
  const daysSinceLastUpload = latestCommittedAt
    ? (() => {
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        const uploadMidnight = new Date(latestCommittedAt);
        uploadMidnight.setHours(0, 0, 0, 0);
        return Math.round((todayMidnight.getTime() - uploadMidnight.getTime()) / (24 * 60 * 60 * 1000));
      })()
    : null;
  const isStale = !noDataEver && daysSinceLastUpload !== null && daysSinceLastUpload > 3;

  const showAlert = logsLoaded && (noDataEver || isStale);

  return (
    <DashboardLayout role="admin" breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "CIE Engine" }]}>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-cie-cockpit-heading">Cellion Intelligence Engine</h1>
            <p className="text-sm text-muted-foreground">
              {isCieAnalyst ? "Analyst workspace — price upload & signals" : "Admin research cockpit — securities, scores, models, signals"}
            </p>
          </div>
        </div>

        {showAlert && (
          <Alert
            className="mb-6 border-amber-400 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-600"
            data-testid="alert-cie-data-warning"
          >
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-amber-800 dark:text-amber-300 flex-1">
                {noDataEver
                  ? "The CIE engine has no price data. Upload today's NGX official price list — data is expected by 18:30 WAT daily."
                  : `Price data is stale — last upload was ${daysSinceLastUpload} day${daysSinceLastUpload !== 1 ? "s" : ""} ago. Upload the NGX official price list (due by 18:30 WAT each trading day).`}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:border-amber-500 dark:text-amber-300 dark:hover:bg-amber-900/30 shrink-0"
                onClick={() => setActiveTab("prices")}
                data-testid="button-go-to-price-upload"
              >
                Go to Price Upload
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap h-auto gap-1" data-testid="tabs-cie-cockpit">
            {!isCieAnalyst && (
              <TabsTrigger value="securities" className="gap-2" data-testid="tab-securities"><ArrowUpDown className="h-4 w-4" />Securities</TabsTrigger>
            )}
            <TabsTrigger value="prices" className="gap-2" data-testid="tab-prices"><Upload className="h-4 w-4" />Price Upload</TabsTrigger>
            {!isCieAnalyst && (
              <TabsTrigger value="model" className="gap-2" data-testid="tab-model"><Settings2 className="h-4 w-4" />Model Editor</TabsTrigger>
            )}
            {!isCieAnalyst && (
              <TabsTrigger value="dividends" className="gap-2" data-testid="tab-dividends"><Banknote className="h-4 w-4" />Dividends</TabsTrigger>
            )}
            <TabsTrigger value="signals" className="gap-2" data-testid="tab-signals"><Zap className="h-4 w-4" />Signals</TabsTrigger>
            {!isCieAnalyst && (
              <TabsTrigger value="partners" className="gap-2" data-testid="tab-partners"><Handshake className="h-4 w-4" />Partners</TabsTrigger>
            )}
            {!isCieAnalyst && (
              <TabsTrigger value="revenue" className="gap-2" data-testid="tab-revenue"><TrendingUp className="h-4 w-4" />Revenue</TabsTrigger>
            )}
          </TabsList>

          {!isCieAnalyst && <TabsContent value="securities"><SecuritiesTab /></TabsContent>}
          <TabsContent value="prices"><PriceUploadTab logsData={logsData} /></TabsContent>
          {!isCieAnalyst && <TabsContent value="model"><ModelEditorTab /></TabsContent>}
          {!isCieAnalyst && <TabsContent value="dividends"><DividendsTab /></TabsContent>}
          <TabsContent value="signals"><SignalsTab /></TabsContent>
          {!isCieAnalyst && <TabsContent value="partners"><PartnersTab /></TabsContent>}
          {!isCieAnalyst && <TabsContent value="revenue"><RevenueTab /></TabsContent>}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
