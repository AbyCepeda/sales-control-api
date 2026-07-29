import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import { errorResponse, successResponse } from "@/lib/api-response";
import { deleteCustomerOrderPaymentService } from "@/modules/orders/order.service";

type CustomerOrderPaymentRouteContext = {
  params: Promise<{
    paymentId: string;
  }>;
};

function parsePaymentId(paymentId: string): number {
  const parsedPaymentId = Number(paymentId);

  if (Number.isNaN(parsedPaymentId) || parsedPaymentId <= 0) {
    throw new Error("ID inválido");
  }

  return parsedPaymentId;
}

/**
 * DELETE /api/customer-order-payments/:paymentId
 *
 * Elimina un abono registrado.
 *
 * Para qué sirve:
 * - Permite corregir pagos capturados por error.
 *
 * Beneficio:
 * - Recalcula automáticamente el estado del cliente y del pedido.
 */
export async function DELETE(
  request: NextRequest,
  context: CustomerOrderPaymentRouteContext,
) {
  try {
    const authUser = requireAuth(request);

    requireRole(authUser, ["ADMIN", "SELLER"]);

    const params = await context.params;
    const paymentId = parsePaymentId(params.paymentId);

    const updatedOrder = await deleteCustomerOrderPaymentService(
      paymentId,
      authUser,
    );

    return successResponse(updatedOrder, "Abono eliminado correctamente");
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
        error.message === "No tienes permisos para modificar este pedido")
    ) {
      return errorResponse(error.message, 403);
    }

    if (
      error instanceof Error &&
      error.message === "No puedes eliminar abonos de un pedido cancelado"
    ) {
      return errorResponse(error.message, 409);
    }

    if (
      error instanceof Error &&
      (error.message === "Abono no encontrado" || error.message === "ID inválido")
    ) {
      return errorResponse(error.message, 404);
    }

    console.error("DELETE_CUSTOMER_ORDER_PAYMENT_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}