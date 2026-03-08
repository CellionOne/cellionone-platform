import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Save,
  Send,
  FileText,
  Package,
  DollarSign,
  ClipboardList,
  Eye,
} from "lucide-react";
import type { RfqCategory, KycOrganisation } from "@shared/schema";

interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  specifications: string;
}

const STEPS = [
  { id: "basic", label: "Basic Info", icon: FileText },
  { id: "items", label: "Line Items", icon: Package },
  { id: "budget", label: "Budget & Deadlines", icon: DollarSign },
  { id: "requirements", label: "Requirements", icon: ClipboardList },
  { id: "review", label: "Review & Publish", icon: Eye },
];

function formatKobo(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return "N/A";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

export default function CreateRfqPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [visibility, setVisibility] = useState("open");
  const [buyerOrgId, setBuyerOrgId] = useState<string>("");

  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unit: "units", specifications: "" },
  ]);

  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deliveryDeadline, setDeliveryDeadline] = useState("");

  const [requirements, setRequirements] = useState("");
  const [qualifications, setQualifications] = useState("");

  const { data: categories = [] } = useQuery<RfqCategory[]>({
    queryKey: ["/api/procurement/categories"],
  });

  const { data: orgs = [], isLoading: orgsLoading } = useQuery<KycOrganisation[]>({
    queryKey: ["/api/kyc-service/organisations"],
  });

  const createMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      const validItems = items.filter((i) => i.description.trim());
      const payload: any = {
        title,
        description,
        buyerOrgId: parseInt(buyerOrgId),
        visibility,
        deadline: new Date(deadline).toISOString(),
        items: validItems.length > 0 ? validItems : undefined,
      };
      if (categoryId) payload.categoryId = parseInt(categoryId);
      if (budgetMin) payload.budgetMin = Math.round(parseFloat(budgetMin) * 100);
      if (budgetMax) payload.budgetMax = Math.round(parseFloat(budgetMax) * 100);
      if (deliveryDeadline) payload.deliveryDeadline = new Date(deliveryDeadline).toISOString();
      if (requirements) payload.requirements = requirements;
      if (qualifications) payload.qualifications = qualifications;

      const res = await apiRequest("POST", "/api/procurement/rfqs", payload);
      const rfq = await res.json();

      if (publish) {
        await apiRequest("POST", `/api/procurement/rfqs/${rfq.id}/publish`);
      }
      return rfq;
    },
    onSuccess: (rfq) => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/rfqs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/marketplace"] });
      toast({ title: "RFQ created successfully" });
      navigate(`/procurement/rfqs/${rfq.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create RFQ", description: error.message, variant: "destructive" });
    },
  });

  function addItem() {
    setItems([...items, { description: "", quantity: 1, unit: "units", specifications: "" }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  }

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return !!title.trim() && !!description.trim() && !!buyerOrgId;
      case 1:
        return items.some((i) => i.description.trim());
      case 2:
        return !!deadline;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  }

  if (orgsLoading) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement" }, { label: "Create RFQ" }]}>
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement", href: "/procurement/my-rfqs" }, { label: "Create RFQ" }]}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-create-rfq-title">Create RFQ</h1>
          <p className="text-muted-foreground text-sm mt-1">Create a new Request for Quotation</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => i <= step && setStep(i)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : i < step
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                }`}
                disabled={i > step}
                data-testid={`step-${s.id}`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
            );
          })}
        </div>

        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Provide the core details for your RFQ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Organisation</Label>
                <Select value={buyerOrgId} onValueChange={setBuyerOrgId}>
                  <SelectTrigger data-testid="select-buyer-org">
                    <SelectValue placeholder="Select organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((org) => (
                      <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Supply of Office Furniture"
                  data-testid="input-rfq-title"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you need in detail..."
                  rows={4}
                  data-testid="input-rfq-description"
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger data-testid="select-rfq-category">
                    <SelectValue placeholder="Select category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger data-testid="select-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open - Any supplier can bid</SelectItem>
                    <SelectItem value="invited">Invited - Only invited suppliers can bid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Line Items</CardTitle>
                  <CardDescription>Add items or services you need quotes for</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addItem} data-testid="button-add-item">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="rounded-md border p-4 space-y-3" data-testid={`item-row-${index}`}>
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline">Item {index + 1}</Badge>
                    {items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        data-testid={`button-remove-item-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      placeholder="Item description"
                      data-testid={`input-item-description-${index}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                        data-testid={`input-item-quantity-${index}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Select value={item.unit} onValueChange={(v) => updateItem(index, "unit", v)}>
                        <SelectTrigger data-testid={`select-item-unit-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="units">Units</SelectItem>
                          <SelectItem value="pieces">Pieces</SelectItem>
                          <SelectItem value="kg">Kilograms</SelectItem>
                          <SelectItem value="liters">Liters</SelectItem>
                          <SelectItem value="meters">Meters</SelectItem>
                          <SelectItem value="sets">Sets</SelectItem>
                          <SelectItem value="lots">Lots</SelectItem>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="days">Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Specifications (optional)</Label>
                    <Textarea
                      value={item.specifications}
                      onChange={(e) => updateItem(index, "specifications", e.target.value)}
                      placeholder="Technical specifications or requirements"
                      rows={2}
                      data-testid={`input-item-specs-${index}`}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Budget & Deadlines</CardTitle>
              <CardDescription>Set your budget range and submission deadline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Budget Min (NGN)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    placeholder="0.00"
                    data-testid="input-budget-min"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Budget Max (NGN)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    placeholder="0.00"
                    data-testid="input-budget-max"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Submission Deadline</Label>
                <Input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  data-testid="input-deadline"
                />
              </div>
              <div className="space-y-2">
                <Label>Delivery Deadline (optional)</Label>
                <Input
                  type="datetime-local"
                  value={deliveryDeadline}
                  onChange={(e) => setDeliveryDeadline(e.target.value)}
                  data-testid="input-delivery-deadline"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Requirements & Qualifications</CardTitle>
              <CardDescription>Specify what suppliers need to meet</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Requirements</Label>
                <Textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="List specific requirements for this RFQ..."
                  rows={5}
                  data-testid="input-requirements"
                />
              </div>
              <div className="space-y-2">
                <Label>Supplier Qualifications</Label>
                <Textarea
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  placeholder="Required certifications, experience, etc..."
                  rows={5}
                  data-testid="input-qualifications"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Review & Publish</CardTitle>
              <CardDescription>Review your RFQ before publishing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-lg" data-testid="text-review-title">{title}</h3>
                  <Badge variant="outline">{visibility}</Badge>
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-review-description">{description}</p>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Organisation:</span>{" "}
                    <span className="font-medium" data-testid="text-review-org">{orgs.find(o => String(o.id) === buyerOrgId)?.name || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category:</span>{" "}
                    <span className="font-medium" data-testid="text-review-category">{categories.find(c => String(c.id) === categoryId)?.name || "Not set"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Budget:</span>{" "}
                    <span className="font-medium" data-testid="text-review-budget">
                      {budgetMin || budgetMax
                        ? `${formatKobo(budgetMin ? parseFloat(budgetMin) * 100 : null)} - ${formatKobo(budgetMax ? parseFloat(budgetMax) * 100 : null)}`
                        : "Not specified"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Deadline:</span>{" "}
                    <span className="font-medium" data-testid="text-review-deadline">
                      {deadline ? new Date(deadline).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                    </span>
                  </div>
                </div>
              </div>

              {items.filter(i => i.description.trim()).length > 0 && (
                <div className="rounded-md border p-4 space-y-2">
                  <h4 className="font-medium text-sm">Line Items ({items.filter(i => i.description.trim()).length})</h4>
                  {items.filter(i => i.description.trim()).map((item, i) => (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm py-1 border-b last:border-b-0">
                      <span data-testid={`text-review-item-${i}`}>{item.description}</span>
                      <span className="text-muted-foreground">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              )}

              {(requirements || qualifications) && (
                <div className="rounded-md border p-4 space-y-2">
                  {requirements && (
                    <div>
                      <h4 className="font-medium text-sm">Requirements</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{requirements}</p>
                    </div>
                  )}
                  {qualifications && (
                    <div>
                      <h4 className="font-medium text-sm">Qualifications</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{qualifications}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => step > 0 ? setStep(step - 1) : navigate("/procurement/my-rfqs")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {step > 0 ? "Back" : "Cancel"}
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {step === 4 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => createMutation.mutate(false)}
                  disabled={createMutation.isPending}
                  data-testid="button-save-draft"
                >
                  <Save className="h-4 w-4 mr-1" />
                  {createMutation.isPending ? "Saving..." : "Save as Draft"}
                </Button>
                <Button
                  onClick={() => createMutation.mutate(true)}
                  disabled={createMutation.isPending}
                  data-testid="button-publish-rfq"
                >
                  <Send className="h-4 w-4 mr-1" />
                  {createMutation.isPending ? "Publishing..." : "Publish RFQ"}
                </Button>
              </>
            )}
            {step < 4 && (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                data-testid="button-next"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
