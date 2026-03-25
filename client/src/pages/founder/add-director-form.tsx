import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2, User, FileText, Upload, Loader2, CheckCircle2,
  ArrowLeft, ArrowRight, Plus, Trash2, AlertCircle,
} from "lucide-react";

const addDirectorFormSchema = z.object({
  companyRcNumber: z.string().min(1, "RC number is required"),
  companyName: z.string().min(1, "Company name is required"),
  companyTin: z.string().optional().default(""),
  incorporationDate: z.string().optional().default(""),
  registeredAddress: z.string().optional().default(""),
  existingDirectors: z.array(z.object({
    name: z.string().min(1, "Director name is required"),
    role: z.string().optional().default(""),
  })).default([]),
  newDirectorFirstName: z.string().min(1, "First name is required"),
  newDirectorLastName: z.string().min(1, "Last name is required"),
  newDirectorEmail: z.string().email("Invalid email").optional().or(z.literal("")).default(""),
  newDirectorPhone: z.string().optional().default(""),
  newDirectorNin: z.string().optional().default(""),
  newDirectorDateOfBirth: z.string().optional().default(""),
  newDirectorNationality: z.string().optional().default("Nigeria"),
  newDirectorOccupation: z.string().optional().default(""),
  newDirectorAddress: z.string().optional().default(""),
  additionalNotes: z.string().optional().default(""),
});

type AddDirectorFormData = z.infer<typeof addDirectorFormSchema>;

const DIRECTOR_DOC_TYPES = [
  { value: "new_director_id", label: "New Director's Government ID (NIN slip, Passport, or Driver's License)" },
  { value: "new_director_photo", label: "New Director's Passport Photograph" },
  { value: "board_resolution", label: "Board Resolution Approving New Director" },
  { value: "signature_specimen", label: "Signature Specimen" },
  { value: "certificate_of_incorporation", label: "Certificate of Incorporation (if not on file)" },
  { value: "memart", label: "Articles of Association (MEMART)" },
];

interface UploadedDoc {
  id: number;
  docType: string;
  filename: string;
  storagePath: string;
  sizeBytes: number | null;
  mimeType: string | null;
}

export default function AddDirectorFormPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const srId = params.get("srId");
  const orderId = params.get("orderId");

  const [step, setStep] = useState(1);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  const { data: srData, isLoading: srLoading } = useQuery<any>({
    queryKey: ["/api/founder/service-requests", srId, "director-data"],
    enabled: !!srId,
  });

  const { data: orderData, isLoading: orderLoading } = useQuery<any>({
    queryKey: ["/api/founder/orders", orderId],
    enabled: !!orderId,
  });

  const orderIsPaid = !orderId || orderData?.order?.status === "paid";

  const uploadedDocs: UploadedDoc[] = srData?.documents || [];

  const form = useForm<AddDirectorFormData>({
    resolver: zodResolver(addDirectorFormSchema),
    defaultValues: {
      companyRcNumber: "",
      companyName: "",
      companyTin: "",
      incorporationDate: "",
      registeredAddress: "",
      existingDirectors: [{ name: "", role: "" }],
      newDirectorFirstName: "",
      newDirectorLastName: "",
      newDirectorEmail: "",
      newDirectorPhone: "",
      newDirectorNin: "",
      newDirectorDateOfBirth: "",
      newDirectorNationality: "Nigeria",
      newDirectorOccupation: "",
      newDirectorAddress: "",
      additionalNotes: "",
    },
  });

  const { fields: directorFields, append: appendDirector, remove: removeDirector } = useFieldArray({
    control: form.control,
    name: "existingDirectors",
  });

  useEffect(() => {
    if (srData?.directorData) {
      const d = srData.directorData;
      form.reset({
        companyRcNumber: d.companyRcNumber || "",
        companyName: d.companyName || "",
        companyTin: d.companyTin || "",
        incorporationDate: d.incorporationDate || "",
        registeredAddress: d.registeredAddress || "",
        existingDirectors: d.existingDirectors?.length ? d.existingDirectors : [{ name: "", role: "" }],
        newDirectorFirstName: d.newDirectorFirstName || "",
        newDirectorLastName: d.newDirectorLastName || "",
        newDirectorEmail: d.newDirectorEmail || "",
        newDirectorPhone: d.newDirectorPhone || "",
        newDirectorNin: d.newDirectorNin || "",
        newDirectorDateOfBirth: d.newDirectorDateOfBirth || "",
        newDirectorNationality: d.newDirectorNationality || "Nigeria",
        newDirectorOccupation: d.newDirectorOccupation || "",
        newDirectorAddress: d.newDirectorAddress || "",
        additionalNotes: d.additionalNotes || "",
      });
    }
  }, [srData, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: AddDirectorFormData) => {
      if (!srId) throw new Error("No service request ID");
      const res = await apiRequest("PUT", `/api/founder/service-requests/${srId}/director-data`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/service-requests", srId, "director-data"] });
      toast({ title: "Details saved", description: "Director appointment details have been saved." });
      setStep(3);
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: async ({ file, docType }: { file: File; docType: string }) => {
      if (!srId) throw new Error("No service request ID");

      const urlRes = await apiRequest("POST", `/api/founder/service-requests/${srId}/documents/upload-url`, {
        name: file.name,
        size: file.size,
        contentType: file.type,
        docType,
      });
      const { uploadURL, objectPath } = await urlRes.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      const docRes = await apiRequest("POST", `/api/founder/service-requests/${srId}/documents`, {
        docType,
        filename: file.name,
        storagePath: objectPath,
        sizeBytes: file.size,
        mimeType: file.type,
      });
      return docRes.json();
    },
    onSuccess: () => {
      setUploadingDocType(null);
      queryClient.invalidateQueries({ queryKey: ["/api/founder/service-requests", srId, "director-data"] });
      toast({ title: "Document uploaded", description: "Your document has been uploaded successfully." });
    },
    onError: (error: Error) => {
      setUploadingDocType(null);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/founder/service-requests/${srId}/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/service-requests", srId, "director-data"] });
      toast({ title: "Document removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFileUpload = (docType: string, file: File) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Only PDF, JPEG, and PNG files are allowed.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10MB.", variant: "destructive" });
      return;
    }
    setUploadingDocType(docType);
    uploadDocMutation.mutate({ file, docType });
  };

  const onSubmitDetails = (data: AddDirectorFormData) => {
    saveMutation.mutate(data);
  };

  if (srLoading || orderLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="form-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!srId) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">No Service Request Found</h2>
            <p className="text-muted-foreground">
              This form requires a valid service request. Please access it from your orders page.
            </p>
            <Button variant="outline" onClick={() => setLocation("/founder/orders")}>
              View My Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (orderId && !orderIsPaid) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold" data-testid="text-payment-required">Payment Required</h2>
            <p className="text-muted-foreground">
              Payment for this order has not been confirmed yet. You can fill in the director details after payment is processed.
            </p>
            <Button variant="outline" onClick={() => setLocation(`/founder/orders/${orderId}`)} data-testid="button-view-order">
              View Order Status
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const steps = [
    { num: 1, label: "Company Info" },
    { num: 2, label: "Director Details" },
    { num: 3, label: "Documents" },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/founder/orders")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-form-title">Add Director — CAC Filing</h1>
          <p className="text-muted-foreground mt-1">
            Provide company and new director details for CAC registration
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2" data-testid="step-indicator">
        {steps.map((s, idx) => (
          <div key={s.num} className="flex items-center gap-2">
            {idx > 0 && <div className="h-px w-8 bg-border" />}
            <button
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                step === s.num ? "text-primary" : step > s.num ? "text-muted-foreground" : "text-muted-foreground/50"
              }`}
              onClick={() => {
                if (s.num <= 2 || srData?.directorData) setStep(s.num);
              }}
              data-testid={`step-${s.num}`}
            >
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s.num
                    ? "bg-primary text-primary-foreground"
                    : step > s.num
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s.num ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.num}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          </div>
        ))}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmitDetails)}>
          {step === 1 && (
            <Card data-testid="card-step-company">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Step 1: Company Information
                </CardTitle>
                <CardDescription>
                  Enter the details of the company that is adding a new director.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="companyRcNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>RC Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., RC123456" {...field} data-testid="input-rc-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="companyName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Registered company name" {...field} data-testid="input-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="companyTin" render={({ field }) => (
                    <FormItem>
                      <FormLabel>TIN Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Tax Identification Number" {...field} data-testid="input-tin" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="incorporationDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Incorporation</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-incorporation-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="registeredAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registered Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Full registered address of the company" {...field} data-testid="input-registered-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Existing Directors</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendDirector({ name: "", role: "" })}
                      data-testid="button-add-existing-director"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Director
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    List all current directors as they appear on the CAC register.
                  </p>

                  {directorFields.map((field, index) => (
                    <div key={field.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField control={form.control} name={`existingDirectors.${index}.name`} render={({ field: f }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Full Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Director's full name" {...f} data-testid={`input-existing-director-name-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`existingDirectors.${index}.role`} render={({ field: f }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Role (optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Managing Director" {...f} data-testid={`input-existing-director-role-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      {directorFields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-6"
                          onClick={() => removeDirector(index)}
                          data-testid={`button-remove-director-${index}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="button" onClick={() => {
                    form.trigger(["companyRcNumber", "companyName"]).then(valid => {
                      if (valid) setStep(2);
                    });
                  }} data-testid="button-next-step-1">
                    Continue <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card data-testid="card-step-director">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Step 2: New Director Details
                </CardTitle>
                <CardDescription>
                  Enter the personal details of the individual being appointed as director.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="newDirectorFirstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" {...field} data-testid="input-director-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="newDirectorLastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" {...field} data-testid="input-director-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="newDirectorEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@example.com" {...field} data-testid="input-director-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="newDirectorPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+234 800 000 0000" {...field} data-testid="input-director-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="newDirectorNin" render={({ field }) => (
                    <FormItem>
                      <FormLabel>NIN (National Identity Number)</FormLabel>
                      <FormControl>
                        <Input placeholder="11-digit NIN" {...field} data-testid="input-director-nin" />
                      </FormControl>
                      <FormDescription className="text-xs">Required for CAC filing</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="newDirectorDateOfBirth" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-director-dob" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="newDirectorNationality" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nationality</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Nigerian" {...field} data-testid="input-director-nationality" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="newDirectorOccupation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Occupation</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Entrepreneur, Engineer" {...field} data-testid="input-director-occupation" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="newDirectorAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Residential Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Full residential address of the new director" {...field} data-testid="input-director-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="additionalNotes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any additional information for our team (optional)" {...field} data-testid="input-additional-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="flex items-center justify-between pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} data-testid="button-prev-step-2">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                    data-testid="button-save-director-details"
                  >
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Save & Continue <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card data-testid="card-step-documents">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Step 3: Upload Documents
                </CardTitle>
                <CardDescription>
                  Upload the required documents for the director appointment. PDF, JPEG, and PNG files accepted (max 10MB each).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {DIRECTOR_DOC_TYPES.map((docType) => {
                  const uploaded = uploadedDocs.filter(d => d.docType === docType.value);
                  const isUploading = uploadingDocType === docType.value;

                  return (
                    <div key={docType.value} className="space-y-2" data-testid={`section-doc-${docType.value}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{docType.label}</p>
                          {uploaded.length > 0 && (
                            <p className="text-xs text-primary">
                              <CheckCircle2 className="h-3 w-3 inline mr-0.5" />
                              {uploaded.length} file{uploaded.length > 1 ? "s" : ""} uploaded
                            </p>
                          )}
                        </div>
                        <label className="cursor-pointer" data-testid={`upload-${docType.value}`}>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            disabled={isUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(docType.value, file);
                              e.target.value = "";
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            asChild
                            disabled={isUploading}
                          >
                            <span>
                              {isUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <Upload className="h-4 w-4 mr-1" />
                              )}
                              Upload
                            </span>
                          </Button>
                        </label>
                      </div>

                      {uploaded.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between gap-3 pl-2 p-2 rounded-md bg-muted/50 text-sm"
                          data-testid={`uploaded-doc-${doc.id}`}
                        >
                          <span className="truncate flex-1">{doc.filename}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => deleteDocMutation.mutate(doc.id)}
                            disabled={deleteDocMutation.isPending}
                            data-testid={`button-delete-doc-${doc.id}`}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}

                      <Separator />
                    </div>
                  );
                })}

                <div className="flex items-center justify-between pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep(2)} data-testid="button-prev-step-3">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      toast({
                        title: "Submission complete",
                        description: "Your Add Director request has been submitted. Our legal team will review and process it shortly.",
                      });
                      setLocation("/founder/orders");
                    }}
                    data-testid="button-finish"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Finish & Submit
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      </Form>
    </div>
  );
}
