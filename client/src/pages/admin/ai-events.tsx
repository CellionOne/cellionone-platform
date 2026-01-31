import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  Search,
  Filter,
  Sparkles,
} from "lucide-react";
import type { ApplicationAIEvent } from "@shared/schema";

export default function AdminAIEvents() {
  const [searchQuery, setSearchQuery] = useState("");
  const [featureFilter, setFeatureFilter] = useState<string>("all");

  const { data: events, isLoading } = useQuery<ApplicationAIEvent[]>({
    queryKey: ["/api/admin/ai-events"],
  });

  const filteredEvents = events?.filter((event) => {
    const matchesSearch = !searchQuery || 
      event.feature?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.applicationId?.toString().includes(searchQuery) ||
      event.actorUserId?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFeature = featureFilter === "all" || event.feature === featureFilter;
    return matchesSearch && matchesFeature;
  });

  const features = events ? Array.from(new Set(events.map(e => e.feature))) : [];

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFeatureLabel = (feature: string) => {
    const labels: Record<string, string> = {
      cac_activity_mapping: "CAC Activity Mapping",
      clarification_generator: "Clarification Generator",
      readiness_explainer: "Readiness Explainer",
      doc_quality: "Document Quality Check",
    };
    return labels[feature] || feature.split("_").map(w => 
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(" ");
  };

  const getFeatureBadgeColor = (feature: string): "default" | "secondary" | "outline" => {
    const colors: Record<string, "default" | "secondary" | "outline"> = {
      cac_activity_mapping: "default",
      clarification_generator: "secondary",
      readiness_explainer: "outline",
      doc_quality: "secondary",
    };
    return colors[feature] || "outline";
  };

  return (
    <DashboardLayout 
      role="admin" 
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "AI Events" }]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">AI Events Log</h1>
          <p className="text-muted-foreground">
            Track all AI-powered operations and their outcomes
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by feature, application ID, or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={featureFilter} onValueChange={setFeatureFilter}>
            <SelectTrigger className="w-full sm:w-52" data-testid="select-feature-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Feature" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Features</SelectItem>
              {features.map((feature) => (
                <SelectItem key={feature} value={feature}>
                  {getFeatureLabel(feature)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !filteredEvents?.length ? (
          <EmptyState
            icon={Brain}
            title="No AI events found"
            description="AI-powered operations will be logged here for tracking and auditing."
          />
        ) : (
          <div className="grid gap-4">
            {filteredEvents.map((event) => (
              <Card key={event.id} data-testid={`ai-event-${event.id}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Brain className="h-6 w-6 text-primary" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">
                            {getFeatureLabel(event.feature)}
                          </h3>
                          <Badge variant={getFeatureBadgeColor(event.feature)}>
                            {event.feature}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span>Application #{event.applicationId}</span>
                          {event.model && (
                            <>
                              <span> &bull; </span>
                              <span className="font-mono text-xs">{event.model}</span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span>User: {event.actorUserId.slice(0, 8)}...</span>
                          {event.promptVersion && (
                            <>
                              <span> &bull; </span>
                              <span>v{event.promptVersion}</span>
                            </>
                          )}
                        </div>
                        {event.outputJson && (
                          <details className="mt-2">
                            <summary className="text-sm text-primary cursor-pointer">
                              View Output
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded-md text-xs overflow-x-auto max-h-40">
                              {JSON.stringify(event.outputJson, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:shrink-0 text-sm text-muted-foreground">
                      <Sparkles className="h-4 w-4" />
                      <span>{formatDate(event.createdAt)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
