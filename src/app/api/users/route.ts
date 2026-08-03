import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { createUserSchema } from "@/modules/users/user.dto";
import { createUserService, getUsersService } from "@/modules/users/user.service";

export async function GET(request: NextRequest) {
  try {
    const authUser = requireAuth(request);

    requireRole(authUser, ["ADMIN"]);

    const users = await getUsersService();

    return successResponse(users, "Usuarios obtenidos correctamente");
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

    console.error("GET_USERS_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = requireAuth(request);

    requireRole(authUser, ["ADMIN"]);

    const body = await request.json();

    const validation = createUserSchema.safeParse(body);

    if (!validation.success) {
      return validationErrorResponse(validation.error.flatten());
    }

    const user = await createUserService(validation.data);

    return successResponse(user, "Usuario creado correctamente", 201);
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
      error.message === "Ya existe un usuario con ese email"
    ) {
      return errorResponse(error.message, 409);
    }

    console.error("CREATE_USER_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}