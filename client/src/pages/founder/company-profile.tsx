import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2,
  ChevronLeft,
  Users,
  MapPin,
  Briefcase,
  Hash,
  Calendar,
  FileText,
  Pencil,
  PieChart,
  ClipboardList,
} from "lucide-react";
import type { CompanyProfile, PostIncorporationTask } from "@shared/schema";
import { Link } from "wouter";

interface ProfileWithTasks extends CompanyProfile {
  tasks?: PostIncorporationTask[];
}

interface RegisteredAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

interface CompanyUpdatePayload {
  companyName: string;
  companyType: string;
  rcNumber: string | null;
  tinNumber: string | null;
  shareCapital: string | null;
  incorporationDate: string | null;
  registeredAddress: RegisteredAddress;
  businessActivities: string[];
}

const COMPANY_TYPES = [
  { value: "LTD", label: "Private Limited Company (LTD)" },
  { value: "PLC", label: "Public Limited Company (PLC)" },
  { value: "LLC", label: "Limited Liability Company (LLC)" },
  { value: "LLP", label: "Limited Liability Partnership (LLP)" },
  { value: "NGO", label: "Non-Governmental Organisation (NGO)" },
  { value: "CBO", label: "Community Based Organisation (CBO)" },
  { value: "TRUST", label: "Trust" },
];

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT - Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

export default function CompanyProfilePage() {
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: profiles, isLoading: profilesLoading } = useQuery<CompanyProfile[]>({
    queryKey: ["/api/founder/company-profiles"],
  });

  const { data: profileDetail, isLoading: detailLoading } = useQuery<ProfileWithTasks>({
    queryKey: ["/api/founder/company-profiles", selectedProfileId],
    enabled: !!selectedProfileId,
  });

  if (selectedProfileId) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[
        { label: "Company Profiles", href: "/founder/company-profile" },
        { label: profileDetail?.companyName || "Loading..." },
      ]}>
        <ProfileDetailView
          profile={profileDetail}
          isLoading={detailLoading}
          onBack={() => setSelectedProfileId(null)}
          toast={toast}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Company Profiles" }]}>
      <div className="space-y-6" data-testid="company-profiles-page">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Company Profiles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage your incorporated companies
          </p>
        </div>

        {profilesLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !profiles?.length ? (
          <EmptyState
            icon={Building2}
            title="No company profiles yet"
            description="Company profiles are automatically created when your incorporation application is completed or filed. Check your applications for status."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <Card
                key={profile.id}
                className="cursor-pointer hover-elevate transition-colors"
                onClick={() => setSelectedProfileId(profile.id)}
                data-testid={`card-company-profile-${profile.id}`}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="text-base truncate" data-testid={`text-company-name-${profile.id}`}>
                      {profile.companyName}
                    </CardTitle>
                    <Badge variant="secondary" data-testid={`badge-company-type-${profile.id}`}>
                      {profile.companyType || "LTD"}
                    </Badge>
                  </div>
                  <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                </CardHeader>
                <CardContent className="space-y-2">
                  {profile.rcNumber && (
                    <div className="flex items-center gap-2 text-sm">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">RC:</span>
                      <span data-testid={`text-rc-number-${profile.id}`}>{profile.rcNumber}</span>
                    </div>
                  )}
                  {profile.incorporationDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Incorporated:</span>
                      <span data-testid={`text-inc-date-${profile.id}`}>
                        {new Date(profile.incorporationDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {!profile.rcNumber && !profile.incorporationDate && (
                    <p className="text-sm text-muted-foreground">Pending incorporation details</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ProfileDetailView({
  profile,
  isLoading,
  onBack,
  toast,
}: {
  profile: ProfileWithTasks | undefined;
  isLoading: boolean;
  onBack: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <EmptyState
        icon={Building2}
        title="Profile not found"
        description="The company profile could not be loaded."
      />
    );
  }

  const address = (profile.registeredAddress || {}) as RegisteredAddress;
  const directors = (profile.directors || []) as { name: string; role?: string; email?: string }[];
  const shareholders = (profile.shareholders || []) as { name: string; shares?: number; percentage?: number }[];
  const activities = (profile.businessActivities || []) as string[];
  const completedTasks = profile.tasks?.filter(t => t.status === "completed").length || 0;
  const totalTasks = profile.tasks?.length || 0;

  return (
    <div className="space-y-6" data-testid="company-profile-detail">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold truncate" data-testid="text-detail-company-name">
              {profile.companyName}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" data-testid="badge-detail-company-type">
                {profile.companyType || "LTD"}
              </Badge>
              {profile.rcNumber && (
                <Badge variant="outline" data-testid="badge-detail-rc">RC {profile.rcNumber}</Badge>
              )}
            </div>
          </div>
        </div>
        <Button
          onClick={() => setEditOpen(true)}
          data-testid="button-edit-company"
          className="shrink-0"
        >
          <Pencil className="h-4 w-4 mr-2" />
          Edit Company Details
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-company-details">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Company Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="RC Number" value={profile.rcNumber} testId="text-rc-number" />
            <DetailRow label="TIN Number" value={profile.tinNumber} testId="text-tin-number" />
            <DetailRow
              label="Incorporation Date"
              value={profile.incorporationDate ? new Date(profile.incorporationDate).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" }) : undefined}
              testId="text-detail-inc-date"
            />
            <DetailRow label="Share Capital" value={profile.shareCapital} testId="text-share-capital" />
          </CardContent>
        </Card>

        <Card data-testid="card-registered-address">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Registered Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            {address && (address.line1 || address.city || address.state) ? (
              <div className="text-sm space-y-1" data-testid="text-address">
                {address.line1 && <p>{address.line1}</p>}
                {address.line2 && <p>{address.line2}</p>}
                <p>{[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No address on file.{" "}
                <button
                  onClick={() => setEditOpen(true)}
                  className="text-primary underline-offset-2 hover:underline"
                  data-testid="link-add-address"
                >
                  Add address
                </button>
              </p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-directors">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Directors ({directors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {directors.length > 0 ? (
              <div className="space-y-3">
                {directors.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-2" data-testid={`row-director-${i}`}>
                    <div>
                      <p className="text-sm font-medium" data-testid={`text-director-name-${i}`}>{d.name}</p>
                      {d.email && <p className="text-xs text-muted-foreground">{d.email}</p>}
                    </div>
                    {d.role && (
                      <Badge variant="outline" className="shrink-0" data-testid={`badge-director-role-${i}`}>
                        {d.role}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No directors listed</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-shareholders">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Shareholders ({shareholders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {shareholders.length > 0 ? (
              <div className="space-y-3">
                {shareholders.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-2" data-testid={`row-shareholder-${i}`}>
                    <p className="text-sm font-medium" data-testid={`text-shareholder-name-${i}`}>{s.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.percentage !== undefined && s.percentage !== null && (
                        <Badge variant="secondary" data-testid={`badge-shareholder-pct-${i}`}>
                          {s.percentage}%
                        </Badge>
                      )}
                      {s.shares !== undefined && s.shares !== null && (
                        <span className="text-xs text-muted-foreground">
                          {s.shares.toLocaleString()} shares
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No shareholders listed</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2" data-testid="card-business-activities">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Business Activities ({activities.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activities.map((a, i) => (
                  <Badge key={i} variant="outline" data-testid={`badge-activity-${i}`}>
                    {a}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No business activities listed</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Post-Incorporation Checklist</p>
            <p className="text-xs text-muted-foreground">
              {completedTasks} of {totalTasks} tasks completed
            </p>
          </div>
        </div>
        <Link href={`/founder/post-inc-checklist?profileId=${profile.id}`}>
          <Button variant="outline" data-testid="button-view-checklist">
            View Checklist
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/founder/vault">
          <Button variant="outline" data-testid="button-view-vault">
            <FileText className="h-4 w-4 mr-2" />
            View Documents in Vault
          </Button>
        </Link>
      </div>

      {editOpen && (
        <EditCompanyDialog
          profile={profile}
          onClose={() => setEditOpen(false)}
          toast={toast}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value, testId }: { label: string; value?: string | null; testId: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm" data-testid={testId}>{value || <span className="text-muted-foreground/60 italic">Not set</span>}</p>
    </div>
  );
}

function EditCompanyDialog({
  profile,
  onClose,
  toast,
}: {
  profile: ProfileWithTasks;
  onClose: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const addr = (profile.registeredAddress || {}) as RegisteredAddress;
  const activities = (profile.businessActivities || []) as string[];

  const [form, setForm] = useState({
    companyName: profile.companyName || "",
    companyType: profile.companyType || "LTD",
    rcNumber: profile.rcNumber || "",
    tinNumber: profile.tinNumber || "",
    incorporationDate: profile.incorporationDate
      ? new Date(profile.incorporationDate).toISOString().split("T")[0]
      : "",
    shareCapital: profile.shareCapital || "",
    addressLine1: addr.line1 || "",
    addressLine2: addr.line2 || "",
    addressCity: addr.city || "",
    addressState: addr.state || "",
    addressPostalCode: addr.postalCode || "",
    businessActivities: activities.join(", "),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CompanyUpdatePayload) => {
      const res = await apiRequest("PUT", `/api/founder/company-profiles/${profile.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      onClose();
      toast({ title: "Company updated", description: "Company profile saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles", profile.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles", profile.id, "compliance"] });
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!form.companyName.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
    }

    const rc = form.rcNumber.trim();
    if (rc && !/^[A-Za-z0-9\-]{4,20}$/.test(rc)) {
      toast({ title: "Invalid RC Number", description: "RC Number should be 4–20 alphanumeric characters.", variant: "destructive" });
      return;
    }

    const tin = form.tinNumber.trim();
    if (tin && !/^\d{8,12}$/.test(tin.replace(/[-\s]/g, ""))) {
      toast({ title: "Invalid TIN", description: "TIN should be 8–12 digits.", variant: "destructive" });
      return;
    }

    if (form.incorporationDate) {
      const parsed = new Date(form.incorporationDate);
      if (isNaN(parsed.getTime())) {
        toast({ title: "Invalid date", description: "Please enter a valid incorporation date.", variant: "destructive" });
        return;
      }
      if (parsed > new Date()) {
        toast({ title: "Invalid date", description: "Incorporation date cannot be in the future.", variant: "destructive" });
        return;
      }
    }

    const payload: CompanyUpdatePayload = {
      companyName: form.companyName.trim(),
      companyType: form.companyType,
      rcNumber: rc || null,
      tinNumber: tin || null,
      shareCapital: form.shareCapital.trim() || null,
      incorporationDate: form.incorporationDate
        ? new Date(form.incorporationDate).toISOString()
        : null,
      registeredAddress: {
        line1: form.addressLine1.trim() || undefined,
        line2: form.addressLine2.trim() || undefined,
        city: form.addressCity.trim() || undefined,
        state: form.addressState || undefined,
        postalCode: form.addressPostalCode.trim() || undefined,
      },
      businessActivities: form.businessActivities
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    };

    updateMutation.mutate(payload);
  };

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-company">
        <DialogHeader>
          <DialogTitle>Edit Company Details</DialogTitle>
          <DialogDescription>
            Update your company information. Changes will be reflected across the Checklist and Compliance Calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="edit-company-name">Company Name *</Label>
              <Input
                id="edit-company-name"
                value={form.companyName}
                onChange={set("companyName")}
                placeholder="e.g. Cellion Platforms Nigeria Limited"
                data-testid="input-edit-company-name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-company-type">Company Type</Label>
              <Select
                value={form.companyType}
                onValueChange={(v) => setForm((prev) => ({ ...prev, companyType: v }))}
              >
                <SelectTrigger id="edit-company-type" data-testid="select-company-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value} data-testid={`option-type-${ct.value}`}>
                      {ct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-rc-number">RC Number</Label>
              <Input
                id="edit-rc-number"
                value={form.rcNumber}
                onChange={set("rcNumber")}
                placeholder="e.g. 1234567"
                data-testid="input-edit-rc-number"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-tin-number">TIN Number</Label>
              <Input
                id="edit-tin-number"
                value={form.tinNumber}
                onChange={set("tinNumber")}
                placeholder="e.g. 12345678-0001"
                data-testid="input-edit-tin-number"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-inc-date">Incorporation Date</Label>
              <Input
                id="edit-inc-date"
                type="date"
                value={form.incorporationDate}
                onChange={set("incorporationDate")}
                data-testid="input-edit-inc-date"
              />
              <p className="text-xs text-muted-foreground">Used to calculate compliance deadlines</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-share-capital">Share Capital</Label>
              <Input
                id="edit-share-capital"
                value={form.shareCapital}
                onChange={set("shareCapital")}
                placeholder="e.g. ₦10,000,000"
                data-testid="input-edit-share-capital"
              />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Registered Address
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="edit-addr-line1">Address Line 1</Label>
                <Input
                  id="edit-addr-line1"
                  value={form.addressLine1}
                  onChange={set("addressLine1")}
                  placeholder="Street address"
                  data-testid="input-edit-addr-line1"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="edit-addr-line2">Address Line 2 (optional)</Label>
                <Input
                  id="edit-addr-line2"
                  value={form.addressLine2}
                  onChange={set("addressLine2")}
                  placeholder="Suite, floor, etc."
                  data-testid="input-edit-addr-line2"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-addr-city">City</Label>
                <Input
                  id="edit-addr-city"
                  value={form.addressCity}
                  onChange={set("addressCity")}
                  placeholder="e.g. Lagos"
                  data-testid="input-edit-addr-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-addr-state">State</Label>
                <Select
                  value={form.addressState}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, addressState: v }))}
                >
                  <SelectTrigger id="edit-addr-state" data-testid="select-addr-state">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {NIGERIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s} data-testid={`option-state-${s}`}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-addr-postal">Postal Code (optional)</Label>
                <Input
                  id="edit-addr-postal"
                  value={form.addressPostalCode}
                  onChange={set("addressPostalCode")}
                  placeholder="e.g. 100001"
                  data-testid="input-edit-addr-postal"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="edit-activities">
              <span className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Business Activities
              </span>
            </Label>
            <Textarea
              id="edit-activities"
              value={form.businessActivities}
              onChange={set("businessActivities")}
              placeholder="Enter activities separated by commas, e.g. Software development, IT consulting, Data analytics"
              rows={3}
              data-testid="input-edit-activities"
            />
            <p className="text-xs text-muted-foreground">Separate multiple activities with commas</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-edit">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-company"
          >
            {updateMutation.isPending ? <LoadingSpinner size="sm" /> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
