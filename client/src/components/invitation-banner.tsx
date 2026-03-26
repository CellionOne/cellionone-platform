import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";
import { ShieldCheck, ArrowRight, CheckCircle2, Building2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Invitation {
  id: number;
  founderId: string;
  inviteEmail: string;
  inviteStatus: string;
  role: string;
  title?: string;
  personUserId?: string;
  founderName?: string | null;
  companyName?: string | null;
}

interface PersonalProfileData {
  profileCompletion?: number;
  isProfileComplete?: boolean;
  isIdentityVerified?: boolean;
}

function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function InvitationBanner() {
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
  const isIdentityVerified = profile?.isIdentityVerified ?? false;

  if (acceptedInvitations.length === 0) return null;

  return (
    <div className="space-y-4" data-testid="invitation-banner">
      {acceptedInvitations.map((inv) => {
        const companyLabel = inv.companyName ? `"${inv.companyName}"` : "a company";
        const founderLabel = inv.founderName ? `${inv.founderName}` : "A founder";

        return (
          <Card key={inv.id} className="border-primary/30 bg-primary/5" data-testid={`invitation-card-${inv.id}`}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-role-${inv.id}`}>
                        {formatRole(inv.role)}
                      </Badge>
                      <Badge variant="default" className="bg-green-600 text-xs">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Accepted
                      </Badge>
                    </div>
                    <p className="text-sm font-medium mt-1">
                      {founderLabel} has added you as a {formatRole(inv.role)} for {companyLabel}.
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Complete your profile and verify your identity so the founder can proceed with incorporation.
                    </p>
                  </div>

                  {!isProfileComplete && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Profile completion</span>
                        <span className="font-medium">{profileCompletion}%</span>
                      </div>
                      <Progress value={profileCompletion} className="h-1.5" data-testid="progress-profile-completion" />
                      <Link href="/profile">
                        <Button size="sm" className="w-full mt-1" data-testid="button-complete-profile-banner">
                          Complete Your Profile
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  )}

                  {isProfileComplete && !isIdentityVerified && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Your profile is complete. The next step is to verify your identity.
                      </p>
                      <Link href="/founder/identity">
                        <Button size="sm" variant="outline" className="w-full border-primary/40 text-primary" data-testid="button-verify-identity-banner">
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                          Verify Your Identity
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  )}

                  {isProfileComplete && isIdentityVerified && (
                    <Alert className="bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <AlertDescription className="text-green-700 dark:text-green-400 text-xs">
                        Your profile and identity verification are complete. The founder has been notified.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
