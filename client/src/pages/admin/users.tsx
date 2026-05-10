import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Users,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Upload,
  ShieldCheck,
  FileText,
  Image,
  PenLine,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { User } from "@shared/models/auth";

interface UserWithRole extends User {
  roles: string[];
}

interface AdminUserProfile {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profile: {
    fullName: string | null;
    phone: string | null;
    dateOfBirth: string | null;
    nationality: string | null;
    gender: string | null;
    occupation: string | null;
    addressLine1: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    idType: string | null;
    hasBvn: boolean;
    hasNin: boolean;
    hasPassportPhoto: boolean;
    hasIdDocument: boolean;
    hasSignature: boolean;
    profileCompletion: number | null;
    isProfileComplete: boolean | null;
  } | null;
}

export default function AdminUsers() {
  const { toast } = useToast();

  // Role management state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Identity (BVN/NIN) form state
  const [bvn, setBvn] = useState("");
  const [nin, setNin] = useState("");

  // Document upload state
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery<UserWithRole[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: selectedProfile, isLoading: profileLoading } = useQuery<AdminUserProfile>({
    queryKey: ["/api/admin/users", selectedUserId, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${selectedUserId}/profile`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: profileDialogOpen && !!selectedUserId,
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, role, action }: { userId: string; role: string; action: "add" | "remove" }) => {
      return apiRequest("POST", `/api/admin/users/${userId}/roles`, { role, action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User role updated" });
    },
    onError: () => {
      toast({ title: "Failed to update role", variant: "destructive" });
    },
  });

  const identityMutation = useMutation({
    mutationFn: async ({ userId, bvn: b, nin: n }: { userId: string; bvn?: string; nin?: string }) => {
      const body: any = {};
      if (b) body.bvn = b;
      if (n) body.nin = n;
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/profile/identity`, body);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save identity");
      }
      return res.json();
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId, "profile"] });
      setBvn("");
      setNin("");
      toast({ title: "Identity data saved", description: "BVN/NIN encrypted and stored securely." });
    },
    onError: (e: Error) => {
      toast({ title: "Failed to save identity", description: e.message, variant: "destructive" });
    },
  });

  const docUploadMutation = useMutation({
    mutationFn: async ({ userId, docType, file }: { userId: string; docType: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", docType);
      const res = await fetch(`/api/admin/users/${userId}/profile/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId, "profile"] });
      setUploadingDocType(null);
      toast({ title: "Document uploaded", description: "Founder profile document saved successfully." });
    },
    onError: (e: Error) => {
      setUploadingDocType(null);
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    },
  });

  function openProfileDialog(userId: string) {
    setSelectedUserId(userId);
    setBvn("");
    setNin("");
    setUploadingDocType(null);
    setProfileDialogOpen(true);
  }

  function closeProfileDialog() {
    setProfileDialogOpen(false);
    setSelectedUserId(null);
  }

  function handleFileSelect(docType: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,application/pdf";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && selectedUserId) {
        setUploadingDocType(docType);
        docUploadMutation.mutate({ userId: selectedUserId, docType, file });
      }
    };
    input.click();
  }

  function handleIdentitySave() {
    if (!selectedUserId) return;
    const b = bvn.trim();
    const n = nin.trim();
    if (!b && !n) {
      toast({ title: "Nothing to save", description: "Enter at least a BVN or NIN.", variant: "destructive" });
      return;
    }
    if (b && !/^\d{11}$/.test(b)) {
      toast({ title: "Invalid BVN", description: "BVN must be exactly 11 digits.", variant: "destructive" });
      return;
    }
    if (n && !/^\d{11}$/.test(n)) {
      toast({ title: "Invalid NIN", description: "NIN must be exactly 11 digits.", variant: "destructive" });
      return;
    }
    identityMutation.mutate({ userId: selectedUserId, bvn: b || undefined, nin: n || undefined });
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "lawyer": return "secondary";
      case "building_manager": return "default";
      default: return "outline";
    }
  };

  const p = selectedProfile?.profile;

  return (
    <DashboardLayout
      role="admin"
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Users" }]}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Manage platform users, roles, and founder profiles</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !users?.length ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description="Users will appear here once they sign up."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4"
                    data-testid={`user-row-${user.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={user.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {user.firstName?.[0] || user.email?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.email || "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {user.roles?.map((role) => (
                          <Badge key={role} variant={getRoleBadgeVariant(role) as any}>
                            {role}
                          </Badge>
                        ))}
                        {(!user.roles || user.roles.length === 0) && (
                          <Badge variant="outline">founder</Badge>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-user-menu-${user.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openProfileDialog(user.id)}
                            data-testid={`action-manage-profile-${user.id}`}
                          >
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Manage Profile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {!user.roles?.includes("lawyer") && (
                            <DropdownMenuItem
                              onClick={() => toggleRoleMutation.mutate({ userId: user.id, role: "lawyer", action: "add" })}
                            >
                              Make Lawyer
                            </DropdownMenuItem>
                          )}
                          {user.roles?.includes("lawyer") && (
                            <DropdownMenuItem
                              onClick={() => toggleRoleMutation.mutate({ userId: user.id, role: "lawyer", action: "remove" })}
                            >
                              Remove Lawyer Role
                            </DropdownMenuItem>
                          )}
                          {!user.roles?.includes("admin") && (
                            <DropdownMenuItem
                              onClick={() => toggleRoleMutation.mutate({ userId: user.id, role: "admin", action: "add" })}
                            >
                              Make Admin
                            </DropdownMenuItem>
                          )}
                          {!user.roles?.includes("building_manager") && (
                            <DropdownMenuItem
                              data-testid={`action-add-building-manager-${user.id}`}
                              onClick={() => toggleRoleMutation.mutate({ userId: user.id, role: "building_manager", action: "add" })}
                            >
                              Make Building Manager
                            </DropdownMenuItem>
                          )}
                          {user.roles?.includes("building_manager") && (
                            <DropdownMenuItem
                              data-testid={`action-remove-building-manager-${user.id}`}
                              onClick={() => toggleRoleMutation.mutate({ userId: user.id, role: "building_manager", action: "remove" })}
                            >
                              Remove Building Manager Role
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Manage Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={(open) => { if (!open) closeProfileDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Founder Profile</DialogTitle>
            <DialogDescription>
              {selectedProfile
                ? `${selectedProfile.firstName || ""} ${selectedProfile.lastName || ""}`.trim() || selectedProfile.email
                : "Loading user…"}
            </DialogDescription>
          </DialogHeader>

          {profileLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <Tabs defaultValue="identity" className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="identity" className="flex-1" data-testid="tab-identity">
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Identity
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex-1" data-testid="tab-documents">
                  <FileText className="h-4 w-4 mr-2" />
                  Documents
                </TabsTrigger>
              </TabsList>

              {/* Identity Tab */}
              <TabsContent value="identity" className="space-y-5 pt-4">
                {p && (
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
                    <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Current Status</p>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        {p.hasBvn ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={p.hasBvn ? "text-green-700 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                          BVN {p.hasBvn ? "on file" : "missing"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.hasNin ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={p.hasNin ? "text-green-700 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                          NIN {p.hasNin ? "on file" : "missing"}
                        </span>
                      </div>
                    </div>
                    {p.profileCompletion != null && (
                      <p className="text-xs text-muted-foreground">Profile completion: {p.profileCompletion}%</p>
                    )}
                  </div>
                )}
                {!p && !profileLoading && (
                  <p className="text-sm text-muted-foreground italic">No founder profile exists yet for this user. Saving identity data will create one.</p>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="admin-bvn">BVN (11 digits)</Label>
                  <Input
                    id="admin-bvn"
                    placeholder="Enter BVN to set or update"
                    maxLength={11}
                    value={bvn}
                    onChange={(e) => setBvn(e.target.value.replace(/\D/g, ""))}
                    data-testid="input-admin-bvn"
                  />
                  <p className="text-xs text-muted-foreground">
                    Stored AES-256-GCM encrypted. Leave blank to keep the existing value.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-nin">NIN (11 digits)</Label>
                  <Input
                    id="admin-nin"
                    placeholder="Enter NIN to set or update"
                    maxLength={11}
                    value={nin}
                    onChange={(e) => setNin(e.target.value.replace(/\D/g, ""))}
                    data-testid="input-admin-nin"
                  />
                  <p className="text-xs text-muted-foreground">
                    Stored AES-256-GCM encrypted. Leave blank to keep the existing value.
                  </p>
                </div>

                <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  This action is audit-logged and classified as a sensitive data write. Only set these values if the founder has provided them through a secure channel.
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={closeProfileDialog}>Cancel</Button>
                  <Button
                    onClick={handleIdentitySave}
                    disabled={identityMutation.isPending || (!bvn.trim() && !nin.trim())}
                    data-testid="button-save-identity"
                  >
                    {identityMutation.isPending ? <LoadingSpinner size="sm" /> : "Save Identity Data"}
                  </Button>
                </DialogFooter>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Upload documents on behalf of this founder. Files are stored in object storage and linked to their profile.
                </p>

                {[
                  { key: "passport_photo", label: "Passport Photo", icon: Image, hasDoc: p?.hasPassportPhoto },
                  { key: "id_document", label: "Government ID Document", icon: FileText, hasDoc: p?.hasIdDocument },
                  { key: "signature", label: "Signature Specimen", icon: PenLine, hasDoc: p?.hasSignature },
                ].map(({ key, label, icon: Icon, hasDoc }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg border p-3"
                    data-testid={`doc-row-${key}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${hasDoc ? "bg-green-100 dark:bg-green-950" : "bg-muted"}`}>
                        {hasDoc ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {hasDoc ? "File on file — upload to replace" : "Not yet uploaded"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={hasDoc ? "ghost" : "outline"}
                      size="sm"
                      onClick={() => handleFileSelect(key)}
                      disabled={docUploadMutation.isPending}
                      data-testid={`button-upload-${key}`}
                    >
                      {docUploadMutation.isPending && uploadingDocType === key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1.5" />
                          {hasDoc ? "Replace" : "Upload"}
                        </>
                      )}
                    </Button>
                  </div>
                ))}

                <p className="text-xs text-muted-foreground">
                  Accepted formats: JPEG, PNG, PDF. Max 5 MB per file. All uploads are audit-logged.
                </p>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
