import { useCallback } from "react";
import { useLocation } from "wouter";

export interface CheckoutItem {
  serviceType: "verification" | "incorporation" | "registered_office";
  tier?: "office_only" | "office_plus_mail";
  quantity?: number;
}

export interface CheckoutContext {
  applicationId?: number;
  returnUrl?: string;
}

export interface CheckoutState {
  items: CheckoutItem[];
  context: CheckoutContext;
}

export function useCheckout() {
  const [, setLocation] = useLocation();

  const initiateCheckout = useCallback((items: CheckoutItem[], context: CheckoutContext = {}) => {
    const state: CheckoutState = { items, context };
    
    sessionStorage.setItem("checkoutState", JSON.stringify(state));
    
    setLocation("/payment/checkout");
  }, [setLocation]);

  const checkoutVerification = useCallback(() => {
    initiateCheckout([{ serviceType: "verification" }]);
  }, [initiateCheckout]);

  const checkoutIncorporation = useCallback((applicationId: number) => {
    initiateCheckout(
      [{ serviceType: "incorporation" }],
      { applicationId }
    );
  }, [initiateCheckout]);

  const checkoutRegisteredOffice = useCallback((tier: "office_only" | "office_plus_mail") => {
    initiateCheckout([{ serviceType: "registered_office", tier }]);
  }, [initiateCheckout]);

  const checkoutBundle = useCallback((
    items: CheckoutItem[],
    applicationId?: number
  ) => {
    initiateCheckout(items, { applicationId });
  }, [initiateCheckout]);

  return {
    initiateCheckout,
    checkoutVerification,
    checkoutIncorporation,
    checkoutRegisteredOffice,
    checkoutBundle,
  };
}
