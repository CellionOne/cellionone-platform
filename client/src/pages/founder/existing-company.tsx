import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, ArrowLeft, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const schema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  companyType: z.string().min(1, "Company type is required"),
  rcNumber: z.string().min(2, "RC number is required"),
  incorporationDate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ExistingCompanyPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: "",
      companyType: "",
      rcNumber: "",
      incorporationDate: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("POST", "/api/founder/company-profiles/existing", data);
    },
    onSuccess: () => {
      toast({ title: "Company registered", description: "Your existing company has been added and is pending admin review." });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles"] });
      navigate("/founder/company-profile");
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl space-y-6">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate("/welcome")} className="gap-1 text-muted-foreground -ml-2" data-testid="button-back-welcome">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-3 pt-1">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Register Existing Company</h1>
              <p className="text-sm text-muted-foreground">Add your already-incorporated company to Cellion One</p>
            </div>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            After submission, our team will verify your company details against the CAC registry. This typically takes 1–2 business days.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company Details</CardTitle>
            <CardDescription>Enter the details exactly as they appear on your CAC certificate.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registered Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Acme Technologies Limited" {...field} data-testid="input-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="companyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-company-type">
                            <SelectValue placeholder="Select company type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="LTD">Private Limited Company (LTD)</SelectItem>
                          <SelectItem value="PLC">Public Limited Company (PLC)</SelectItem>
                          <SelectItem value="LLP">Limited Liability Partnership (LLP)</SelectItem>
                          <SelectItem value="BN">Business Name</SelectItem>
                          <SelectItem value="NGO">Non-Governmental Organisation</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rcNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CAC RC Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. RC1234567" {...field} data-testid="input-rc-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="incorporationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Incorporation (optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-incorporation-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={mutation.isPending}
                  data-testid="button-submit-existing-company"
                >
                  {mutation.isPending ? "Submitting…" : "Submit for Review"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
