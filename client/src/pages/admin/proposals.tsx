import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { FileText, Printer, ArrowLeft, Building2 } from "lucide-react";

interface Proposal {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  htmlEndpoint: string;
}

const proposals: Proposal[] = [
  {
    id: "bank-partnership",
    title: "Bank Partnership Proposal",
    description: "A comprehensive partnership proposal for banking institutions, outlining Celion's services and collaboration opportunities.",
    icon: Building2,
    htmlEndpoint: "/api/admin/proposals/bank-partnership/html",
  },
];

export default function AdminProposals() {
  const [activeProposal, setActiveProposal] = useState<Proposal | null>(null);
  const [proposalHtml, setProposalHtml] = useState<string>("");
  const [isLoadingHtml, setIsLoadingHtml] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleViewProposal = async (proposal: Proposal) => {
    setIsLoadingHtml(true);
    setLoadError(null);
    try {
      const res = await fetch(proposal.htmlEndpoint, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load proposal");
      const html = await res.text();
      setProposalHtml(html);
      setActiveProposal(proposal);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load proposal");
    } finally {
      setIsLoadingHtml(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    setActiveProposal(null);
    setProposalHtml("");
    setLoadError(null);
  };

  if (activeProposal) {
    return (
      <DashboardLayout role="admin" breadcrumbs={[{ label: "Proposals", href: "/admin/proposals" }, { label: activeProposal.title }]}>
        <div className="space-y-4 print-hide-controls">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleBack}
              data-testid="button-back-to-proposals"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to list
            </Button>
            <Button
              onClick={handlePrint}
              data-testid="button-print-proposal"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print / Save as PDF
            </Button>
          </div>
        </div>
        <div
          className="mt-4 proposal-content"
          data-testid="container-proposal-html"
          dangerouslySetInnerHTML={{ __html: proposalHtml }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin" breadcrumbs={[{ label: "Proposals" }]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-proposals-title">Proposals</h1>
          <p className="text-muted-foreground mt-1">
            View and print partnership proposals and documents.
          </p>
        </div>

        {isLoadingHtml && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {loadError && (
          <Card>
            <CardContent className="p-6 text-center text-destructive" data-testid="text-proposal-error">
              {loadError}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {proposals.map((proposal) => (
            <Card key={proposal.id} data-testid={`card-proposal-${proposal.id}`}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10">
                    <proposal.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base" data-testid={`text-proposal-title-${proposal.id}`}>
                      {proposal.title}
                    </CardTitle>
                  </div>
                </div>
                <CardDescription className="mt-2" data-testid={`text-proposal-desc-${proposal.id}`}>
                  {proposal.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={() => handleViewProposal(proposal)}
                  disabled={isLoadingHtml}
                  data-testid={`button-view-proposal-${proposal.id}`}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Proposal
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
