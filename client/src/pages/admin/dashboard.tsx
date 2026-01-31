import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useAuth } from "@/hooks/use-auth";
import {
  Users,
  FileText,
  Scale,
  Flag,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface AdminDashboardData {
  stats: {
    totalUsers: number;
    totalApplications: number;
    totalLawyers: number;
    activeApplications: number;
    completedApplications: number;
    pendingReview: number;
  };
  recentActivity: {
    id: number;
    action: string;
    entityType: string;
    createdAt: string;
  }[];
}

export default function AdminDashboard() {
  const { user } = useAuth();
  
  const { data, isLoading } = useQuery<AdminDashboardData>({
    queryKey: ["/api/admin/dashboard"],
  });

  return (
    <DashboardLayout role="admin" breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of platform activity and metrics
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Users
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data?.stats?.totalUsers || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active Lawyers
                  </CardTitle>
                  <Scale className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data?.stats?.totalLawyers || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Applications
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data?.stats?.totalApplications || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pending Review
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data?.stats?.pendingReview || 0}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <Button variant="outline" className="justify-start" asChild>
                    <Link href="/admin/users">
                      <Users className="h-4 w-4 mr-2" />
                      Manage Users
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </Link>
                  </Button>
                  <Button variant="outline" className="justify-start" asChild>
                    <Link href="/admin/applications">
                      <FileText className="h-4 w-4 mr-2" />
                      View Applications
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </Link>
                  </Button>
                  <Button variant="outline" className="justify-start" asChild>
                    <Link href="/admin/feature-flags">
                      <Flag className="h-4 w-4 mr-2" />
                      Feature Flags
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Platform Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Completed This Month</span>
                    </div>
                    <span className="font-semibold">{data?.stats?.completedApplications || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm">Active Applications</span>
                    </div>
                    <span className="font-semibold">{data?.stats?.activeApplications || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Completion Rate</span>
                    </div>
                    <span className="font-semibold">
                      {data?.stats?.totalApplications 
                        ? Math.round((data.stats.completedApplications / data.stats.totalApplications) * 100)
                        : 0}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
