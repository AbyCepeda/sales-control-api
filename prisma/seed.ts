import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

/**
 * Adapter de Prisma 7 para conectar con MySQL/MariaDB.
 *
 * Usamos la misma configuración que en src/lib/prisma.ts.
 */
const adapter = new PrismaMariaDb({
  host: "localhost",
  port: 3310,
  user: "root",
  password: "root",
  database: "sales_control_db",
});

/**
 * Cliente Prisma usado únicamente para ejecutar el seed.
 */
const prisma = new PrismaClient({
  adapter,
});

/**
 * Seed principal.
 *
 * Crea usuarios base para probar roles:
 * - ADMIN
 * - SELLER
 */
async function main() {
  /**
   * Creamos contraseña encriptada para admin.
   *
   * Nunca guardes contraseñas en texto plano.
   */
  const adminPassword = await bcrypt.hash("admin123", 10);

  /**
   * upsert:
   * - Si existe admin@test.com, no lo duplica.
   * - Si no existe, lo crea.
   */
  const admin = await prisma.user.upsert({
    where: {
      email: "admin@test.com",
    },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@test.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  console.log("Usuario admin creado:", admin.email);

  /**
   * Creamos contraseña encriptada para vendedor.
   */
  const sellerPassword = await bcrypt.hash("seller123", 10);

  /**
   * Usuario vendedor para probar permisos.
   *
   * Este usuario NO debe poder crear productos,
   * pero sí puede crear clientes y pedidos.
   */
  const seller = await prisma.user.upsert({
    where: {
      email: "seller@test.com",
    },
    update: {},
    create: {
      name: "Vendedor",
      email: "seller@test.com",
      password: sellerPassword,
      role: "SELLER",
    },
  });

  console.log("Usuario seller creado:", seller.email);
}

/**
 * Ejecutamos el seed y manejamos errores.
 */
main()
  .catch((error) => {
    console.error("SEED_ERROR:", error);
    process.exit(1);
  })
  .finally(async () => {
    /**
     * Cerramos conexión con la base de datos.
     */
    await prisma.$disconnect();
  });