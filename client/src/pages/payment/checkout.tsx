import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CreditCard, 
  Globe2, 
  Loader2, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Building2,
  AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PriceItem {
  serviceType: string;
  tier?: string;
  provider: "stripe" | "paystack";
  currency: string;
  amount: number;
  amountDisplay: string;
  stripePriceId?: string;
  paystackPlanCode?: string;
  isRecurring: boolean;
  recurringInterval?: string;
  description: string;
}

interface CheckoutItem {
  serviceType: string;
  tier?: string;
  quantity?: number;
}

interface CheckoutContext {
  applicationId?: number;
  returnUrl?: string;
}

interface CheckoutState {
  items: CheckoutItem[];
  context: CheckoutContext;
}

interface StripeConfigResponse {
  publishableKey: string;
}

interface PriceBookResponse {
  prices: PriceItem[];
}

interface CheckoutSessionResponse {
  sessionId: string;
  sessionUrl: string;
  dbSessionId: number;
  mode: "payment" | "subscription";
  requiresSecondStep: boolean;
  secondStepItems?: CheckoutItem[];
}

interface PaystackConfigResponse {
  isConfigured: boolean;
}

interface PaystackInitResponse {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [checkoutState, setCheckoutState] = useState<CheckoutState | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<"stripe" | "paystack">("stripe");
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [isStep2, setIsStep2] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const stateParam = urlParams.get("state");
    const step = urlParams.get("step");
    
    if (stateParam) {
      try {
        const decoded = JSON.parse(atob(stateParam));
        setCheckoutState(decoded);
      } catch (e) {
        console.error("Failed to parse checkout state:", e);
      }
    }
    
    const storedState = sessionStorage.getItem("checkoutState");
    if (storedState) {
      try {
        const parsed = JSON.parse(storedState);
        setCheckoutState(parsed);
        if (step === "2") {
          setIsStep2(true);
          sessionStorage.removeItem("checkoutState");
        }
      } catch (e) {
        console.error("Failed to parse stored checkout state:", e);
      }
    }
  }, []);

  const { data: stripeConfig, isLoading: stripeLoading } = useQuery<StripeConfigResponse>({
    queryKey: ["/api/payments/stripe/config"],
  });

  const { data: paystackConfig, isLoading: paystackLoading } = useQuery<PaystackConfigResponse>({
    queryKey: ["/api/payments/paystack/config"],
  });

  const { data: priceBook, isLoading: pricesLoading } = useQuery<PriceBookResponse>({
    queryKey: ["/api/payments/pricebook", selectedProvider],
    queryFn: () => fetch(`/api/payments/pricebook?provider=${selectedProvider}`).then(r => r.json()),
  });

  const stripeCheckoutMutation = useMutation({
    mutationFn: async (payload: { items: CheckoutItem[]; context: CheckoutContext }) => {
      const response = await apiRequest("POST", "/api/payments/stripe/checkout", payload);
      return response.json() as Promise<CheckoutSessionResponse>;
    },
    onSuccess: (data) => {
      setIsRedirecting(true);
      
      if (data.requiresSecondStep && data.secondStepItems) {
        sessionStorage.setItem("checkoutState", JSON.stringify({
          items: data.secondStepItems,
          context: checkoutState?.context || {},
        }));
      }
      
      window.location.href = data.sessionUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    },
  });

  const paystackCheckoutMutation = useMutation({
    mutationFn: async (payload: { items: CheckoutItem[]; context: CheckoutContext }) => {
      const response = await apiRequest("POST", "/api/payments/paystack/initialize", payload);
      return response.json() as Promise<PaystackInitResponse>;
    },
    onSuccess: (data) => {
      setIsRedirecting(true);
      window.location.href = data.authorizationUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to initialize payment",
        variant: "destructive",
      });
    },
  });

  const getPrice = (serviceType: string, tier?: string): PriceItem | undefined => {
    if (!priceBook?.prices) return undefined;
    return priceBook.prices.find(p => 
      p.serviceType === serviceType && 
      (tier ? p.tier === tier : true)
    );
  };

  const calculateTotal = (): { oneOff: number; recurring: number; currency: string } => {
    if (!checkoutState?.items || !priceBook?.prices) {
      return { oneOff: 0, recurring: 0, currency: "GBP" };
    }

    let oneOff = 0;
    let recurring = 0;
    let currency = selectedProvider === "stripe" ? "GBP" : "NGN";

    for (const item of checkoutState.items) {
      const price = getPrice(item.serviceType, item.tier);
      if (price) {
        if (price.isRecurring) {
          recurring += price.amount;
        } else {
          oneOff += price.amount;
        }
      }
    }

    return { oneOff, recurring, currency };
  };

  const formatAmount = (amount: number, currency: string): string => {
    const formatted = (amount / 100).toFixed(2);
    return currency === "GBP" ? `£${formatted}` : `₦${formatted}`;
  };

  const handleCheckout = () => {
    if (!checkoutState?.items?.length) {
      toast({
        title: "No items",
        description: "Please add items to checkout",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      items: checkoutState.items,
      context: checkoutState.context || {},
    };

    if (selectedProvider === "stripe") {
      stripeCheckoutMutation.mutate(payload);
    } else {
      paystackCheckoutMutation.mutate(payload);
    }
  };

  const isCheckoutPending = stripeCheckoutMutation.isPending || paystackCheckoutMutation.isPending;

  if (!checkoutState?.items?.length) {
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>No Items to Checkout</CardTitle>
              <CardDescription>
                It looks like you haven't selected any services yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setLocation("/founder/dashboard")} className="w-full" data-testid="button-go-dashboard">
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totals = calculateTotal();
  const hasOneOff = totals.oneOff > 0;
  const hasRecurring = totals.recurring > 0;
  const hasMixedPayments = hasOneOff && hasRecurring;

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          {isStep2 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <span className="font-medium">Step 2 of 2: Subscription Setup</span>
            </div>
          )}
          <h1 className="text-3xl font-bold text-foreground">
            {isStep2 ? "Complete Your Subscription" : "Checkout"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isStep2 
              ? "Set up your annual subscription to continue"
              : "Complete your purchase to activate services"
            }
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="h-5 w-5" />
                  Payment Method
                </CardTitle>
                <CardDescription>
                  Choose how you'd like to pay
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup 
                  value={selectedProvider} 
                  onValueChange={(v) => setSelectedProvider(v as "stripe" | "paystack")}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-3 p-4 rounded-lg border border-border hover-elevate cursor-pointer">
                    <RadioGroupItem value="stripe" id="stripe" data-testid="radio-stripe" />
                    <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">International (GBP)</p>
                          <p className="text-sm text-muted-foreground">
                            Pay with card via Stripe
                          </p>
                        </div>
                        <Badge variant="secondary">GBP £</Badge>
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-4 rounded-lg border border-border hover-elevate cursor-pointer">
                    <RadioGroupItem value="paystack" id="paystack" data-testid="radio-paystack" />
                    <Label htmlFor="paystack" className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Nigeria (NGN)</p>
                          <p className="text-sm text-muted-foreground">
                            Pay with card via Paystack
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">NGN ₦</Badge>
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {checkoutState.items.map((item, idx) => {
                  const price = getPrice(item.serviceType, item.tier);
                  return (
                    <div key={idx} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        {item.serviceType === "verification" && (
                          <ShieldCheck className="h-5 w-5 text-primary" />
                        )}
                        {item.serviceType === "incorporation" && (
                          <Building2 className="h-5 w-5 text-primary" />
                        )}
                        {item.serviceType === "registered_office" && (
                          <Building2 className="h-5 w-5 text-primary" />
                        )}
                        <div>
                          <p className="font-medium text-foreground">
                            {price?.description || item.serviceType}
                          </p>
                          {price?.isRecurring && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {price.recurringInterval === "year" ? "Annual" : "Monthly"} subscription
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">
                          {price?.amountDisplay || "—"}
                        </p>
                      </div>
                    </div>
                  );
                })}

                <Separator />

                {hasOneOff && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">One-time payment</span>
                    <span className="font-medium">{formatAmount(totals.oneOff, totals.currency)}</span>
                  </div>
                )}
                {hasRecurring && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Annual subscription</span>
                    <span className="font-medium">{formatAmount(totals.recurring, totals.currency)}/year</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between">
                  <span className="text-lg font-semibold">Total Due Today</span>
                  <span className="text-lg font-bold text-primary">
                    {formatAmount(totals.oneOff + totals.recurring, totals.currency)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {hasMixedPayments && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your order contains both one-time and subscription items. 
                  You'll complete two separate payment steps.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">
                    {formatAmount(totals.oneOff + totals.recurring, totals.currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total due</p>
                </div>
                
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleCheckout}
                  disabled={isCheckoutPending || isRedirecting}
                  data-testid="button-pay-now"
                >
                  {(isCheckoutPending || isRedirecting) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Pay Now
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  Secure payment via {selectedProvider === "stripe" ? "Stripe" : "Paystack"}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col text-xs text-muted-foreground space-y-1">
                <p>By proceeding, you agree to our</p>
                <div className="flex gap-2">
                  <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>
                  <span>&</span>
                  <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
