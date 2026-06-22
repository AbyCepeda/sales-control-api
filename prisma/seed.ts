import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

/**
 * Adapter de MariaDB/MySQL para Prisma 7.
 *
 * Debe coincidir con la conexión del backend.
 *
 * Beneficio:
 * - Permite ejecutar el seed usando la misma base de datos.
 */
const adapter = new PrismaMariaDb({
  host: "localhost",
  port: 3310,
  user: "root",
  password: "root",
  database: "sales_control_db",
  allowPublicKeyRetrieval: true,
});

/**
 * Cliente Prisma para insertar datos iniciales.
 */
const prisma = new PrismaClient({
  adapter,
});

/**
 * Seed principal.
 *
 * Crea:
 * - Usuario ADMIN
 * - Usuario SELLER
 * - Cliente de prueba
 *
 * Beneficio:
 * - Después de hacer migrate reset puedes volver a iniciar sesión.
 * - Puedes probar clientes y pedidos sin capturar todo manualmente.
 */
async function main() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  const sellerPassword = await bcrypt.hash("seller123", 10);

  /**
   * Usuario administrador.
   *
   * Login:
   * admin@test.com
   * admin123
   */
  const admin = await prisma.user.upsert({
    where: {
      email: "admin@test.com",
    },
    update: {
      name: "Administrador",
      password: adminPassword,
      role: "ADMIN",
    },
    create: {
      name: "Administrador",
      email: "admin@test.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  /**
   * Usuario vendedor.
   *
   * Login:
   * seller@test.com
   * seller123
   */
  const seller = await prisma.user.upsert({
    where: {
      email: "seller@test.com",
    },
    update: {
      name: "Vendedor Demo",
      password: sellerPassword,
      role: "SELLER",
    },
    create: {
      name: "Vendedor Demo",
      email: "seller@test.com",
      password: sellerPassword,
      role: "SELLER",
    },
  });

  /**
   * Cliente de prueba.
   *
   * Nota:
   * Tu modelo Customer NO tiene address ni reference.
   * Por eso usamos notes.
   */
  const customer = await prisma.customer.upsert({
    where: {
      id: 1,
    },
    update: {
      name: "Cliente de prueba",
      phone: "8440000000",
      notes: "Cliente creado desde seed para pruebas",
      isActive: true,
    },
    create: {
      name: "Cliente de prueba",
      phone: "8440000000",
      notes: "Cliente creado desde seed para pruebas",
      isActive: true,
    },
  });

  console.log("Seed ejecutado correctamente");

  console.log({
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
    seller: {
      id: seller.id,
      email: seller.email,
      role: seller.role,
    },
    customer: {
      id: customer.id,
      name: customer.name,
    },
  });
}

/**
 * Ejecuta el seed y cierra la conexión.
 *
 * Beneficio:
 * - Evita que la terminal se quede colgada.
 */
main()
  .catch((error) => {
    console.error("SEED_ERROR:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });