import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { updateFullOrderSchema } from "@/modules/orders/order.dto";
import { updateFullOrderService } from "@/modules/orders/order.service";

/**
 * Contexto de ruta dinámica.
 *
 * En Next actual, params viene como Promise.
 */
type OrderFullRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * Convierte el ID recibido por URL a número.
 *
 * Para qué sirve:
 * - Evita mandar IDs inválidos al service.
 *
 * Beneficio:
 * - Si llega un ID incorrecto, respondemos error claro.
 */
function parseOrderId(id: string): number {
  const orderId = Number(id);

  if (Number.isNaN(orderId) || orderId <= 0) {
    throw new Error("ID inválido");
  }

  return orderId;
}

/**
 * PUT /api/orders/:id/full
 *
 * Edita completamente un pedido:
 * - datos generales
 * - estado
 * - clientes
 * - artículos
 * - cantidades
 * - precios
 *
 * Para qué sirve:
 * - Permite modificar un pedido ya creado sin crear otro pedido nuevo.
 *
 * Beneficio:
 * - Puedes agregar clientes o artículos después.
 * - Puedes corregir cantidades/precios.
 * - El backend recalcula totales automáticamente.
 */
export async function PUT(
  request: NextRequest,
  context: OrderFullRouteContext
) {
  try {
    /**
     * Validamos token.
     */
    const authUser = requireAuth(request);

    /**
     * Validamos rol.
     *
     * Por ahora ADMIN y SELLER pueden editar.
     */
    requireRole(authUser, ["ADMIN", "SELLER"]);

    /**
     * Obtenemos y validamos ID del pedido.
     */
    const params = await context.params;
    const orderId = parseOrderId(params.id);

    /**
     * Leemos el body enviado desde móvil/web.
     */
    const body = await request.json();

    /**
     * Validamos el body con Zod.
     *
     * Si falta cliente, artículo, SKU, cantidad, etc.,
     * respondemos 422 con detalle.
     */
    const validation = updateFullOrderSchema.safeParse(body);

    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    /**
     * Editamos el pedido completo.
     */
    const updatedOrder = await updateFullOrderService(
      orderId,
      validation.data
    );

    return successResponse(updatedOrder, "Pedido editado correctamente");
  } catch (error) {
    /**
     * Error de validación Zod.
     */
    if (error instanceof ZodError) {
      return validationErrorResponse(error);
    }

    /**
     * Error de autenticación.
     */
    if (
      error instanceof Error &&
      (error.message === "Token no proporcionado" ||
        error.message === "Token inválido o expirado")
    ) {
      return errorResponse(error.message, 401);
    }

    /**
     * Error de autorización.
     */
    if (
      error instanceof Error &&
      error.message === "No tienes permisos para realizar esta acción"
    ) {
      return errorResponse(error.message, 403);
    }

    /**
     * Error de pedido no encontrado o ID inválido.
     */
    if (
      error instanceof Error &&
      (error.message === "Pedido no encontrado" ||
        error.message === "ID inválido")
    ) {
      return errorResponse(error.message, 404);
    }

    console.error("UPDATE_FULL_ORDER_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}