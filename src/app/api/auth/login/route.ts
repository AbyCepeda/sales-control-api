import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/modules/auth/auth.dto";
import { loginService } from "@/modules/auth/auth.service";

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8081",
  "http://localhost:19006",
];

function getCorsOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }

  return "http://localhost:5173";
}

function getCorsHeaders(request: NextRequest) {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(request),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(
  request: NextRequest,
  body: unknown,
  status: number = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: getCorsHeaders(request),
  });
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return jsonResponse(
        request,
        {
          success: false,
          message: "Error de validación",
          errors: validation.error.flatten(),
        },
        422,
      );
    }

    const loginResponse = await loginService(validation.data);

    return jsonResponse(
      request,
      {
        success: true,
        message: "Inicio de sesión correcto",
        data: loginResponse,
      },
      200,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Credenciales inválidas") {
      return jsonResponse(
        request,
        {
          success: false,
          message: error.message,
        },
        401,
      );
    }

    if (error instanceof Error && error.message === "Usuario desactivado") {
      return jsonResponse(
        request,
        {
          success: false,
          message: "No puedes iniciar sesión porque tu usuario está desactivado",
        },
        403,
      );
    }

    console.error("LOGIN_ERROR:", error);

    return jsonResponse(
      request,
      {
        success: false,
        message: "Error interno del servidor",
      },
      500,
    );
  }
}