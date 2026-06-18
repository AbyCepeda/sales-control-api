import jwt from "jsonwebtoken";
import type { Secret } from "jsonwebtoken";
import type { UserRole } from "@prisma/client";

/**
 * Payload propio de nuestra aplicación.
 *
 * Lo llamamos AppJwtPayload para no confundirlo con el JwtPayload
 * que ya existe dentro de la librería jsonwebtoken.
 */
export type AppJwtPayload = {
  userId: number;
  email: string;
  role: UserRole;
};

/**
 * Obtiene el secreto JWT desde las variables de entorno.
 *
 * ¿Por qué lo hacemos en una función?
 * Porque process.env.JWT_SECRET puede ser string o undefined.
 * Esta función obliga a TypeScript a entender que, si no existe,
 * lanzamos error; y si existe, regresa un Secret válido.
 */
function getJwtSecret(): Secret {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  return secret;
}

/**
 * Genera un token JWT para un usuario autenticado.
 *
 * Este token será guardado por la app móvil y enviado después
 * en las peticiones protegidas usando el header Authorization.
 */
export function signToken(payload: AppJwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: "7d",
  });
}

/**
 * Verifica un token JWT y devuelve su contenido.
 *
 * Si el token fue alterado, expiró o es inválido,
 * jsonwebtoken lanzará un error.
 */
export function verifyToken(token: string): AppJwtPayload {
  const decoded = jwt.verify(token, getJwtSecret());

  /**
   * jsonwebtoken puede devolver string u object.
   * En nuestro caso esperamos un objeto con userId, email y role.
   */
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }

  /**
   * Validación mínima del contenido del token.
   *
   * No confíes ciegamente en un cast de TypeScript.
   * TypeScript no valida datos en ejecución.
   */
  if (
    typeof decoded.userId !== "number" ||
    typeof decoded.email !== "string" ||
    typeof decoded.role !== "string"
  ) {
    throw new Error("Invalid token payload");
  }

  /**
   * Validamos que el rol sea uno de los permitidos.
   */
  if (decoded.role !== "ADMIN" && decoded.role !== "SELLER") {
    throw new Error("Invalid token role");
  }

  return {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role as UserRole,
  };
}