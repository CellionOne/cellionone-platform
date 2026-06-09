import { useState, useEffect } from "react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Building2,
  LayoutDashboard,
  FileText,
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
  ShieldCheck,
  ShieldAlert,
  ClipboardCheck,
  Store,
  FileSearch,
  Gavel,
  FileSignature,
  Vault,
  Banknote,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ArrowLeftRight,
  TrendingUp,
  Info,
  LayoutGrid,
  MapPin,
  Hash,
  Shield,
  Landmark,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CelionLogo } from "@/components/celion-logo";
import { ModuleSwitcher } from "@/components/module-switcher";
import type { Intent } from "@/components/module-switcher";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  activeIntents: Intent[];
}

const founderGroups: NavGroup[] = [
  {
    label: "Incorporation",
    items: [
      { title: "My Applications", url: "/founder/applications", icon: FileText },
      { title: "Register Existing Company", url: "/founder/existing-company", icon: ClipboardCheck },
      { title: "My Registrations", url: "/founder/registrations", icon: ClipboardList },
      { title: "Directors & Shareholders", url: "/founder/company-people", icon: Users },
      { title: "Post-Inc Checklist", url: "/founder/post-inc-checklist", icon: ListChecks },
      { title: "Compliance Calendar", url: "/founder/compliance", icon: Calendar },
    ],
    activeIntents: ["founder_new_co", "founder_existing_co"],
  },
  {
    label: "Business Services",
    items: [
      { title: "Registered Office", url: "/founder/registered-office", icon: Building2 },
      { title: "Mail Handling", url: "/founder/mail", icon: Mail },
      { title: "Open Bank Account", url: "/founder/vault", icon: Landmark },
      { title: "Document Vault", url: "/founder/vault", icon: FolderOpen },
      { title: "Legal AI", url: "/founder/legal-assistant", icon: MessageSquare },
      { title: "Data Sharing", url: "/founder/data-sharing", icon: Share2 },
    ],
    activeIntents: ["founder_new_co", "founder_existing_co"],
  },
  {
    label: "Registration Services",
    items: [
      { title: "SCUML Registration", url: "/founder/registration-services?service=SCUML", icon: ShieldCheck },
      { title: "TIN Registration", url: "/founder/registration-services?service=TIN", icon: Hash },
      { title: "Trademark", url: "/founder/registration-services?service=TM", icon: Shield },
      { title: "Add a Director (CAC)", url: "/founder/registration-services?service=ADD_DIR", icon: UserPlus },
      { title: "My Service Orders", url: "/founder/orders", icon: Receipt },
    ],
    activeIntents: ["founder_reg_services"],
  },
  {
    label: "KYC & Verification",
    items: [
      { title: "KYC Service", url: "/kyc/orgs", icon: ShieldCheck },
      { title: "My Verifications", url: "/kyc/my-verifications", icon: ClipboardCheck },
    ],
    activeIntents: ["kyc_service"],
  },
  {
    label: "Procurement",
    items: [
      { title: "Marketplace", url: "/procurement/marketplace", icon: Store },
      { title: "My RFQs", url: "/procurement/my-rfqs", icon: FileSearch },
      { title: "My Bids", url: "/procurement/my-bids", icon: Gavel },
      { title: "Contracts", url: "/procurement/contracts", icon: FileSignature },
      { title: "Invoices", url: "/procurement/invoices", icon: Receipt },
    ],
    activeIntents: ["procurement"],
  },
];

const lawyerItems: NavItem[] = [
  { title: "Dashboard", url: "/lawyer/dashboard", icon: LayoutDashboard },
  { title: "Personal Profile", url: "/profile", icon: UserCircle },
  { title: "Assigned Cases", url: "/lawyer/applications", icon: Scale },
  { title: "Service Requests", url: "/lawyer/service-requests", icon: ClipboardList },
  { title: "Payouts", url: "/lawyer/payouts", icon: Wallet },
  { title: "Marketplace", url: "/procurement/marketplace", icon: Store },
  { title: "My RFQs", url: "/procurement/my-rfqs", icon: FileSearch },
  { title: "My Bids", url: "/procurement/my-bids", icon: Gavel },
  { title: "Contracts", url: "/procurement/contracts", icon: FileSignature },
  { title: "Invoices", url: "/procurement/invoices", icon: Receipt },
  { title: "KYC Service", url: "/kyc/orgs", icon: ShieldCheck },
  { title: "My Verifications", url: "/kyc/my-verifications", icon: ClipboardCheck },
  { title: "Settings", url: "/settings", icon: Settings },
];

const buildingManagerItems: NavItem[] = [
  { title: "Dashboard", url: "/building-manager/dashboard", icon: LayoutDashboard },
  { title: "Personal Profile", url: "/profile", icon: UserCircle },
  { title: "Utility Bill", url: "/building-manager/utility-bill", icon: FileText },
  { title: "Subscribers", url: "/building-manager/subscribers", icon: Users },
  { title: "Mail Intake", url: "/building-manager/mail-intake", icon: Mail },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "User Management",
    items: [
      { title: "Users", url: "/admin/users", icon: Users },
      { title: "Lawyer Applications", url: "/admin/lawyer-applications", icon: UserPlus },
    ],
  },
  {
    label: "Incorporation & KYC",
    items: [
      { title: "Applications", url: "/admin/applications", icon: FileText },
      { title: "Existing Companies", url: "/admin/existing-companies", icon: Building2 },
      { title: "KYC Oversight", url: "/admin/kyc", icon: ShieldCheck },
      { title: "Field Verifications", url: "/admin/field-verifications", icon: MapPin },
    ],
  },
  {
    label: "Business Services",
    items: [
      { title: "Registered Offices", url: "/admin/registered-offices", icon: Building2 },
      { title: "Mailroom", url: "/admin/mailroom", icon: Mail },
      { title: "Orders", url: "/admin/orders", icon: ShoppingCart },
      { title: "Proposals", url: "/admin/proposals", icon: FileText },
    ],
  },
  {
    label: "Financial & Escrow",
    items: [
      { title: "Receipts", url: "/admin/receipts", icon: Receipt },
      { title: "Escrow Dashboard", url: "/admin/escrow-dashboard", icon: Vault },
      { title: "Banking Partners", url: "/admin/banking-partners", icon: Banknote },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { title: "CIE Engine", url: "/admin/cie", icon: BarChart3 },
      { title: "Live Intelligence", url: "/admin/intelligence", icon: TrendingUp },
      { title: "AI Events", url: "/admin/ai-events", icon: Brain },
    ],
  },
  {
    label: "Platform Administration",
    items: [
      { title: "Feature Flags", url: "/admin/feature-flags", icon: Flag },
      { title: "Security", url: "/admin/security", icon: ShieldAlert },
      { title: "Audit Logs", url: "/admin/audit-logs", icon: ClipboardList },
    ],
  },
];

interface AppSidebarProps {
  role: "founder" | "lawyer" | "admin" | "building_manager";
}

function NavItemButton({ item, location }: { item: NavItem; location: string }) {
  const itemBasePath = item.url.split("?")[0];
  const locationBasePath = location.split("?")[0];
  const isActive =
    locationBasePath === itemBasePath ||
    locationBasePath.startsWith(itemBasePath + "/");

  return (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-").replace(/[()]/g, "")}`}
      >
        <Link href={item.url}>
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function FounderSidebar({ location, primaryIntent }: { location: string; primaryIntent: Intent | null }) {
  const coreItems: NavItem[] = [
    { title: "Dashboard", url: "/founder/dashboard", icon: LayoutDashboard },
    { title: "Personal Profile", url: "/profile", icon: UserCircle },
    { title: "Company Profile", url: "/founder/company-profile", icon: Briefcase },
  ];

  const accountItems: NavItem[] = [
    { title: "My Orders", url: "/founder/orders", icon: Receipt },
    { title: "Services & Checkout", url: "/founder/checkout", icon: ShoppingCart },
    { title: "Settings", url: "/settings", icon: Settings },
    { title: "Service Selection", url: "/welcome", icon: LayoutGrid },
  ];

  const computeOpenGroups = (intent: Intent | null) =>
    founderGroups.reduce<Record<string, boolean>>((acc, g) => {
      acc[g.label] = intent ? g.activeIntents.includes(intent) : false;
      return acc;
    }, {});

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () => computeOpenGroups(primaryIntent)
  );

  useEffect(() => {
    setOpenGroups(computeOpenGroups(primaryIntent));
  }, [primaryIntent]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Core</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {coreItems.map((item) => (
              <NavItemButton key={item.title} item={item} location={location} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {founderGroups.map((group) => {
        const isActive = primaryIntent ? group.activeIntents.includes(primaryIntent) : false;
        const isOpen = openGroups[group.label] ?? false;

        const founderIntents: Intent[] = ["founder_new_co", "founder_existing_co"];
        const showRequirementHint =
          !isActive &&
          primaryIntent &&
          founderIntents.includes(primaryIntent) &&
          (group.label === "KYC & Verification" || group.label === "Procurement");

        return (
          <Collapsible key={group.label} open={isOpen} onOpenChange={() => toggleGroup(group.label)}>
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel
                  className="cursor-pointer flex items-center justify-between hover:text-foreground transition-colors select-none"
                  data-testid={`group-${group.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span className={isActive ? "text-foreground font-medium" : "text-muted-foreground/70"}>{group.label}</span>
                  <div className="flex items-center gap-1 ml-auto">
                    {showRequirementHint && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-foreground"
                            data-testid={`hint-${group.label.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <Info className="h-3 w-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[200px] text-xs">
                          A verified company profile may be needed for full access to {group.label}.
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </div>
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <NavItemButton key={item.title} item={item} location={location} />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        );
      })}

      <SidebarGroup>
        <SidebarGroupLabel>Account</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {accountItems.map((item) => (
              <NavItemButton key={item.title} item={item} location={location} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
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
    </SidebarContent>
  );
}

function AdminSidebar({ location }: { location: string }) {
  const allGroupLabels = adminGroups.map((g) => g.label);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(allGroupLabels.map((l) => [l, true]))
  );

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <SidebarContent>
      {adminGroups.map((group) => {
        const isOpen = openGroups[group.label] ?? true;
        return (
          <Collapsible key={group.label} open={isOpen} onOpenChange={() => toggleGroup(group.label)}>
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  {group.label}
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <NavItemButton key={item.title} item={item} location={location} />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        );
      })}
    </SidebarContent>
  );
}

export function AppSidebar({ role }: AppSidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [showModuleSwitcher, setShowModuleSwitcher] = useState(false);

  const primaryIntent = (user?.primaryIntent as Intent) || null;
  const roleLabel =
    role === "founder"
      ? "Founder Portal"
      : role === "lawyer"
        ? "Lawyer Portal"
        : role === "building_manager"
          ? "Building Manager"
          : "Admin Portal";

  const nonFounderItems =
    role === "lawyer"
      ? lawyerItems
      : buildingManagerItems;

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) return user.email[0].toUpperCase();
    return "U";
  };

  const getUserName = () => {
    if (user?.firstName && user?.lastName) return `${user.firstName} ${user.lastName}`;
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

        {role === "founder" && (
          <div className="mt-2">
            <button
              onClick={() => setShowModuleSwitcher((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded"
              data-testid="button-switch-module"
            >
              <ArrowLeftRight className="h-3 w-3" />
              {showModuleSwitcher ? "Close service selector" : "Switch service"}
            </button>

            {showModuleSwitcher && (
              <div className="mt-2 border rounded-lg p-2 bg-background">
                <ModuleSwitcher
                  compact
                  onSwitch={() => setShowModuleSwitcher(false)}
                />
              </div>
            )}
          </div>
        )}
      </SidebarHeader>

      {role === "founder" ? (
        <FounderSidebar location={location} primaryIntent={primaryIntent} />
      ) : role === "admin" ? (
        <AdminSidebar location={location} />
      ) : (
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nonFounderItems.map((item) => (
                  <NavItemButton key={item.title} item={item} location={location} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      )}

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
