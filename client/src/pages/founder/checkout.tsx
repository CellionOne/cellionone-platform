import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ShoppingCart, Building2, FileText, Shield, Loader2, Plus, Minus, AlertCircle, ExternalLink, CheckCircle2 } from "lucide-react";

interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  priceNgn: number;
  requiresManualPricing: boolean | null;
  metadata: Record<string, unknown> | null;
}

function formatNgn(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

function getSkuIcon(sku: string) {
  if (sku.startsWith("CAC_")) return Building2;
  if (sku === "TM") return Shield;
  return FileText;
}

export default function CheckoutPage() {
  const { toast } = useToast();
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const incorporationProducts = useMemo(
    () => products?.filter(p => p.category === "incorporation" && !p.requiresManualPricing) || [],
    [products]
  );

  const addOnProducts = useMemo(
    () => products?.filter(p => p.category === "post_incorporation" && !p.requiresManualPricing) || [],
    [products]
  );

  const selectedProducts = useMemo(
    () => products?.filter(p => selectedSkus.includes(p.sku)) || [],
    [products, selectedSkus]
  );

  const totalKobo = useMemo(
    () => selectedProducts.reduce((sum, p) => sum + p.priceNgn, 0),
    [selectedProducts]
  );

  const selectedIncorporation = selectedSkus.find(s => s.startsWith("CAC_"));

  const toggleSku = (sku: string) => {
    setSelectedSkus(prev => {
      if (sku.startsWith("CAC_")) {
        const withoutCac = prev.filter(s => !s.startsWith("CAC_"));
        if (prev.includes(sku)) return withoutCac;
        return [...withoutCac, sku];
      }
      return prev.includes(sku) ? prev.filter(s => s !== sku) : [...prev, sku];
    });
  };

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/checkout/split", {
        items: selectedSkus.map(sku => ({ sku })),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Checkout Failed",
        description: error.message || "Could not initiate payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (productsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="checkout-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-checkout-title">Services & Checkout</h1>
        <p className="text-muted-foreground mt-1">Select services for your company incorporation and post-incorporation needs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-3" data-testid="text-incorporation-heading">Company Incorporation</h2>
            <p className="text-sm text-muted-foreground mb-4">Choose a share capital tier for your company registration with the Corporate Affairs Commission (CAC).</p>
            <div className="space-y-3">
              {incorporationProducts.map((p) => {
                const isSelected = selectedSkus.includes(p.sku);
                const Icon = getSkuIcon(p.sku);
                const shareCapital = (p.metadata as any)?.shareCapital;
                return (
                  <Card
                    key={p.sku}
                    className={`cursor-pointer transition-colors ${isSelected ? "border-primary ring-1 ring-primary" : ""}`}
                    onClick={() => toggleSku(p.sku)}
                    data-testid={`card-product-${p.sku}`}
                  >
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-md ${isSelected ? "bg-primary/10" : "bg-muted"}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.name}</p>
                          {shareCapital && (
                            <p className="text-xs text-muted-foreground">
                              Share Capital: {formatNgn(shareCapital * 100)}
                              {(p.metadata as any)?.foreignParticipation && " (Foreign Participation)"}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-semibold text-lg">{formatNgn(p.priceNgn)}</span>
                        {isSelected ? (
                          <Badge variant="default" data-testid={`badge-selected-${p.sku}`}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Selected
                          </Badge>
                        ) : (
                          <Button size="sm" variant="outline" data-testid={`button-select-${p.sku}`}>Select</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {addOnProducts.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3" data-testid="text-addons-heading">Add-on Services</h2>
              <p className="text-sm text-muted-foreground mb-4">Enhance your incorporation with additional registrations.</p>
              <div className="space-y-3">
                {addOnProducts.map((p) => {
                  const isSelected = selectedSkus.includes(p.sku);
                  const Icon = getSkuIcon(p.sku);
                  return (
                    <Card
                      key={p.sku}
                      className={`cursor-pointer transition-colors ${isSelected ? "border-primary ring-1 ring-primary" : ""}`}
                      onClick={() => toggleSku(p.sku)}
                      data-testid={`card-product-${p.sku}`}
                    >
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-md ${isSelected ? "bg-primary/10" : "bg-muted"}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <p className="font-medium">{p.name}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="font-semibold text-lg">{formatNgn(p.priceNgn)}</span>
                          {isSelected ? (
                            <Badge variant="default" data-testid={`badge-selected-${p.sku}`}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Added
                            </Badge>
                          ) : (
                            <Button size="sm" variant="outline" data-testid={`button-add-${p.sku}`}>
                              <Plus className="h-3 w-3 mr-1" /> Add
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-20" data-testid="card-order-summary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Order Summary
              </CardTitle>
              <CardDescription>
                {selectedProducts.length === 0
                  ? "Select services to proceed"
                  : `${selectedProducts.length} item${selectedProducts.length > 1 ? "s" : ""} selected`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-empty-cart">
                  No services selected yet. Choose from the options on the left to get started.
                </p>
              ) : (
                <>
                  {selectedProducts.map((p) => (
                    <div key={p.sku} className="flex items-center justify-between gap-2" data-testid={`summary-item-${p.sku}`}>
                      <span className="text-sm truncate">{p.name}</span>
                      <span className="text-sm font-medium flex-shrink-0">{formatNgn(p.priceNgn)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg" data-testid="text-total-amount">{formatNgn(totalKobo)}</span>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                className="w-full"
                size="lg"
                disabled={selectedProducts.length === 0 || checkoutMutation.isPending}
                onClick={() => checkoutMutation.mutate()}
                data-testid="button-checkout"
              >
                {checkoutMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Pay {formatNgn(totalKobo)}
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                You will be redirected to Paystack to complete your payment securely.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
