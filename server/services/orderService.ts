import { db } from "../db";
import { orders, orderItems, productCatalog } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import * as catalogService from "./productCatalogService";

export interface CreateOrderInput {
  founderId: string;
  applicationId?: number;
  items: { sku: string }[];
}

export async function createOrder(input: CreateOrderInput) {
  if (!input.items.length) {
    throw new Error("At least one item is required");
  }

  const resolvedItems: {
    product: typeof productCatalog.$inferSelect;
    amounts: { priceNgn: number; cellionCutNgn: number; lawyerNetNgn: number };
  }[] = [];

  for (const item of input.items) {
    const product = await catalogService.getBySku(item.sku);
    if (!product) {
      throw new Error(`Product not found: ${item.sku}`);
    }
    if (!product.isActive) {
      throw new Error(`Product is inactive: ${item.sku}`);
    }
    const amounts = catalogService.computeItemAmounts(product);
    resolvedItems.push({ product, amounts });
  }

  const totalAmount = resolvedItems.reduce((sum, i) => sum + i.amounts.priceNgn, 0);
  const totalCellionCut = resolvedItems.reduce((sum, i) => sum + i.amounts.cellionCutNgn, 0);
  const totalLawyerNet = resolvedItems.reduce((sum, i) => sum + i.amounts.lawyerNetNgn, 0);

  const [order] = await db.insert(orders).values({
    founderId: input.founderId,
    applicationId: input.applicationId || null,
    status: "pending_payment",
    currency: "NGN",
    totalAmount,
    totalCellionCut,
    totalLawyerNet,
  }).returning();

  const itemRecords = [];
  for (const ri of resolvedItems) {
    const [item] = await db.insert(orderItems).values({
      orderId: order.id,
      productId: ri.product.id,
      sku: ri.product.sku,
      quantity: 1,
      unitPrice: ri.amounts.priceNgn,
      cellionCut: ri.amounts.cellionCutNgn,
      lawyerNet: ri.amounts.lawyerNetNgn,
      metadata: ri.product.metadata as Record<string, unknown> || null,
    }).returning();
    itemRecords.push(item);
  }

  return { order, items: itemRecords };
}

export async function getOrderById(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return { order, items };
}

export async function getOrdersByFounder(founderId: string) {
  return db.select().from(orders).where(eq(orders.founderId, founderId));
}

export async function updateOrderStatus(orderId: number, status: string) {
  const [updated] = await db.update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();
  return updated;
}

export async function updateOrderFulfilment(orderId: number, fulfilmentStatus: string, assignedLawyerId?: string) {
  const updateData: Record<string, unknown> = { fulfilmentStatus, updatedAt: new Date() };
  if (assignedLawyerId) updateData.assignedLawyerId = assignedLawyerId;
  const [updated] = await db.update(orders)
    .set(updateData)
    .where(eq(orders.id, orderId))
    .returning();
  return updated;
}
