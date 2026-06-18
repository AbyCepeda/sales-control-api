import type { UserRole } from "@prisma/client";
import type { AppJwtPayload } from "@/lib/jwt";

/**
 * Valida que el usuario autenticado tenga uno de los roles permitidos.
 *
 * Importante:
 * Esta función NO valida si el token existe.
 * Eso ya lo hace requireAuth().
 *
 * Flujo correcto:
 * 1. requireAuth(request) valida token.
 * 2. requireRole(authUser, ["ADMIN"]) valida permisos.
 */
export function requireRole(
  authUser: AppJwtPayload,
  allowedRoles: UserRole[]
): void {
  /**
   * Revisamos si el rol del usuario está dentro de los roles permitidos.
   */
  const hasPermission = allowedRoles.includes(authUser.role);

  /**
   * Si no tiene permiso, lanzamos error.
   *
   * El route.ts captura este error y responde 403.
   */
  if (!hasPermission) {
    throw new Error("No tienes permisos para realizar esta acción");
  }
}