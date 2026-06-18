import { NextResponse } from "next/server";

/**
 * Respuesta correcta estándar.
 *
 * Todas las respuestas exitosas deberían tener la misma forma.
 * Esto le ayuda mucho a RTK Query en el frontend/móvil.
 */
export function successResponse<T>(
  data: T,
  message = "Operación exitosa",
  status = 200
) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status }
  );
}

/**
 * Respuesta de error estándar.
 *
 * No exponemos errores internos directamente al usuario.
 * Solo mandamos un mensaje claro y controlado.
 */
export function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

/**
 * Respuesta para errores de validación.
 *
 * La usaremos cuando Zod detecte que faltan campos
 * o que los datos vienen con formato incorrecto.
 */
export function validationErrorResponse(errors: unknown) {
  return NextResponse.json(
    {
      success: false,
      message: "Datos inválidos",
      errors,
    },
    { status: 422 }
  );
}