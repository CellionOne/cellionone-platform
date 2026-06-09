import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Code2 } from "lucide-react";

export default function DeveloperLogin() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/developers/login", form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developers/me"] });
      setLocation("/developers/dashboard");
    },
    onError: async (err: any) => {
      const body = err.response ? await err.response.json().catch(() => ({})) : {};
      if (body?.code === "EMAIL_NOT_VERIFIED") {
        toast({ title: "Email not verified", description: "Check your inbox for a verification link", variant: "destructive" });
      } else {
        toast({ title: body?.error || "Login failed", variant: "destructive" });
      }
    },
  });

  const searchParams = new URLSearchParams(window.location.search);
  const message = searchParams.get("message");
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 justify-center mb-2">
          <Code2 className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Cellion One Developers</span>
        </div>

        {message === "email_verified" && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 dark:text-green-400">
            Email verified! You can now sign in.
          </div>
        )}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive">
            {error === "invalid_token" ? "Invalid or expired verification link." : "Something went wrong."}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Developer sign in</CardTitle>
            <CardDescription>Access your API keys and usage dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && mutation.mutate()} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && mutation.mutate()} />
            </div>
            <Button className="w-full" disabled={mutation.isPending || !form.email || !form.password}
              onClick={() => mutation.mutate()}>
              {mutation.isPending ? <LoadingSpinner size="sm" /> : "Sign in"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              No account?{" "}
              <Link href="/developers/register" className="text-primary hover:underline">Register</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
