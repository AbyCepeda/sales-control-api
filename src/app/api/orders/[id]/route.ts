import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import {
  getOrderByIdService,
  updateOrderService,
} from "@/modules/orders/order.service";
import { updateOrderSchema } from "@/modules/orders/order.dto";

/**
 * Tipo correcto para ruta dinámica:
 * /api/orders/:id
 *
 * En Next.js actual, params viene como Promise.
 */
type OrderRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * Convierte el id del pedido a número.
 *
 * Beneficio:
 * - Evita IDs inválidos como "abc", "0" o negativos.
 */
function parseOrderId(id: string): number {
  const orderId = Number(id);

  if (Number.isNaN(orderId) || orderId <= 0) {
    throw new Error("ID inválido");
  }

  return orderId;
}

/**
 * GET /api/orders/:id
 *
 * Obtiene el detalle completo de un pedido general.
 *
 * Incluye:
 * - vendedor
 * - clientes dentro del pedido
 * - artículos de cada cliente
 * - producto relacionado de cada artículo
 *
 * Beneficio:
 * - Permite ver un pedido completo agrupado por cliente.
 */
export async function GET(request: NextRequest, context: OrderRouteContext) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const params = await context.params;
    const orderId = parseOrderId(params.id);

    const order = await getOrderByIdService(orderId);

    return successResponse(order, "Pedido obtenido correctamente");
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
      (error.message === "Pedido no encontrado" ||
        error.message === "ID inválido")
    ) {
      return errorResponse(error.message, 404);
    }

    console.error("GET_ORDER_BY_ID_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}

/**
 * PUT /api/orders/:id
 *
 * Actualiza datos básicos de un pedido general.
 *
 * Permite actualizar:
 * - status
 * - deliveryDate
 * - notes
 *
 * Beneficio:
 * - Puedes cambiar el estado del pedido sin tocar artículos o clientes.
 */
export async function PUT(request: NextRequest, context: OrderRouteContext) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const params = await context.params;
    const orderId = parseOrderId(params.id);

    const body = await request.json();

    const validation = updateOrderSchema.safeParse(body);

    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const updatedOrder = await updateOrderService(orderId, validation.data);

    return successResponse(updatedOrder, "Pedido actualizado correctamente");
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
      (error.message === "Pedido no encontrado" ||
        error.message === "ID inválido")
    ) {
      return errorResponse(error.message, 404);
    }

    console.error("UPDATE_ORDER_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}