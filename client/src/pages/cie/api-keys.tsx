import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CieLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Copy, CheckCircle2 } from "lucide-react";

interface StatusData { tier: "free" | "subscriber" | "pro"; isPaid: boolean; subscription: unknown }
interface ApiKey {
  id: number; label: string; keyPrefix: string;
  permissions: string[]; rateLimit: number;
  createdAt: string | null; lastUsedAt: string | null; totalCalls: number;
}

function formatDate(d?: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function CieApiKeys() {
  const { toast } = useToast();
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const { data: status } = useQuery<StatusData>({ queryKey: ["/api/cie-portal/status"] });
  const tier = status?.tier ?? "free";

  const { data, isLoading } = useQuery<{ keys: ApiKey[] }>({
    queryKey: ["/api/cie-portal/api-keys"],
    enabled: tier !== "free",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cie-portal/api-keys", { label: newKeyLabel });
      return res.json() as Promise<{ apiKey: string; label: string; permissions: string[]; rateLimit: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cie-portal/api-keys"] });
      if (data?.apiKey) setRevealedKey(data.apiKey);
      toast({ title: "API key created — copy it now, it won't be shown again" });
      setNewKeyLabel("");
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed to create key", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/cie-portal/api-keys/${id}`, undefined);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cie-portal/api-keys"] });
      toast({ title: "API key revoked" });
    },
    onError: () => toast({ title: "Failed to revoke key", variant: "destructive" }),
  });

  return (
    <CieLayout tier={tier}>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h2 className="text-lg font-semibold mb-1" data-testid="text-api-keys-heading">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Generate and manage API keys for programmatic access to the CIE intelligence API.
            Keys are scoped to <code className="text-xs bg-muted px-1 rounded">cie:read</code> permissions.
          </p>
        </div>

        {revealedKey && (
          <Card className="border-green-500/50 bg-green-50/30 dark:bg-green-900/10">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> New API key — copy it now, it won't be shown again
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-background border rounded px-3 py-2 text-sm font-mono break-all" data-testid="text-new-api-key">
                  {revealedKey}
                </code>
                <Button
                  size="sm" variant="outline"
                  onClick={() => { navigator.clipboard.writeText(revealedKey!); toast({ title: "Copied!" }); }}
                  data-testid="button-copy-api-key"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => setRevealedKey(null)} data-testid="button-dismiss-key">
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Create API Key</CardTitle>
            <CardDescription className="text-xs">
              {tier === "pro"
                ? "Pro plan — 1,000 req/min, full cie:read access including signals"
                : "Subscriber plan — 500 req/min, cie:read access for securities and prices"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Label (e.g. my-trading-app)"
                value={newKeyLabel}
                onChange={e => setNewKeyLabel(e.target.value)}
                className="max-w-xs"
                data-testid="input-new-key-label"
              />
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newKeyLabel.trim() || createMutation.isPending}
                className="gap-2"
                data-testid="button-create-api-key"
              >
                {createMutation.isPending ? <LoadingSpinner size="sm" /> : <Plus className="h-4 w-4" />}
                Create Key
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Your API Keys</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8"><LoadingSpinner /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Key Prefix</TableHead>
                      <TableHead>Rate Limit</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Total Calls</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.keys ?? []).map(k => (
                      <TableRow key={k.id} data-testid={`row-api-key-${k.id}`}>
                        <TableCell className="text-sm font-medium">{k.label}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{k.keyPrefix}••••</TableCell>
                        <TableCell className="text-xs">{k.rateLimit?.toLocaleString()} req/min</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(k.lastUsedAt)}</TableCell>
                        <TableCell className="text-xs">{k.totalCalls?.toLocaleString() ?? 0}</TableCell>
                        <TableCell>
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => deleteMutation.mutate(k.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-key-${k.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!data?.keys?.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                          No API keys yet. Create one above to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs font-medium mb-2">API Base URL</p>
            <code className="text-xs bg-muted rounded px-2 py-1 block">
              https://cellionone.com/api/v1/cie/securities
            </code>
            <p className="text-xs text-muted-foreground mt-3">
              Authenticate requests with: <code className="bg-muted px-1 rounded">X-API-Key: your_key</code>
            </p>
          </CardContent>
        </Card>
      </div>
    </CieLayout>
  );
}
