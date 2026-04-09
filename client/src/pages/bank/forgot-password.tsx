import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

const schema = z.object({ email: z.string().email("Please enter a valid email address") });
type FormData = z.infer<typeof schema>;

export default function BankForgotPasswordPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/bank-portal/forgot-password", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send reset email");
      }
      return res.json();
    },
    onSuccess: () => setSubmitted(true),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Bank Portal</h1>
            <p className="text-muted-foreground text-sm mt-1">Cellion One — Password Reset</p>
          </div>
        </div>

        <Card>
          {submitted ? (
            <CardContent className="pt-6 text-center space-y-4">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
              <div>
                <p className="font-semibold">Check your email</p>
                <p className="text-sm text-muted-foreground mt-1">
                  If that email is registered, we've sent a password reset link. It expires in 2 hours.
                </p>
              </div>
              <Button variant="outline" asChild className="w-full">
                <Link href="/bank/login">Back to Sign In</Link>
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Forgot Password</CardTitle>
                <CardDescription>Enter your registered email address and we'll send you a reset link.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@bank.ng" data-testid="input-forgot-email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-send-reset">
                      {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Send Reset Link
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/bank/login" className="text-primary underline-offset-4 hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
