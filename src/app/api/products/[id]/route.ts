import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { updateProductSchema } from "@/modules/products/product.dto";
import {
  deactivateProductService,
  getProductByIdService,
  updateProductService,
} from "@/modules/products/product.service";

/**
 * Tipo correcto para rutas dinámicas en Next.js nuevo.
 */
type ProductRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * Convierte el parámetro id de la URL a número.
 */
function parseProductId(id: string): number {
  const productId = Number(id);

  if (Number.isNaN(productId) || productId <= 0) {
    throw new Error("ID inválido");
  }

  return productId;
}

/**
 * GET /api/products/:id
 *
 * Obtiene un producto por ID.
 */
export async function GET(request: NextRequest, context: ProductRouteContext) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const params = await context.params;
    const productId = parseProductId(params.id);

    const product = await getProductByIdService(productId);

    return successResponse(product, "Producto obtenido correctamente");
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
      (error.message === "Producto no encontrado" ||
        error.message === "ID inválido")
    ) {
      return errorResponse(error.message, 404);
    }

    console.error("GET_PRODUCT_BY_ID_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}

/**
 * PUT /api/products/:id
 *
 * Actualiza un producto.
 *
 * Solo ADMIN puede modificar productos.
 */
export async function PUT(request: NextRequest, context: ProductRouteContext) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN"]);

    const params = await context.params;
    const productId = parseProductId(params.id);

    const body = await request.json();

    const result = updateProductSchema.safeParse(body);

    if (!result.success) {
      return validationErrorResponse(result.error.flatten());
    }

    const product = await updateProductService(productId, result.data);

    return successResponse(product, "Producto actualizado correctamente");
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
      (error.message === "Producto no encontrado" ||
        error.message === "ID inválido")
    ) {
      return errorResponse(error.message, 404);
    }

    console.error("UPDATE_PRODUCT_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}

/**
 * DELETE /api/products/:id
 *
 * Desactiva un producto.
 *
 * Solo ADMIN puede desactivar productos.
 */
export async function DELETE(
  request: NextRequest,
  context: ProductRouteContext
) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN"]);

    const params = await context.params;
    const productId = parseProductId(params.id);

    const product = await deactivateProductService(productId);

    return successResponse(product, "Producto desactivado correctamente");
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
      (error.message === "Producto no encontrado" ||
        error.message === "ID inválido")
    ) {
      return errorResponse(error.message, 404);
    }

    console.error("DELETE_PRODUCT_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}