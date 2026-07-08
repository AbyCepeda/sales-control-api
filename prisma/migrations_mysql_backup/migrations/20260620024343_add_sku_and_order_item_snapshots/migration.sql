/*
  Warnings:

  - You are about to drop the column `unitPrice` on the `order_items` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sku]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `nameSnapshot` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `skuSnapshot` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitPriceSnapshot` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sku` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `order_items` DROP FOREIGN KEY `order_items_productId_fkey`;

-- AlterTable
ALTER TABLE `order_items` DROP COLUMN `unitPrice`,
    ADD COLUMN `descriptionSnapshot` VARCHAR(191) NULL,
    ADD COLUMN `nameSnapshot` VARCHAR(191) NOT NULL,
    ADD COLUMN `skuSnapshot` VARCHAR(191) NOT NULL,
    ADD COLUMN `unitPriceSnapshot` DECIMAL(10, 2) NOT NULL,
    MODIFY `productId` INTEGER NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `sku` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `order_items_skuSnapshot_idx` ON `order_items`(`skuSnapshot`);

-- CreateIndex
CREATE UNIQUE INDEX `products_sku_key` ON `products`(`sku`);

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
