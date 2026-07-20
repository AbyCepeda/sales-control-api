import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import { errorResponse, successResponse } from "@/lib/api-response";
import { getCustomerOrderPaymentSummaryService } from "@/modules/orders/order.service";

type CustomerOrderPaymentSummaryRouteContext = {
  params: Promise<{
    customerOrderId: string;
  }>;
};

function parseCustomerOrderId(customerOrderId: string): number {
  const parsedCustomerOrderId = Number(customerOrderId);

  if (Number.isNaN(parsedCustomerOrderId) || parsedCustomerOrderId <= 0) {
    throw new Error("ID inválido");
  }

  return parsedCustomerOrderId;
}

/**
 * GET /api/customer-orders/:customerOrderId/payments/summary
 *
 * Obtiene el resumen de pagos de un cliente dentro de un pedido.
 *
 * Para qué sirve:
 * - Calcula el total que debe ese cliente.
 * - Calcula cuánto ha pagado ese cliente.
 * - Calcula cuánto le queda pendiente.
 *
 * Beneficio:
 * - La app puede mostrar deuda por cliente.
 * - Ya no se mezclan los abonos de varios clientes dentro del mismo pedido.
 */
export async function GET(
  request: NextRequest,
  context: CustomerOrderPaymentSummaryRouteContext,
) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const params = await context.params;
    const customerOrderId = parseCustomerOrderId(params.customerOrderId);

    const summary = await getCustomerOrderPaymentSummaryService(
      customerOrderId,
      authUser,
    );

    return successResponse(
      summary,
      "Resumen de pagos del cliente obtenido correctamente",
    );
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
      (error.message === "Cliente del pedido no encontrado" ||
        error.message === "ID inválido")
    ) {
      return errorResponse(error.message, 404);
    }

    console.error("GET_CUSTOMER_ORDER_PAYMENT_SUMMARY_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}