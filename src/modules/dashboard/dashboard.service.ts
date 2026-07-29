import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AppJwtPayload } from "@/lib/jwt";
import type { DashboardResponse } from "./dashboard.types";

/**
 * Obtiene el inicio del día actual.
 *
 * Para qué sirve:
 * - Permite calcular los pagos hechos hoy.
 */
function getTodayStartDate() {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
}

/**
 * Convierte un Decimal de Prisma a Decimal seguro.
 *
 * Para qué sirve:
 * - Los aggregate de Prisma pueden regresar null.
 * - Con esto evitamos errores al hacer operaciones.
 */
function toDecimal(value: Prisma.Decimal | null | undefined) {
  return value ?? new Prisma.Decimal(0);
}

/**
 * Obtiene datos de resumen para el dashboard.
 *
 * Regla actual:
 * - ADMIN ve datos generales.
 * - SELLER ve solo sus propios pedidos.
 *
 * Nueva estructura:
 * - Order representa pedido general.
 * - CustomerOrder representa clientes dentro del pedido.
 * - OrderItem representa artículos de cada cliente.
 * - CustomerOrderPayment representa abonos por cliente.
 */
export async function getDashboardService(
  authUser: AppJwtPayload,
): Promise<DashboardResponse> {
  /**
   * Si el usuario es vendedor, solo ve sus propios pedidos.
   *
   * Beneficio:
   * - Un vendedor no ve ventas capturadas por otro vendedor.
   */
  const orderWhere =
    authUser.role === "SELLER"
      ? {
          sellerId: authUser.userId,
        }
      : {};

  /**
   * Filtro para pagos.
   *
   * Si es SELLER, solo suma pagos de pedidos creados por ese vendedor.
   */
  const paymentWhere =
    authUser.role === "SELLER"
      ? {
          customerOrder: {
            order: {
              sellerId: authUser.userId,
            },
          },
        }
      : {};

  const todayStartDate = getTodayStartDate();

  const [
    totalOrders,
    pendingOrders,
    paidOrders,
    deliveredOrders,
    cancelledOrders,
    revenueResult,
    paidResult,
    todayPaymentsResult,
    activeCustomers,
    activeProducts,
    recentOrders,
  ] = await Promise.all([
    /**
     * Contamos todos los pedidos generales visibles para el usuario.
     */
    prisma.order.count({
      where: orderWhere,
    }),

    /**
     * Contamos pedidos pendientes.
     */
    prisma.order.count({
      where: {
        ...orderWhere,
        status: OrderStatus.PENDING,
      },
    }),

    /**
     * Contamos pedidos pagados.
     */
    prisma.order.count({
      where: {
        ...orderWhere,
        status: OrderStatus.PAID,
      },
    }),

    /**
     * Contamos pedidos entregados.
     */
    prisma.order.count({
      where: {
        ...orderWhere,
        status: OrderStatus.DELIVERED,
      },
    }),

    /**
     * Contamos pedidos cancelados.
     */
    prisma.order.count({
      where: {
        ...orderWhere,
        status: OrderStatus.CANCELLED,
      },
    }),

    /**
     * Total vendido.
     *
     * Importante:
     * - No sumamos pedidos cancelados porque no representan venta real.
     */
    prisma.order.aggregate({
      where: {
        ...orderWhere,
        status: {
          not: OrderStatus.CANCELLED,
        },
      },
      _sum: {
        total: true,
      },
    }),

    /**
     * Total pagado/abonado.
     *
     * Suma todos los abonos registrados por cliente.
     */
    prisma.customerOrderPayment.aggregate({
      where: paymentWhere,
      _sum: {
        amount: true,
      },
    }),

    /**
     * Pagos de hoy.
     */
    prisma.customerOrderPayment.aggregate({
      where: {
        ...paymentWhere,
        createdAt: {
          gte: todayStartDate,
        },
      },
      _sum: {
        amount: true,
      },
    }),

    /**
     * Clientes activos.
     *
     * Nota:
     * - Por ahora ADMIN y SELLER ven conteo general de clientes activos.
     */
    prisma.customer.count({
      where: {
        isActive: true,
      },
    }),

    /**
     * Productos activos.
     */
    prisma.product.count({
      where: {
        isActive: true,
      },
    }),

    /**
     * Últimos pedidos generales registrados.
     *
     * Nueva estructura:
     * - Incluye vendedor.
     * - Incluye customerOrders.
     * - Cada customerOrder incluye cliente, items y payments.
     */
    prisma.order.findMany({
      where: orderWhere,
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        customerOrders: {
          include: {
            customer: true,
            items: {
              include: {
                product: true,
              },
            },
            payments: {
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
      },
    }),
  ]);

  const totalRevenue = toDecimal(revenueResult._sum.total);
  const totalPaid = toDecimal(paidResult._sum.amount);
  const todayPayments = toDecimal(todayPaymentsResult._sum.amount);

  /**
   * Total pendiente.
   *
   * Regla:
   * - Es total vendido menos total pagado.
   * - Nunca bajamos de cero.
   */
  const totalPending = Prisma.Decimal.max(
    totalRevenue.sub(totalPaid),
    new Prisma.Decimal(0),
  );

  return {
    totalOrders,
    pendingOrders,
    paidOrders,
    deliveredOrders,
    cancelledOrders,
    totalRevenue: totalRevenue.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    totalPending: totalPending.toFixed(2),
    todayPayments: todayPayments.toFixed(2),
    activeCustomers,
    activeProducts,
    recentOrders,
  };
}