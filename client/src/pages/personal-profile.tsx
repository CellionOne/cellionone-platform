import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import SignatureCanvas from "react-signature-canvas";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient, getCsrfToken } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  UserCircle,
  Loader2,
  Check,
  Upload,
  Camera,
  FileSignature,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Eye,
  Pen,
  Eraser,
  Info,
  ArrowRight,
  Lock,
  Sparkles,
  X,
} from "lucide-react";
import { LiveCaptureWidget } from "@/components/live-capture-widget";
import { InvitationBanner } from "@/components/invitation-banner";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

const profileFormSchema = z.object({
  fullName: z.string().optional(),
  phone: z.string().min(10, "Phone number is required"),
  dateOfBirth: z.string().optional(),
  nationality: z.string().min(1, "Nationality is required"),
  gender: z.string().optional(),
  occupation: z.string().min(1, "Occupation is required"),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().optional(),
  country: z.string().default("Nigeria"),
  idType: z.string().min(1, "ID type is required"),
  idNumber: z.string().optional(),
  nin: z.string().optional(),
  bvn: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

interface PersonalProfile {
  userId: string;
  fullName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  gender: string | null;
  occupation: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  ninLast4: string | null;
  bvnLast4: string | null;
  hasNin: boolean;
  hasBvn: boolean;
  idType: string | null;
  idNumber: string | null;
  hasIdDocument: boolean;
  hasPassportPhoto: boolean;
  hasSignature: boolean;
  profileCompletion: number;
  isProfileComplete: boolean;
  isVerified?: boolean;
  kybPrefilled?: boolean;
  kybSourceCompanyProfileId?: number | null;
  lockedFields?: string[];
  profilePopulatedFromKyc?: boolean;
}

function ProfileBottomCTA() {
  const { data: profile } = useQuery<PersonalProfile>({
    queryKey: ["/api/profile/personal"],
  });
  const completion = profile?.profileCompletion || 0;
  if (completion < 80) return null;
  if (profile?.isVerified) return null;
  return (
    <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-6 flex flex-col sm:flex-row items-center gap-4" data-testid="cta-bottom-identity">
      <div className="flex-1 text-center sm:text-left">
        <p className="text-lg font-semibold">Your profile is ready — verify your identity.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Identity verification unlocks company registration, orders, and service requests on the platform.
        </p>
      </div>
      <Link href="/profile#identity">
        <Button size="lg" className="shrink-0 w-full sm:w-auto" data-testid="button-bottom-verify-identity">
          Verify Identity <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </Link>
    </div>
  );
}

function VerifyIdentityBanner() {
  const { data: profile } = useQuery<PersonalProfile>({ queryKey: ["/api/profile/personal"] });
  const { user } = useAuth();
  const isFounder = Array.isArray(user?.roles) && user.roles.includes("founder");
  if (!isFounder) return null;
  if (profile?.isVerified) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border-2 border-primary/40 bg-primary/5 dark:bg-primary/10 px-4 py-4" data-testid="banner-verify-identity-prompt">
      <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">Verify Your Identity to unlock all features</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enter your BVN and NIN to verify your identity. Your name, date of birth, and gender will be auto-populated from government records — no manual entry needed.
        </p>
      </div>
      <Link href="/verify-identity">
        <Button size="sm" className="shrink-0" data-testid="button-banner-verify-identity">
          Verify Now <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </Link>
    </div>
  );
}

function KycPrefilledBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data: profile } = useQuery<PersonalProfile>({ queryKey: ["/api/profile/personal"] });
  if (!profile?.profilePopulatedFromKyc || dismissed) return null;
  const lockedCount = (profile.lockedFields ?? []).filter(f => ["fullName", "dateOfBirth", "gender"].includes(f)).length;
  if (lockedCount === 0) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10 px-4 py-3" data-testid="banner-kyc-prefilled">
      <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          Profile auto-populated from Government Records
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {lockedCount} field{lockedCount !== 1 ? "s were" : " was"} filled automatically using data verified via your BVN/NIN (NIBSS/NIMC). These fields are locked with a "Govt-verified" badge.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        data-testid="button-dismiss-kyc-banner"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function KybPrefilledBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data: profile } = useQuery<PersonalProfile>({ queryKey: ["/api/profile/personal"] });

  if (!profile?.kybPrefilled || dismissed) return null;

  const lockedCount = profile.lockedFields?.length ?? 0;
  if (lockedCount === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10 px-4 py-3" data-testid="banner-kyb-prefilled">
      <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          Profile pre-filled from your verified company registration
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {lockedCount} field{lockedCount !== 1 ? "s were" : " was"} filled in automatically using data verified during your CAC registration and BVN/NIN check. These fields are locked to preserve your verified status.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        data-testid="button-dismiss-kyb-banner"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function PersonalProfilePage() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  const role = roles.includes("admin") ? "admin" as const : roles.includes("lawyer") ? "lawyer" as const : "founder" as const;
  const dashboardPath = `/${role}/dashboard`;

  return (
    <DashboardLayout
      role={role}
      breadcrumbs={[{ label: "Dashboard", href: dashboardPath }, { label: "Personal Profile" }]}
    >
      <div className="max-w-3xl mx-auto space-y-6 p-4 overflow-y-auto h-full">
        <InvitationBanner />
        <VerifyIdentityBanner />
        <KycPrefilledBanner />
        <KybPrefilledBanner />
        <ProfileHeader />
        <ProfileForm />
        <Separator />
        <IdentitySection />
        <Separator />
        <DocumentsSection />
        <ProfileBottomCTA />
      </div>
    </DashboardLayout>
  );
}

function ProfileHeader() {
  const { data: profile, isLoading } = useQuery<PersonalProfile>({
    queryKey: ["/api/profile/personal"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const completion = profile?.profileCompletion || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="text-profile-title">
              <UserCircle className="h-5 w-5" /> Personal Profile
            </CardTitle>
            <CardDescription>
              Complete your personal profile to proceed with company incorporation. All information is securely stored.
            </CardDescription>
          </div>
          {profile?.isProfileComplete ? (
            <Badge variant="default" className="gap-1" data-testid="badge-profile-complete">
              <CheckCircle2 className="h-3 w-3" /> Complete
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1" data-testid="badge-profile-incomplete">
              <AlertCircle className="h-3 w-3" /> Incomplete
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Profile Completion</span>
            <span className="font-medium" data-testid="text-completion-percent">{completion}%</span>
          </div>
          <Progress value={completion} className="h-2" data-testid="progress-completion" />
        </div>
        {profile?.isProfileComplete && !profile?.isVerified && (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 px-4 py-3" data-testid="cta-profile-complete">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm font-medium text-green-800 dark:text-green-300 flex-1">Profile complete! Scroll down to verify your BVN or NIN.</p>
            <Link href="/profile#identity">
              <Button size="sm" variant="outline" className="shrink-0 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400" data-testid="button-go-to-identity-complete">
                Verify Identity <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LockedFieldBadge({ source = "kyb" }: { source?: "kyb" | "kyc" }) {
  const label = source === "kyc" ? "Govt-verified" : "KYB-verified";
  const title =
    source === "kyc"
      ? "This field was confirmed via your BVN/NIN and cannot be edited."
      : "This field was verified during your company registration and cannot be edited.";
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5 ml-2 cursor-help"
    >
      <Lock className="h-3 w-3" /> {label}
    </span>
  );
}

function ProfileForm() {
  const { toast } = useToast();
  const [idDocUploading, setIdDocUploading] = useState(false);

  async function handleIdDocUpload(file: File) {
    setIdDocUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", "id_document");
      const csrf = await getCsrfToken();
      const res = await fetch("/api/profile/personal/upload", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": csrf },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Upload failed");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/profile/personal"] });
      toast({ title: "Government ID uploaded", description: "Your ID document has been uploaded successfully." });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIdDocUploading(false);
    }
  }

  const { data: profile, isLoading } = useQuery<PersonalProfile>({
    queryKey: ["/api/profile/personal"],
  });

  const isLocked = (fieldKey: string) => (profile?.lockedFields ?? []).includes(fieldKey);
  const lockSource = (fieldKey: string): "kyc" | "kyb" =>
    profile?.profilePopulatedFromKyc && (profile?.lockedFields ?? []).includes(fieldKey) ? "kyc" : "kyb";

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: "",
      phone: "+234",
      dateOfBirth: "",
      nationality: "Nigerian",
      gender: "",
      occupation: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "Nigeria",
      idType: "",
      idNumber: "",
      nin: "",
      bvn: "",
    },
    values: profile ? {
      fullName: profile.fullName || "",
      phone: profile.phone || "+234",
      dateOfBirth: profile.dateOfBirth || "",
      nationality: profile.nationality || "Nigerian",
      gender: profile.gender || "",
      occupation: profile.occupation || "",
      addressLine1: profile.addressLine1 || "",
      addressLine2: profile.addressLine2 || "",
      city: profile.city || "",
      state: profile.state || "",
      postalCode: profile.postalCode || "",
      country: profile.country || "Nigeria",
      idType: profile.idType || "",
      idNumber: profile.idNumber || "",
      nin: "",
      bvn: "",
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const payload: any = { ...data };
      if (!payload.nin) delete payload.nin;
      if (!payload.bvn) delete payload.bvn;
      const res = await apiRequest("PUT", "/api/profile/personal", payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Profile saved", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/personal"] });
      form.setValue("nin", "");
      form.setValue("bvn", "");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isVerified = profile?.isVerified ?? false;

  return (
    <Card id="personal-info">
      <CardHeader>
        <CardTitle className="text-lg">Personal Information</CardTitle>
        <CardDescription>Provide your details as they appear on your government-issued ID</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
            {/* Name / DOB / Gender — only shown after identity verification */}
            {!isVerified ? (
              <div className="rounded-lg border border-dashed border-primary/30 bg-muted/30 px-4 py-5 text-center space-y-2" data-testid="placeholder-verify-first">
                <ShieldCheck className="h-6 w-6 text-primary mx-auto" />
                <p className="text-sm font-medium text-foreground">Full name, date of birth, and gender will appear here after identity verification</p>
                <p className="text-xs text-muted-foreground">These fields are auto-populated from government records — you won't need to enter them manually.</p>
                <Link href="/verify-identity">
                  <Button type="button" size="sm" className="mt-1" data-testid="button-verify-identity-from-profile">
                    Verify Your Identity <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isVerified && (
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="flex items-center">
                        Full Legal Name
                        {isLocked("fullName") && <LockedFieldBadge source={lockSource("fullName")} />}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="As on government ID"
                          data-testid="input-full-name"
                          readOnly={isLocked("fullName")}
                          title={isLocked("fullName") ? "This field was confirmed via your BVN/NIN and cannot be edited." : undefined}
                          className={isLocked("fullName") ? "bg-muted/60 cursor-not-allowed" : ""}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      Phone Number
                      {isLocked("phone") && <LockedFieldBadge source={lockSource("phone")} />}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+234 801 234 5678"
                        data-testid="input-phone"
                        readOnly={isLocked("phone")}
                        title={isLocked("phone") ? "This field was verified during your company registration and cannot be edited." : undefined}
                        className={isLocked("phone") ? "bg-muted/60 cursor-not-allowed" : ""}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isVerified && (
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        Date of Birth
                        {isLocked("dateOfBirth") && <LockedFieldBadge source={lockSource("dateOfBirth")} />}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          data-testid="input-dob"
                          readOnly={isLocked("dateOfBirth")}
                          title={isLocked("dateOfBirth") ? "This field was confirmed via your BVN/NIN and cannot be edited." : undefined}
                          className={isLocked("dateOfBirth") ? "bg-muted/60 cursor-not-allowed" : ""}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {isVerified && (
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        Gender
                        {isLocked("gender") && <LockedFieldBadge source={lockSource("gender")} />}
                      </FormLabel>
                      {isLocked("gender") ? (
                        <FormControl>
                          <Input
                            data-testid="input-gender"
                            readOnly
                            value={field.value ? field.value.charAt(0).toUpperCase() + field.value.slice(1) : ""}
                            className="bg-muted/60 cursor-not-allowed"
                            title="This field was confirmed via your BVN/NIN and cannot be edited."
                          />
                        </FormControl>
                      ) : (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-gender">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="nationality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nationality</FormLabel>
                    <FormControl>
                      <Input placeholder="Nigerian" data-testid="input-nationality" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="occupation"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Occupation</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Software Engineer, Lawyer, Business Owner" data-testid="input-occupation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-medium mb-4">Residential Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="addressLine1"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="flex items-center">
                        Address Line 1
                        {isLocked("addressLine1") && <LockedFieldBadge source={lockSource("addressLine1")} />}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Street address"
                          data-testid="input-address1"
                          readOnly={isLocked("addressLine1")}
                          title={isLocked("addressLine1") ? "This field was verified during your company registration and cannot be edited." : undefined}
                          className={isLocked("addressLine1") ? "bg-muted/60 cursor-not-allowed" : ""}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="addressLine2"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Address Line 2</FormLabel>
                      <FormControl>
                        <Input placeholder="Apartment, suite, etc. (optional)" data-testid="input-address2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Lagos, Abuja" data-testid="input-city" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        State
                        {isLocked("state") && <LockedFieldBadge source={lockSource("state")} />}
                      </FormLabel>
                      {isLocked("state") ? (
                        <Input
                          value={field.value}
                          readOnly
                          title="This field was verified during your company registration and cannot be edited."
                          className="bg-muted/60 cursor-not-allowed"
                          data-testid="input-state-locked"
                        />
                      ) : (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-state">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {NIGERIAN_STATES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" data-testid="input-postal" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input data-testid="input-country" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <div id="identity-docs">
              <h3 className="text-sm font-medium mb-4">Government ID</h3>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="idType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID Document Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-id-type">
                            <SelectValue placeholder="Select ID type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="national_id">National ID Card (NIN Slip)</SelectItem>
                          <SelectItem value="drivers_license">Driver's License</SelectItem>
                          <SelectItem value="international_passport">International Passport</SelectItem>
                          <SelectItem value="voters_card">Voter's Card</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="idNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID Number</FormLabel>
                      <FormControl>
                        <Input placeholder="As printed on your ID" data-testid="input-id-number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${profile?.hasIdDocument ? "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Government-Issued ID Document
                      {profile?.hasIdDocument && (
                        <Badge variant="default" className="gap-1 text-xs ml-2">
                          <CheckCircle2 className="h-3 w-3" /> Uploaded
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Upload a clear copy of your {profile?.idType?.replace(/_/g, " ") || "government ID"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {profile?.hasIdDocument && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          const res = await apiRequest("GET", "/api/profile/personal/document/id_document");
                          const { downloadURL } = await res.json();
                          window.open(downloadURL, "_blank");
                        } catch {
                          toast({ title: "Error", description: "Could not load document.", variant: "destructive" });
                        }
                      }}
                      data-testid="button-view-id_document"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <label>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleIdDocUpload(file);
                        e.target.value = "";
                      }}
                      data-testid="input-upload-id_document"
                    />
                    <Button
                      type="button"
                      variant={profile?.hasIdDocument ? "outline" : "default"}
                      size="sm"
                      asChild
                      disabled={idDocUploading}
                    >
                      <span className="cursor-pointer">
                        {idDocUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Upload className="h-4 w-4 mr-1" />
                        )}
                        {profile?.hasIdDocument ? "Replace" : "Upload"}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-profile">
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save Profile
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function IdentitySection() {
  const { toast } = useToast();
  const [ninValue, setNinValue] = useState("");
  const [bvnValue, setBvnValue] = useState("");

  const { data: profile, isLoading } = useQuery<PersonalProfile>({
    queryKey: ["/api/profile/personal"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { nin?: string; bvn?: string }) => {
      const res = await apiRequest("PUT", "/api/profile/personal", {
        ...data,
        fullName: profile?.fullName,
        phone: profile?.phone,
        dateOfBirth: profile?.dateOfBirth,
        nationality: profile?.nationality,
        gender: profile?.gender,
        occupation: profile?.occupation,
        addressLine1: profile?.addressLine1,
        addressLine2: profile?.addressLine2,
        city: profile?.city,
        state: profile?.state,
        postalCode: profile?.postalCode,
        country: profile?.country,
        idType: profile?.idType,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Identity numbers saved", description: "Your NIN/BVN has been encrypted and stored securely." });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/personal"] });
      setNinValue("");
      setBvnValue("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="identity" data-testid="card-identity-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5" /> Identity Numbers
        </CardTitle>
        <CardDescription>
          Your NIN and BVN are encrypted using military-grade encryption (AES-256-GCM) and are never stored in plain text. Only the last 4 digits are displayed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>National Identification Number (NIN)</Label>
            {profile?.hasNin ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted/50 border rounded-md px-3 py-2 font-mono" data-testid="text-nin-masked">
                  *******{profile.ninLast4}
                </div>
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Saved
                </Badge>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Enter 11-digit NIN"
                  maxLength={11}
                  value={ninValue}
                  onChange={(e) => setNinValue(e.target.value.replace(/\D/g, ""))}
                  data-testid="input-nin"
                />
                <p className="text-xs text-muted-foreground">11 digits, numbers only</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Bank Verification Number (BVN)</Label>
            {profile?.hasBvn ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted/50 border rounded-md px-3 py-2 font-mono" data-testid="text-bvn-masked">
                  *******{profile.bvnLast4}
                </div>
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Saved
                </Badge>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Enter 11-digit BVN"
                  maxLength={11}
                  value={bvnValue}
                  onChange={(e) => setBvnValue(e.target.value.replace(/\D/g, ""))}
                  data-testid="input-bvn"
                />
                <p className="text-xs text-muted-foreground">11 digits, numbers only</p>
              </div>
            )}
          </div>
        </div>

        {(!profile?.hasNin || !profile?.hasBvn) && (ninValue.length === 11 || bvnValue.length === 11) && (
          <Button
            onClick={() => {
              const data: { nin?: string; bvn?: string } = {};
              if (ninValue.length === 11) data.nin = ninValue;
              if (bvnValue.length === 11) data.bvn = bvnValue;
              updateMutation.mutate(data);
            }}
            disabled={updateMutation.isPending}
            data-testid="button-save-identity"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-2" />
            )}
            Save Identity Numbers
          </Button>
        )}

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 rounded-lg text-sm text-blue-800 dark:text-blue-300">
          Your identity numbers are encrypted with AES-256-GCM encryption before storage. Only the last 4 digits are ever displayed. Access to these fields is logged in our audit trail.
        </div>
      </CardContent>
    </Card>
  );
}

function BiometricSection() {
  const { toast } = useToast();

  const { data: profile } = useQuery<PersonalProfile>({
    queryKey: ["/api/profile/personal"],
  });

  const submitMutation = useMutation({
    mutationFn: async (dataUrl: string) => {
      const base64 = dataUrl.startsWith("data:") ? dataUrl.split(",")[1] : dataUrl;
      const res = await apiRequest("POST", "/api/verification/smile-id/submit-selfie", {
        selfieBase64: base64,
      });
      return res.json();
    },
    onSuccess: (result) => {
      if (result.verified) {
        toast({
          title: "Identity verified",
          description: `Liveness check passed${result.livenessScore ? ` (confidence: ${Math.round(result.livenessScore)}%)` : ""}. Your identity is now verified.`,
        });
      } else if (result.resultCode === "NOT_CONFIGURED") {
        toast({
          title: "Selfie recorded",
          description: "Your selfie has been captured. Live biometric verification will be activated when the service is configured.",
        });
      } else {
        toast({
          title: "Selfie submitted",
          description: "Liveness was not confirmed. Ensure good lighting with no shadows and try again.",
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/profile/personal"] });
    },
    onError: (error: Error) => {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    },
  });

  const isVerified = profile?.isVerified;
  const isKybPrefilled = profile?.kybPrefilled ?? false;

  return (
    <Card id="biometric" data-testid="card-biometric-section" className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" /> Verify My Identity — Biometric Selfie
        </CardTitle>
        <CardDescription>
          Capture a live selfie to complete your identity verification.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isVerified ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800" data-testid="alert-biometric-verified">
            <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">Identity verified</p>
              <p className="text-xs text-green-600 dark:text-green-500">Your biometric selfie has been confirmed. No further action needed.</p>
            </div>
          </div>
        ) : isKybPrefilled ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/30" data-testid="alert-kyb-pending-review">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Identity verification in progress</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your BVN/NIN was confirmed through your CAC company registration. Your identity is being automatically verified — no further action is required from you.
              </p>
            </div>
          </div>
        ) : submitMutation.isPending ? (
          <div className="flex items-center justify-center gap-3 py-8" data-testid="text-submitting-biometric">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Submitting biometric check — please wait…</span>
          </div>
        ) : submitMutation.isSuccess ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800" data-testid="alert-biometric-submitted">
              <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Selfie received</p>
                <p className="text-xs text-blue-600 dark:text-blue-500">Your verification result will update shortly. Retake if you were notified of a failure.</p>
              </div>
            </div>
            <LiveCaptureWidget onCapture={(dataUrl) => submitMutation.mutate(dataUrl)} data-testid="widget-live-capture" />
          </div>
        ) : (
          <LiveCaptureWidget onCapture={(dataUrl) => submitMutation.mutate(dataUrl)} data-testid="widget-live-capture" />
        )}

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 rounded-lg text-sm text-blue-800 dark:text-blue-300">
          Your selfie is used only for identity verification via Cellion's verification engine and is not stored on our servers after the check is complete.
        </div>
      </CardContent>
    </Card>
  );
}

function SignaturePad({ onSave, saving }: { onSave: (file: File) => void; saving: boolean }) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = useCallback(() => {
    sigRef.current?.clear();
    setIsEmpty(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    const canvas = sigRef.current.getTrimmedCanvas();
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "signature.png", { type: "image/png" });
        onSave(file);
      }
    }, "image/png");
  }, [onSave]);

  return (
    <div className="space-y-3" data-testid="signature-pad-container">
      <div className="border-2 border-dashed rounded-lg bg-white dark:bg-gray-50 overflow-hidden">
        <SignatureCanvas
          ref={sigRef}
          penColor="#000000"
          canvasProps={{
            className: "w-full",
            style: { width: "100%", height: "160px" },
            "data-testid": "canvas-signature-pad",
          } as any}
          onBegin={() => setIsEmpty(false)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={isEmpty || saving}
          data-testid="button-clear-signature"
        >
          <Eraser className="h-4 w-4 mr-1" />
          Clear
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isEmpty || saving}
          data-testid="button-save-signature"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Save Signature
        </Button>
      </div>
    </div>
  );
}

function DocumentsSection() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery<PersonalProfile>({
    queryKey: ["/api/profile/personal"],
  });

  const handleUpload = async (docType: string, file: File) => {
    setUploading(docType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", docType);

      const csrf = await getCsrfToken();
      const res = await fetch("/api/profile/personal/upload", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": csrf },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Upload failed");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/profile/personal"] });
      toast({ title: "Document uploaded", description: `Your ${docType.replace(/_/g, " ")} has been uploaded successfully.` });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const handleViewDocument = async (docType: string) => {
    try {
      const res = await apiRequest("GET", `/api/profile/personal/document/${docType}`);
      const { downloadURL } = await res.json();
      window.open(downloadURL, "_blank");
    } catch {
      toast({ title: "Error", description: "Could not load document.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const otherDocuments = [
    {
      type: "passport_photo",
      label: "Passport Photograph",
      description: "Clear, recent passport-sized photograph with white background",
      icon: Camera,
      uploaded: profile?.hasPassportPhoto || false,
      accept: "image/jpeg,image/png",
      govtSource: !!(profile?.profilePopulatedFromKyc && profile?.hasPassportPhoto),
    },
  ];

  const hasSignature = profile?.hasSignature || false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Signature Specimen
            {hasSignature && (
              <Badge variant="default" className="gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3" /> Saved
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Your signature is required for company filings and legal documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 rounded-lg text-sm text-blue-800 dark:text-blue-300 flex gap-2" data-testid="signature-consent-notice">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium mb-1">How your signature is used</p>
              <p>Your signature will only be used for applications and filings you have explicitly authorised. It will be securely stored and shared only with assigned lawyers handling your approved applications. You can update or delete your signature at any time.</p>
            </div>
          </div>

          {hasSignature && (
            <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30" data-testid="signature-preview-row">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400">
                <FileSignature className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <span className="font-medium text-sm">Current Signature</span>
                <p className="text-xs text-muted-foreground">Your saved signature specimen</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewDocument("signature")}
                data-testid="button-view-signature"
              >
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
            </div>
          )}

          <Tabs defaultValue="draw" data-testid="signature-tabs">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="draw" data-testid="tab-draw-signature">
                <Pen className="h-4 w-4 mr-1" />
                Draw Signature
              </TabsTrigger>
              <TabsTrigger value="upload" data-testid="tab-upload-signature">
                <Upload className="h-4 w-4 mr-1" />
                Upload Scan
              </TabsTrigger>
            </TabsList>
            <TabsContent value="draw" className="mt-4">
              <p className="text-sm text-muted-foreground mb-3">Draw your signature below using your mouse, trackpad, or touchscreen.</p>
              <SignaturePad
                onSave={(file) => handleUpload("signature", file)}
                saving={uploading === "signature"}
              />
            </TabsContent>
            <TabsContent value="upload" className="mt-4">
              <p className="text-sm text-muted-foreground mb-3">Upload a clear scan or photo of your signature on white paper. Max 5MB (JPEG, PNG, or PDF).</p>
              <label>
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload("signature", file);
                    e.target.value = "";
                  }}
                  data-testid="input-upload-signature"
                />
                <Button
                  variant={hasSignature ? "outline" : "default"}
                  size="sm"
                  asChild
                  disabled={uploading === "signature"}
                >
                  <span className="cursor-pointer">
                    {uploading === "signature" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    {hasSignature ? "Replace Signature" : "Upload Signature"}
                  </span>
                </Button>
              </label>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Other Required Documents</CardTitle>
          <CardDescription>Upload clear copies of the following documents. Max 5MB per file (JPEG, PNG, or PDF).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {otherDocuments.map((doc) => (
              <div
                key={doc.type}
                className="flex items-center gap-4 p-4 border rounded-lg"
                data-testid={`document-row-${doc.type}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${doc.uploaded ? "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                  <doc.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{doc.label}</span>
                    {doc.uploaded && (
                      <Badge variant="default" className="gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" /> Uploaded
                      </Badge>
                    )}
                    {doc.govtSource && (
                      <Badge variant="outline" className="gap-1 text-xs border-primary/50 text-primary" data-testid={`badge-govt-source-${doc.type}`}>
                        <ShieldCheck className="h-3 w-3" /> Source: Govt ID
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {doc.uploaded && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDocument(doc.type)}
                      data-testid={`button-view-${doc.type}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <label>
                    <input
                      type="file"
                      className="hidden"
                      accept={doc.accept}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(doc.type, file);
                        e.target.value = "";
                      }}
                      data-testid={`input-upload-${doc.type}`}
                    />
                    <Button
                      variant={doc.uploaded ? "outline" : "default"}
                      size="sm"
                      asChild
                      disabled={uploading === doc.type}
                    >
                      <span className="cursor-pointer">
                        {uploading === doc.type ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Upload className="h-4 w-4 mr-1" />
                        )}
                        {doc.uploaded ? "Replace" : "Upload"}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
