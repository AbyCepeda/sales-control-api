/*
  Warnings:

  - You are about to drop the column `orderId` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `orders` table. All the data in the column will be lost.
  - Added the required column `customerOrderId` to the `order_items` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `order_items` DROP FOREIGN KEY `order_items_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `orders` DROP FOREIGN KEY `orders_customerId_fkey`;

-- DropIndex
DROP INDEX `order_items_orderId_idx` ON `order_items`;

-- DropIndex
DROP INDEX `orders_customerId_idx` ON `orders`;

-- AlterTable
ALTER TABLE `order_items` DROP COLUMN `orderId`,
    ADD COLUMN `customerOrderId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `orders` DROP COLUMN `customerId`;

-- CreateTable
CREATE TABLE `customer_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `customerId` INTEGER NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `customer_orders_orderId_idx`(`orderId`),
    INDEX `customer_orders_customerId_idx`(`customerId`),
    UNIQUE INDEX `customer_orders_orderId_customerId_key`(`orderId`, `customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `order_items_customerOrderId_idx` ON `order_items`(`customerOrderId`);

-- AddForeignKey
ALTER TABLE `customer_orders` ADD CONSTRAINT `customer_orders_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_orders` ADD CONSTRAINT `customer_orders_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_customerOrderId_fkey` FOREIGN KEY (`customerOrderId`) REFERENCES `customer_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
