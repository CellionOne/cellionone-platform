import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Building2,
  LayoutDashboard,
  FileText,
  User,
  UserCircle,
  FolderOpen,
  Settings,
  Users,
  Flag,
  ClipboardList,
  LogOut,
  Wallet,
  Scale,
  Brain,
  Receipt,
  UserPlus,
  Mail,
  MessageSquare,
  Calendar,
  ListChecks,
  Briefcase,
  ShoppingCart,
  Share2,
} from "lucide-react";
import { CelionLogo } from "@/components/celion-logo";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

const founderItems: NavItem[] = [
  { title: "Dashboard", url: "/founder/dashboard", icon: LayoutDashboard },
  { title: "Personal Profile", url: "/profile", icon: UserCircle },
  { title: "Identity Verification", url: "/founder/identity", icon: User },
  { title: "Directors & Shareholders", url: "/founder/company-people", icon: Users },
  { title: "My Applications", url: "/founder/applications", icon: FileText },
  { title: "My Orders", url: "/founder/orders", icon: Receipt },
  { title: "Company Profile", url: "/founder/company-profile", icon: Briefcase },
  { title: "Checklist", url: "/founder/post-inc-checklist", icon: ListChecks },
  { title: "Compliance Calendar", url: "/founder/compliance", icon: Calendar },
  { title: "Document Vault", url: "/founder/vault", icon: FolderOpen },
  { title: "Registered Office", url: "/founder/registered-office", icon: Building2 },
  { title: "Mail Handling", url: "/founder/mail", icon: Mail },
  { title: "Legal AI", url: "/founder/legal-assistant", icon: MessageSquare },
  { title: "Data Sharing", url: "/founder/data-sharing", icon: Share2 },
  { title: "Services & Checkout", url: "/founder/checkout", icon: ShoppingCart },
  { title: "Settings", url: "/settings", icon: Settings },
];

const lawyerItems: NavItem[] = [
  { title: "Dashboard", url: "/lawyer/dashboard", icon: LayoutDashboard },
  { title: "Personal Profile", url: "/profile", icon: UserCircle },
  { title: "Assigned Cases", url: "/lawyer/applications", icon: Scale },
  { title: "Service Requests", url: "/lawyer/service-requests", icon: ClipboardList },
  { title: "Payouts", url: "/lawyer/payouts", icon: Wallet },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminItems: NavItem[] = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Personal Profile", url: "/profile", icon: UserCircle },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Applications", url: "/admin/applications", icon: FileText },
  { title: "Lawyer Applications", url: "/admin/lawyer-applications", icon: UserPlus },
  { title: "Mailroom", url: "/admin/mailroom", icon: Mail },
  { title: "Receipts", url: "/admin/receipts", icon: Receipt },
  { title: "AI Events", url: "/admin/ai-events", icon: Brain },
  { title: "Feature Flags", url: "/admin/feature-flags", icon: Flag },
  { title: "Orders", url: "/admin/orders", icon: ShoppingCart },
  { title: "Audit Logs", url: "/admin/audit-logs", icon: ClipboardList },
  { title: "Settings", url: "/settings", icon: Settings },
];

interface AppSidebarProps {
  role: "founder" | "lawyer" | "admin";
}

export function AppSidebar({ role }: AppSidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const items = role === "founder" ? founderItems : role === "lawyer" ? lawyerItems : adminItems;
  const roleLabel = role === "founder" ? "Founder Portal" : role === "lawyer" ? "Lawyer Portal" : "Admin Portal";

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const getUserName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.email || "User";
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2 hover-elevate rounded-md p-2 -m-2">
          <div>
            <CelionLogo textClassName="font-bold text-lg" />
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url || location.startsWith(item.url + "/")}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === "founder" && (
          <SidebarGroup>
            <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2">
                <Button asChild className="w-full" data-testid="button-new-application">
                  <Link href="/applications/new">
                    <FileText className="h-4 w-4 mr-2" />
                    New Application
                  </Link>
                </Button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{getUserName()}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
