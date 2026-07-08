import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

/**
 * Validamos que exista DATABASE_URL.
 *
 * Para qué sirve:
 * - El seed usará la misma base de datos PostgreSQL que el backend.
 *
 * Beneficio:
 * - Funciona tanto local con Neon como en deploy.
 */
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL no está configurada.");
}

/**
 * Pool de conexión PostgreSQL.
 *
 * Para qué sirve:
 * - Conecta el seed a Neon PostgreSQL usando DATABASE_URL.
 *
 * Beneficio:
 * - Ya no dependemos de MySQL local ni del puerto 3310.
 */
const pool = new Pool({
  connectionString: databaseUrl,
});

/**
 * Adapter PostgreSQL para Prisma 7.
 *
 * Para qué sirve:
 * - Prisma 7 necesita adapter para conectarse a la base.
 *
 * Beneficio:
 * - El seed queda alineado con el backend.
 */
const adapter = new PrismaPg(pool);

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
 * - Después de migrar puedes iniciar sesión.
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
    await pool.end();
  });