import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { updateProfileSchema, changePasswordSchema } from "@shared/schema";
import type { UpdateProfileInput, ChangePasswordInput } from "@shared/schema";
import { User, Lock, Bell, Loader2, Check } from "lucide-react";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  hasPassword: boolean;
}

interface NotificationPrefs {
  complianceReminders: boolean;
  serviceRequestUpdates: boolean;
  orderUpdates: boolean;
  incorporationUpdates: boolean;
  marketingEmails: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  const role = roles.includes("admin") ? "admin" as const : roles.includes("lawyer") ? "lawyer" as const : "founder" as const;
  const dashboardPath = `/${role}/dashboard`;

  return (
    <DashboardLayout
      role={role}
      breadcrumbs={[{ label: "Dashboard", href: dashboardPath }, { label: "Settings" }]}
    >
      <div className="max-w-2xl mx-auto space-y-6 p-4 overflow-y-auto h-full">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
          <p className="text-muted-foreground">Manage your account, security, and notification preferences</p>
        </div>

        <ProfileSection />
        <Separator />
        <PasswordSection />
        <Separator />
        <NotificationSection roles={roles} />
      </div>
    </DashboardLayout>
  );
}

function ProfileSection() {
  const { toast } = useToast();

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/settings/profile"],
  });

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
    },
    values: profile ? { firstName: profile.firstName, lastName: profile.lastName } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateProfileInput) => {
      const res = await apiRequest("PUT", "/api/settings/profile", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated", description: "Your name has been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Profile</CardTitle>
        <CardDescription>Update your personal information</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Email</Label>
              <Input
                value={profile?.email || ""}
                disabled
                data-testid="input-email-display"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-first-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-last-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-profile">
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function PasswordSection() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery<ProfileData>({
    queryKey: ["/api/settings/profile"],
  });

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
    },
  });

  const changeMutation = useMutation({
    mutationFn: async (data: ChangePasswordInput) => {
      const res = await apiRequest("POST", "/api/settings/change-password", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      form.reset();
      setShowForm(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (profileLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Password</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!profile?.hasPassword) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Password</CardTitle>
          <CardDescription>Your account uses an external login method. Password management is not available.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Password</CardTitle>
        <CardDescription>Change your account password</CardDescription>
      </CardHeader>
      <CardContent>
        {!showForm ? (
          <Button variant="outline" onClick={() => setShowForm(true)} data-testid="button-change-password">
            Change Password
          </Button>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => changeMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} data-testid="input-current-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} data-testid="input-new-password" />
                    </FormControl>
                    <FormDescription>
                      At least 8 characters with uppercase, lowercase, number, and special character
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={changeMutation.isPending} data-testid="button-submit-password">
                  {changeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Lock className="h-4 w-4 mr-2" />
                  )}
                  Update Password
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setShowForm(false); form.reset(); }} data-testid="button-cancel-password">
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

interface NotificationToggle {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
  visibleForRoles: string[];
}

const notificationToggles: NotificationToggle[] = [
  {
    key: "incorporationUpdates",
    label: "Incorporation Updates",
    description: "Receive emails about your application status changes",
    visibleForRoles: ["founder"],
  },
  {
    key: "orderUpdates",
    label: "Order Updates",
    description: "Get notified when your order status changes",
    visibleForRoles: ["founder"],
  },
  {
    key: "serviceRequestUpdates",
    label: "Service Request Updates",
    description: "Get notified when service requests are updated or assigned",
    visibleForRoles: ["founder", "lawyer", "admin"],
  },
  {
    key: "complianceReminders",
    label: "Compliance Reminders",
    description: "Receive reminders about upcoming compliance deadlines",
    visibleForRoles: ["founder"],
  },
  {
    key: "marketingEmails",
    label: "Marketing & Announcements",
    description: "Receive updates about new features and promotions",
    visibleForRoles: ["founder", "lawyer", "admin"],
  },
];

function NotificationSection({ roles }: { roles: string[] }) {
  const { toast } = useToast();

  const { data: prefs, isLoading } = useQuery<NotificationPrefs>({
    queryKey: ["/api/settings/notifications"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: NotificationPrefs) => {
      const res = await apiRequest("PUT", "/api/settings/notifications", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/notifications"] });
      toast({ title: "Preferences saved", description: "Your notification preferences have been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleToggle = (key: keyof NotificationPrefs, value: boolean) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: value };
    updateMutation.mutate(updated);
  };

  const visibleToggles = notificationToggles.filter(
    (toggle) => toggle.visibleForRoles.some((r) => roles.includes(r))
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle>
        <CardDescription>Choose which email notifications you want to receive</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {visibleToggles.map((toggle) => (
            <div key={toggle.key} className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium" data-testid={`label-${toggle.key}`}>{toggle.label}</Label>
                <p className="text-xs text-muted-foreground">{toggle.description}</p>
              </div>
              <Switch
                checked={prefs?.[toggle.key] ?? true}
                onCheckedChange={(value) => handleToggle(toggle.key, value)}
                disabled={updateMutation.isPending}
                data-testid={`switch-${toggle.key}`}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
