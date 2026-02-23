import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { CelionLogo } from "@/components/celion-logo";
import { LoadingSpinner } from "@/components/loading-spinner";
import { CheckCircle2, Users, ArrowRight, AlertTriangle, UserPlus, LogIn } from "lucide-react";

interface InviteInfo {
  id: number;
  role: string;
  inviteEmail: string;
  inviteStatus: string;
  founderName: string;
  title?: string;
}

function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function InviteAcceptPage() {
  const [, params] = useRoute("/invite/:token");
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const token = params?.token || "";
  const [accepted, setAccepted] = useState(false);

  const { data: inviteInfo, isLoading: inviteLoading, error: inviteError } = useQuery<InviteInfo>({
    queryKey: ["/api/invites", token],
    queryFn: async () => {
      const res = await fetch(`/api/invites/${token}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Invalid invitation");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/company-people/accept-invite", { inviteToken: token });
      return res.json();
    },
    onSuccess: () => {
      setAccepted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/company-people/my-invitations"] });
      toast({
        title: "Invitation accepted",
        description: "You can now complete your profile.",
      });
    },
    onError: (error: any) => {
      if (error?.message?.includes("already accepted")) {
        setAccepted(true);
      } else {
        toast({
          title: "Failed to accept invitation",
          description: error?.message || "Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const alreadyAccepted = inviteInfo?.inviteStatus === "accepted";

  useEffect(() => {
    if (alreadyAccepted) {
      setAccepted(true);
    }
  }, [alreadyAccepted]);

  const isLoading = authLoading || inviteLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (inviteError || !inviteInfo) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 gap-4">
              <Link href="/"><CelionLogo /></Link>
              <ThemeToggle />
            </div>
          </div>
        </nav>
        <div className="flex-1 flex items-center justify-center px-4 pt-20 pb-8">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle>Invalid Invitation</CardTitle>
              <CardDescription>
                This invitation link is invalid, expired, or has already been used.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" onClick={() => setLocation("/login")} data-testid="button-goto-login">
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 gap-4">
              <Link href="/"><CelionLogo /></Link>
              <ThemeToggle />
            </div>
          </div>
        </nav>
        <div className="flex-1 flex items-center justify-center px-4 pt-20 pb-8">
          <Card className="w-full max-w-md" data-testid="card-invite-details">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <UserPlus className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>You're Invited</CardTitle>
              <CardDescription className="text-base">
                <strong>{inviteInfo.founderName}</strong> has invited you to join as{" "}
                <strong>{formatRole(inviteInfo.role)}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  Invitation sent to <strong>{inviteInfo.inviteEmail}</strong>
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <Link href={`/register?invite=${token}`}>
                  <Button className="w-full" data-testid="button-create-account">
                    Create Account <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
                <Link href={`/login?invite=${token}`}>
                  <Button variant="outline" className="w-full" data-testid="button-login-existing">
                    <LogIn className="h-4 w-4 mr-1" /> I Already Have an Account
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 gap-4">
              <Link href="/"><CelionLogo /></Link>
              <ThemeToggle />
            </div>
          </div>
        </nav>
        <div className="flex-1 flex items-center justify-center px-4 pt-20 pb-8">
          <Card className="w-full max-w-md text-center" data-testid="card-invite-accepted">
            <CardHeader className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle>Invitation Accepted</CardTitle>
              <CardDescription className="text-base">
                You've been added as <strong>{formatRole(inviteInfo.role)}</strong>.
                Please complete your personal profile for verification.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={() => setLocation("/profile")} data-testid="button-go-to-profile">
                Complete Your Profile <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setLocation("/founder/dashboard")} data-testid="button-go-to-dashboard">
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/"><CelionLogo /></Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>
      <div className="flex-1 flex items-center justify-center px-4 pt-20 pb-8">
        <Card className="w-full max-w-md" data-testid="card-accept-invite">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <UserPlus className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Accept Invitation</CardTitle>
            <CardDescription className="text-base">
              <strong>{inviteInfo.founderName}</strong> has invited you to join as{" "}
              <strong>{formatRole(inviteInfo.role)}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Users className="h-4 w-4" />
              <AlertTitle>Invitation Details</AlertTitle>
              <AlertDescription>
                Role: {formatRole(inviteInfo.role)}
                {inviteInfo.title && <><br />Title: {inviteInfo.title}</>}
              </AlertDescription>
            </Alert>

            <Button
              className="w-full"
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              data-testid="button-accept-invite"
            >
              {acceptMutation.isPending ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>Accept Invitation <ArrowRight className="h-4 w-4 ml-1" /></>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
