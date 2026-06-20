import type { Prisma } from "@prisma/client";

/**
 * Tipo de pedido con relaciones incluidas.
 *
 * Incluye:
 * - cliente del pedido
 * - vendedor que registró el pedido
 * - artículos del pedido
 * - producto relacionado, si existe
 *
 * Nueva lógica:
 * Cada item del pedido guarda snapshots:
 * - skuSnapshot
 * - nameSnapshot
 * - descriptionSnapshot
 * - unitPriceSnapshot
 *
 * Beneficio:
 * - El pedido conserva los datos reales usados al momento de vender.
 * - Si después cambia el nombre, descripción o precio del producto,
 *   el historial del pedido no se altera.
 */
export type OrderWithDetails = Prisma.OrderGetPayload<{
  include: {
    customer: true;
    seller: {
      select: {
        id: true;
        name: true;
        email: true;
        role: true;
      };
    };
    items: {
      include: {
        /**
         * Producto relacionado al SKU.
         *
         * Importante:
         * El pedido no debe depender solo de este producto,
         * porque los datos históricos viven en los snapshots del OrderItem.
         */
        product: true;
      };
    };
  };
}>;