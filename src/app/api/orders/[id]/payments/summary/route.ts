import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import { errorResponse, successResponse } from "@/lib/api-response";
import { getOrderPaymentSummaryService } from "@/modules/orders/order.service";

type OrderPaymentSummaryRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseOrderId(id: string): number {
  const orderId = Number(id);

  if (Number.isNaN(orderId) || orderId <= 0) {
    throw new Error("ID inválido");
  }

  return orderId;
}

/**
 * GET /api/orders/:id/payments/summary
 *
 * Obtiene resumen de pagos de un pedido.
 *
 * Para qué sirve:
 * - Calcula total del pedido.
 * - Calcula total pagado.
 * - Calcula pendiente.
 *
 * Beneficio:
 * - La app puede mostrar un resumen claro de deuda.
 */
export async function GET(
  request: NextRequest,
  context: OrderPaymentSummaryRouteContext,
) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const params = await context.params;
    const orderId = parseOrderId(params.id);

    const summary = await getOrderPaymentSummaryService(orderId, authUser);

    return successResponse(summary, "Resumen de pagos obtenido correctamente");
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
      (error.message === "No tienes permisos para realizar esta acción" ||
        error.message === "No tienes permisos para consultar este pedido")
    ) {
      return errorResponse(error.message, 403);
    }

    if (
      error instanceof Error &&
      (error.message === "Pedido no encontrado" ||
        error.message === "ID inválido")
    ) {
      return errorResponse(error.message, 404);
    }

    console.error("GET_ORDER_PAYMENT_SUMMARY_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}