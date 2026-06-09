import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DevLayout } from "./layout";
import { useDevAuth } from "@/hooks/use-dev-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Copy, CheckCircle2, AlertTriangle } from "lucide-react";

const ALL_SCOPES = [
  { value: "verify:identity", label: "Identity", desc: "BVN/NIN/document verification" },
  { value: "verify:business", label: "KYB", desc: "CAC company lookup" },
  { value: "escrow:read", label: "Escrow Read", desc: "View escrow transactions" },
  { value: "escrow:write", label: "Escrow Write", desc: "Create/release escrow transactions" },
  { value: "bureau:read", label: "Bureau Read", desc: "Query ClearLedger credit profiles" },
  { value: "bureau:write", label: "Bureau Write", desc: "Submit bureau events" },
  { value: "formation:read", label: "Formation", desc: "Formation lookups" },
  { value: "intelligence:read", label: "Intelligence", desc: "Market pulse and NGX data" },
];

interface ApiKey {
  id: number; name: string; keyPrefix: string; environment: string;
  permissions: string[]; isActive: boolean;
  createdAt: string | null; lastUsedAt: string | null; totalCalls: number;
}

function fmtDate(d?: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function DeveloperKeys() {
  const { toast } = useToast();
  const { devOrg } = useDevAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState({ name: "", environment: "live" as "live" | "test", permissions: [] as string[] });
  const [revokeId, setRevokeId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ keys: ApiKey[] }>({ queryKey: ["/api/developers/keys"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/developers/keys", newKey);
      return res.json() as Promise<{ apiKey: string; name: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/developers/keys"] });
      setRevealedKey(data.apiKey);
      setShowCreate(false);
      setNewKey({ name: "", environment: "live", permissions: [] });
      toast({ title: "API key created — copy it now!" });
    },
    onError: async (err: any) => {
      const body = err.response ? await err.response.json().catch(() => ({})) : {};
      toast({ title: body?.error || "Failed to create key", variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/developers/keys/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developers/keys"] });
      setRevokeId(null);
      toast({ title: "Key revoked" });
    },
  });

  const toggleScope = (scope: string) => {
    setNewKey(k => ({
      ...k,
      permissions: k.permissions.includes(scope)
        ? k.permissions.filter(s => s !== scope)
        : [...k.permissions, scope],
    }));
  };

  return (
    <DevLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">API Keys</h1>
          <p className="text-sm text-muted-foreground">Manage your API keys and their permissions</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New key
        </Button>
      </div>

      {/* Revealed key banner */}
      {revealedKey && (
        <Card className="mb-6 border-green-500/50 bg-green-50/30 dark:bg-green-900/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                New API key created — copy it now, it won't be shown again
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-background border rounded px-3 py-2 text-sm font-mono break-all">
                {revealedKey}
              </code>
              <Button size="sm" variant="outline"
                onClick={() => { navigator.clipboard.writeText(revealedKey!); toast({ title: "Copied!" }); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setRevealedKey(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {/* Keys table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10"><LoadingSpinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Env</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Calls</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.keys ?? []).map(k => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium text-sm">{k.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{k.keyPrefix}••••</TableCell>
                      <TableCell>
                        <Badge variant={k.environment === "live" ? "default" : "secondary"} className="text-xs">
                          {k.environment}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(k.permissions ?? []).map(p => (
                            <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(k.lastUsedAt)}</TableCell>
                      <TableCell className="text-xs">{k.totalCalls?.toLocaleString() ?? 0}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setRevokeId(k.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!data?.keys?.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10 text-sm">
                        No API keys yet. Click "New key" to create one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create key dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Key name</Label>
              <Input placeholder="e.g. production-app" value={newKey.name}
                onChange={e => setNewKey(k => ({ ...k, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <div className="flex gap-2">
                {(["live", "test"] as const).map(env => (
                  <button key={env}
                    className={`flex-1 py-2 rounded-md text-sm border transition-colors ${
                      newKey.environment === env
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    } ${env === "live" && devOrg?.sandboxOnly ? "opacity-40 cursor-not-allowed" : ""}`}
                    onClick={() => (!devOrg?.sandboxOnly || env !== "live") && setNewKey(k => ({ ...k, environment: env }))}
                  >
                    {env === "live" ? "Live" : "Test/Sandbox"}
                  </button>
                ))}
              </div>
              {devOrg?.sandboxOnly && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Live keys disabled in sandbox mode
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Scopes</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_SCOPES.map(s => (
                  <label key={s.value}
                    className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                      newKey.permissions.includes(s.value)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-foreground/30"
                    }`}>
                    <input type="checkbox" className="mt-0.5"
                      checked={newKey.permissions.includes(s.value)}
                      onChange={() => toggleScope(s.value)} />
                    <div>
                      <p className="text-xs font-medium">{s.label}</p>
                      <p className="text-xs text-muted-foreground">{s.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <Button className="w-full" disabled={!newKey.name || newKey.permissions.length === 0 || createMutation.isPending}
              onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? <LoadingSpinner size="sm" /> : "Create key"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation dialog */}
      <Dialog open={!!revokeId} onOpenChange={open => !open && setRevokeId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Revoke API key?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This key will be permanently revoked. Any integrations using it will stop working immediately.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setRevokeId(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1"
              disabled={revokeMutation.isPending}
              onClick={() => revokeId && revokeMutation.mutate(revokeId)}>
              {revokeMutation.isPending ? <LoadingSpinner size="sm" /> : "Revoke key"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DevLayout>
  );
}
