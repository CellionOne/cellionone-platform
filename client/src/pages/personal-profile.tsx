import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
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
} from "lucide-react";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

const profileFormSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().min(10, "Phone number is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  nationality: z.string().min(1, "Nationality is required"),
  gender: z.string().min(1, "Gender is required"),
  occupation: z.string().min(1, "Occupation is required"),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().optional(),
  country: z.string().default("Nigeria"),
  idType: z.string().min(1, "ID type is required"),
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
  hasIdDocument: boolean;
  hasPassportPhoto: boolean;
  hasSignature: boolean;
  profileCompletion: number;
  isProfileComplete: boolean;
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
        <ProfileHeader />
        <ProfileForm />
        <Separator />
        <IdentitySection />
        <Separator />
        <DocumentsSection />
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
      </CardContent>
    </Card>
  );
}

function ProfileForm() {
  const { toast } = useToast();

  const { data: profile, isLoading } = useQuery<PersonalProfile>({
    queryKey: ["/api/profile/personal"],
  });

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Personal Information</CardTitle>
        <CardDescription>Provide your details as they appear on your government-issued ID</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Full Legal Name</FormLabel>
                    <FormControl>
                      <Input placeholder="As on government ID" data-testid="input-full-name" {...field} />
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
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+234 801 234 5678" data-testid="input-phone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input type="date" data-testid="input-dob" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
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
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" data-testid="input-address1" {...field} />
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
                      <FormLabel>State</FormLabel>
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

            <div>
              <h3 className="text-sm font-medium mb-4">Government ID Type</h3>
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
    <Card>
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

function DocumentsSection() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery<PersonalProfile>({
    queryKey: ["/api/profile/personal"],
  });

  const handleUpload = async (docType: string, file: File) => {
    setUploading(docType);
    try {
      const urlRes = await apiRequest("POST", "/api/profile/personal/upload-url", {
        docType,
        contentType: file.type,
        name: file.name,
        size: file.size,
      });
      const { uploadURL, objectPath } = await urlRes.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      await apiRequest("POST", "/api/profile/personal/upload-complete", {
        docType,
        objectPath,
      });

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

  const documents = [
    {
      type: "passport_photo",
      label: "Passport Photograph",
      description: "Clear, recent passport-sized photograph with white background",
      icon: Camera,
      uploaded: profile?.hasPassportPhoto || false,
      accept: "image/jpeg,image/png",
    },
    {
      type: "signature",
      label: "Signature Specimen",
      description: "Clear scan or photo of your signature on white paper",
      icon: FileSignature,
      uploaded: profile?.hasSignature || false,
      accept: "image/jpeg,image/png,application/pdf",
    },
    {
      type: "id_document",
      label: "Government-Issued ID",
      description: `Upload a clear copy of your ${profile?.idType?.replace(/_/g, " ") || "government ID"}`,
      icon: CreditCard,
      uploaded: profile?.hasIdDocument || false,
      accept: "image/jpeg,image/png,application/pdf",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Required Documents</CardTitle>
        <CardDescription>Upload clear copies of the following documents. Max 5MB per file (JPEG, PNG, or PDF).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {documents.map((doc) => (
            <div
              key={doc.type}
              className="flex items-center gap-4 p-4 border rounded-lg"
              data-testid={`document-row-${doc.type}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${doc.uploaded ? "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                <doc.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{doc.label}</span>
                  {doc.uploaded && (
                    <Badge variant="default" className="gap-1 text-xs">
                      <CheckCircle2 className="h-3 w-3" /> Uploaded
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
  );
}
