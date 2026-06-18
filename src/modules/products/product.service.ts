import { prisma } from "@/lib/prisma";
import type {
  CreateProductDto,
  UpdateProductDto,
} from "./product.dto";

/**
 * Obtiene todos los productos.
 *
 * Por defecto mostramos primero los productos activos.
 * Esto ayuda a que el vendedor vea primero lo que sí puede vender.
 */
export async function getProductsService() {
  return prisma.product.findMany({
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
 * Busca un producto por ID.
 *
 * Si no existe, lanzamos error para que el route decida cómo responder.
 */
export async function getProductByIdService(id: number) {
  const product = await prisma.product.findUnique({
    where: {
      id,
    },
  });

  if (!product) {
    throw new Error("Producto no encontrado");
  }

  return product;
}

/**
 * Crea un producto nuevo.
 *
 * Este service solo recibe datos ya validados por el DTO.
 */
export async function createProductService(data: CreateProductDto) {
  return prisma.product.create({
    data: {
      name: data.name,
      description: data.description,
      price: data.price,
      stock: data.stock,
      isActive: data.isActive,
    },
  });
}

/**
 * Actualiza un producto existente.
 *
 * Primero verificamos que exista para devolver un error claro.
 */
export async function updateProductService(
  id: number,
  data: UpdateProductDto
) {
  await getProductByIdService(id);

  return prisma.product.update({
    where: {
      id,
    },
    data: {
      name: data.name,
      description: data.description,
      price: data.price,
      stock: data.stock,
      isActive: data.isActive,
    },
  });
}

/**
 * Desactiva un producto.
 *
 * No lo borramos físicamente porque podría estar relacionado
 * con ventas históricas.
 */
export async function deactivateProductService(id: number) {
  await getProductByIdService(id);

  return prisma.product.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });
}