import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import { errorResponse, successResponse } from "@/lib/api-response";
import { getOrdersByCustomerIdService } from "@/modules/orders/order.service";

/**
 * Tipo correcto para ruta dinámica:
 * /api/customers/:id/orders
 */
type CustomerOrdersRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * Convierte el id del cliente a número.
 */
function parseCustomerId(id: string): number {
  const customerId = Number(id);

  if (Number.isNaN(customerId) || customerId <= 0) {
    throw new Error("ID inválido");
  }

  return customerId;
}

/**
 * GET /api/customers/:id/orders
 *
 * Devuelve el historial de pedidos de un cliente.
 */
export async function GET(
  request: NextRequest,
  context: CustomerOrdersRouteContext
) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const params = await context.params;
    const customerId = parseCustomerId(params.id);

    const orders = await getOrdersByCustomerIdService(customerId);

    return successResponse(orders, "Historial de pedidos obtenido correctamente");
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Token no proporcionado" ||
        error.message === "Token inválido o expirado")
    ) {
      return errorResponse(error.message, 401);
    }

    if (
      error instanceof Error &&
      error.message === "No tienes permisos para realizar esta acción"
    ) {
      return errorResponse(error.message, 403);
    }

    if (
      error instanceof Error &&
      (error.message === "Cliente no encontrado" ||
        error.message === "ID inválido")
    ) {
      return errorResponse(error.message, 404);
    }

    console.error("GET_CUSTOMER_ORDERS_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}