import type { UserRole } from "@prisma/client";

/**
 * Usuario seguro para devolver al frontend.
 *
 * No incluye password.
 * Nunca regreses el password al cliente, ni aunque esté encriptado.
 */
export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

/**
 * Respuesta que regresa el login.
 */
export type LoginResponse = {
  token: string;
  user: AuthUser;
};