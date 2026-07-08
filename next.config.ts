import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Mantiene activo React Compiler.
   *
   * Para qué sirve:
   * - Optimiza componentes de React automáticamente.
   *
   * Beneficio:
   * - No perdemos tu configuración actual.
   */
  reactCompiler: true,

  /**
   * Headers CORS para las rutas API.
   *
   * Para qué sirve:
   * - Permite que tu app mobile/web en Expo pueda llamar a la API publicada en Vercel.
   *
   * Beneficio:
   * - Soluciona el bloqueo:
   *   "No Access-Control-Allow-Origin header".
   */
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;