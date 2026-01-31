import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import {
  Receipt,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
} from "lucide-react";

interface VerificationReceipt {
  id: number;
  receiptNumber: string;
  applicationId: number;
  paymentId: number | null;
  amount: number;
  currency: string;
  receiptType: string;
  issuedAt: string;
  revokedAt: string | null;
  hash: string;
}

interface ReceiptsListProps {
  applicationId?: number;
  showVerifyLink?: boolean;
}

export function ReceiptsList({ applicationId, showVerifyLink = true }: ReceiptsListProps) {
  const queryKey = applicationId 
    ? [`/api/applications/${applicationId}/receipts`]
    : ["/api/founder/receipts"];
    
  const { data: receipts, isLoading } = useQuery<VerificationReceipt[]>({
    queryKey,
  });

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
    }).format(amount / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getReceiptTypeLabel = (type: string) => {
    switch (type) {
      case "payment":
        return "Payment Receipt";
      case "filing":
        return "Filing Confirmation";
      case "completion":
        return "Completion Certificate";
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!receipts?.length) {
    return (
      <EmptyState
        icon={Receipt}
        title="No receipts yet"
        description="Receipts will appear here after successful payments or filings."
      />
    );
  }

  return (
    <div className="space-y-4" data-testid="receipts-list">
      {receipts.map((receipt) => (
        <Card 
          key={receipt.id} 
          className={receipt.revokedAt ? "opacity-60" : ""}
          data-testid={`receipt-card-${receipt.id}`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">
                      {receipt.receiptNumber}
                    </span>
                    {receipt.revokedAt ? (
                      <Badge variant="destructive" className="text-xs">
                        <XCircle className="h-3 w-3 mr-1" />
                        Revoked
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Valid
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getReceiptTypeLabel(receipt.receiptType)}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="font-semibold text-foreground">
                      {formatCurrency(receipt.amount, receipt.currency)}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDate(receipt.issuedAt)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {showVerifyLink && !receipt.revokedAt && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    asChild
                    data-testid={`button-verify-${receipt.id}`}
                  >
                    <a 
                      href={`/verify/${receipt.receiptNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Verify
                    </a>
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  asChild
                  data-testid={`button-download-${receipt.id}`}
                >
                  <a href={`/api/receipts/${receipt.id}/download`} download>
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
            {receipt.hash && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  SHA-256: <span className="font-mono">{receipt.hash.substring(0, 32)}...</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
