import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { updateCustomerSchema } from "@/modules/customers/customer.dto";
import {
  deactivateCustomerService,
  getCustomerByIdService,
  updateCustomerService,
} from "@/modules/customers/customer.service";

/**
 * Tipo correcto para rutas dinámicas en Next.js nuevo.
 *
 * En esta versión, params llega como Promise.
 * Por eso en cada método usamos:
 * const params = await context.params;
 */
type CustomerRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * Convierte el id recibido por URL a número.
 *
 * Next entrega params como string.
 * Prisma necesita number porque el id es Int.
 */
function parseCustomerId(id: string): number {
  const customerId = Number(id);

  if (Number.isNaN(customerId) || customerId <= 0) {
    throw new Error("ID inválido");
  }

  return customerId;
}

/**
 * GET /api/customers/:id
 *
 * Obtiene un cliente por ID.
 */
export async function GET(request: NextRequest, context: CustomerRouteContext) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    /**
     * En rutas dinámicas, params es Promise.
     */
    const params = await context.params;
    const customerId = parseCustomerId(params.id);

    const customer = await getCustomerByIdService(customerId);

    return successResponse(customer, "Cliente obtenido correctamente");
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

    console.error("GET_CUSTOMER_BY_ID_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}

/**
 * PUT /api/customers/:id
 *
 * Actualiza un cliente.
 */
export async function PUT(request: NextRequest, context: CustomerRouteContext) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const params = await context.params;
    const customerId = parseCustomerId(params.id);

    const body = await request.json();

    const result = updateCustomerSchema.safeParse(body);

    if (!result.success) {
      return validationErrorResponse(result.error.flatten());
    }

    const customer = await updateCustomerService(customerId, result.data);

    return successResponse(customer, "Cliente actualizado correctamente");
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

    console.error("UPDATE_CUSTOMER_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}

/**
 * DELETE /api/customers/:id
 *
 * Desactiva un cliente.
 *
 * No lo borramos físicamente porque puede tener pedidos anteriores.
 */
export async function DELETE(
  request: NextRequest,
  context: CustomerRouteContext
) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const params = await context.params;
    const customerId = parseCustomerId(params.id);

    const customer = await deactivateCustomerService(customerId);

    return successResponse(customer, "Cliente desactivado correctamente");
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

    console.error("DEACTIVATE_CUSTOMER_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}