import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import { errorResponse, successResponse } from "@/lib/api-response";
import { getDashboardService } from "@/modules/dashboard/dashboard.service";

/**
 * GET /api/dashboard
 *
 * Devuelve información resumida para la pantalla principal.
 *
 * Permisos:
 * - ADMIN puede ver dashboard.
 * - SELLER puede ver dashboard.
 */
export async function GET(request: Request) {
  try {
    /**
     * Validamos token.
     */
    const authUser = requireAuth(request);

    /**
     * Validamos rol.
     *
     * Por ahora ambos roles pueden consultar dashboard.
     */
    requireRole(authUser, ["ADMIN", "SELLER"]);

    /**
     * Obtenemos resumen desde el service.
     */
    const dashboard = await getDashboardService(authUser);

    return successResponse(dashboard, "Dashboard obtenido correctamente");
  } catch (error) {
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

    console.error("GET_DASHBOARD_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}