import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * Configuración de conexión a MySQL/MariaDB.
 *
 * IMPORTANTE:
 * Estamos usando Prisma 7 con adapter.
 *
 * allowPublicKeyRetrieval:
 * - Permite que el cliente pueda obtener la llave pública RSA de MySQL.
 * - Soluciona el error:
 *   "RSA public key is not available client side"
 */
const adapter = new PrismaMariaDb({
  host: "localhost",
  port: 3310,
  user: "root",
  password: "root",
  database: "sales_control_db",

  /**
   * Necesario para algunos contenedores MySQL 8.
   *
   * Beneficio:
   * Evita errores de conexión relacionados con autenticación RSA.
   */
  allowPublicKeyRetrieval: true,
});

/**
 * Evita crear muchas instancias de PrismaClient en desarrollo.
 *
 * En Next.js, por el hot reload, el código puede recargarse varias veces.
 * Si creamos PrismaClient en cada recarga, podemos saturar conexiones.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Cliente Prisma global.
 *
 * Beneficio:
 * - Reutiliza conexión en desarrollo.
 * - Evita problemas de pool/conexiones duplicadas.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}