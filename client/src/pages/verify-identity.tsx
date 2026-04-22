import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getCsrfToken } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { CelionLogo } from "@/components/celion-logo";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Loader2, ShieldCheck, CheckCircle2, Lock, Info } from "lucide-react";

const verifySchema = z.object({
  bvn: z
    .string()
    .length(11, "BVN must be exactly 11 digits")
    .regex(/^\d+$/, "BVN must contain only digits"),
  nin: z
    .string()
    .length(11, "NIN must be exactly 11 digits")
    .regex(/^\d+$/, "NIN must contain only digits"),
});

type VerifyForm = z.infer<typeof verifySchema>;

interface VerifyResult {
  success: boolean;
  message: string;
  profile?: {
    fullName: string | null;
    dateOfBirth: string | null;
    profileCompletion: number;
  };
}

export default function VerifyIdentityPage() {
  usePageMeta({
    title: "Verify Your Identity \u2014 Cellion One",
    description: "Complete your identity verification using your BVN and NIN to access all Cellion One features.",
    canonicalPath: "/verify-identity",
  });

  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const [verified, setVerified] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [inviteAccepted, setInviteAccepted] = useState(false);

  const params = new URLSearchParams(searchString);
  const inviteToken = params.get("invite");

  const form = useForm<VerifyForm>({
    resolver: zodResolver(verifySchema),
    defaultValues: { bvn: "", nin: "" },
  });

  const verifyMutation = useMutation({
    mutationFn: async (data: VerifyForm): Promise<VerifyResult> => {
      const res = await apiRequest("POST", "/api/founder/profile/verify-identity", data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Verification failed. Please try again.");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      // Update cached user to reflect isIdentityVerified = true
      queryClient.setQueryData(["/api/auth/user"], (old: any) =>
        old ? { ...old, isIdentityVerified: true, pendingInviteToken: null } : old
      );
      queryClient.invalidateQueries({ queryKey: ["/api/profile/personal"] });

      // Auto-consume pending invite if present — check response status
      let inviteAccepted = false;
      if (inviteToken) {
        try {
          const csrf = await getCsrfToken();
          const inviteRes = await fetch("/api/company-people/accept-invite", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
            body: JSON.stringify({ inviteToken }),
          });
          inviteAccepted = inviteRes.ok;
        } catch {
          // Network failure — pendingInviteToken preserved in DB for manual acceptance
          inviteAccepted = false;
        }
      }

      setVerifiedName(data.profile?.fullName ?? null);
      setInviteAccepted(inviteAccepted);
      setVerified(true);
      toast({ title: "Identity verified!", description: "Your profile has been updated with government-verified data." });
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error?.message || "Please check your BVN and NIN and try again.",
        variant: "destructive",
      });
    },
  });

  const handleContinue = () => {
    if (inviteToken && !inviteAccepted) {
      // Auto-accept failed — redirect to invite page for manual acceptance
      // (pendingInviteToken is still in the DB since we only clear on successful accept)
      setLocation(`/invite/${inviteToken}`);
    } else {
      // Invite was auto-accepted (or no invite) — go to intent gate / dashboard
      setLocation("/");
    }
  };

  const handleSkip = () => {
    if (inviteToken) {
      // When skipping, preserve invite for manual acceptance
      setLocation(`/invite/${inviteToken}`);
    } else {
      setLocation("/");
    }
  };

  const onSubmit = (data: VerifyForm) => verifyMutation.mutate(data);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <CelionLogo />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 pt-20 pb-8">
        {verified ? (
          <Card className="w-full max-w-md text-center" data-testid="card-identity-verified">
            <CardHeader className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Identity Verified</CardTitle>
              <CardDescription className="text-base">
                {verifiedName ? (
                  <>
                    Welcome, <strong>{verifiedName}</strong>! Your identity has been confirmed
                    via the Nigerian national identity systems.
                  </>
                ) : (
                  "Your identity has been confirmed via the Nigerian national identity systems."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
                <Lock className="h-4 w-4" />
                Your name and date of birth have been locked from government records
              </div>
              <Button
                className="w-full"
                onClick={handleContinue}
                data-testid="button-continue-after-verify"
              >
                Continue to Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-md" data-testid="card-verify-identity">
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Verify Your Identity</CardTitle>
              <CardDescription>
                Enter your BVN and NIN to confirm your identity. This is required before you can use Cellion One services.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm text-foreground">
                  Your BVN and NIN are verified securely via government identity systems. Your name and date of birth will be auto-populated — you won't need to enter them manually.
                </AlertDescription>
              </Alert>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="bvn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Verification Number (BVN)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="11-digit BVN"
                            maxLength={11}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            data-testid="input-bvn"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Dial <span className="font-mono font-medium">*565*0#</span> on any network to retrieve your BVN.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>National Identification Number (NIN)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="11-digit NIN"
                            maxLength={11}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            data-testid="input-nin"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Dial <span className="font-mono font-medium">*346#</span> to retrieve your NIN.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={verifyMutation.isPending}
                    data-testid="button-verify-identity"
                  >
                    {verifyMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Verifying with government records...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        Verify Identity
                      </>
                    )}
                  </Button>
                </form>
              </Form>

              {!inviteToken && (
                <div className="text-center">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                    onClick={handleSkip}
                    data-testid="button-skip-verify"
                  >
                    Skip for now — I'll verify later
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
