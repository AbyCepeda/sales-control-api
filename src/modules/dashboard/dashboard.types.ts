import type { Prisma } from "@prisma/client";

/**
 * Tipo para pedidos recientes en el dashboard.
 *
 * Nueva estructura:
 * - Order es el pedido general.
 * - customerOrders son los clientes dentro del pedido.
 * - items son los artículos de cada cliente.
 * - payments vive dentro de cada CustomerOrder.
 *
 * Beneficio:
 * - El dashboard puede mostrar pedidos generales con varios clientes.
 * - También puede saber cuánto se ha abonado por cliente.
 */
export type RecentOrder = Prisma.OrderGetPayload<{
  include: {
    seller: {
      select: {
        id: true;
        name: true;
        email: true;
        role: true;
      };
    };
    customerOrders: {
      include: {
        customer: true;
        items: {
          include: {
            product: true;
          };
        };
        payments: {
          orderBy: {
            createdAt: "desc";
          };
        };
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

  /**
   * Total vendido, sin contar cancelados.
   */
  totalRevenue: string;

  /**
   * Total abonado/pagado por los clientes.
   */
  totalPaid: string;

  /**
   * Total pendiente por cobrar.
   */
  totalPending: string;

  /**
   * Total abonado hoy.
   */
  todayPayments: string;

  activeCustomers: number;
  activeProducts: number;
  recentOrders: RecentOrder[];
};