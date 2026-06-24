import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AppJwtPayload } from "@/lib/jwt";
import type { DashboardResponse } from "./dashboard.types";

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
 */
export async function getDashboardService(
  authUser: AppJwtPayload
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
   * Contamos todos los pedidos generales visibles para el usuario.
   */
  const totalOrders = await prisma.order.count({
    where: orderWhere,
  });

  /**
   * Contamos pedidos pendientes.
   */
  const pendingOrders = await prisma.order.count({
    where: {
      ...orderWhere,
      status: "PENDING",
    },
  });

  /**
   * Contamos pedidos pagados.
   */
  const paidOrders = await prisma.order.count({
    where: {
      ...orderWhere,
      status: "PAID",
    },
  });

  /**
   * Contamos pedidos entregados.
   */
  const deliveredOrders = await prisma.order.count({
    where: {
      ...orderWhere,
      status: "DELIVERED",
    },
  });

  /**
   * Contamos pedidos cancelados.
   */
  const cancelledOrders = await prisma.order.count({
    where: {
      ...orderWhere,
      status: "CANCELLED",
    },
  });

  /**
   * Sumamos ingresos del pedido general.
   *
   * Importante:
   * No sumamos pedidos cancelados porque no representan venta real.
   */
  const revenueResult = await prisma.order.aggregate({
    where: {
      ...orderWhere,
      status: {
        not: "CANCELLED",
      },
    },
    _sum: {
      total: true,
    },
  });

  /**
   * Prisma devuelve Decimal o null.
   * Si no hay ventas, usamos 0.
   */
  const totalRevenue = revenueResult._sum.total ?? new Prisma.Decimal(0);

  /**
   * Contamos clientes activos.
   *
   * Por ahora es conteo general.
   */
  const activeCustomers = await prisma.customer.count({
    where: {
      isActive: true,
    },
  });

  /**
   * Contamos productos activos.
   */
  const activeProducts = await prisma.product.count({
    where: {
      isActive: true,
    },
  });

  /**
   * Últimos pedidos generales registrados.
   *
   * Nueva estructura:
   * - Incluye vendedor.
   * - Incluye customerOrders.
   * - Cada customerOrder incluye cliente e items.
   * - Cada item incluye producto.
   *
   * Beneficio:
   * - El dashboard puede mostrar un pedido agrupado por clientes.
   */
  const recentOrders = await prisma.order.findMany({
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
        },
      },
    },
  });

  return {
    totalOrders,
    pendingOrders,
    paidOrders,
    deliveredOrders,
    cancelledOrders,
    totalRevenue: totalRevenue.toFixed(2),
    activeCustomers,
    activeProducts,
    recentOrders,
  };
}