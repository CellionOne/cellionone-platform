import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { CelionLogo } from "@/components/celion-logo";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorState, setTwoFactorState] = useState<{
    userId: string;
    message: string;
  } | null>(null);
  const [otpValue, setOtpValue] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCodeValue, setBackupCodeValue] = useState("");

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.requiresTwoFactor) {
        setTwoFactorState({ userId: data.userId, message: data.message });
        return;
      }
      toast({ title: "Welcome back!", description: "You have been logged in successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    },
    onError: (error: any) => {
      const message = error?.message || "Login failed. Please check your credentials.";
      if (message.includes("verify your email")) {
        setShowResendVerification(true);
      }
      toast({ title: "Login failed", description: message, variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (payload: { userId: string; otp?: string; backupCode?: string }) => {
      const res = await apiRequest("POST", "/api/auth/two-factor/verify", payload);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Welcome back!", description: "You have been logged in successfully." });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        setLocation("/");
      } else {
        toast({ title: "Verification failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Verification failed", description: error?.message || "Please try again.", variant: "destructive" });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/resend-verification", { email });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Verification email sent", description: "Please check your inbox." });
    },
    onError: () => {
      toast({ title: "Failed to send", description: "Please try again later.", variant: "destructive" });
    },
  });

  const resendOtpMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", "/api/auth/two-factor/send", { userId });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.success ? "Code sent" : "Error", description: data.message, variant: data.success ? "default" : "destructive" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resend code.", variant: "destructive" });
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  const handleVerifyOTP = () => {
    if (!twoFactorState) return;
    if (useBackupCode) {
      verifyMutation.mutate({ userId: twoFactorState.userId, backupCode: backupCodeValue.trim() });
    } else {
      verifyMutation.mutate({ userId: twoFactorState.userId, otp: otpValue });
    }
  };

  if (twoFactorState) {
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
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Two-Factor Verification</CardTitle>
              <CardDescription>
                {useBackupCode
                  ? "Enter one of your backup codes to sign in"
                  : "Enter the 6-digit code sent to your phone"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!useBackupCode ? (
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otpValue}
                    onChange={setOtpValue}
                    data-testid="input-otp-login"
                  >
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
              ) : (
                <Input
                  placeholder="Enter backup code (e.g. A1B2C3D4)"
                  value={backupCodeValue}
                  onChange={(e) => setBackupCodeValue(e.target.value.toUpperCase())}
                  className="text-center tracking-widest font-mono"
                  data-testid="input-backup-code"
                />
              )}

              <Button
                className="w-full"
                onClick={handleVerifyOTP}
                disabled={verifyMutation.isPending || (!useBackupCode && otpValue.length !== 6) || (useBackupCode && !backupCodeValue.trim())}
                data-testid="button-verify-otp"
              >
                {verifyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Verify
              </Button>

              <div className="flex flex-col items-center gap-2 text-sm">
                {!useBackupCode && (
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => resendOtpMutation.mutate(twoFactorState.userId)}
                    disabled={resendOtpMutation.isPending}
                    data-testid="button-resend-otp"
                  >
                    {resendOtpMutation.isPending ? "Sending..." : "Resend code"}
                  </button>
                )}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => {
                    setUseBackupCode(!useBackupCode);
                    setOtpValue("");
                    setBackupCodeValue("");
                  }}
                  data-testid="button-toggle-backup"
                >
                  {useBackupCode ? "Use SMS code instead" : "Use a backup code"}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => {
                    setTwoFactorState(null);
                    setOtpValue("");
                    setBackupCodeValue("");
                    setUseBackupCode(false);
                  }}
                  data-testid="button-back-to-login"
                >
                  Back to login
                </button>
              </div>
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
            <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Password</FormLabel>
                        <Link href="/forgot-password">
                          <a className="text-sm text-primary hover:underline" data-testid="link-forgot-password">
                            Forgot password?
                          </a>
                        </Link>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
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

                {showResendVerification && (
                  <div className="bg-muted/50 p-3 rounded-md text-sm">
                    <p className="text-muted-foreground mb-2">
                      Your email hasn't been verified yet.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => resendMutation.mutate(form.getValues("email"))}
                      disabled={resendMutation.isPending}
                      data-testid="button-resend-verification"
                    >
                      {resendMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Resend verification email
                    </Button>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Sign in
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="text-sm text-center text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register">
                <a className="text-primary hover:underline font-medium" data-testid="link-register">
                  Create one
                </a>
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
