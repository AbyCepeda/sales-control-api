import type { Prisma } from "@prisma/client";

/**
 * Tipo para pedidos recientes en el dashboard.
 *
 * Incluimos datos útiles:
 * - cliente
 * - vendedor
 * - productos del pedido
 */
export type RecentOrder = Prisma.OrderGetPayload<{
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

/**
 * Respuesta principal del dashboard.
 *
 * Esta estructura será consumida por la app móvil
 * para mostrar tarjetas/resumen en la pantalla inicial.
 */
export type DashboardResponse = {
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: string;
  activeCustomers: number;
  activeProducts: number;
  recentOrders: RecentOrder[];
};