import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { createCustomerSchema } from "@/modules/customers/customer.dto";
import {
  createCustomerService,
  getCustomersService,
} from "@/modules/customers/customer.service";

/**
 * GET /api/customers
 *
 * Lista todos los clientes.
 * Esta ruta NO es dinámica, por eso NO recibe params.
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const customers = await getCustomersService();

    return successResponse(customers, "Clientes obtenidos correctamente");
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

    console.error("GET_CUSTOMERS_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}

/**
 * POST /api/customers
 *
 * Crea un cliente nuevo.
 * Esta ruta NO es dinámica, por eso NO recibe params.
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const body = await request.json();

    const result = createCustomerSchema.safeParse(body);

    if (!result.success) {
      return validationErrorResponse(result.error.flatten());
    }

    const customer = await createCustomerService(result.data);

    return successResponse(customer, "Cliente creado correctamente", 201);
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

    console.error("CREATE_CUSTOMER_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}