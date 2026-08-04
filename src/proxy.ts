import { NextRequest, NextResponse } from "next/server";

/**
 * Orígenes permitidos para consumir la API.
 *
 * Desarrollo:
 * - Web Vite: localhost:5173
 * - Expo Web: localhost:8081
 * - Expo Web alternativo: 127.0.0.1:8081
 * - IP local para pruebas en red
 *
 * Producción:
 * - Aquí agregaremos después la URL de la web en Vercel.
 */
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",

  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://192.168.100.198:8081",

  "http://localhost:19006",
  "http://127.0.0.1:19006",
];

function getCorsOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }

  return allowedOrigins[0];
}

/**
 * Proxy global para rutas /api.
 *
 * Para qué sirve:
 * - Permite que web y Expo consuman el backend.
 * - Responde correctamente a preflight OPTIONS.
 * - Evita repetir headers CORS en cada route.ts.
 */
export function proxy(request: NextRequest) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": getCorsOrigin(request),
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };

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