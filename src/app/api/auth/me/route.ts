import { requireAuth } from "@/lib/auth-guard";
import { errorResponse, successResponse } from "@/lib/api-response";
import { getAuthUserById } from "@/modules/auth/auth.service";

/**
 * GET /api/auth/me
 *
 * Este endpoint valida el token enviado por el cliente
 * y devuelve los datos del usuario autenticado.
 */
export async function GET(request: Request) {
  try {
    /**
     * Validamos el token del header Authorization.
     *
     * Si el token no existe o es inválido, requireAuth lanza error.
     */
    const authPayload = requireAuth(request);

    /**
     * Buscamos al usuario real en base de datos.
     *
     * No confiamos únicamente en el token porque el usuario pudo
     * haber sido eliminado, desactivado o modificado después de iniciar sesión.
     */
    const user = await getAuthUserById(authPayload.userId);

    return successResponse(user, "Usuario autenticado");
  } catch (error) {
    /**
     * Errores esperados de autenticación.
     */
    if (
      error instanceof Error &&
      (error.message === "Token no proporcionado" ||
        error.message === "Token inválido o expirado" ||
        error.message === "Usuario no encontrado")
    ) {
      return errorResponse(error.message, 401);
    }

    /**
     * Si el usuario fue desactivado por ADMIN, su token viejo
     * ya no debe seguir funcionando.
     */
    if (error instanceof Error && error.message === "Usuario desactivado") {
      return errorResponse(
        "Tu usuario está desactivado. Contacta al administrador.",
        403,
      );
    }

    /**
     * Cualquier otro error es interno.
     */
    console.error("AUTH_ME_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}