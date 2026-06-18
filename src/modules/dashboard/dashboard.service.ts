import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AppJwtPayload } from "@/lib/jwt";
import type { DashboardResponse } from "./dashboard.types";

/**
 * Obtiene datos de resumen para el dashboard.
 *
 * Regla actual:
 * - ADMIN ve datos generales.
 * - SELLER por ahora también ve datos generales.
 *
 * Más adelante podemos cambiarlo para que SELLER solo vea sus pedidos.
 */
export async function getDashboardService(
  authUser: AppJwtPayload
): Promise<DashboardResponse> {
  /**
   * En este punto authUser ya viene validado por requireAuth().
   *
   * Lo recibimos porque más adelante podemos usar authUser.role
   * o authUser.userId para filtrar información por vendedor.
   */
  const orderWhere =
    authUser.role === "SELLER"
      ? {
          /**
           * Si quieres que SELLER solo vea sus propios pedidos,
           * deja esta línea activa.
           *
           * Por ahora la mantenemos activa porque es más seguro
           * y más realista para un vendedor.
           */
          sellerId: authUser.userId,
        }
      : {};

  /**
   * Contamos todos los pedidos visibles para el usuario.
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
   * Sumamos ingresos.
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
   * Para SELLER también mostramos total general por ahora.
   * Si después cada vendedor tiene sus propios clientes, se filtra aquí.
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
   * Últimos pedidos registrados.
   *
   * Limitamos a 5 para dashboard.
   * No tiene sentido traer 500 pedidos en la pantalla inicial.
   */
  const recentOrders = await prisma.order.findMany({
    where: orderWhere,
    take: 5,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      customer: true,
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      items: {
        include: {
          product: true,
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