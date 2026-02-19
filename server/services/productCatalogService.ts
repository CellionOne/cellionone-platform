import { db } from "../db";
import { productCatalog } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export async function getActiveProducts() {
  return db.select().from(productCatalog).where(eq(productCatalog.isActive, true));
}

export async function getBySku(sku: string) {
  const [product] = await db.select().from(productCatalog)
    .where(and(eq(productCatalog.sku, sku), eq(productCatalog.isActive, true)));
  return product || null;
}

export async function getById(id: number) {
  const [product] = await db.select().from(productCatalog)
    .where(eq(productCatalog.id, id));
  return product || null;
}

export function computeItemAmounts(product: { priceNgn: number; cellionCutNgn: number | null; requiresManualPricing: boolean | null }) {
  if (product.requiresManualPricing || product.cellionCutNgn === null) {
    throw new Error("MANUAL_PRICING_REQUIRED");
  }

  const priceNgn = product.priceNgn;
  const cellionCutNgn = product.cellionCutNgn;
  const lawyerNetNgn = priceNgn - cellionCutNgn;

  return { priceNgn, cellionCutNgn, lawyerNetNgn };
}
