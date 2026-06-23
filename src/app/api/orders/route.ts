import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import {
  createOrderService,
  getOrdersService,
} from "@/modules/orders/order.service";
import {
  createOrderSchema,
  orderFiltersSchema,
} from "@/modules/orders/order.dto";

/**
 * GET /api/orders
 *
 * Obtiene pedidos generales.
 *
 * Soporta filtros:
 * - status
 * - customerId
 * - from
 * - to
 *
 * Ejemplo:
 * /api/orders?status=PENDING
 * /api/orders?customerId=1
 *
 * Beneficio:
 * - Permite listar pedidos generales.
 * - Permite filtrar por cliente aunque un pedido tenga varios clientes.
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const searchParams = request.nextUrl.searchParams;

    /**
     * Convertimos query params a objeto.
     *
     * Beneficio:
     * - Zod puede validar filtros desde la URL.
     */
    const filtersValidation = orderFiltersSchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      customerId: searchParams.get("customerId") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });

    if (!filtersValidation.success) {
      return validationErrorResponse(filtersValidation.error);
    }

    const orders = await getOrdersService(filtersValidation.data, authUser);

    return successResponse(orders, "Pedidos obtenidos correctamente");
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

    console.error("GET_ORDERS_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}

/**
 * POST /api/orders
 *
 * Crea un pedido general con varios clientes.
 *
 * Body esperado:
 * {
 *   "notes": "Pedido campaña junio",
 *   "deliveryDate": null,
 *   "customers": [
 *     {
 *       "customerId": 1,
 *       "notes": "Pedido de María",
 *       "items": [
 *         {
 *           "sku": "A123",
 *           "name": "Perfume floral",
 *           "description": "Perfume 100ml",
 *           "quantity": 2,
 *           "unitPrice": 250
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * Beneficio:
 * - Un solo pedido puede contener varios clientes.
 * - Cada cliente tiene sus propios artículos.
 * - Los productos se crean automáticamente por SKU.
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const body = await request.json();

    const validation = createOrderSchema.safeParse(body);

    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    /**
     * El sellerId sale del token.
     *
     * Beneficio:
     * - El frontend no puede fingir pedidos de otro vendedor.
     */
    const order = await createOrderService(validation.data, authUser.userId);

    return successResponse(order, "Pedido creado correctamente", 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return validationErrorResponse(error);
    }

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
      (error.message.startsWith("Cliente no encontrado") ||
        error.message.startsWith("Cliente inactivo"))
    ) {
      return errorResponse(error.message, 404);
    }

    console.error("CREATE_ORDER_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}