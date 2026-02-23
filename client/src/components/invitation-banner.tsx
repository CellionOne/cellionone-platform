import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { UserPlus, ArrowRight, CheckCircle2, Loader2, Users, ClipboardList } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Invitation {
  id: number;
  founderId: string;
  inviteEmail: string;
  inviteStatus: string;
  role: string;
  title?: string;
  personUserId?: string;
  founderName?: string;
}

interface PersonalProfileData {
  profileCompletion?: number;
  isProfileComplete?: boolean;
}

function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function InvitationBanner() {
  const { toast } = useToast();

  const { data: invitations, isLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/company-people/my-invitations"],
  });

  const { data: profile } = useQuery<PersonalProfileData>({
    queryKey: ["/api/profile/personal"],
  });

  if (isLoading || !invitations || invitations.length === 0) return null;

  const acceptedInvitations = invitations.filter(i => i.inviteStatus === "accepted");
  const profileCompletion = profile?.profileCompletion ?? 0;
  const isProfileComplete = profile?.isProfileComplete ?? false;

  if (acceptedInvitations.length === 0) return null;

  return (
    <div className="space-y-4" data-testid="invitation-banner">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-sm">Your Company Roles</h3>
                <p className="text-sm text-muted-foreground">
                  You've been added to the following company roles. Complete your profile so the founder can proceed with their application.
                </p>
              </div>

              <div className="space-y-2">
                {acceptedInvitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-2 rounded-md bg-background" data-testid={`invitation-row-${inv.id}`}>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{formatRole(inv.role)}</Badge>
                      {inv.title && <span className="text-xs text-muted-foreground">{inv.title}</span>}
                    </div>
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Accepted
                    </Badge>
                  </div>
                ))}
              </div>

              {!isProfileComplete && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Profile completion</span>
                    <span className="font-medium">{profileCompletion}%</span>
                  </div>
                  <Progress value={profileCompletion} className="h-2" />
                  <Link href="/profile">
                    <Button size="sm" className="w-full mt-2" data-testid="button-complete-profile-banner">
                      <ClipboardList className="h-4 w-4 mr-1" />
                      Complete Your Profile
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              )}

              {isProfileComplete && (
                <Alert className="bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    Your profile is complete. The founder has been notified.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
