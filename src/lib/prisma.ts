import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * Validamos que exista DATABASE_URL.
 *
 * Para qué sirve:
 * - Render y Neon usarán DATABASE_URL desde variables de entorno.
 *
 * Beneficio:
 * - Si falta la variable, el backend falla con un error claro
 *   y no con un error raro de conexión.
 */
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL no está configurada.");
}

/**
 * Pool de conexión PostgreSQL.
 *
 * Para qué sirve:
 * - Crea conexiones hacia Neon PostgreSQL.
 *
 * Beneficio:
 * - Reemplaza la conexión local MySQL/MariaDB.
 * - Ya no dependemos de localhost:3310.
 */
const pool = new Pool({
  connectionString: databaseUrl,
});

/**
 * Adapter de PostgreSQL para Prisma 7.
 *
 * Para qué sirve:
 * - Prisma 7 necesita adapter para conectarse a la base de datos.
 *
 * Beneficio:
 * - El backend puede conectarse a PostgreSQL/Neon correctamente.
 */
const adapter = new PrismaPg(pool);

/**
 * Guardamos Prisma en globalThis para evitar crear muchas conexiones
 * cuando Next.js recarga archivos en modo desarrollo.
 *
 * Sin esto, en desarrollo podrías terminar con demasiadas conexiones abiertas.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Cliente único de Prisma para usar en todos los services.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

/**
 * Solo guardamos la instancia global en desarrollo.
 * En producción no queremos compartir estado global innecesario.
 */
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}