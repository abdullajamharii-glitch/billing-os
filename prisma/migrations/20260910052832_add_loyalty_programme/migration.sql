/*
  Warnings:

  - You are about to drop the column `ipAddress` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `billingAddress` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `creditTermsDays` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `taxId` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `defaultCurrency` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `logoUrl` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `taxId` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `timezone` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the `credit_notes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invoice_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invoice_sequences` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invoices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plans` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `report_snapshots` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscriptions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tax_classes` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'SPLIT', 'OTHER');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'HELD', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoyaltyTxnType" AS ENUM ('EARN', 'REDEEM', 'ADJUST', 'EXPIRE');

-- AlterEnum — must be committed before new value can be used
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CASHIER';

-- DropForeignKey
ALTER TABLE "credit_notes" DROP CONSTRAINT "credit_notes_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_taxClassId_fkey";

-- DropForeignKey
ALTER TABLE "invoice_sequences" DROP CONSTRAINT "invoice_sequences_orgId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_customerId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_orgId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "plans" DROP CONSTRAINT "plans_orgId_fkey";

-- DropForeignKey
ALTER TABLE "plans" DROP CONSTRAINT "plans_taxClassId_fkey";

-- DropForeignKey
ALTER TABLE "report_snapshots" DROP CONSTRAINT "report_snapshots_orgId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_customerId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_planId_fkey";

-- DropForeignKey
ALTER TABLE "tax_classes" DROP CONSTRAINT "tax_classes_orgId_fkey";

-- DropIndex
DROP INDEX "customers_orgId_isActive_idx";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "ipAddress",
DROP COLUMN "userAgent";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "billingAddress",
DROP COLUMN "creditTermsDays",
DROP COLUMN "currency",
DROP COLUMN "notes",
DROP COLUMN "taxId",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "balanceDue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "defaultCurrency",
DROP COLUMN "logoUrl",
DROP COLUMN "taxId",
DROP COLUMN "timezone",
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "paperSize" TEXT NOT NULL DEFAULT '80mm',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "receiptFooter" TEXT DEFAULT 'Thank you for shopping with us! Visit again.',
ADD COLUMN     "receiptHeader" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CASHIER';

-- DropTable
DROP TABLE "credit_notes";

-- DropTable
DROP TABLE "invoice_items";

-- DropTable
DROP TABLE "invoice_sequences";

-- DropTable
DROP TABLE "invoices";

-- DropTable
DROP TABLE "payments";

-- DropTable
DROP TABLE "plans";

-- DropTable
DROP TABLE "report_snapshots";

-- DropTable
DROP TABLE "subscriptions";

-- DropTable
DROP TABLE "tax_classes";

-- DropEnum
DROP TYPE "BillingCycle";

-- DropEnum
DROP TYPE "InvoiceStatus";

-- DropEnum
DROP TYPE "PaymentGateway";

-- DropEnum
DROP TYPE "PaymentStatus";

-- DropEnum
DROP TYPE "ReportType";

-- DropEnum
DROP TYPE "SubscriptionStatus";

-- DropEnum
DROP TYPE "TaxType";

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT DEFAULT '#e05c2b',
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "sku" TEXT,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "costPrice" INTEGER NOT NULL DEFAULT 0,
    "stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStock" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "taxRate" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_sequences" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNum" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sale_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "customerId" TEXT,
    "billNumber" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "customerName" TEXT DEFAULT 'Walk-in Customer',
    "customerPhone" TEXT,
    "subtotal" INTEGER NOT NULL,
    "taxTotal" INTEGER NOT NULL DEFAULT 0,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "costTotal" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "cashReceived" INTEGER NOT NULL DEFAULT 0,
    "changeReturned" INTEGER NOT NULL DEFAULT 0,
    "paymentRef" TEXT,
    "notes" TEXT,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "pointsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "barcode" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "costPrice" INTEGER NOT NULL DEFAULT 0,
    "taxRate" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_configs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pointsPerHundred" INTEGER NOT NULL DEFAULT 1,
    "pointValuePaise" INTEGER NOT NULL DEFAULT 50,
    "minPointsRedeem" INTEGER NOT NULL DEFAULT 50,
    "expiryDays" INTEGER NOT NULL DEFAULT 0,
    "bronzeThreshold" INTEGER NOT NULL DEFAULT 0,
    "silverThreshold" INTEGER NOT NULL DEFAULT 500,
    "goldThreshold" INTEGER NOT NULL DEFAULT 2000,
    "platinumThreshold" INTEGER NOT NULL DEFAULT 5000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "saleId" TEXT,
    "type" "LoyaltyTxnType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_orgId_idx" ON "categories"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_orgId_name_key" ON "categories"("orgId", "name");

-- CreateIndex
CREATE INDEX "products_orgId_categoryId_idx" ON "products"("orgId", "categoryId");

-- CreateIndex
CREATE INDEX "products_orgId_name_idx" ON "products"("orgId", "name");

-- CreateIndex
CREATE INDEX "products_orgId_barcode_idx" ON "products"("orgId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "products_orgId_barcode_key" ON "products"("orgId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "sale_sequences_orgId_key" ON "sale_sequences"("orgId");

-- CreateIndex
CREATE INDEX "sales_orgId_createdAt_idx" ON "sales"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "sales_orgId_status_idx" ON "sales"("orgId", "status");

-- CreateIndex
CREATE INDEX "sales_orgId_paymentMethod_idx" ON "sales"("orgId", "paymentMethod");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orgId_billNumber_key" ON "sales"("orgId", "billNumber");

-- CreateIndex
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");

-- CreateIndex
CREATE INDEX "sale_items_productId_idx" ON "sale_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_configs_orgId_key" ON "loyalty_configs"("orgId");

-- CreateIndex
CREATE INDEX "loyalty_transactions_customerId_createdAt_idx" ON "loyalty_transactions"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "loyalty_transactions_orgId_createdAt_idx" ON "loyalty_transactions"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "customers_orgId_phone_idx" ON "customers"("orgId", "phone");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_configs" ADD CONSTRAINT "loyalty_configs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
