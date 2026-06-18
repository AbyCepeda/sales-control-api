import { prisma } from "@/lib/prisma";
import type {
  CreateCustomerDto,
  UpdateCustomerDto,
} from "./customer.dto";

/**
 * Obtiene todos los clientes.
 *
 * Ordenamos primero los activos y después los más recientes.
 * Así la app puede mostrar clientes vigentes arriba.
 */
export async function getCustomersService() {
  return prisma.customer.findMany({
    orderBy: [
      {
        isActive: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}

/**
 * Busca un cliente por ID.
 *
 * Si no existe, lanzamos error para que el route responda 404.
 */
export async function getCustomerByIdService(id: number) {
  const customer = await prisma.customer.findUnique({
    where: {
      id,
    },
  });

  if (!customer) {
    throw new Error("Cliente no encontrado");
  }

  return customer;
}

/**
 * Crea un cliente nuevo.
 *
 * El cliente queda activo por defecto.
 */
export async function createCustomerService(data: CreateCustomerDto) {
  return prisma.customer.create({
    data: {
      name: data.name,
      phone: data.phone,
      notes: data.notes,
      isActive: data.isActive,
    },
  });
}

/**
 * Actualiza un cliente existente.
 *
 * Primero verificamos que exista para devolver un error claro.
 */
export async function updateCustomerService(
  id: number,
  data: UpdateCustomerDto
) {
  await getCustomerByIdService(id);

  return prisma.customer.update({
    where: {
      id,
    },
    data: {
      name: data.name,
      phone: data.phone,
      notes: data.notes,
      isActive: data.isActive,
    },
  });
}

/**
 * Desactiva un cliente.
 *
 * No lo borramos físicamente porque puede tener pedidos anteriores.
 * Borrar clientes con historial es mala decisión para este negocio.
 */
export async function deactivateCustomerService(id: number) {
  await getCustomerByIdService(id);

  return prisma.customer.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });
}