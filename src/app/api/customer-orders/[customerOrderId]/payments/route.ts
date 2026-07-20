import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { createOrderPaymentSchema } from "@/modules/orders/order.dto";
import { createCustomerOrderPaymentService } from "@/modules/orders/order.service";

type CustomerOrderPaymentRouteContext = {
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
 * POST /api/customer-orders/:customerOrderId/payments
 *
 * Registra un pago o abono para un cliente dentro de un pedido.
 *
 * Para qué sirve:
 * - Permite guardar pagos parciales de un cliente específico.
 * - Permite guardar pagos completos de un cliente específico.
 *
 * Beneficio:
 * - Ya no mezclamos pagos de diferentes clientes.
 * - Podemos saber exactamente quién pagó.
 * - La app puede mostrar total, pagado y pendiente por cliente.
 */
export async function POST(
  request: NextRequest,
  context: CustomerOrderPaymentRouteContext,
) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const params = await context.params;
    const customerOrderId = parseCustomerOrderId(params.customerOrderId);

    const body = await request.json();

    const validation = createOrderPaymentSchema.safeParse(body);

    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const updatedOrder = await createCustomerOrderPaymentService(
      customerOrderId,
      validation.data,
      authUser,
    );

    return successResponse(
      updatedOrder,
      "Pago del cliente registrado correctamente",
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
        error.message === "No tienes permisos para modificar este pedido")
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

    console.error("CREATE_CUSTOMER_ORDER_PAYMENT_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}