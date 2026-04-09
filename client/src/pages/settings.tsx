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
import { User, Lock, Bell, Loader2, Check, ShieldCheck, Phone, Copy, Eye, EyeOff, Layers } from "lucide-react";
import { ModuleSwitcher } from "@/components/module-switcher";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

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

        {roles.includes("founder") && (
          <>
            <YourServicesSection />
            <Separator />
          </>
        )}
        <ProfileSection />
        <Separator />
        <PasswordSection />
        <Separator />
        <TwoFactorSection />
        <Separator />
        <NotificationSection roles={roles} />
      </div>
    </DashboardLayout>
  );
}

function YourServicesSection() {
  return (
    <Card data-testid="card-your-services">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" /> Your Services
        </CardTitle>
        <CardDescription>
          Switch your active service at any time. Your data and applications are preserved when you switch.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ModuleSwitcher />
      </CardContent>
    </Card>
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

interface TwoFactorStatus {
  enabled: boolean;
  method: string | null;
  phone: string | null;
}

function TwoFactorSection() {
  const { toast } = useToast();
  const [step, setStep] = useState<"idle" | "phone" | "verify" | "backup">("idle");
  const [phoneNumber, setPhoneNumber] = useState("+234");
  const [otpValue, setOtpValue] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");

  const { data: status, isLoading } = useQuery<TwoFactorStatus>({
    queryKey: ["/api/settings/two-factor"],
  });

  const setupMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("POST", "/api/settings/two-factor/setup", { phoneNumber: phone });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setStep("verify");
        toast({ title: "Code sent", description: data.message });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ otp, phone }: { otp: string; phone: string }) => {
      const res = await apiRequest("POST", "/api/settings/two-factor/confirm", { otp, phoneNumber: phone });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.backupCodes) {
        setBackupCodes(data.backupCodes);
        setStep("backup");
        queryClient.invalidateQueries({ queryKey: ["/api/settings/two-factor"] });
        toast({ title: "2FA Enabled", description: "Two-factor authentication is now active" });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest("POST", "/api/settings/two-factor/disable", { password });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/settings/two-factor"] });
        setDisablePassword("");
        toast({ title: "2FA Disabled", description: data.message });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast({ title: "Copied", description: "Backup codes copied to clipboard" });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Two-Factor Authentication</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (status?.enabled) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Two-Factor Authentication
                <Badge variant="default" className="ml-2" data-testid="badge-2fa-enabled">Enabled</Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                {status.phone ? `SMS codes sent to ${status.phone}` : "SMS verification is active"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" data-testid="button-disable-2fa">
                Disable Two-Factor Authentication
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the extra security layer from your account. Enter your password to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                type="password"
                placeholder="Enter your current password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                data-testid="input-disable-2fa-password"
              />
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-disable-2fa">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => disableMutation.mutate(disablePassword)}
                  disabled={!disablePassword || disableMutation.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-confirm-disable-2fa"
                >
                  {disableMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Disable
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Two-Factor Authentication
          <Badge variant="secondary" className="ml-2" data-testid="badge-2fa-disabled">Disabled</Badge>
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account by receiving SMS verification codes when you sign in
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "idle" && (
          <Button onClick={() => setStep("phone")} data-testid="button-enable-2fa">
            <Phone className="h-4 w-4 mr-2" />
            Enable Two-Factor Authentication
          </Button>
        )}

        {step === "phone" && (
          <div className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                type="tel"
                placeholder="+234 801 234 5678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                data-testid="input-2fa-phone"
              />
              <p className="text-xs text-muted-foreground">Enter your Nigerian phone number in international format (starting with +234)</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setupMutation.mutate(phoneNumber)}
                disabled={setupMutation.isPending || phoneNumber.length < 10}
                data-testid="button-send-2fa-code"
              >
                {setupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send Verification Code
              </Button>
              <Button variant="ghost" onClick={() => { setStep("idle"); setPhoneNumber("+234"); }} data-testid="button-cancel-2fa-setup">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to {phoneNumber}</p>
            <div className="flex justify-start">
              <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue} data-testid="input-2fa-otp">
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => confirmMutation.mutate({ otp: otpValue, phone: phoneNumber })}
                disabled={confirmMutation.isPending || otpValue.length !== 6}
                data-testid="button-verify-2fa-code"
              >
                {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verify & Enable
              </Button>
              <Button
                variant="ghost"
                onClick={() => setupMutation.mutate(phoneNumber)}
                disabled={setupMutation.isPending}
                data-testid="button-resend-2fa-code"
              >
                Resend Code
              </Button>
            </div>
          </div>
        )}

        {step === "backup" && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
              <h4 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">Save Your Backup Codes</h4>
              <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                Store these codes in a safe place. You can use them to sign in if you lose access to your phone. Each code can only be used once.
              </p>
              <div className="relative">
                <div className={`grid grid-cols-2 gap-2 p-3 bg-white dark:bg-background rounded border font-mono text-sm ${!showBackupCodes ? 'blur-sm select-none' : ''}`}>
                  {backupCodes.map((code, i) => (
                    <div key={i} className="text-center py-1" data-testid={`text-backup-code-${i}`}>{code}</div>
                  ))}
                </div>
                {!showBackupCodes && (
                  <button
                    className="absolute inset-0 flex items-center justify-center"
                    onClick={() => setShowBackupCodes(true)}
                    data-testid="button-show-backup-codes"
                  >
                    <Eye className="h-5 w-5 text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Click to reveal</span>
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyBackupCodes} data-testid="button-copy-backup-codes">
                <Copy className="h-4 w-4 mr-2" />
                Copy Codes
              </Button>
              <Button onClick={() => { setStep("idle"); setBackupCodes([]); setOtpValue(""); setShowBackupCodes(false); }} data-testid="button-done-2fa-setup">
                Done
              </Button>
            </div>
          </div>
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
