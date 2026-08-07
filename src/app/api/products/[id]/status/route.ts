import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { updateProductStatusSchema } from "@/modules/products/product.dto";
import { updateProductStatusService } from "@/modules/products/product.service";

type ProductStatusRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseProductId(id: string): number {
  const productId = Number(id);

  if (Number.isNaN(productId) || productId <= 0) {
    throw new Error("ID inválido");
  }

  return productId;
}

/**
 * PATCH /api/products/:id/status
 *
 * Activa o desactiva un producto.
 *
 * Solo ADMIN puede cambiar el estado de un producto.
 */
export async function PATCH(
  request: NextRequest,
  context: ProductStatusRouteContext,
) {
  try {
    const authUser = requireAuth(request);
    requireRole(authUser, ["ADMIN"]);

    const params = await context.params;
    const productId = parseProductId(params.id);

    const body = await request.json();

    const result = updateProductStatusSchema.safeParse(body);

    if (!result.success) {
      return validationErrorResponse(result.error.flatten());
    }

    const product = await updateProductStatusService(
      productId,
      result.data.isActive,
    );

    return successResponse(
      product,
      result.data.isActive
        ? "Producto activado correctamente"
        : "Producto desactivado correctamente",
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

    console.error("UPDATE_PRODUCT_STATUS_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}