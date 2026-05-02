import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ShoppingCart, Building2, FileText, Shield, Loader2, Plus, X,
  ExternalLink, CheckCircle2, Sparkles, Users, Clock,
  MapPin, Hash, ClipboardList, Info, AlertTriangle
} from "lucide-react";

interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  priceNgn: number;
  requiresManualPricing: boolean | null;
  metadata: Record<string, unknown> | null;
}

type CheckoutMode = "new_company" | "existing_company";

function formatNgn(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

function getSkuIcon(sku: string) {
  if (sku.startsWith("CAC_")) return Building2;
  if (sku === "NGO") return Users;
  if (sku === "TM") return Shield;
  if (sku === "TIN") return Hash;
  if (sku === "SCUML") return FileText;
  if (sku === "ADD_DIR") return ClipboardList;
  if (sku === "OFFICE_ONLY" || sku === "OFFICE_PLUS_MAIL") return MapPin;
  return FileText;
}

function getSkuDescription(sku: string): string {
  const descriptions: Record<string, string> = {
    TIN: "Get your Tax Identification Number from the Federal Inland Revenue Service. Required for opening a corporate bank account.",
    SCUML: "Special Control Unit against Money Laundering certificate from the EFCC. Required for financial transactions.",
    TM: "Protect your brand name with a registered trademark. Covers both stages of the trademark process.",
    ADD_DIR: "Formally appoint a new director at the Corporate Affairs Commission. Includes Form CAC 7 filing and board resolution preparation.",
    OFFICE_ONLY: "Use our prestigious Ikoyi, Lagos address as your official CAC-registered office address. Annual subscription.",
    OFFICE_PLUS_MAIL: "Our Ikoyi address plus mail receiving, scanning, and forwarding services. Ideal for remote founders. Annual subscription.",
  };
  return descriptions[sku] || "";
}

function getSkuAdvisory(sku: string): string | null {
  const advisories: Record<string, string> = {
    TIN: "You can apply for TIN registration directly with FIRS at no cost. However, the process requires consistent follow-up and can take considerable time. Our fee covers professional handling and expedited processing on your behalf.",
    SCUML: "You can apply for SCUML registration directly with the EFCC at no cost. However, the process requires consistent follow-up and can take considerable time. Our fee covers professional handling and expedited processing on your behalf.",
    ADD_DIR: "Filing with the CAC requires accurate documentation including Form CAC 7, a board resolution, and the new director's personal details. Our lawyers handle all CAC correspondence on your behalf.",
  };
  return advisories[sku] || null;
}

function getSkuBenefit(sku: string): string {
  const benefits: Record<string, string> = {
    TIN: "Needed for corporate bank account",
    SCUML: "Ready in 5 business days",
    TM: "Full brand name protection",
    ADD_DIR: "CAC-registered within 10 business days",
    OFFICE_ONLY: "Annual — billed once with your incorporation",
    OFFICE_PLUS_MAIL: "Annual — billed once with your incorporation",
  };
  return benefits[sku] || "";
}

function getSkuPriceLabel(sku: string, priceNgn: number): string {
  const annualSkus = ["OFFICE_ONLY", "OFFICE_PLUS_MAIL"];
  const formatted = formatNgn(priceNgn);
  return annualSkus.includes(sku) ? `${formatted}/yr` : formatted;
}

export default function CheckoutPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { applicationId, initSkus } = (() => {
    const params = new URLSearchParams(window.location.search);
    const appId = params.get("applicationId");
    const skusParam = params.get("initSkus");
    return {
      applicationId: appId ? parseInt(appId, 10) : null,
      initSkus: skusParam ? skusParam.split(",").filter(Boolean) : [],
    };
  })();

  const [mode, setMode] = useState<CheckoutMode>("new_company");
  const [selectedSkus, setSelectedSkus] = useState<string[]>(initSkus);

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  interface ApplicationBrief {
    application: { selectedNames?: string[] | null };
  }

  const { data: applicationData } = useQuery<ApplicationBrief>({
    queryKey: ["/api/applications", applicationId],
    enabled: !!applicationId,
  });

  const nameCount = (applicationData?.application?.selectedNames ?? []).length || 1;

  interface ReadinessSummary {
    people: {
      id: number | string;
      inviteEmail: string | null;
      role: string;
      firstName: string | null;
      lastName: string | null;
      profileCompletion: number;
      isProfileComplete: boolean;
    }[];
    summary: {
      totalPeople: number;
      readyCount: number;
      allReady: boolean;
    };
  }

  const { data: readiness } = useQuery<ReadinessSummary>({
    queryKey: ["/api/company-people/readiness"],
  });

  const profilesReady = readiness?.summary?.allReady ?? true;
  const incompletePeople = readiness?.people?.filter(p => !p.isProfileComplete) ?? [];

  const cacProducts = useMemo(
    () => products?.filter(p => p.sku.startsWith("CAC_") && !p.requiresManualPricing) || [],
    [products]
  );

  const ngoProduct = useMemo(
    () => products?.find(p => p.sku === "NGO" && !p.requiresManualPricing) || null,
    [products]
  );

  const addOnProducts = useMemo(
    () => products?.filter(p => (p.category === "post_incorporation" || p.category === "registered_office") && !p.requiresManualPricing) || [],
    [products]
  );

  const selectedProducts = useMemo(
    () => products?.filter(p => selectedSkus.includes(p.sku)) || [],
    [products, selectedSkus]
  );

  const totalKobo = useMemo(() => {
    return selectedProducts.reduce((sum, p) => {
      const qty = (p.sku.startsWith("CAC_") || p.sku === "NGO") ? nameCount : 1;
      return sum + p.priceNgn * qty;
    }, 0);
  }, [selectedProducts, nameCount]);

  const hasIncorporation = selectedSkus.some(s => s.startsWith("CAC_") || s === "NGO");

  const unselectedAddOns = useMemo(
    () => addOnProducts.filter(p => !selectedSkus.includes(p.sku)),
    [addOnProducts, selectedSkus]
  );

  const toggleSku = (sku: string) => {
    setSelectedSkus(prev => {
      const isIncorporationType = sku.startsWith("CAC_") || sku === "NGO";
      if (isIncorporationType) {
        const withoutIncorporation = prev.filter(s => !s.startsWith("CAC_") && s !== "NGO");
        if (prev.includes(sku)) return withoutIncorporation;
        return [...withoutIncorporation, sku];
      }
      const isOfficeType = sku === "OFFICE_ONLY" || sku === "OFFICE_PLUS_MAIL";
      if (isOfficeType) {
        const sibling = sku === "OFFICE_ONLY" ? "OFFICE_PLUS_MAIL" : "OFFICE_ONLY";
        const withoutOffice = prev.filter(s => s !== sibling);
        if (prev.includes(sku)) return withoutOffice.filter(s => s !== sku);
        return [...withoutOffice, sku];
      }
      return prev.includes(sku) ? prev.filter(s => s !== sku) : [...prev, sku];
    });
  };

  const removeSku = (sku: string) => {
    setSelectedSkus(prev => prev.filter(s => s !== sku));
  };

  const switchMode = (newMode: CheckoutMode) => {
    setMode(newMode);
    setSelectedSkus([]);
  };

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/checkout/split", {
        items: selectedSkus.map(sku => ({ sku })),
        ...(applicationId ? { applicationId } : {}),
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-checkout-title">Services & Checkout</h1>
        <p className="text-muted-foreground mt-1">Select the services you need and proceed to payment.</p>
      </div>

      {!applicationId && (
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={mode === "new_company" ? "default" : "outline"}
            onClick={() => switchMode("new_company")}
            data-testid="button-mode-new-company"
            className="toggle-elevate"
          >
            <Building2 className="h-4 w-4 mr-2" />
            New Company Registration
          </Button>
          <Button
            variant={mode === "existing_company" ? "default" : "outline"}
            onClick={() => switchMode("existing_company")}
            data-testid="button-mode-existing-company"
            className="toggle-elevate"
          >
            <FileText className="h-4 w-4 mr-2" />
            I Already Have a Company
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {mode === "new_company" && (
            <>
              <div>
                <h2 className="text-lg font-semibold mb-2" data-testid="text-incorporation-heading">
                  Company Incorporation (CAC)
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose a share capital tier for your company registration with the Corporate Affairs Commission.
                </p>
                <div className="space-y-3">
                  {cacProducts.map((p) => {
                    const isSelected = selectedSkus.includes(p.sku);
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
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{p.name}</p>
                              {shareCapital && (
                                <p className="text-xs text-muted-foreground">
                                  Share Capital: {formatNgn(shareCapital * 100)}
                                  {(p.metadata as any)?.foreignParticipation && " — includes foreign participation per CAMA"}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="font-semibold text-lg">{getSkuPriceLabel(p.sku, p.priceNgn)}</span>
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

              {ngoProduct && (
                <div>
                  <h2 className="text-lg font-semibold mb-2" data-testid="text-ngo-heading">
                    NGO / Incorporated Trustees
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Register a non-profit organisation or incorporated trustees.
                  </p>
                  <Card
                    className={`cursor-pointer transition-colors ${selectedSkus.includes("NGO") ? "border-primary ring-1 ring-primary" : ""}`}
                    onClick={() => toggleSku("NGO")}
                    data-testid="card-product-NGO"
                  >
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-md ${selectedSkus.includes("NGO") ? "bg-primary/10" : "bg-muted"}`}>
                          <Users className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{ngoProduct.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Includes filing fees, newspaper publications, constitution & legal charges
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-semibold text-lg">{formatNgn(ngoProduct.priceNgn)}</span>
                        {selectedSkus.includes("NGO") ? (
                          <Badge variant="default" data-testid="badge-selected-NGO">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Selected
                          </Badge>
                        ) : (
                          <Button size="sm" variant="outline" data-testid="button-select-NGO">Select</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {hasIncorporation && unselectedAddOns.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold" data-testid="text-recommended-heading">
                      Recommended Add-ons
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Most founders add these services alongside their incorporation to save time and avoid delays later.
                  </p>
                  <div className="space-y-3">
                    {unselectedAddOns.map((p) => {
                      const Icon = getSkuIcon(p.sku);
                      const description = getSkuDescription(p.sku);
                      const benefit = getSkuBenefit(p.sku);
                      return (
                        <Card
                          key={p.sku}
                          className="cursor-pointer transition-colors border-dashed"
                          onClick={() => toggleSku(p.sku)}
                          data-testid={`card-recommended-${p.sku}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="p-2 rounded-md bg-muted flex-shrink-0 mt-0.5">
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium">{p.name}</p>
                                  {description && (
                                    <p className="text-xs text-muted-foreground mt-1">{description}</p>
                                  )}
                                  {benefit && (
                                    <div className="flex items-center gap-1 mt-1.5">
                                      <Clock className="h-3 w-3 text-primary flex-shrink-0" />
                                      <span className="text-xs text-primary font-medium">{benefit}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <span className="font-semibold">{getSkuPriceLabel(p.sku, p.priceNgn)}</span>
                                <Button size="sm" variant="outline" data-testid={`button-add-recommended-${p.sku}`}>
                                  <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {!hasIncorporation && addOnProducts.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-2" data-testid="text-addons-heading">Additional Services</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    You can also add these services to your incorporation order.
                  </p>
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
                              <div className="min-w-0">
                                <p className="font-medium">{p.name}</p>
                                {getSkuDescription(p.sku) && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{getSkuDescription(p.sku)}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="font-semibold">{getSkuPriceLabel(p.sku, p.priceNgn)}</span>
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
            </>
          )}

          {mode === "existing_company" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-2" data-testid="text-standalone-heading">
                  Services for Your Existing Company
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Already incorporated? Select the services you need for your business.
                </p>
                <div className="space-y-3">
                  {addOnProducts.map((p) => {
                    const isSelected = selectedSkus.includes(p.sku);
                    const Icon = getSkuIcon(p.sku);
                    const description = getSkuDescription(p.sku);
                    const advisory = getSkuAdvisory(p.sku);
                    return (
                      <Card
                        key={p.sku}
                        className={`cursor-pointer transition-colors ${isSelected ? "border-primary ring-1 ring-primary" : ""}`}
                        onClick={() => toggleSku(p.sku)}
                        data-testid={`card-product-${p.sku}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`p-2 rounded-md ${isSelected ? "bg-primary/10" : "bg-muted"} flex-shrink-0 mt-0.5`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium">{p.name}</p>
                                {description && (
                                  <p className="text-xs text-muted-foreground mt-1">{description}</p>
                                )}
                                {getSkuBenefit(p.sku) && (
                                  <div className="flex items-center gap-1 mt-1.5">
                                    <Clock className="h-3 w-3 text-primary flex-shrink-0" />
                                    <span className="text-xs text-primary font-medium">{getSkuBenefit(p.sku)}</span>
                                  </div>
                                )}
                                {advisory && (
                                  <div className="flex items-start gap-1.5 mt-2 p-2 rounded-md bg-muted/50">
                                    <AlertTriangle className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                                    <span className="text-xs text-muted-foreground" data-testid={`text-advisory-${p.sku}`}>{advisory}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="font-semibold text-lg">{getSkuPriceLabel(p.sku, p.priceNgn)}</span>
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
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {selectedProducts.length > 0 && (
                <Card className="border-muted bg-muted/30" data-testid="card-post-payment-info">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">What happens after payment</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          After successful payment, you will be asked to provide your company registration details and upload supporting documents (Certificate of Incorporation, MEMART, TIN, Proof of Address, etc.) so a lawyer can process your request.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
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
                <div className="text-center py-6" data-testid="text-empty-cart">
                  <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {mode === "new_company"
                      ? "Choose an incorporation tier or NGO registration to get started."
                      : "Select the services you need for your company."}
                  </p>
                </div>
              ) : (
                <>
                  {selectedProducts.map((p) => {
                    const isIncorp = p.sku.startsWith("CAC_") || p.sku === "NGO";
                    const qty = isIncorp ? nameCount : 1;
                    const lineTotal = p.priceNgn * qty;
                    return (
                      <div key={p.sku} className="flex items-center justify-between gap-2" data-testid={`summary-item-${p.sku}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={(e) => { e.stopPropagation(); removeSku(p.sku); }}
                            data-testid={`button-remove-${p.sku}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <div className="min-w-0">
                            <span className="text-sm truncate block">{p.name}</span>
                            {isIncorp && qty > 1 && (
                              <span className="text-xs text-muted-foreground">{formatNgn(p.priceNgn)} × {qty} names</span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-medium flex-shrink-0">{getSkuPriceLabel(p.sku, lineTotal)}</span>
                      </div>
                    );
                  })}

                  <Separator />
                  <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span data-testid="text-subtotal-amount">{formatNgn(totalKobo)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>Administration Fee (10%)</span>
                    <span data-testid="text-admin-fee-amount">{formatNgn(Math.round(totalKobo * 0.10))}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg" data-testid="text-total-amount">{formatNgn(totalKobo + Math.round(totalKobo * 0.10))}</span>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              {!profilesReady && selectedProducts.length > 0 && (
                <Alert variant="destructive" className="w-full" data-testid="alert-profiles-incomplete">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Profiles Incomplete</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>The following people need to complete their profiles before you can proceed:</p>
                    <ul className="text-xs space-y-1 list-disc ml-4">
                      {incompletePeople.map((p) => (
                        <li key={String(p.id)}>
                          {p.firstName && p.lastName
                            ? `${p.firstName} ${p.lastName}`
                            : p.inviteEmail || "Unknown"}{" "}
                          ({p.role === "founder" ? "You" : p.role.replace(/_/g, " ")}) — {p.profileCompletion}% complete
                        </li>
                      ))}
                    </ul>
                    <Link href="/founder/company-people">
                      <Button variant="outline" size="sm" className="mt-2" data-testid="button-manage-people-from-checkout">
                        <Users className="h-3 w-3 mr-1" />
                        Manage Team
                      </Button>
                    </Link>
                  </AlertDescription>
                </Alert>
              )}
              <Button
                className="w-full"
                size="lg"
                disabled={selectedProducts.length === 0 || checkoutMutation.isPending || !profilesReady}
                onClick={() => checkoutMutation.mutate()}
                data-testid="button-checkout"
              >
                {checkoutMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : !profilesReady ? (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Complete All Profiles First
                  </>
                ) : (
                  <>
                    Pay {selectedProducts.length > 0 ? formatNgn(totalKobo + Math.round(totalKobo * 0.10)) : ""}
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                You will be redirected to Paystack to complete your payment securely.
              </p>
              <p className="text-xs text-muted-foreground text-center mt-1" data-testid="text-managed-service-note">
                Your payment covers a fully managed service — our licensed lawyers handle all filings, follow-ups, and correspondence with government agencies on your behalf.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
