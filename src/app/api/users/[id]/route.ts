import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireRole } from "@/lib/roles";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { updateUserSchema } from "@/modules/users/user.dto";
import { updateUserService } from "@/modules/users/user.service";

type UserRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseUserId(id: string): number {
  const parsedId = Number(id);

  if (Number.isNaN(parsedId) || parsedId <= 0) {
    throw new Error("ID inválido");
  }

  return parsedId;
}

export async function PUT(request: NextRequest, context: UserRouteContext) {
  try {
    const authUser = requireAuth(request);

    requireRole(authUser, ["ADMIN"]);

    const params = await context.params;
    const userId = parseUserId(params.id);

    const body = await request.json();

    const validation = updateUserSchema.safeParse(body);

    if (!validation.success) {
      return validationErrorResponse(validation.error.flatten());
    }

    const user = await updateUserService(userId, validation.data);

    return successResponse(user, "Usuario actualizado correctamente");
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
      (error.message === "Usuario no encontrado" ||
        error.message === "ID inválido")
    ) {
      return errorResponse(error.message, 404);
    }

    if (
      error instanceof Error &&
      error.message === "Ya existe un usuario con ese email"
    ) {
      return errorResponse(error.message, 409);
    }

    console.error("UPDATE_USER_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}