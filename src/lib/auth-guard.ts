import { verifyToken } from "@/lib/jwt";
import type { AppJwtPayload } from "@/lib/jwt";

/**
 * Extrae el token JWT desde el header Authorization.
 *
 * El formato esperado es:
 * Authorization: Bearer token_aqui
 */
function getTokenFromAuthorizationHeader(request: Request): string | null {
  const authorizationHeader = request.headers.get("authorization");

  /**
   * Si no viene el header Authorization, no hay token.
   */
  if (!authorizationHeader) {
    return null;
  }

  /**
   * El header debe empezar con "Bearer ".
   *
   * Ejemplo correcto:
   * Bearer eyJhbGciOiJIUzI1NiIs...
   */
  if (!authorizationHeader.startsWith("Bearer ")) {
    return null;
  }

  /**
   * Quitamos la palabra "Bearer " y nos quedamos solo con el token.
   */
  const token = authorizationHeader.replace("Bearer ", "").trim();

  if (!token) {
    return null;
  }

  return token;
}

/**
 * Valida que la petición tenga un token JWT correcto.
 *
 * Si el token existe y es válido, devuelve el payload del usuario.
 * Si no existe o es inválido, lanza error.
 */
export function requireAuth(request: Request): AppJwtPayload {
  const token = getTokenFromAuthorizationHeader(request);

  if (!token) {
    throw new Error("Token no proporcionado");
  }

  try {
    return verifyToken(token);
  } catch {
    throw new Error("Token inválido o expirado");
  }
}