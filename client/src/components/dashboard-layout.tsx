import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { ThemeToggle } from "./theme-toggle";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: "founder" | "lawyer" | "admin";
  breadcrumbs?: { label: string; href?: string }[];
}

export function DashboardLayout({ children, role, breadcrumbs = [] }: DashboardLayoutProps) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar role={role} />
        <SidebarInset className="flex-1 flex flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" data-testid="button-sidebar-toggle" />
              <Separator orientation="vertical" className="h-4" />
              {breadcrumbs.length > 0 && (
                <Breadcrumb>
                  <BreadcrumbList>
                    {breadcrumbs.map((crumb, index) => (
                      <BreadcrumbItem key={index}>
                        {index > 0 && <BreadcrumbSeparator />}
                        {crumb.href ? (
                          <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    ))}
                  </BreadcrumbList>
                </Breadcrumb>
              )}
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
