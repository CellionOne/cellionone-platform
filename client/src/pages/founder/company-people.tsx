import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  UserPlus,
  Loader2,
  Mail,
  MailCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Trash2,
  ShieldCheck,
  Percent,
  FileCheck,
  Camera,
  PenTool,
  CreditCard,
  Fingerprint,
} from "lucide-react";

interface CompanyPerson {
  id: number;
  applicationId: number | null;
  companyProfileId: number | null;
  founderId: string;
  personUserId: string | null;
  inviteEmail: string | null;
  inviteStatus: string | null;
  inviteToken: string | null;
  inviteSentAt: string | null;
  role: string;
  title: string | null;
  sharesAllocated: number | null;
  shareClass: string | null;
  sharePercentage: string | null;
  isVerified: boolean | null;
  createdAt: string;
}

const inviteSchema = z.object({
  inviteEmail: z.string().email("Valid email address required"),
  role: z.string().min(1, "Role is required"),
  title: z.string().optional(),
  sharesAllocated: z.string().optional(),
  shareClass: z.string().optional(),
  sharePercentage: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

export default function CompanyPeoplePage() {
  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[{ label: "Dashboard", href: "/founder/dashboard" }, { label: "Directors & Shareholders" }]}
    >
      <div className="max-w-3xl mx-auto space-y-6 p-4 overflow-y-auto h-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-company-people-title">
              <Users className="h-6 w-6" /> Directors & Shareholders
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage the directors, shareholders, and company secretary for your company. Each person must create their own account and complete identity verification.
            </p>
          </div>
          <InviteDialog />
        </div>

        <ReadinessSummary />
        <PeopleList />
      </div>
    </DashboardLayout>
  );
}

function InviteDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      inviteEmail: "",
      role: "",
      title: "",
      sharesAllocated: "",
      shareClass: "ordinary",
      sharePercentage: "",
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      const payload: any = {
        inviteEmail: data.inviteEmail,
        role: data.role,
        title: data.title || null,
        shareClass: data.shareClass || null,
        sharePercentage: data.sharePercentage || null,
      };
      if (data.sharesAllocated) {
        payload.sharesAllocated = parseInt(data.sharesAllocated);
      }
      const res = await apiRequest("POST", "/api/company-people", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invitation sent", description: "An email has been sent to the invited person." });
      queryClient.invalidateQueries({ queryKey: ["/api/company-people"] });
      form.reset();
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const selectedRole = form.watch("role");
  const showShares = selectedRole === "shareholder" || selectedRole === "director_shareholder";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-invite-person">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Person
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Director / Shareholder</DialogTitle>
          <DialogDescription>
            Send an invitation to add a person to your company. They will need to create an account and complete their profile.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => inviteMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="inviteEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="person@example.com" data-testid="input-invite-email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-person-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="director">Director</SelectItem>
                      <SelectItem value="shareholder">Shareholder</SelectItem>
                      <SelectItem value="director_shareholder">Director & Shareholder</SelectItem>
                      <SelectItem value="secretary">Company Secretary</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title / Designation (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Managing Director, Chairman" data-testid="input-person-title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showShares && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="sharesAllocated"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shares</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 500" data-testid="input-shares" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sharePercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Percentage (%)</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="e.g. 50" data-testid="input-share-percentage" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="shareClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Share Class</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-share-class">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ordinary">Ordinary Shares</SelectItem>
                          <SelectItem value="preference">Preference Shares</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <DialogFooter>
              <Button type="submit" disabled={inviteMutation.isPending} data-testid="button-send-invite">
                {inviteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface ReadinessData {
  people: {
    id: number | string;
    inviteEmail: string | null;
    role: string;
    inviteStatus: string;
    isVerified: boolean;
    personUserId: string | null;
    firstName: string | null;
    lastName: string | null;
    profileCompletion: number;
    isProfileComplete: boolean;
    hasPassportPhoto: boolean;
    hasSignature: boolean;
    hasIdDocument: boolean;
    hasNin: boolean;
    hasBvn: boolean;
  }[];
  summary: {
    totalPeople: number;
    readyCount: number;
    allReady: boolean;
  };
}

function ReadinessSummary() {
  const { data: readiness, isLoading } = useQuery<ReadinessData>({
    queryKey: ["/api/company-people/readiness"],
  });

  if (isLoading || !readiness) return null;

  const { summary } = readiness;

  return (
    <Card className={summary.allReady ? "border-green-300 dark:border-green-800" : "border-amber-300 dark:border-amber-800"} data-testid="card-readiness-summary">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Team Readiness</h3>
          <Badge variant={summary.allReady ? "default" : "secondary"}>
            {summary.readyCount} / {summary.totalPeople} ready
          </Badge>
        </div>
        <Progress
          value={(summary.readyCount / summary.totalPeople) * 100}
          className="h-2"
        />
        {summary.allReady ? (
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            All team members have completed their profiles. You can proceed to checkout.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-2">
            {summary.totalPeople - summary.readyCount} team member(s) still need to complete their profiles before you can proceed to checkout.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileChecklist({ person }: { person: ReadinessData["people"][0] }) {
  if (person.inviteStatus !== "accepted" && person.role !== "founder") return null;

  const items = [
    { label: "Passport Photo", done: person.hasPassportPhoto, icon: Camera },
    { label: "Signature", done: person.hasSignature, icon: PenTool },
    { label: "ID Document", done: person.hasIdDocument, icon: FileCheck },
    { label: "NIN", done: person.hasNin, icon: Fingerprint },
    { label: "BVN", done: person.hasBvn, icon: CreditCard },
  ];

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Profile completion</span>
        <span className="text-xs font-medium">{person.profileCompletion}%</span>
      </div>
      <Progress value={person.profileCompletion} className="h-1.5" />
      <div className="flex flex-wrap gap-2 mt-1">
        {items.map(({ label, done, icon: Icon }) => (
          <div
            key={label}
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              done
                ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {done ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function PeopleList() {
  const { toast } = useToast();

  const { data: people, isLoading } = useQuery<CompanyPerson[]>({
    queryKey: ["/api/company-people"],
  });

  const { data: readiness } = useQuery<ReadinessData>({
    queryKey: ["/api/company-people/readiness"],
  });

  const readinessMap = new Map<number, ReadinessData["people"][0]>();
  if (readiness) {
    for (const person of readiness.people) {
      if (typeof person.id === "number") {
        readinessMap.set(person.id, person);
      }
    }
  }

  const resendMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/company-people/resend-invite/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invitation resent", description: "A reminder email has been sent." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/company-people/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Person removed", description: "The person has been removed from your company." });
      queryClient.invalidateQueries({ queryKey: ["/api/company-people"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!people?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-lg mb-1">No directors or shareholders yet</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            Start by inviting the people who will serve as directors, shareholders, or company secretary for your company. Each person receives an email invitation to create their account and complete their profile.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "director": return "Director";
      case "shareholder": return "Shareholder";
      case "director_shareholder": return "Director & Shareholder";
      case "secretary": return "Company Secretary";
      default: return role;
    }
  };

  const getStatusBadge = (person: CompanyPerson) => {
    if (person.isVerified) {
      return <Badge variant="default" className="gap-1"><ShieldCheck className="h-3 w-3" /> Verified</Badge>;
    }
    if (person.inviteStatus === "accepted") {
      return <Badge variant="secondary" className="gap-1"><MailCheck className="h-3 w-3" /> Accepted</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
  };

  return (
    <div className="space-y-3">
      {people.map((person) => (
        <Card key={person.id} data-testid={`card-person-${person.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{person.inviteEmail}</span>
                  {getStatusBadge(person)}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="font-medium text-foreground">{getRoleLabel(person.role)}</span>
                  {person.title && <span>{person.title}</span>}
                  {person.sharesAllocated && (
                    <span className="flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      {person.sharesAllocated} shares ({person.sharePercentage || "—"}%)
                    </span>
                  )}
                  {person.shareClass && <span>{person.shareClass} shares</span>}
                </div>
                {readinessMap.has(person.id) && (
                  <ProfileChecklist person={readinessMap.get(person.id)!} />
                )}
              </div>
              <div className="flex items-center gap-1">
                {person.inviteStatus === "pending" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resendMutation.mutate(person.id)}
                    disabled={resendMutation.isPending}
                    data-testid={`button-resend-${person.id}`}
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" data-testid={`button-remove-${person.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove this person?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove {person.inviteEmail} as {getRoleLabel(person.role).toLowerCase()} from your company. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(person.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-300">
        <strong>How it works:</strong> Each person you invite receives an email with a link to create their Cellion One account. Once they sign up and complete their personal profile, they can be individually verified. A verification fee of NGN 10,000 per person applies and will be included in your checkout total. This covers BVN/NIN validation, document verification, biometric selfie matching, and AML screening.
      </div>
    </div>
  );
}
