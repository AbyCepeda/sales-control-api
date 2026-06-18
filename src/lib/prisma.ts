import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * Adapter de conexión para Prisma 7.
 *
 * Prisma 7 ya no toma la URL directamente desde schema.prisma
 * para crear PrismaClient. Por eso usamos un adapter.
 *
 * En desarrollo usamos root porque Prisma Migrate necesita permisos
 * para crear la shadow database.
 */
const adapter = new PrismaMariaDb({
  host: "localhost",
  port: 3310,
  user: "root",
  password: "root",
  database: "sales_control_db",
});

/**
 * Guardamos Prisma en globalThis para evitar crear muchas conexiones
 * cuando Next.js recarga archivos en modo desarrollo.
 *
 * Sin esto, en desarrollo podrías terminar con demasiadas conexiones
 * abiertas a MySQL.
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