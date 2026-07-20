/*
  Warnings:

  - You are about to drop the `order_payments` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "order_payments" DROP CONSTRAINT "order_payments_orderId_fkey";

-- DropTable
DROP TABLE "order_payments";

-- CreateTable
CREATE TABLE "customer_order_payments" (
    "id" SERIAL NOT NULL,
    "customerOrderId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_order_payments_customerOrderId_idx" ON "customer_order_payments"("customerOrderId");

-- AddForeignKey
ALTER TABLE "customer_order_payments" ADD CONSTRAINT "customer_order_payments_customerOrderId_fkey" FOREIGN KEY ("customerOrderId") REFERENCES "customer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
