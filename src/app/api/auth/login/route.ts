import { loginSchema } from "@/modules/auth/auth.dto";
import { loginService } from "@/modules/auth/auth.service";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";

/**
 * POST /api/auth/login
 *
 * Este endpoint recibe email y password.
 * Si las credenciales son correctas, devuelve token y usuario.
 */
export async function POST(request: Request) {
  try {
    /**
     * Leemos el body de la petición.
     *
     * Si el cliente manda JSON mal formado, esto puede lanzar error.
     */
    const body = await request.json();

    /**
     * Validamos el body con Zod.
     *
     * safeParse no lanza error.
     * Nos devuelve success true/false.
     */
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return validationErrorResponse(result.error.flatten());
    }

    /**
     * Mandamos los datos ya validados al service.
     *
     * El route no debe hacer la lógica del login.
     * Solo coordina entrada y salida.
     */
    const loginData = await loginService(result.data);

    return successResponse(loginData, "Login exitoso");
  } catch (error) {
    /**
     * Si el service lanza error de credenciales, respondemos 401.
     */
    if (error instanceof Error && error.message === "Credenciales inválidas") {
      return errorResponse(error.message, 401);
    }

    /**
     * Cualquier otro error es interno.
     *
     * No mandamos el error real al cliente para no exponer detalles.
     */
    console.error("LOGIN_ERROR:", error);

    return errorResponse("Error interno del servidor", 500);
  }
}