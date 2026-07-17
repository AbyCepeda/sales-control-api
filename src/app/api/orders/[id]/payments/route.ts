import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { createOrderPaymentSchema } from "@/modules/orders/order.dto";
import { createOrderPaymentService } from "@/modules/orders/order.service";

type OrderPaymentRouteContext = {
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
 * POST /api/orders/:id/payments
 *
 * Registra un pago o abono para un pedido.
 *
 * Para qué sirve:
 * - Permite guardar pagos parciales.
 * - Permite guardar pagos completos.
 *
 * Beneficio:
 * - El pedido conserva historial de abonos.
 * - La app puede mostrar total, pagado y pendiente.
 */
export async function POST(
  request: NextRequest,
  context: OrderPaymentRouteContext,
) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const params = await context.params;
    const orderId = parseOrderId(params.id);

    const body = await request.json();

    const validation = createOrderPaymentSchema.safeParse(body);

    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const updatedOrder = await createOrderPaymentService(
      orderId,
      validation.data,
      authUser,
    );

    return successResponse(updatedOrder, "Pago registrado correctamente");
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
      (error.message === "Pedido no encontrado" ||
        error.message === "ID inválido")
    ) {
      return errorResponse(error.message, 404);
    }

    console.error("CREATE_ORDER_PAYMENT_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}