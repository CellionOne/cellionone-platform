import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { Loader2, CheckCircle, Scale, ArrowLeft } from "lucide-react";
import { CelionLogo } from "@/components/celion-logo";
import { useState } from "react";

const lawyerApplicationSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  barId: z.string().min(1, "Bar ID / Enrollment number is required"),
  scnNumber: z.string().optional(),
  firmName: z.string().optional(),
  firmAddress: z.string().optional(),
  yearsOfExperience: z.coerce.number().min(0).optional(),
  statementOfInterest: z.string().min(50, "Please provide at least 50 characters about why you want to join"),
});

type LawyerApplicationForm = z.infer<typeof lawyerApplicationSchema>;

export default function ApplyLawyerPage() {
  const { toast } = useToast();
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);

  const form = useForm<LawyerApplicationForm>({
    resolver: zodResolver(lawyerApplicationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      barId: "",
      scnNumber: "",
      firmName: "",
      firmAddress: "",
      yearsOfExperience: undefined,
      statementOfInterest: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: LawyerApplicationForm) => {
      const res = await apiRequest("POST", "/api/lawyer-applications", {
        ...data,
        serviceRegions: ["Lagos", "Abuja"], // Default regions
        specializations: ["Company Law", "Corporate Governance"], // Default
      });
      return res.json();
    },
    onSuccess: () => {
      setApplicationSubmitted(true);
    },
    onError: (error: any) => {
      toast({
        title: "Application failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LawyerApplicationForm) => {
    submitMutation.mutate(data);
  };

  if (applicationSubmitted) {
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
              <CardTitle className="text-2xl font-bold">Application Submitted</CardTitle>
              <CardDescription className="text-base">
                Thank you for applying to join Celion One as a legal practitioner. 
                We will review your application and get back to you within 2-3 business days.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Once approved, you'll receive an email with instructions to set up your account and start receiving cases.
              </p>
              <Link href="/">
                <Button variant="outline" data-testid="button-back-home">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
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

      <div className="flex-1 px-4 pt-20 pb-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/">
            <a className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </a>
          </Link>

          <Card>
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <Scale className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Join as a Legal Practitioner</CardTitle>
                  <CardDescription>
                    Apply to become a verified lawyer on Celion One
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John" data-testid="input-first-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" data-testid="input-last-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="you@firm.com" data-testid="input-email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="+234..." data-testid="input-phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="barId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>NBA Enrollment Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="NBA/XXX/XXXX" data-testid="input-bar-id" {...field} />
                          </FormControl>
                          <FormDescription>Your Nigerian Bar Association enrollment number</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="scnNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SCN Number</FormLabel>
                          <FormControl>
                            <Input placeholder="SCN/XXX/XXXX" data-testid="input-scn" {...field} />
                          </FormControl>
                          <FormDescription>Supreme Court Number (if applicable)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firmName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Law Firm Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your firm name" data-testid="input-firm-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="yearsOfExperience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Years of Experience</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" placeholder="5" data-testid="input-experience" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="firmAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Office Address</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Your office address" 
                            className="resize-none"
                            data-testid="input-firm-address"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="statementOfInterest"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statement of Interest *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Tell us why you want to join Celion One and your experience with company incorporation..."
                            className="resize-none min-h-[120px]"
                            data-testid="input-statement"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Describe your experience with CAC filings and company registration
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-2">What happens next?</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Our team will review your application within 2-3 business days</li>
                      <li>You'll receive an email with the outcome of your application</li>
                      <li>Approved lawyers get access to the lawyer portal to receive cases</li>
                    </ul>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitMutation.isPending}
                    data-testid="button-submit-application"
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Submit Application
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
