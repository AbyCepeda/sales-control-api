import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/bcrypt";
import { signToken } from "@/lib/jwt";
import type { LoginDto } from "./auth.dto";
import type { AuthUser, LoginResponse } from "./auth.types";

/**
 * Servicio de autenticación.
 *
 * Los services contienen lógica de negocio.
 * No deben depender directamente de NextResponse ni de HTTP.
 */
export async function loginService(data: LoginDto): Promise<LoginResponse> {
  /**
   * Buscamos al usuario por email.
   *
   * email es único en schema.prisma, por eso usamos findUnique.
   */
  const user = await prisma.user.findUnique({
    where: {
      email: data.email,
    },
  });

  /**
   * Si no existe el usuario, usamos mensaje genérico.
   *
   * No conviene decir "el correo no existe", porque eso ayuda
   * a que alguien pueda adivinar usuarios registrados.
   */
  if (!user) {
    throw new Error("Credenciales inválidas");
  }

  /**
   * Comparamos la contraseña escrita contra la contraseña hasheada.
   */
  const passwordIsValid = await comparePassword(data.password, user.password);

  if (!passwordIsValid) {
    throw new Error("Credenciales inválidas");
  }

  /**
   * Creamos el token con datos mínimos del usuario.
   */
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  /**
   * Regresamos un usuario limpio.
   *
   * Aquí NO incluimos password.
   */
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

/**
 * Busca al usuario autenticado por su ID.
 *
 * Esta función se usa en /api/auth/me para saber quién está
 * haciendo la petición según el token.
 */
export async function getAuthUserById(userId: number): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  /**
   * Si el token trae un userId que ya no existe en base de datos,
   * la sesión ya no debe considerarse válida.
   */
  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  return user;
}