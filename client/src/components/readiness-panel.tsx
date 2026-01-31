import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  FileCheck,
  User,
  CreditCard,
  Building2,
  FileText,
} from "lucide-react";

interface ReadinessData {
  score: number;
  checklist: {
    key: string;
    label: string;
    status: "complete" | "incomplete" | "warning";
    message?: string;
  }[];
}

interface ReadinessPanelProps {
  applicationId: number;
}

const checklistIcons: Record<string, React.ElementType> = {
  identity_verified: User,
  company_info_complete: Building2,
  documents_uploaded: FileText,
  documents_verified: FileCheck,
  payment_complete: CreditCard,
};

export function ReadinessPanel({ applicationId }: ReadinessPanelProps) {
  const { data, isLoading } = useQuery<ReadinessData>({
    queryKey: [`/api/applications/${applicationId}/readiness`],
    enabled: !!applicationId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Card data-testid="readiness-panel">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Application Readiness</CardTitle>
            <CardDescription>Track your progress toward submission</CardDescription>
          </div>
          <div className="text-right">
            <span className={`text-3xl font-bold ${getScoreColor(data.score)}`}>
              {data.score}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress 
          value={data.score} 
          className="h-2" 
          data-testid="readiness-progress"
        />

        <div className="space-y-2">
          {data.checklist.map((item) => {
            const Icon = checklistIcons[item.key] || FileText;
            return (
              <div 
                key={item.key}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                data-testid={`checklist-item-${item.key}`}
              >
                <div className="shrink-0">
                  {getStatusIcon(item.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {item.message && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {item.message}
                    </p>
                  )}
                </div>
                {item.status === "complete" && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Done
                  </Badge>
                )}
                {item.status === "warning" && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    Attention
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {data.score === 100 && (
          <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm">
            Your application is ready for submission.
          </div>
        )}

        {data.score < 100 && data.score >= 50 && (
          <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-sm">
            Complete the remaining items to submit your application.
          </div>
        )}

        {data.score < 50 && (
          <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            Several items need your attention before submission.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
