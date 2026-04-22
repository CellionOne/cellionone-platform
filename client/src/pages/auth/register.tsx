import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { Loader2, CheckCircle, Eye, EyeOff, Users, UserPlus, ShieldCheck } from "lucide-react";
import { CelionLogo } from "@/components/celion-logo";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useState, useEffect } from "react";

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

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

export default function RegisterPage() {
  usePageMeta({
    title: "Create Account \u2014 Cellion One",
    description: "Create your Cellion One account to start incorporating companies, verifying identities, and managing compliance in Nigeria.",
    canonicalPath: "/register",
  });

  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const params = new URLSearchParams(searchString);
  const inviteToken = params.get("invite");

  const { data: inviteInfo } = useQuery<InviteInfo>({
    queryKey: ["/api/invites", inviteToken],
    queryFn: async () => {
      const res = await fetch(`/api/invites/${inviteToken}`);
      if (!res.ok) throw new Error("Invalid invitation");
      return res.json();
    },
    enabled: !!inviteToken,
  });

  const isInvite = !!inviteToken && !!inviteInfo;

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (inviteInfo?.inviteEmail && !form.getValues("email")) {
      form.setValue("email", inviteInfo.inviteEmail);
    }
  }, [inviteInfo, form]);

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const res = await apiRequest("POST", "/api/auth/register", {
        email: data.email,
        password: data.password,
        ...(inviteToken ? { inviteToken } : {}),
      });
      return res.json();
    },
    onSuccess: () => {
      setRegistrationSuccess(true);
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 gap-4">
              <Link href="/">
              <CelionLogo />
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </nav>

        <div className="flex-1 flex items-center justify-center px-4 pt-20 pb-8">
          <Card className="w-full max-w-md text-center">
            <CardHeader className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
              <CardDescription className="text-base">
                We've sent a verification link to <strong>{form.getValues("email")}</strong>. 
                Please check your inbox and click the link to verify your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isInvite && (
                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    After verifying your email, log in and accept your invitation to join as {formatRole(inviteInfo.role)}.
                    {inviteToken && (
                      <span> Your invite will be linked automatically when you log in with this email.</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              <Alert className="text-left">
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription>
                  After verifying your email, you'll complete a quick identity check using your BVN and NIN to secure your account.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                Didn't receive the email? Check your spam folder or request a new verification email.
              </p>
              <Button variant="outline" onClick={() => setLocation("/login")} data-testid="button-goto-login">
                Go to Login
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
            <Link href="/">
              <CelionLogo />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 pt-20 pb-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">
              {isInvite ? "Accept Invitation" : "Create an account"}
            </CardTitle>
            <CardDescription>
              {isInvite ? (
                <>
                  <strong>{inviteInfo.founderName}</strong> has invited you to join as{" "}
                  <strong>{formatRole(inviteInfo.role)}</strong>
                </>
              ) : (
                "Sign up in seconds — your name is confirmed via BVN/NIN after login"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isInvite && (
              <Alert className="mb-4">
                <UserPlus className="h-4 w-4" />
                <AlertDescription>
                  Create your account to accept this invitation. After registering, you'll complete a quick identity check using your BVN and NIN.
                </AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          data-testid="input-email"
                          readOnly={isInvite}
                          {...field}
                        />
                      </FormControl>
                      {isInvite && (
                        <p className="text-xs text-muted-foreground">
                          This email must match the invitation email.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="At least 8 characters"
                            className="pr-10"
                            data-testid="input-password"
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            aria-pressed={showPassword}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm your password"
                            className="pr-10"
                            data-testid="input-confirm-password"
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            aria-pressed={showConfirmPassword}
                            data-testid="button-toggle-confirm-password"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>
                    Your name and date of birth will be confirmed automatically via your BVN and NIN after you log in — no manual entry needed.
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  By creating an account, you agree to our{" "}
                  <Link href="/terms">
                    <a className="text-primary hover:underline">Terms & Conditions</a>
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy">
                    <a className="text-primary hover:underline">Privacy Policy</a>
                  </Link>
                  .
                </p>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                  data-testid="button-register"
                >
                  {registerMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {isInvite ? "Create Account & Accept Invitation" : "Create Account"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              <Link href={inviteToken ? `/login?invite=${inviteToken}` : "/login"}>
                <a className="text-primary hover:underline font-medium" data-testid="link-login">
                  Sign in
                </a>
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
