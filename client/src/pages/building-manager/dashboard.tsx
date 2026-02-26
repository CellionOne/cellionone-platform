import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { Link } from "wouter";
import {
  Building2,
  MapPin,
  Users,
  FileText,
  Mail,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Package,
} from "lucide-react";

interface LocationData {
  id: number;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  country: string;
  contactPhone: string | null;
  contactEmail: string | null;
  operatingHours: string | null;
  utilityBillStatus: string | null;
  utilityBillExpiresAt: string | null;
}

interface SubscriberSummary {
  id: number;
  founderId: string;
  founderName: string;
  companyName: string | null;
  tier: string;
  status: string;
}

interface MailItemSummary {
  id: number;
  senderName: string | null;
  status: string;
  receivedAt: string;
  founderName: string;
  isSensitive: boolean;
}

export default function BuildingManagerDashboard() {
  const { data: location, isLoading: loadingLocation } = useQuery<LocationData>({
    queryKey: ["/api/building-manager/location"],
  });

  const { data: subscribers, isLoading: loadingSubs } = useQuery<SubscriberSummary[]>({
    queryKey: ["/api/building-manager/subscribers"],
  });

  const { data: mailItems, isLoading: loadingMail } = useQuery<MailItemSummary[]>({
    queryKey: ["/api/building-manager/mail"],
  });

  const isLoading = loadingLocation || loadingSubs || loadingMail;

  if (isLoading) {
    return (
      <DashboardLayout
        role="building_manager"
        breadcrumbs={[{ label: "Dashboard" }]}
      >
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (!location) {
    return (
      <DashboardLayout
        role="building_manager"
        breadcrumbs={[{ label: "Dashboard" }]}
      >
        <EmptyState
          icon={Building2}
          title="No Location Assigned"
          description="You have not been assigned to a building location yet. Please contact an administrator."
        />
      </DashboardLayout>
    );
  }

  const activeSubscribers = subscribers?.filter(s => s.status === "active") || [];
  const recentMail = (mailItems || []).slice(0, 5);

  const getUtilityBillBadge = () => {
    switch (location.utilityBillStatus) {
      case "current":
        return <Badge className="gap-1 bg-primary" data-testid="badge-utility-status"><CheckCircle2 className="h-3 w-3" />Current</Badge>;
      case "expired":
        return <Badge variant="destructive" className="gap-1" data-testid="badge-utility-status"><AlertTriangle className="h-3 w-3" />Expired</Badge>;
      case "pending":
        return <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600" data-testid="badge-utility-status"><Clock className="h-3 w-3" />Pending</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1" data-testid="badge-utility-status"><Upload className="h-3 w-3" />Not Uploaded</Badge>;
    }
  };

  const getMailStatusBadge = (status: string) => {
    switch (status) {
      case "received":
        return <Badge variant="secondary" className="gap-1"><Package className="h-3 w-3" />Received</Badge>;
      case "scanned":
        return <Badge className="gap-1 bg-primary"><CheckCircle2 className="h-3 w-3" />Scanned</Badge>;
      case "forwarded":
        return <Badge variant="secondary" className="gap-1"><Mail className="h-3 w-3" />Forwarded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout
      role="building_manager"
      breadcrumbs={[{ label: "Dashboard" }]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Building2 className="h-6 w-6 text-primary" />
            Building Manager Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your building location, utility bills, and mail intake
          </p>
        </div>

        <Card data-testid="card-building-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {location.label}
            </CardTitle>
            <CardDescription>
              {location.line1}{location.line2 ? `, ${location.line2}` : ""}, {location.city}, {location.state}, {location.country}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {location.contactPhone && (
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium" data-testid="text-contact-phone">{location.contactPhone}</p>
                </div>
              )}
              {location.contactEmail && (
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium" data-testid="text-contact-email">{location.contactEmail}</p>
                </div>
              )}
              {location.operatingHours && (
                <div>
                  <p className="text-muted-foreground">Operating Hours</p>
                  <p className="font-medium" data-testid="text-operating-hours">{location.operatingHours}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card data-testid="card-subscriber-count">
            <CardHeader className="pb-2">
              <CardDescription>Active Subscribers</CardDescription>
              <CardTitle className="text-2xl" data-testid="text-subscriber-count">{activeSubscribers.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/building-manager/subscribers">
                <Button variant="outline" size="sm" className="gap-1" data-testid="link-view-subscribers">
                  <Users className="h-4 w-4" />
                  View All
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card data-testid="card-utility-bill">
            <CardHeader className="pb-2">
              <CardDescription>Utility Bill</CardDescription>
              <div className="mt-1">{getUtilityBillBadge()}</div>
            </CardHeader>
            <CardContent>
              {location.utilityBillExpiresAt && (
                <p className="text-xs text-muted-foreground mb-2" data-testid="text-utility-expiry">
                  Expires: {new Date(location.utilityBillExpiresAt).toLocaleDateString()}
                </p>
              )}
              <Link href="/building-manager/utility-bill">
                <Button variant="outline" size="sm" className="gap-1" data-testid="link-manage-utility">
                  <FileText className="h-4 w-4" />
                  Manage
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card data-testid="card-mail-count">
            <CardHeader className="pb-2">
              <CardDescription>Recent Mail Items</CardDescription>
              <CardTitle className="text-2xl" data-testid="text-mail-count">{mailItems?.length ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/building-manager/mail-intake">
                <Button variant="outline" size="sm" className="gap-1" data-testid="link-mail-intake">
                  <Mail className="h-4 w-4" />
                  Mail Intake
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {(location.utilityBillStatus === "expired" || !location.utilityBillStatus) && (
          <Card className="border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20" data-testid="card-utility-alert">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="h-5 w-5" />
                Utility Bill Action Required
              </CardTitle>
              <CardDescription className="text-yellow-700 dark:text-yellow-300">
                {location.utilityBillStatus === "expired"
                  ? "Your utility bill has expired. Please upload a new one."
                  : "No utility bill has been uploaded yet. Please upload one to support subscriber registrations."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/building-manager/utility-bill">
                <Button className="gap-2" data-testid="button-upload-utility">
                  <Upload className="h-4 w-4" />
                  Upload Utility Bill
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <Card data-testid="card-recent-mail">
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Recent Mail
                </CardTitle>
                <CardDescription>Latest mail items at your location</CardDescription>
              </div>
              <Link href="/building-manager/mail-intake">
                <Button variant="outline" size="sm" data-testid="link-view-all-mail">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentMail.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-mail">
                No mail items recorded yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentMail.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border"
                    data-testid={`mail-item-${item.id}`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.senderName || "Unknown Sender"}</p>
                      <p className="text-xs text-muted-foreground">
                        To: {item.founderName} &middot; {new Date(item.receivedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.isSensitive && (
                        <Badge variant="outline" className="gap-1 border-red-500 text-red-600">Sensitive</Badge>
                      )}
                      {getMailStatusBadge(item.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
