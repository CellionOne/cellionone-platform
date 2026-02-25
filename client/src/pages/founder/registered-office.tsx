import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2,
  MapPin,
  Mail,
  CheckCircle2,
  Shield,
  AlertTriangle,
  Clock,
  Copy,
  ExternalLink,
  Calendar,
  Package,
  FileCheck,
  Info,
  FileText,
  Loader2,
} from "lucide-react";

interface SubscriptionData {
  subscription: {
    id: number;
    tier: string;
    status: string;
    startsAt: string | null;
    expiresAt: string | null;
    paymentReference: string | null;
    paymentStatus: string;
    priceNgn: number;
    termMonths: number;
    useAsRegisteredAddress: boolean;
    registeredAddressConfirmedAt: string | null;
    registeredAddressConsentText: string | null;
    proofOfAddressStatus: string;
  } | null;
  address: {
    id: number;
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string | null;
    country: string;
  } | null;
  applicationId: number | null;
}

interface PoaStatusData {
  status: string;
  uploadedAt: string | null;
}

interface OptionsData {
  tiers: { id: string; name: string; priceNgn: number; description: string; features: string[] }[];
  location: { label: string; city: string; state: string; country: string };
  policyText: string;
  termMonths: number;
}

interface IdentityData {
  status: string;
}

interface ServicePolicy {
  mailItemsIncluded: number;
  storageRetentionDays: number;
  officialMailOnly: boolean;
}

const CONSENT_TEXT = "I confirm that I want to use this address as the registered office for my company. A proof of address (utility bill) will be obtained from the virtual office provider. This document will be shared with my assigned lawyer for CAC filing and with authorised third parties (e.g. banks) for registrations processed through Celion One. I understand that I will not be able to download the proof of address directly \u2014 it is shared only with verified parties to prevent fraud.";

export default function RegisteredOfficePage() {
  const { toast } = useToast();
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  const { data: subscription, isLoading: loadingSubscription } = useQuery<SubscriptionData>({
    queryKey: ["/api/registered-office/subscription"],
  });

  const { data: options, isLoading: loadingOptions } = useQuery<OptionsData>({
    queryKey: ["/api/registered-office/options"],
  });

  const { data: identity, isLoading: loadingIdentity } = useQuery<IdentityData | null>({
    queryKey: ["/api/founder/identity"],
  });

  const { data: servicePolicy } = useQuery<ServicePolicy>({
    queryKey: ["/api/registered-office/service-policy"],
    enabled: subscription?.subscription?.tier === "office_plus_mail",
  });

  const { data: poaStatus } = useQuery<PoaStatusData>({
    queryKey: ["/api/registered-office/proof-of-address-status"],
    enabled: !!subscription?.subscription?.useAsRegisteredAddress,
  });

  const confirmRegisteredAddressMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/registered-office/confirm-as-registered-address", {
        consentText: CONSENT_TEXT,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/registered-office/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/registered-office/proof-of-address-status"] });
      setShowConsentDialog(false);
      setConsentChecked(false);
      toast({
        title: "Address confirmed",
        description: "This address has been confirmed as your company's registered office.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Confirmation failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async (tier: string) => {
      return apiRequest("POST", "/api/registered-office/subscribe", { tier });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/registered-office/subscription"] });
      toast({
        title: "Subscription initiated",
        description: "Your registered office subscription has been created. Complete payment to activate.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Subscription failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard.",
    });
  };

  const isLoading = loadingSubscription || loadingOptions || loadingIdentity;
  const isVerified = identity?.status === "verified";
  const hasActiveSubscription = subscription?.subscription?.status === "active";
  const hasPendingSubscription = subscription?.subscription && subscription.subscription.status !== "active";

  if (isLoading) {
    return (
      <DashboardLayout
        role="founder"
        breadcrumbs={[
          { label: "Dashboard", href: "/founder/dashboard" },
          { label: "Registered Office" },
        ]}
      >
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  const formatAddress = (addr: SubscriptionData["address"]) => {
    if (!addr) return "";
    const parts = [addr.line1];
    if (addr.line2) parts.push(addr.line2);
    parts.push(`${addr.city}, ${addr.state}`);
    if (addr.postalCode) parts.push(addr.postalCode);
    parts.push(addr.country);
    return parts.join(", ");
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case "office_only":
        return "Office Only";
      case "office_plus_mail":
        return "Office + Mail";
      default:
        return tier;
    }
  };

  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[
        { label: "Dashboard", href: "/founder/dashboard" },
        { label: "Registered Office" },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Registered Office Service
          </h1>
          <p className="text-muted-foreground mt-1">
            Use a premium Ikoyi, Lagos address as your company's registered office
          </p>
        </div>

        {hasActiveSubscription && subscription?.address && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Active Subscription
                  </CardTitle>
                  <CardDescription>
                    Your registered office is active and can be used for official documents
                  </CardDescription>
                </div>
                <Badge variant="default" className="bg-primary">
                  {getTierLabel(subscription.subscription!.tier)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-background rounded-lg p-4 border space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">{subscription.address.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {subscription.address.line1}
                        {subscription.address.line2 && <br />}
                        {subscription.address.line2}
                        <br />
                        {subscription.address.city}, {subscription.address.state} {subscription.address.postalCode}
                        <br />
                        {subscription.address.country}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyToClipboard(formatAddress(subscription.address))}
                    data-testid="button-copy-address"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Valid from</p>
                    <p className="font-medium">
                      {subscription.subscription?.startsAt
                        ? new Date(subscription.subscription.startsAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Expires</p>
                    <p className="font-medium">
                      {subscription.subscription?.expiresAt
                        ? new Date(subscription.subscription.expiresAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {subscription.subscription?.tier === "office_plus_mail" && (
                <>
                  {servicePolicy && (
                    <div className="pt-2 border-t">
                      <p className="text-sm font-medium flex items-center gap-2 mb-3">
                        <Info className="h-4 w-4 text-primary" />
                        Mail Service Policy
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-start gap-2 bg-primary/5 rounded-lg p-2">
                          <Package className="h-4 w-4 text-primary mt-0.5" />
                          <div>
                            <p className="font-medium">{servicePolicy.mailItemsIncluded}/month</p>
                            <p className="text-muted-foreground text-xs">Items included</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 bg-primary/5 rounded-lg p-2">
                          <Calendar className="h-4 w-4 text-primary mt-0.5" />
                          <div>
                            <p className="font-medium">{servicePolicy.storageRetentionDays} days</p>
                            <p className="text-muted-foreground text-xs">Storage retention</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 bg-primary/5 rounded-lg p-2">
                          <FileCheck className="h-4 w-4 text-primary mt-0.5" />
                          <div>
                            <p className="font-medium">{servicePolicy.officialMailOnly ? "Official only" : "All mail"}</p>
                            <p className="text-muted-foreground text-xs">Mail policy</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <Link href="/founder/mail">
                      <Button variant="outline" className="gap-2" data-testid="link-manage-mail">
                        <Mail className="h-4 w-4" />
                        Manage Mail Preferences
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {hasActiveSubscription && subscription?.address && (
          <Card data-testid="card-registered-address-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Use as Your Company's Registered Address
              </CardTitle>
              <CardDescription>
                Confirm this address for company incorporation and third-party registrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscription.subscription?.useAsRegisteredAddress ? (
                <>
                  <div className="flex items-start gap-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium text-green-800 dark:text-green-200" data-testid="text-registered-address-confirmed">
                        Confirmed as Registered Address
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Confirmed on{" "}
                        <span data-testid="text-confirmed-date">
                          {subscription.subscription.registeredAddressConfirmedAt
                            ? new Date(subscription.subscription.registeredAddressConfirmedAt).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-primary" />
                      Proof of Address (Utility Bill)
                    </p>
                    <div className="flex items-center gap-3" data-testid="poa-status-indicator">
                      {(() => {
                        const status = poaStatus?.status || subscription.subscription.proofOfAddressStatus || "pending";
                        switch (status) {
                          case "verified":
                            return (
                              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 w-full">
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                                <div>
                                  <p className="font-medium text-green-800 dark:text-green-200" data-testid="text-poa-status">Verified</p>
                                  <p className="text-sm text-green-700 dark:text-green-300">
                                    The utility bill has been verified and is ready for use in filings
                                  </p>
                                </div>
                              </div>
                            );
                          case "uploaded":
                            return (
                              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 w-full">
                                <FileCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                                <div>
                                  <p className="font-medium text-blue-800 dark:text-blue-200" data-testid="text-poa-status">Uploaded</p>
                                  <p className="text-sm text-blue-700 dark:text-blue-300">
                                    Utility bill received and pending verification by our team
                                  </p>
                                </div>
                              </div>
                            );
                          default:
                            return (
                              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 w-full">
                                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <div>
                                  <p className="font-medium text-amber-800 dark:text-amber-200" data-testid="text-poa-status">Pending</p>
                                  <p className="text-sm text-amber-700 dark:text-amber-300">
                                    Waiting for the virtual office provider to supply the utility bill
                                  </p>
                                </div>
                              </div>
                            );
                        }
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The proof of address is shared only with your assigned lawyer and authorised third parties. You cannot download it directly for fraud prevention.
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>
                      You can designate this virtual office address as the registered office for your company.
                      This is required for company incorporation at the CAC and for third-party registrations (e.g. bank accounts).
                    </p>
                    <p>
                      A proof of address (utility bill) will be obtained from the virtual office provider and shared securely with your assigned lawyer.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setConsentChecked(false);
                      setShowConsentDialog(true);
                    }}
                    className="gap-2"
                    data-testid="button-confirm-registered-address"
                  >
                    <Building2 className="h-4 w-4" />
                    Confirm as Registered Address
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Registered Address Usage</DialogTitle>
              <DialogDescription>
                Please read and agree to the following before confirming
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm space-y-3 bg-muted/50 rounded-lg p-4">
                <p>I confirm that I want to use this address as the registered office for my company.</p>
                <p>A proof of address (utility bill) will be obtained from the virtual office provider.</p>
                <p>
                  This document will be shared with my assigned lawyer for CAC filing and with authorised third parties
                  (e.g. banks) for registrations processed through Celion One.
                </p>
                <p>
                  I understand that I will not be able to download the proof of address directly — it is shared only
                  with verified parties to prevent fraud.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent-checkbox"
                  checked={consentChecked}
                  onCheckedChange={(checked) => setConsentChecked(checked === true)}
                  data-testid="checkbox-consent"
                />
                <label htmlFor="consent-checkbox" className="text-sm leading-tight cursor-pointer">
                  I have read and agree to the above terms regarding the use of this address as my company's registered office
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowConsentDialog(false)}
                data-testid="button-cancel-consent"
              >
                Cancel
              </Button>
              <Button
                onClick={() => confirmRegisteredAddressMutation.mutate()}
                disabled={!consentChecked || confirmRegisteredAddressMutation.isPending}
                data-testid="button-submit-consent"
              >
                {confirmRegisteredAddressMutation.isPending ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  "Confirm"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {hasPendingSubscription && !hasActiveSubscription && (
          <Card className="border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Pending Activation
              </CardTitle>
              <CardDescription>
                Your subscription is awaiting payment or activation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tier</span>
                  <span className="font-medium">{getTierLabel(subscription!.subscription!.tier)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">
                    ₦{subscription!.subscription!.priceNgn.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={subscription!.subscription!.status} />
                </div>
              </div>
              <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-sm">
                <p className="text-yellow-800 dark:text-yellow-200">
                  Your subscription will be activated once payment is confirmed or manually approved during beta.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!subscription?.subscription && (
          <>
            {!isVerified && (
              <Card className="border-orange-500/30 bg-orange-50 dark:bg-orange-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-orange-600" />
                    Identity Verification Required
                  </CardTitle>
                  <CardDescription>
                    You must verify your identity before subscribing to a standalone registered office service
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/founder/identity">
                    <Button className="gap-2" data-testid="link-verify-identity">
                      <Shield className="h-4 w-4" />
                      Complete Identity Verification
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {isVerified && options && (
              <>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">Service Policy</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{options.policyText}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {options.tiers.map((tier) => (
                    <Card key={tier.id} className="relative hover-elevate" data-testid={`card-tier-${tier.id}`}>
                      {tier.id === "office_plus_mail" && (
                        <div className="absolute -top-3 left-4">
                          <Badge variant="default" className="bg-primary">Most Popular</Badge>
                        </div>
                      )}
                      <CardHeader className="pt-6">
                        <CardTitle className="flex items-center gap-2">
                          {tier.id === "office_plus_mail" ? (
                            <Mail className="h-5 w-5 text-primary" />
                          ) : (
                            <Building2 className="h-5 w-5 text-primary" />
                          )}
                          {tier.name}
                        </CardTitle>
                        <CardDescription>{tier.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-3xl font-bold text-primary">
                            ₦{tier.priceNgn.toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">per year</p>
                        </div>
                        <ul className="space-y-2 text-sm">
                          {tier.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                      <CardFooter>
                        <Button
                          className="w-full"
                          onClick={() => subscribeMutation.mutate(tier.id)}
                          disabled={subscribeMutation.isPending}
                          data-testid={`button-subscribe-${tier.id}`}
                        >
                          {subscribeMutation.isPending ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            "Subscribe Now"
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      Office Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{options.location.label}</p>
                    <p className="text-muted-foreground">
                      {options.location.city}, {options.location.state}, {options.location.country}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Full address details will be provided after subscription activation.
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
