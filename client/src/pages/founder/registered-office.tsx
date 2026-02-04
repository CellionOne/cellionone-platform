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

interface OptionsData {
  tiers: { id: string; name: string; priceNgn: number; description: string; features: string[] }[];
  location: { label: string; city: string; state: string; country: string };
  policyText: string;
  termMonths: number;
}

interface IdentityData {
  status: string;
}

export default function RegisteredOfficePage() {
  const { toast } = useToast();

  const { data: subscription, isLoading: loadingSubscription } = useQuery<SubscriptionData>({
    queryKey: ["/api/registered-office/subscription"],
  });

  const { data: options, isLoading: loadingOptions } = useQuery<OptionsData>({
    queryKey: ["/api/registered-office/options"],
  });

  const { data: identity, isLoading: loadingIdentity } = useQuery<IdentityData | null>({
    queryKey: ["/api/founder/identity"],
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
                <div className="pt-2 border-t">
                  <Link href="/founder/mail">
                    <Button variant="outline" className="gap-2" data-testid="link-manage-mail">
                      <Mail className="h-4 w-4" />
                      Manage Mail Preferences
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
