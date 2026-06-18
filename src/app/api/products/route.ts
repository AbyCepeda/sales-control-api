import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { createProductSchema } from "@/modules/products/product.dto";
import {
  createProductService,
  getProductsService,
} from "@/modules/products/product.service";

/**
 * GET /api/products
 *
 * Lista todos los productos.
 *
 * Permisos:
 * - ADMIN puede ver productos.
 * - SELLER puede ver productos.
 *
 * Motivo:
 * El vendedor necesita ver productos para poder crear pedidos.
 */
export async function GET(request: Request) {
  try {
    /**
     * Validamos que el usuario tenga un token correcto.
     */
    const authUser = requireAuth(request);

    /**
     * Validamos roles permitidos.
     *
     * Aquí permitimos ADMIN y SELLER porque ambos pueden consultar catálogo.
     */
    requireRole(authUser, ["ADMIN", "SELLER"]);

    const products = await getProductsService();

    return successResponse(products, "Productos obtenidos correctamente");
  } catch (error) {
    /**
     * Errores de autenticación.
     */
    if (
      error instanceof Error &&
      (error.message === "Token no proporcionado" ||
        error.message === "Token inválido o expirado")
    ) {
      return errorResponse(error.message, 401);
    }

    /**
     * Errores de autorización.
     */
    if (
      error instanceof Error &&
      error.message === "No tienes permisos para realizar esta acción"
    ) {
      return errorResponse(error.message, 403);
    }

    console.error("GET_PRODUCTS_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}

/**
 * POST /api/products
 *
 * Crea un producto nuevo.
 *
 * Permisos:
 * - Solo ADMIN puede crear productos.
 *
 * Motivo:
 * El catálogo debe estar controlado.
 * Si cualquier vendedor crea productos, puedes terminar con duplicados,
 * precios mal puestos o productos basura.
 */
export async function POST(request: Request) {
  try {
    /**
     * Primero validamos que exista token.
     */
    const authUser = requireAuth(request);

    /**
     * Después validamos que el usuario tenga rol ADMIN.
     */
    requireRole(authUser, ["ADMIN"]);

    /**
     * Leemos el body enviado por el cliente.
     */
    const body = await request.json();

    /**
     * Validamos los datos con Zod.
     */
    const result = createProductSchema.safeParse(body);

    if (!result.success) {
      return validationErrorResponse(result.error.flatten());
    }

    /**
     * Mandamos los datos ya validados al service.
     */
    const product = await createProductService(result.data);

    return successResponse(product, "Producto creado correctamente", 201);
  } catch (error) {
    /**
     * Errores de autenticación.
     */
    if (
      error instanceof Error &&
      (error.message === "Token no proporcionado" ||
        error.message === "Token inválido o expirado")
    ) {
      return errorResponse(error.message, 401);
    }

    /**
     * Errores de autorización.
     */
    if (
      error instanceof Error &&
      error.message === "No tienes permisos para realizar esta acción"
    ) {
      return errorResponse(error.message, 403);
    }

    console.error("CREATE_PRODUCT_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}