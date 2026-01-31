import { db } from "../db";
import { eq } from "drizzle-orm";
import { 
  payments, 
  companyApplications,
  payoutLedger,
  type Payment
} from "@shared/schema";

export type PaymentState = 
  | "unpaid" 
  | "paid_escrowed" 
  | "released_to_lawyer" 
  | "refunded_partial"
  | "refunded_full"
  | "chargeback";

export interface PaymentStateTransition {
  from: PaymentState;
  to: PaymentState;
  validRoles: ("admin" | "system")[];
  requiresReason: boolean;
}

const VALID_TRANSITIONS: PaymentStateTransition[] = [
  { from: "unpaid", to: "paid_escrowed", validRoles: ["system"], requiresReason: false },
  { from: "paid_escrowed", to: "released_to_lawyer", validRoles: ["admin"], requiresReason: false },
  { from: "paid_escrowed", to: "refunded_full", validRoles: ["admin"], requiresReason: true },
  { from: "paid_escrowed", to: "refunded_partial", validRoles: ["admin"], requiresReason: true },
  { from: "released_to_lawyer", to: "refunded_partial", validRoles: ["admin"], requiresReason: true },
  { from: "paid_escrowed", to: "chargeback", validRoles: ["admin", "system"], requiresReason: true },
  { from: "released_to_lawyer", to: "chargeback", validRoles: ["admin", "system"], requiresReason: true },
];

export function isValidTransition(
  fromState: PaymentState, 
  toState: PaymentState, 
  role: "admin" | "system"
): boolean {
  const transition = VALID_TRANSITIONS.find(
    t => t.from === fromState && t.to === toState
  );
  return transition ? transition.validRoles.includes(role) : false;
}

export function getAvailableTransitions(
  currentState: PaymentState, 
  role: "admin" | "system"
): PaymentState[] {
  return VALID_TRANSITIONS
    .filter(t => t.from === currentState && t.validRoles.includes(role))
    .map(t => t.to);
}

export interface TransitionResult {
  success: boolean;
  payment?: Payment;
  error?: string;
}

export async function transitionPaymentState(
  paymentId: number,
  targetState: PaymentState,
  role: "admin" | "system",
  reason?: string
): Promise<TransitionResult> {
  const [payment] = await db.select().from(payments)
    .where(eq(payments.id, paymentId));
    
  if (!payment) {
    return { success: false, error: "Payment not found" };
  }

  const currentState = (payment.state || "unpaid") as PaymentState;
  
  if (!isValidTransition(currentState, targetState, role)) {
    return { 
      success: false, 
      error: `Invalid transition from ${currentState} to ${targetState} for role ${role}` 
    };
  }

  const transition = VALID_TRANSITIONS.find(
    t => t.from === currentState && t.to === targetState
  );
  
  if (transition?.requiresReason && !reason) {
    return { success: false, error: "This transition requires a reason" };
  }

  const updateData: Partial<Payment> = {
    state: targetState,
  };

  switch (targetState) {
    case "paid_escrowed":
      updateData.status = "completed";
      updateData.escrowedAt = new Date();
      break;
    case "released_to_lawyer":
      updateData.releasedAt = new Date();
      break;
    case "refunded_full":
    case "refunded_partial":
    case "chargeback":
      updateData.refundedAt = new Date();
      updateData.refundReason = reason;
      break;
  }

  const [updated] = await db.update(payments)
    .set(updateData)
    .where(eq(payments.id, paymentId))
    .returning();

  if (targetState === "paid_escrowed" && payment.applicationId) {
    await db.update(companyApplications)
      .set({ 
        paymentState: targetState,
        paymentStateUpdatedAt: new Date(),
      })
      .where(eq(companyApplications.id, payment.applicationId));
  }

  return { success: true, payment: updated };
}

export async function handlePaystackWebhook(
  reference: string,
  status: "success" | "failed",
  paystackData: Record<string, any>
): Promise<TransitionResult> {
  const [payment] = await db.select().from(payments)
    .where(eq(payments.paystackReference, reference));
    
  if (!payment) {
    return { success: false, error: "Payment not found for reference" };
  }

  if (status === "success") {
    return transitionPaymentState(payment.id, "paid_escrowed", "system");
  } else {
    return { success: true, payment, error: "Payment failed - no state change needed" };
  }
}

export async function releaseToLawyer(
  applicationId: number,
  lawyerUserId: string,
  lawyerFeeKobo: number
): Promise<TransitionResult> {
  const [payment] = await db.select().from(payments)
    .where(eq(payments.applicationId, applicationId));
    
  if (!payment) {
    return { success: false, error: "No payment found for this application" };
  }

  const result = await transitionPaymentState(payment.id, "released_to_lawyer", "admin");
  
  if (result.success && result.payment) {
    await db.insert(payoutLedger).values({
      paymentId: result.payment.id,
      lawyerUserId,
      amountKobo: lawyerFeeKobo,
      status: "pending",
    });

    await db.update(companyApplications)
      .set({ 
        paymentState: "released_to_lawyer",
        paymentStateUpdatedAt: new Date(),
      })
      .where(eq(companyApplications.id, applicationId));
  }

  return result;
}

export async function processRefund(
  applicationId: number,
  reason: string,
  isPartial: boolean = false
): Promise<TransitionResult> {
  const [payment] = await db.select().from(payments)
    .where(eq(payments.applicationId, applicationId));
    
  if (!payment) {
    return { success: false, error: "No payment found for this application" };
  }

  const targetState: PaymentState = isPartial ? "refunded_partial" : "refunded_full";
  const result = await transitionPaymentState(payment.id, targetState, "admin", reason);
  
  if (result.success) {
    await db.update(companyApplications)
      .set({ 
        paymentState: targetState,
        paymentStateUpdatedAt: new Date(),
      })
      .where(eq(companyApplications.id, applicationId));
  }

  return result;
}

export async function getPaymentState(applicationId: number): Promise<{
  state: PaymentState;
  payment?: Payment;
  availableTransitions: PaymentState[];
}> {
  const [payment] = await db.select().from(payments)
    .where(eq(payments.applicationId, applicationId));

  if (!payment) {
    return {
      state: "unpaid",
      availableTransitions: getAvailableTransitions("unpaid", "admin"),
    };
  }

  const currentState = (payment.state || "unpaid") as PaymentState;
  
  return {
    state: currentState,
    payment,
    availableTransitions: getAvailableTransitions(currentState, "admin"),
  };
}
