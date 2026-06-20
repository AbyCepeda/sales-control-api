import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CreateOrderDto,
  CreateOrderItemDto,
  OrderFiltersDto,
  UpdateOrderDto,
} from "./order.dto";
import { AppJwtPayload } from "@/lib/jwt";

/**
 * Normaliza los artículos del pedido por SKU.
 *
 * ¿Por qué existe esto?
 * Porque el usuario podría capturar el mismo SKU dos veces:
 *
 * [
 *   { sku: "123", quantity: 1 },
 *   { sku: "123", quantity: 2 }
 * ]
 *
 * En vez de guardar dos líneas repetidas, las juntamos:
 *
 * [
 *   { sku: "123", quantity: 3 }
 * ]
 *
 * Beneficio:
 * - Evita duplicados dentro del pedido.
 * - Facilita el cálculo correcto del total.
 */
function normalizeOrderItems(items: CreateOrderItemDto[]) {
  const itemMap = new Map<string, CreateOrderItemDto>();

  for (const item of items) {
    const currentItem = itemMap.get(item.sku);

    if (!currentItem) {
      itemMap.set(item.sku, item);
      continue;
    }

    itemMap.set(item.sku, {
      ...currentItem,
      /**
       * Si el SKU viene repetido, sumamos cantidades.
       */
      quantity: currentItem.quantity + item.quantity,

      /**
       * Conservamos la última información escrita.
       *
       * Beneficio:
       * - Si el usuario corrigió nombre, descripción o precio
       *   en la segunda captura, usamos esa versión.
       */
      name: item.name,
      description: item.description,
      unitPrice: item.unitPrice,
    });
  }

  return Array.from(itemMap.values());
}

/**
 * Obtiene pedidos con filtros opcionales.
 *
 * Filtros disponibles:
 * - status
 * - customerId
 * - from
 * - to
 *
 * Reglas de permisos:
 * - ADMIN ve todos los pedidos.
 * - SELLER solo ve sus propios pedidos.
 */
export async function getOrdersService(
  filters: OrderFiltersDto,
  authUser: AppJwtPayload
) {
  const where: Prisma.OrderWhereInput = {};

  if (authUser.role === "SELLER") {
    where.sellerId = authUser.userId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.customerId) {
    where.customerId = filters.customerId;
  }

  if (filters.from || filters.to) {
    where.createdAt = {};

    if (filters.from) {
      where.createdAt.gte = new Date(`${filters.from}T00:00:00.000Z`);
    }

    if (filters.to) {
      where.createdAt.lte = new Date(`${filters.to}T23:59:59.999Z`);
    }
  }

  return prisma.order.findMany({
    where,
    include: {
      customer: true,
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      items: {
        include: {
          product: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Crea un pedido nuevo.
 *
 * Nueva lógica:
 * 1. El sellerId sale del token, no del body.
 * 2. El total se calcula en backend.
 * 3. Los artículos llegan con SKU, nombre, descripción, cantidad y precio.
 * 4. Si el producto no existe, se crea automáticamente.
 * 5. Si el producto ya existe, se actualiza con la información más reciente.
 * 6. El OrderItem guarda snapshots del artículo vendido.
 * 7. Todo se hace en una transacción.
 *
 * Beneficio:
 * - El usuario no tiene que registrar productos uno por uno.
 * - Puede crear un pedido como en catálogos tipo Avon/Natura.
 * - Los pedidos anteriores no se dañan si después cambia el producto.
 */
export async function createOrderService(
  data: CreateOrderDto,
  sellerId: number
) {
  return prisma.$transaction(async (tx) => {
    /**
     * Validamos que el cliente exista y esté activo.
     */
    const customer = await tx.customer.findUnique({
      where: {
        id: data.customerId,
      },
    });

    if (!customer) {
      throw new Error("Cliente no encontrado");
    }

    if (!customer.isActive) {
      throw new Error("Cliente inactivo");
    }

    /**
     * Juntamos SKUs repetidos.
     */
    const normalizedItems = normalizeOrderItems(data.items);

    /**
     * Aquí construiremos los items finales del pedido.
     */
    const orderItems: {
      productId: number;
      skuSnapshot: string;
      nameSnapshot: string;
      descriptionSnapshot: string | null;
      unitPriceSnapshot: Prisma.Decimal;
      quantity: number;
      subtotal: Prisma.Decimal;
    }[] = [];

    /**
     * Total acumulado del pedido.
     *
     * Usamos Prisma.Decimal para evitar errores de precisión con dinero.
     */
    let total = new Prisma.Decimal(0);

    for (const item of normalizedItems) {
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      const subtotal = unitPrice.mul(item.quantity);

      /**
       * Buscamos o creamos el producto por SKU.
       *
       * Si el SKU ya existe:
       * - Actualizamos nombre, descripción y precio.
       *
       * Si el SKU no existe:
       * - Creamos el producto automáticamente.
       *
       * Beneficio:
       * - El catálogo se va formando mientras se capturan pedidos.
       */
      const product = await tx.product.upsert({
        where: {
          sku: item.sku,
        },
        update: {
          name: item.name,
          description: item.description ?? null,
          price: unitPrice,
          isActive: true,
        },
        create: {
          sku: item.sku,
          name: item.name,
          description: item.description ?? null,
          price: unitPrice,
          stock: 0,
          isActive: true,
        },
      });

      total = total.add(subtotal);

      orderItems.push({
        productId: product.id,
        skuSnapshot: item.sku,
        nameSnapshot: item.name,
        descriptionSnapshot: item.description ?? null,
        unitPriceSnapshot: unitPrice,
        quantity: item.quantity,
        subtotal,
      });
    }

    /**
     * Creamos el pedido primero.
     *
     * Beneficio:
     * - Obtenemos el orderId para crear los detalles después.
     */
    const order = await tx.order.create({
      data: {
        customerId: data.customerId,
        sellerId,
        total,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        notes: data.notes,
      },
    });

    /**
     * Creamos los artículos del pedido.
     *
     * Guardamos snapshots:
     * - SKU usado
     * - nombre usado
     * - descripción usada
     * - precio usado
     *
     * Beneficio:
     * - Si el producto cambia después, este pedido conserva
     *   los datos originales de la venta.
     */
    await tx.orderItem.createMany({
      data: orderItems.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        skuSnapshot: item.skuSnapshot,
        nameSnapshot: item.nameSnapshot,
        descriptionSnapshot: item.descriptionSnapshot,
        unitPriceSnapshot: item.unitPriceSnapshot,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
    });

    /**
     * Regresamos el pedido completo con sus relaciones.
     */
    const orderWithDetails = await tx.order.findUnique({
      where: {
        id: order.id,
      },
      include: {
        customer: true,
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return orderWithDetails;
  });
}

/**
 * Obtiene un pedido por ID con todos sus detalles.
 *
 * Incluye:
 * - Cliente
 * - Vendedor
 * - Artículos del pedido
 * - Producto relacionado, si existe
 */
export async function getOrderByIdService(id: number) {
  const order = await prisma.order.findUnique({
    where: {
      id,
    },
    include: {
      customer: true,
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("Pedido no encontrado");
  }

  return order;
}

/**
 * Actualiza datos básicos de un pedido.
 *
 * Permitimos cambiar:
 * - status
 * - deliveryDate
 * - notes
 *
 * Importante:
 * - Ya no ajustamos stock aquí.
 * - En este flujo el pedido funciona más como registro de venta/catálogo.
 *
 * Beneficio:
 * - Evitamos errores porque los productos pueden crearse automáticamente
 *   con stock 0.
 * - El usuario puede registrar pedidos sin manejar inventario todavía.
 */
export async function updateOrderService(id: number, data: UpdateOrderDto) {
  const currentOrder = await prisma.order.findUnique({
    where: {
      id,
    },
  });

  if (!currentOrder) {
    throw new Error("Pedido no encontrado");
  }

  const updatedOrder = await prisma.order.update({
    where: {
      id,
    },
    data: {
      status: data.status,
      deliveryDate: data.deliveryDate
        ? new Date(data.deliveryDate)
        : data.deliveryDate,
      notes: data.notes,
    },
    include: {
      customer: true,
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  return updatedOrder;
}

/**
 * Obtiene todos los pedidos de un cliente.
 *
 * Esto sirve para mostrar el historial:
 * "María ha comprado estos pedidos..."
 */
export async function getOrdersByCustomerIdService(customerId: number) {
  const customer = await prisma.customer.findUnique({
    where: {
      id: customerId,
    },
  });

  if (!customer) {
    throw new Error("Cliente no encontrado");
  }

  return prisma.order.findMany({
    where: {
      customerId,
    },
    include: {
      customer: true,
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      items: {
        include: {
          product: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}