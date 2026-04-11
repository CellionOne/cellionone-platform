import { useQuery } from "@tanstack/react-query";
import { useSearch, Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  ShieldCheck,
  Hash,
  Shield,
  UserPlus,
  ArrowRight,
  Info,
  Users,
  Clock,
  CheckCircle2,
} from "lucide-react";

interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  priceNgn: number;
  requiresManualPricing: boolean | null;
  metadata: Record<string, unknown> | null;
}

function formatNgn(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

const SERVICE_CONFIG: {
  sku: string;
  icon: React.ElementType;
  title: string;
  description: string;
  benefit: string;
  advisory: string | null;
  cac_note?: string;
}[] = [
  {
    sku: "SCUML",
    icon: ShieldCheck,
    title: "SCUML Registration",
    description:
      "Special Control Unit Against Money Laundering (SCUML) certificate from the EFCC. Required for Designated Non-Financial Businesses and Professions (DNFBPs) — including real estate agents, dealers in luxury goods, hotels, casinos, law firms, accounting firms, and non-profit organisations.",
    benefit: "Ready in 5 business days",
    advisory:
      "You can apply for SCUML directly with the EFCC at no cost. Our fee covers professional handling, consistent follow-up, and expedited processing on your behalf.",
    cac_note: undefined,
  },
  {
    sku: "TIN",
    icon: Hash,
    title: "TIN Registration",
    description:
      "Get your Tax Identification Number (TIN) from the Federal Inland Revenue Service (FIRS). A TIN is required for opening a corporate bank account, filing tax returns, and most government transactions.",
    benefit: "Required for corporate bank account",
    advisory:
      "You can apply for a TIN directly with FIRS at no cost. Our fee covers professional handling and expedited processing — avoiding the lengthy queues and back-and-forth.",
    cac_note: undefined,
  },
  {
    sku: "TM",
    icon: Shield,
    title: "Trademark Registration",
    description:
      "Protect your brand name, logo, or slogan with a registered trademark at the Trademarks, Patents and Designs Registry. Covers both Stage 1 (filing) and Stage 2 (grant) of the trademark process.",
    benefit: "Full brand name protection",
    advisory: null,
    cac_note: undefined,
  },
  {
    sku: "ADD_DIR",
    icon: UserPlus,
    title: "Add a Director (CAC Filing)",
    description:
      "Formally appoint a new director at the Corporate Affairs Commission. Includes Form CAC 7 preparation, board resolution drafting, and all CAC correspondence handled by our lawyers.",
    benefit: "CAC-registered within 10 business days",
    advisory:
      "Filing with the CAC requires accurate documentation including Form CAC 7, a board resolution, and the new director's personal details. Our lawyers handle all CAC correspondence on your behalf.",
    cac_note:
      "This is a formal CAC statutory filing — it registers the director with the government. If you only want to add someone to your company profile on Cellion One for internal management and KYC, use Directors & Shareholders instead.",
  },
];

export default function RegistrationServicesPage() {
  const search = useSearch();
  const highlightSku = new URLSearchParams(search).get("service");

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const getProduct = (sku: string) => products?.find((p) => p.sku === sku);

  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[
        { label: "Dashboard", href: "/founder/dashboard" },
        { label: "Registration & Statutory Services" },
      ]}
    >
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-reg-services-title">
            Registration & Statutory Services
          </h1>
          <p className="text-muted-foreground mt-1">
            Government registrations and statutory filings handled by our lawyers on your behalf. Select a service to get started.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="space-y-4">
            {SERVICE_CONFIG.map(({ sku, icon: Icon, title, description, benefit, advisory, cac_note }) => {
              const product = getProduct(sku);
              const isHighlighted = highlightSku === sku;

              return (
                <Card
                  key={sku}
                  className={isHighlighted ? "border-primary ring-1 ring-primary/30" : ""}
                  data-testid={`card-service-${sku.toLowerCase()}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{title}</CardTitle>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {benefit}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {product ? (
                          product.requiresManualPricing ? (
                            <p className="text-sm font-semibold text-muted-foreground">Custom pricing</p>
                          ) : (
                            <p className="text-lg font-bold text-primary">{formatNgn(product.priceNgn)}</p>
                          )
                        ) : (
                          <p className="text-sm text-muted-foreground">—</p>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <CardDescription className="text-sm text-foreground/80 leading-relaxed">
                      {description}
                    </CardDescription>

                    {cac_note && (
                      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20">
                        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                          <strong>Note:</strong> {cac_note}{" "}
                          <Link href="/founder/company-people" className="underline font-medium">
                            Go to Directors & Shareholders →
                          </Link>
                        </AlertDescription>
                      </Alert>
                    )}

                    {advisory && (
                      <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-3">
                        {advisory}
                      </p>
                    )}

                    <div className="flex justify-end pt-1">
                      <Button
                        asChild
                        size="sm"
                        data-testid={`button-start-service-${sku.toLowerCase()}`}
                      >
                        <Link href={`/founder/checkout?initSkus=${sku}`}>
                          Get Started
                          <ArrowRight className="h-4 w-4 ml-1.5" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 py-4">
            <Users className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Already have your company incorporated?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Switch to{" "}
                <Link href="/welcome" className="text-primary underline">
                  Manage an Existing Company
                </Link>{" "}
                to access compliance tools, document vault, and bank account opening.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            All services are handled by registered Nigerian lawyers and compliance professionals. You will be contacted within 1 business day of payment to begin the process.
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}
