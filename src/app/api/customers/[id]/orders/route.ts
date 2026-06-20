import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import {
  createOrderService,
  getOrdersByCustomerIdService,
} from "@/modules/orders/order.service";
import { createOrderSchema } from "@/modules/orders/order.dto";

/**
 * Tipo correcto para ruta dinámica:
 * /api/customers/:id/orders
 *
 * En Next.js actual, params viene como Promise.
 */
type CustomerOrdersRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * Convierte el id del cliente a número.
 *
 * Beneficio:
 * - Evita que lleguen valores inválidos como "abc", "0" o negativos.
 * - Centraliza la validación del ID.
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
 *
 * Beneficio:
 * - Permite ver todos los pedidos anteriores de una persona.
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

/**
 * POST /api/customers/:id/orders
 *
 * Crea un pedido para un cliente específico.
 *
 * Nueva lógica:
 * - El customerId viene desde la URL.
 * - El body trae artículos con SKU.
 * - El backend crea el producto automáticamente si no existe.
 *
 * Body esperado:
 * {
 *   "items": [
 *     {
 *       "sku": "A123",
 *       "name": "Perfume floral",
 *       "description": "Perfume de catálogo 100ml",
 *       "quantity": 2,
 *       "unitPrice": 250
 *     }
 *   ],
 *   "deliveryDate": null,
 *   "notes": "Pedido de prueba"
 * }
 *
 * Beneficio:
 * - El usuario crea el pedido y el catálogo se actualiza solo.
 * - Evitamos obligarlo a registrar productos uno por uno antes de vender.
 */
export async function POST(
  request: NextRequest,
  context: CustomerOrdersRouteContext
) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const params = await context.params;
    const customerId = parseCustomerId(params.id);

    const body = await request.json();

    /**
     * Inyectamos customerId desde la URL.
     *
     * Beneficio:
     * - El frontend no necesita mandar customerId en el body.
     * - Evitamos inconsistencias como URL cliente 1 pero body cliente 2.
     */
    const validation = createOrderSchema.safeParse({
      ...body,
      customerId,
    });

    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    /**
     * El sellerId se toma del token.
     *
     * Beneficio:
     * - Nadie puede crear pedidos fingiendo ser otro vendedor.
     */
    const order = await createOrderService(validation.data, authUser.userId);

    return successResponse(order, "Pedido creado correctamente", 201);
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
        error.message === "Cliente inactivo" ||
        error.message === "ID inválido")
    ) {
      return errorResponse(error.message, 404);
    }

    console.error("CREATE_CUSTOMER_ORDER_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}