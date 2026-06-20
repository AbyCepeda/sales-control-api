import { NextRequest, NextResponse } from "next/server";

/**
 * Orígenes permitidos para consumir la API.
 *
 * En desarrollo necesitamos permitir:
 * - Expo Web en localhost:8081
 * - Expo Web en 127.0.0.1:8081
 * - Tu IP local para pruebas en red local
 */
const allowedOrigins = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://192.168.100.198:8081",
];

/**
 * Proxy global para rutas /api.
 *
 * En Next 16, proxy.ts reemplaza el antiguo middleware.ts.
 *
 * Beneficio:
 * - Permite que el frontend Expo consuma el backend.
 * - Responde correctamente a preflight OPTIONS.
 * - Evita repetir headers CORS en cada route.ts.
 */
export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");

  const isAllowedOrigin = origin && allowedOrigins.includes(origin);

  const corsHeaders = {
    "Access-Control-Allow-Origin": isAllowedOrigin ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };

  /**
   * El navegador manda OPTIONS antes de ciertos requests.
   *
   * Si no respondemos esto, el POST real nunca llega al backend.
   */
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const response = NextResponse.next();

  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Aplicamos este proxy solo a rutas API.
 */
export const config = {
  matcher: "/api/:path*",
};