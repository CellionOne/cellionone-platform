import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { CelionLogo } from "@/components/celion-logo";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const verifyMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest("POST", "/api/auth/verify-email", { token });
      return res.json();
    },
    onSuccess: () => {
      setStatus("success");
    },
    onError: (error: any) => {
      setStatus("error");
      setErrorMessage(error?.message || "Verification failed. Please try again.");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const token = params.get("token");
    
    if (token) {
      verifyMutation.mutate(token);
    } else {
      setStatus("error");
      setErrorMessage("No verification token provided.");
    }
  }, [searchString]);

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
          {status === "loading" && (
            <>
              <CardHeader className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                </div>
                <CardTitle className="text-2xl font-bold">Verifying your email</CardTitle>
                <CardDescription className="text-base">
                  Please wait while we verify your email address...
                </CardDescription>
              </CardHeader>
            </>
          )}

          {status === "success" && (
            <>
              <CardHeader className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">Email verified!</CardTitle>
                <CardDescription className="text-base">
                  Your email has been verified successfully. You can now log in to your account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setLocation("/login")} data-testid="button-goto-login">
                  Go to Login
                </Button>
              </CardContent>
            </>
          )}

          {status === "error" && (
            <>
              <CardHeader className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle className="text-2xl font-bold">Verification failed</CardTitle>
                <CardDescription className="text-base">
                  {errorMessage}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The verification link may have expired or already been used.
                </p>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" onClick={() => setLocation("/login")} data-testid="button-goto-login">
                    Go to Login
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
