import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Receipt,
  Plus,
  Trash2,
  Send,
  Save,
  ArrowLeft,
  Calculator,
  Building2,
  CreditCard,
} from "lucide-react";
import type { Contract } from "@shared/schema";

interface ContractWithMilestones extends Contract {
  milestones?: any[];
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
}

function formatNGN(kobo: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(kobo / 100);
}

export default function CreateInvoicePage() {
  const { contractId } = useParams<{ contractId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [bankDetails, setBankDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [taxLabel, setTaxLabel] = useState("VAT");
  const [taxAmount, setTaxAmount] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<InvoiceLineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, unit: "units" },
  ]);

  const { data: contract, isLoading } = useQuery<ContractWithMilestones>({
    queryKey: ["/api/procurement/contracts", contractId],
    enabled: !!contractId,
  });

  useEffect(() => {
    if (contract && items.length === 1 && !items[0].description) {
      setItems([{
        description: `Services as per contract ${contract.contractNumber}`,
        quantity: 1,
        unitPrice: contract.totalAmount || 0,
        unit: "units",
      }]);
    }
  }, [contract]);

  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const totalAmount = subtotal + taxAmount;

  const createInvoiceMutation = useMutation({
    mutationFn: async (sendAfter: boolean) => {
      const res = await apiRequest("POST", `/api/procurement/contracts/${contractId}/invoices`, {
        paymentTerms,
        bankDetails: bankDetails || undefined,
        notes: notes || undefined,
        taxLabel,
        taxAmount,
        dueDate: dueDate || undefined,
        items: items.filter(i => i.description),
      });
      const invoice = await res.json();
      if (sendAfter) {
        await apiRequest("POST", `/api/procurement/invoices/${invoice.id}/send`);
      }
      return invoice;
    },
    onSuccess: (invoice, sendAfter) => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/invoices"] });
      toast({
        title: sendAfter ? "Invoice sent" : "Invoice saved as draft",
        description: sendAfter ? "The invoice has been sent to the buyer." : "You can send it later from the invoice detail page.",
      });
      navigate(`/procurement/invoices/${invoice.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create invoice", description: error.message, variant: "destructive" });
    },
  });

  function addItem() {
    setItems(prev => [...prev, { description: "", quantity: 1, unitPrice: 0, unit: "units" }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof InvoiceLineItem, value: any) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  if (isLoading) {
    return (
      <DashboardLayout role="founder">
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  if (!contract) {
    return (
      <DashboardLayout role="founder">
        <div className="text-center py-20">
          <p className="text-muted-foreground">Contract not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/procurement/invoices")} data-testid="button-back-invoices">
            Back to Invoices
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement" }, { label: "Create Invoice" }]}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1 as any)} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Create Invoice</h1>
            <p className="text-muted-foreground text-sm">Contract: {contract.contractNumber}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Line Items
                </CardTitle>
                <CardDescription>Add items to your invoice</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                  <div className="col-span-4">Description</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-3">Price (kobo)</div>
                  <div className="col-span-1"></div>
                </div>
                <Separator />
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        placeholder="Item description"
                        data-testid={`input-item-desc-${index}`}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                        data-testid={`input-item-qty-${index}`}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        value={item.unit}
                        onChange={(e) => updateItem(index, "unit", e.target.value)}
                        placeholder="units"
                        data-testid={`input-item-unit-${index}`}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min={0}
                        value={item.unitPrice || ""}
                        onChange={(e) => updateItem(index, "unitPrice", parseInt(e.target.value) || 0)}
                        placeholder="0"
                        data-testid={`input-item-price-${index}`}
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        disabled={items.length <= 1}
                        data-testid={`button-remove-item-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addItem} data-testid="button-add-item">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Item
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Invoice Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Payment Terms</Label>
                    <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                      <SelectTrigger data-testid="select-payment-terms">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Due on receipt">Due on receipt</SelectItem>
                        <SelectItem value="Net 15">Net 15</SelectItem>
                        <SelectItem value="Net 30">Net 30</SelectItem>
                        <SelectItem value="Net 60">Net 60</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date (optional)</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      data-testid="input-due-date"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tax Label</Label>
                    <Input
                      value={taxLabel}
                      onChange={(e) => setTaxLabel(e.target.value)}
                      placeholder="VAT"
                      data-testid="input-tax-label"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax Amount (kobo)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={taxAmount || ""}
                      onChange={(e) => setTaxAmount(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      data-testid="input-tax-amount"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Bank Details</Label>
                  <Textarea
                    value={bankDetails}
                    onChange={(e) => setBankDetails(e.target.value)}
                    placeholder="Bank Name: ...\nAccount Name: ...\nAccount Number: ..."
                    className="min-h-[80px]"
                    data-testid="input-bank-details"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes or instructions..."
                    className="min-h-[60px]"
                    data-testid="input-notes"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span data-testid="text-subtotal">{formatNGN(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{taxLabel}</span>
                  <span data-testid="text-tax">{formatNGN(taxAmount)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-bold">
                  <span>Total</span>
                  <span data-testid="text-total">{formatNGN(totalAmount)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Contract Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Number</span>
                  <span data-testid="text-contract-number">{contract.contractNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Value</span>
                  <span data-testid="text-contract-value">{formatNGN(contract.totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span data-testid="text-contract-status">{contract.status}</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => createInvoiceMutation.mutate(true)}
                disabled={createInvoiceMutation.isPending || !items.some(i => i.description)}
                data-testid="button-send-invoice"
              >
                <Send className="h-4 w-4 mr-2" />
                {createInvoiceMutation.isPending ? "Sending..." : "Send Invoice"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => createInvoiceMutation.mutate(false)}
                disabled={createInvoiceMutation.isPending || !items.some(i => i.description)}
                data-testid="button-save-draft"
              >
                <Save className="h-4 w-4 mr-2" />
                {createInvoiceMutation.isPending ? "Saving..." : "Save as Draft"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
