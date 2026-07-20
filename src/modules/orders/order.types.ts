import type { Prisma } from "@prisma/client";

/**
 * Tipo de pedido general con relaciones incluidas.
 *
 * Nueva estructura:
 * - Order representa el pedido general.
 * - customerOrders representa los clientes dentro del pedido.
 * - items representa los artículos de cada cliente.
 * - payments ahora vive dentro de cada CustomerOrder.
 *
 * Ejemplo:
 * Pedido general #1
 * - Cliente María
 *   - Perfume x2
 *   - Abonos de María
 *     - $300 efectivo
 *
 * - Cliente Juan
 *   - Crema x1
 *   - Abonos de Juan
 *     - $200 transferencia
 *
 * Beneficio:
 * - Permite manejar un pedido con varios clientes.
 * - Permite ver cuánto pidió cada cliente.
 * - Permite conservar historial de pagos por cliente.
 * - Permite saber cuánto ha pagado y cuánto debe cada cliente.
 */
export type OrderWithDetails = Prisma.OrderGetPayload<{
  include: {
    /**
     * Vendedor que registró el pedido general.
     */
    seller: {
      select: {
        id: true;
        name: true;
        email: true;
        role: true;
      };
    };

    /**
     * Clientes incluidos dentro del pedido general.
     *
     * Cada CustomerOrder tiene:
     * - customer
     * - total del cliente
     * - items del cliente
     * - payments/abonos del cliente
     */
    customerOrders: {
      include: {
        /**
         * Cliente que hizo esta parte del pedido.
         */
        customer: true;

        /**
         * Artículos comprados por este cliente.
         */
        items: {
          include: {
            /**
             * Producto relacionado al SKU.
             *
             * Importante:
             * El pedido no depende solo del producto,
             * porque los datos históricos viven en los snapshots:
             *
             * - skuSnapshot
             * - nameSnapshot
             * - descriptionSnapshot
             * - unitPriceSnapshot
             *
             * Beneficio:
             * - Si el producto cambia después, el historial del pedido
             *   conserva los datos reales usados al momento de vender.
             */
            product: true;
          };
        };

        /**
         * Pagos/abonos registrados para este cliente dentro del pedido.
         *
         * Beneficio:
         * - Permite mostrar historial de pagos por cliente.
         * - Permite calcular pagado y pendiente por cliente.
         */
        payments: {
          orderBy: {
            createdAt: "desc";
          };
        };
      };
    };
  };
}>;