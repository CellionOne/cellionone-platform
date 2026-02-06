import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
  Check,
  X,
  PieChart,
  ClipboardList,
} from "lucide-react";
import type { CompanyProfile, PostIncorporationTask } from "@shared/schema";
import { Link } from "wouter";

interface ProfileWithTasks extends CompanyProfile {
  tasks?: PostIncorporationTask[];
}

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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">Company Profiles</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage your incorporated companies
            </p>
          </div>
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
                    <p className="text-sm text-muted-foreground">
                      Pending incorporation details
                    </p>
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
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PUT", `/api/founder/company-profiles/${profile?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles", profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles"] });
      setEditingField(null);
      toast({ title: "Updated", description: "Company profile updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = (field: string) => {
    updateMutation.mutate({ [field]: editValue });
  };

  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue || "");
  };

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

  const address = profile.registeredAddress as any;
  const directors = (profile.directors || []) as { name: string; role?: string; email?: string }[];
  const shareholders = (profile.shareholders || []) as { name: string; shares?: number; percentage?: number }[];
  const activities = (profile.businessActivities || []) as string[];
  const completedTasks = profile.tasks?.filter(t => t.status === "completed").length || 0;
  const totalTasks = profile.tasks?.length || 0;

  return (
    <div className="space-y-6" data-testid="company-profile-detail">
      <div className="flex items-center gap-3 flex-wrap">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-company-details">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Company Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EditableField
              label="RC Number"
              value={profile.rcNumber || ""}
              field="rcNumber"
              editingField={editingField}
              editValue={editValue}
              isPending={updateMutation.isPending}
              onStartEdit={startEditing}
              onSave={handleSave}
              onCancel={() => setEditingField(null)}
              onEditValueChange={setEditValue}
              placeholder="Enter RC number"
              testIdPrefix="rc-number"
            />

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Incorporation Date</label>
              <p className="text-sm" data-testid="text-detail-inc-date">
                {profile.incorporationDate
                  ? new Date(profile.incorporationDate).toLocaleDateString()
                  : "Not set"}
              </p>
            </div>

            <EditableField
              label="TIN Number"
              value={profile.tinNumber || ""}
              field="tinNumber"
              editingField={editingField}
              editValue={editValue}
              isPending={updateMutation.isPending}
              onStartEdit={startEditing}
              onSave={handleSave}
              onCancel={() => setEditingField(null)}
              onEditValueChange={setEditValue}
              placeholder="Enter TIN number"
              testIdPrefix="tin-number"
            />

            {profile.shareCapital && (
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Share Capital</label>
                <p className="text-sm" data-testid="text-share-capital">{profile.shareCapital}</p>
              </div>
            )}
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
            {address ? (
              <div className="text-sm space-y-1" data-testid="text-address">
                {address.line1 && <p>{address.line1}</p>}
                {address.line2 && <p>{address.line2}</p>}
                <p>
                  {[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No address on file</p>
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
    </div>
  );
}

function EditableField({
  label,
  value,
  field,
  editingField,
  editValue,
  isPending,
  onStartEdit,
  onSave,
  onCancel,
  onEditValueChange,
  placeholder,
  testIdPrefix,
}: {
  label: string;
  value: string;
  field: string;
  editingField: string | null;
  editValue: string;
  isPending: boolean;
  onStartEdit: (field: string, value: string) => void;
  onSave: (field: string) => void;
  onCancel: () => void;
  onEditValueChange: (value: string) => void;
  placeholder: string;
  testIdPrefix: string;
}) {
  const isEditing = editingField === field;

  return (
    <div className="space-y-1">
      <label className="text-sm text-muted-foreground">{label}</label>
      {isEditing ? (
        <div className="flex items-center gap-2">
          <Input
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            placeholder={placeholder}
            data-testid={`input-${testIdPrefix}`}
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onSave(field)}
            disabled={isPending}
            data-testid={`button-save-${testIdPrefix}`}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onCancel}
            data-testid={`button-cancel-${testIdPrefix}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="text-sm" data-testid={`text-${testIdPrefix}`}>
            {value || "Not set"}
          </p>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onStartEdit(field, value)}
            data-testid={`button-edit-${testIdPrefix}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
