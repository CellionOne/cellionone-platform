import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, LogOut, Loader2, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";

type BankSession = {
  email: string;
  bankPartnerId: number;
  bankName?: string;
};

async function getCsrfToken(): Promise<string> {
  const res = await fetch("/api/csrf-token", { credentials: "include" });
  const data = await res.json();
  return data.csrfToken;
}

export default function BankAccountPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);

  const { data: session, isLoading: sessionLoading } = useQuery<BankSession>({
    queryKey: ["/api/bank-portal/me"],
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const csrf = await getCsrfToken();
      await fetch("/api/bank-portal/logout", {
        method: "POST",
        credentials: "include",
        headers: { "x-csrf-token": csrf },
      });
    },
    onSuccess: () => setLocation("/bank/login"),
    onError: () => setLocation("/bank/login"),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const csrf = await getCsrfToken();
      const res = await fetch("/api/bank-portal/change-password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");
      return data;
    },
    onSuccess: () => {
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    setLocation("/bank/login");
    return null;
  }

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !changePasswordMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-none">Cellion One — Bank Portal</p>
              <p className="text-xs text-muted-foreground mt-0.5">{session.bankName || `Partner #${session.bankPartnerId}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{session.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-bank-logout"
            >
              {logoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/bank/companies">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Companies
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your bank portal account.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" />
              Change Password
            </CardTitle>
            <CardDescription>
              Enter your current password and choose a new one. Minimum 8 characters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="font-medium">Password changed successfully</p>
                <p className="text-sm text-muted-foreground">Your new password is active. Use it the next time you log in.</p>
                <Button variant="outline" size="sm" onClick={() => setSuccess(false)} data-testid="button-change-again">
                  Change again
                </Button>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={e => { e.preventDefault(); if (canSubmit) changePasswordMutation.mutate(); }}
              >
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    data-testid="input-current-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    data-testid="input-new-password"
                  />
                  {newPassword.length > 0 && newPassword.length < 8 && (
                    <p className="text-xs text-destructive">Must be at least 8 characters</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    data-testid="input-confirm-password"
                  />
                  {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full"
                  data-testid="button-change-password"
                >
                  {changePasswordMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating…</>
                  ) : (
                    "Change Password"
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Forgot your current password?{" "}
                  <Link href="/bank/forgot-password" className="text-primary underline">
                    Reset it here
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium">Logged in as</p>
              <p className="font-medium">{session.email}</p>
              <p className="text-muted-foreground text-xs">{session.bankName}</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
