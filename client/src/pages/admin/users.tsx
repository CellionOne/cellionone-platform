import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Users,
  UserPlus,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "@shared/models/auth";

interface UserWithRole extends User {
  roles: string[];
}

export default function AdminUsers() {
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<UserWithRole[]>({
    queryKey: ["/api/admin/users"],
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, role, action }: { userId: string; role: string; action: "add" | "remove" }) => {
      return apiRequest("POST", `/api/admin/users/${userId}/roles`, { role, action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User role updated" });
    },
    onError: () => {
      toast({ title: "Failed to update role", variant: "destructive" });
    },
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "lawyer": return "secondary";
      default: return "outline";
    }
  };

  return (
    <DashboardLayout 
      role="admin" 
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Users" }]}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-muted-foreground">
              Manage platform users and their roles
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !users?.length ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description="Users will appear here once they sign up."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {users.map((user) => (
                  <div 
                    key={user.id} 
                    className="flex items-center justify-between p-4"
                    data-testid={`user-row-${user.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={user.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {user.firstName?.[0] || user.email?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}`
                            : user.email || "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {user.roles?.map((role) => (
                          <Badge key={role} variant={getRoleBadgeVariant(role) as any}>
                            {role}
                          </Badge>
                        ))}
                        {(!user.roles || user.roles.length === 0) && (
                          <Badge variant="outline">founder</Badge>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!user.roles?.includes("lawyer") && (
                            <DropdownMenuItem
                              onClick={() => toggleRoleMutation.mutate({ 
                                userId: user.id, 
                                role: "lawyer", 
                                action: "add" 
                              })}
                            >
                              Make Lawyer
                            </DropdownMenuItem>
                          )}
                          {user.roles?.includes("lawyer") && (
                            <DropdownMenuItem
                              onClick={() => toggleRoleMutation.mutate({ 
                                userId: user.id, 
                                role: "lawyer", 
                                action: "remove" 
                              })}
                            >
                              Remove Lawyer Role
                            </DropdownMenuItem>
                          )}
                          {!user.roles?.includes("admin") && (
                            <DropdownMenuItem
                              onClick={() => toggleRoleMutation.mutate({ 
                                userId: user.id, 
                                role: "admin", 
                                action: "add" 
                              })}
                            >
                              Make Admin
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
