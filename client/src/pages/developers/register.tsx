import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Code2, CheckCircle2 } from "lucide-react";

export default function DeveloperRegister() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", orgType: "", website: "" });

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/developers/register", form),
    onSuccess: () => setSubmitted(true),
    onError: async (err: any) => {
      const body = err.response ? await err.response.json().catch(() => ({})) : {};
      toast({ title: body?.error || "Registration failed", variant: "destructive" });
    },
  });

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
            <h2 className="font-semibold text-lg">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              We've sent a verification link to <strong>{form.email}</strong>.
              Click it to activate your developer account.
            </p>
            <Link href="/developers/login">
              <Button variant="outline" className="w-full">Go to sign in</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center gap-2 justify-center mb-2">
          <Code2 className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Cellion One Developers</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create developer account</CardTitle>
            <CardDescription>Get API access to identity, escrow, bureau, and formation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Organisation name</Label>
              <Input id="name" placeholder="Acme Fintech Ltd" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" placeholder="dev@example.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="Min. 8 characters" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orgType">Organisation type <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="orgType" placeholder="e.g. Fintech, MFB, SACCO" value={form.orgType}
                onChange={e => setForm(f => ({ ...f, orgType: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="website">Website <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="website" placeholder="https://example.com" value={form.website}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
            </div>
            <Button className="w-full" disabled={mutation.isPending || !form.name || !form.email || !form.password}
              onClick={() => mutation.mutate()}>
              {mutation.isPending ? <LoadingSpinner size="sm" /> : "Create account"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link href="/developers/login" className="text-primary hover:underline">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
