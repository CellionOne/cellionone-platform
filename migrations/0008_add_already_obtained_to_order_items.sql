ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "already_obtained" boolean DEFAULT false;
