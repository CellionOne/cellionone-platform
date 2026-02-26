import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Plus, UserPlus, MapPin } from "lucide-react";
import type { ServiceAddress } from "@shared/schema";
import type { User } from "@shared/models/auth";

interface ServiceAddressWithManager extends ServiceAddress {
  managerUser: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
}

interface UserWithRole extends User {
  roles: string[];
}

export default function AdminRegisteredOffices() {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");

  const [newAddress, setNewAddress] = useState({
    label: "",
    line1: "",
    line2: "",
    floorDetails: "",
    city: "",
    state: "",
    country: "Nigeria",
    contactPhone: "",
    contactEmail: "",
    operatingHours: "",
  });

  const { data: addresses, isLoading } = useQuery<ServiceAddressWithManager[]>({
    queryKey: ["/api/admin/service-addresses"],
  });

  const { data: users } = useQuery<UserWithRole[]>({
    queryKey: ["/api/admin/users"],
  });

  const buildingManagers = users?.filter(u => u.roles?.includes("building_manager")) || [];

  const createMutation = useMutation({
    mutationFn: async (data: typeof newAddress) => {
      return apiRequest("POST", "/api/admin/service-addresses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/service-addresses"] });
      toast({ title: "Service address created" });
      setAddDialogOpen(false);
      setNewAddress({ label: "", line1: "", line2: "", floorDetails: "", city: "", state: "", country: "Nigeria", contactPhone: "", contactEmail: "", operatingHours: "" });
    },
    onError: () => {
      toast({ title: "Failed to create address", variant: "destructive" });
    },
  });

  const assignManagerMutation = useMutation({
    mutationFn: async ({ addressId, managerUserId }: { addressId: number; managerUserId: string | null }) => {
      return apiRequest("PUT", `/api/admin/service-addresses/${addressId}/manager`, { managerUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/service-addresses"] });
      toast({ title: "Manager assigned successfully" });
      setAssignDialogOpen(false);
      setSelectedAddressId(null);
      setSelectedManagerId("");
    },
    onError: (error: any) => {
      toast({ title: error?.message || "Failed to assign manager", variant: "destructive" });
    },
  });

  const getUtilityBillBadge = (status: string | null) => {
    switch (status) {
      case "current": return <Badge variant="default" data-testid="badge-utility-current">Current</Badge>;
      case "expired": return <Badge variant="destructive" data-testid="badge-utility-expired">Expired</Badge>;
      case "pending": return <Badge variant="secondary" data-testid="badge-utility-pending">Pending</Badge>;
      default: return <Badge variant="outline" data-testid="badge-utility-none">No Bill</Badge>;
    }
  };

  return (
    <DashboardLayout
      role="admin"
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Registered Offices" }]}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Registered Offices</h1>
            <p className="text-muted-foreground">
              Manage office locations and assign building managers
            </p>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-address">
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Service Address</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="label">Location Name</Label>
                  <Input
                    id="label"
                    data-testid="input-label"
                    value={newAddress.label}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="e.g. Lagos Island Office"
                  />
                </div>
                <div>
                  <Label htmlFor="line1">Address Line 1</Label>
                  <Input
                    id="line1"
                    data-testid="input-line1"
                    value={newAddress.line1}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, line1: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="line2">Address Line 2</Label>
                  <Input
                    id="line2"
                    data-testid="input-line2"
                    value={newAddress.line2}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, line2: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="floorDetails">Floor Details</Label>
                  <Input
                    id="floorDetails"
                    data-testid="input-floor"
                    value={newAddress.floorDetails}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, floorDetails: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      data-testid="input-city"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      data-testid="input-state"
                      value={newAddress.state}
                      onChange={(e) => setNewAddress(prev => ({ ...prev, state: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    data-testid="input-phone"
                    value={newAddress.contactPhone}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, contactPhone: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    data-testid="input-email"
                    value={newAddress.contactEmail}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, contactEmail: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="operatingHours">Operating Hours</Label>
                  <Input
                    id="operatingHours"
                    data-testid="input-hours"
                    value={newAddress.operatingHours}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, operatingHours: e.target.value }))}
                    placeholder="e.g. Mon-Fri 9am-5pm"
                  />
                </div>
                <Button
                  className="w-full"
                  data-testid="button-submit-address"
                  onClick={() => createMutation.mutate(newAddress)}
                  disabled={createMutation.isPending || !newAddress.label || !newAddress.line1 || !newAddress.city || !newAddress.state}
                >
                  {createMutation.isPending ? "Creating..." : "Create Address"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !addresses?.length ? (
          <EmptyState
            icon={Building2}
            title="No registered offices"
            description="Add your first office location to get started."
          />
        ) : (
          <div className="grid gap-4">
            {addresses.map((addr) => (
              <Card key={addr.id} data-testid={`card-address-${addr.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{addr.label}</CardTitle>
                      <p className="text-sm text-muted-foreground truncate">
                        {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {addr.isActive ? (
                      <Badge variant="outline">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                    {getUtilityBillBadge(addr.utilityBillStatus)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1 text-sm">
                      <p className="text-muted-foreground">
                        Manager:{" "}
                        <span className="text-foreground" data-testid={`text-manager-${addr.id}`}>
                          {addr.managerUser
                            ? `${addr.managerUser.firstName || ""} ${addr.managerUser.lastName || ""}`.trim() || addr.managerUser.email
                            : "Unassigned"}
                        </span>
                      </p>
                      {addr.contactPhone && (
                        <p className="text-muted-foreground">Phone: {addr.contactPhone}</p>
                      )}
                      {addr.operatingHours && (
                        <p className="text-muted-foreground">Hours: {addr.operatingHours}</p>
                      )}
                    </div>
                    <Dialog open={assignDialogOpen && selectedAddressId === addr.id} onOpenChange={(open) => {
                      setAssignDialogOpen(open);
                      if (!open) { setSelectedAddressId(null); setSelectedManagerId(""); }
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          data-testid={`button-assign-manager-${addr.id}`}
                          onClick={() => {
                            setSelectedAddressId(addr.id);
                            setSelectedManagerId(addr.managerUserId || "");
                          }}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          {addr.managerUser ? "Change Manager" : "Assign Manager"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Assign Building Manager</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                          Select a user with the <Badge variant="default" className="mx-1">building_manager</Badge> role to manage <strong>{addr.label}</strong>.
                        </p>
                        {buildingManagers.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4">
                            No users have the building_manager role yet. Assign the role first from the Users page.
                          </p>
                        ) : (
                          <div className="space-y-4">
                            <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                              <SelectTrigger data-testid="select-manager">
                                <SelectValue placeholder="Select a building manager" />
                              </SelectTrigger>
                              <SelectContent>
                                {buildingManagers.map((mgr) => (
                                  <SelectItem key={mgr.id} value={mgr.id}>
                                    {mgr.firstName && mgr.lastName
                                      ? `${mgr.firstName} ${mgr.lastName} (${mgr.email})`
                                      : mgr.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex gap-2">
                              <Button
                                className="flex-1"
                                data-testid="button-confirm-assign"
                                onClick={() => {
                                  if (selectedAddressId && selectedManagerId) {
                                    assignManagerMutation.mutate({ addressId: selectedAddressId, managerUserId: selectedManagerId });
                                  }
                                }}
                                disabled={!selectedManagerId || assignManagerMutation.isPending}
                              >
                                {assignManagerMutation.isPending ? "Assigning..." : "Assign"}
                              </Button>
                              {addr.managerUser && (
                                <Button
                                  variant="outline"
                                  data-testid="button-unassign-manager"
                                  onClick={() => {
                                    if (selectedAddressId) {
                                      assignManagerMutation.mutate({ addressId: selectedAddressId, managerUserId: null });
                                    }
                                  }}
                                  disabled={assignManagerMutation.isPending}
                                >
                                  Unassign
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
