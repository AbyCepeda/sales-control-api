import { NextRequest, NextResponse } from "next/server";

/**
 * Orígenes permitidos para consumir la API.
 *
 * Para qué sirve:
 * - Permite que Expo Web y el celular puedan consumir el backend.
 *
 * Beneficio:
 * - Evita errores CORS al hacer login o consumir endpoints desde el front.
 */
const allowedOrigins = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://192.168.100.198:8081",
];

/**
 * Middleware global de CORS.
 *
 * Para qué sirve:
 * - Agrega headers CORS a todas las rutas /api.
 * - Responde correctamente las peticiones OPTIONS.
 *
 * Beneficio:
 * - El navegador deja pasar peticiones POST, PUT, DELETE con JSON y Authorization.
 */
export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");

  const isAllowedOrigin = origin && allowedOrigins.includes(origin);

  const corsHeaders = {
    "Access-Control-Allow-Origin": isAllowedOrigin ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };

  /**
   * El navegador manda OPTIONS antes de un POST con Authorization.
   *
   * Si no respondemos OPTIONS bien, el login falla antes de llegar
   * al endpoint real.
   */
  if (request.method === "OPTIONS") {
    return NextResponse.json({}, { headers: corsHeaders });
  }

  const response = NextResponse.next();

  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Aplica este middleware solo a rutas /api.
 *
 * Beneficio:
 * - No afecta páginas normales de Next.
 */
export const config = {
  matcher: "/api/:path*",
};