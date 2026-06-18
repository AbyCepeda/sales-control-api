import type { Prisma } from "@prisma/client";

/**
 * Tipo de pedido con relaciones incluidas.
 *
 * Incluye:
 * - cliente del pedido
 * - vendedor que registró el pedido
 * - productos dentro del pedido
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
        product: true;
      };
    };
  };
}>;