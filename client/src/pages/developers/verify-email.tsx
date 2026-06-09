import { useEffect } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";

// This page is never actually rendered — the backend redirects directly.
// If JS kicks in before redirect, show a loading state.
export default function VerifyEmail() {
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) {
      window.location.href = `/api/developers/verify-email?token=${encodeURIComponent(token)}`;
    } else {
      window.location.href = "/developers/login?error=invalid_token";
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <LoadingSpinner />
        <p className="text-sm text-muted-foreground">Verifying your email…</p>
      </div>
    </div>
  );
}
