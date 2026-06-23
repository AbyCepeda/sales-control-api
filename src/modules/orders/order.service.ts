import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CreateCustomerOrderDto,
  CreateOrderDto,
  CreateOrderItemDto,
  OrderFiltersDto,
  UpdateOrderDto,
} from "./order.dto";
import { AppJwtPayload } from "@/lib/jwt";

/**
 * Normaliza artículos por SKU.
 *
 * Para qué sirve:
 * - Si el mismo SKU viene repetido dentro del mismo cliente,
 *   juntamos las cantidades en una sola línea.
 *
 * Ejemplo:
 * A123 x1
 * A123 x2
 *
 * Resultado:
 * A123 x3
 *
 * Beneficio:
 * - Evita duplicados innecesarios.
 * - Calcula mejor los totales por cliente.
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
      quantity: currentItem.quantity + item.quantity,

      /**
       * Conservamos la última información escrita.
       *
       * Beneficio:
       * - Si el usuario corrigió el nombre, descripción o precio
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
 * Normaliza clientes dentro del pedido general.
 *
 * Para qué sirve:
 * - Si el mismo cliente viene dos veces en el body,
 *   juntamos sus artículos en un solo CustomerOrder.
 *
 * Beneficio:
 * - Evita chocar con el índice único:
 *   @@unique([orderId, customerId])
 * - Mantiene todos los artículos del cliente juntos.
 */
function normalizeCustomerOrders(customers: CreateCustomerOrderDto[]) {
  const customerMap = new Map<number, CreateCustomerOrderDto>();

  for (const customerOrder of customers) {
    const currentCustomerOrder = customerMap.get(customerOrder.customerId);

    if (!currentCustomerOrder) {
      customerMap.set(customerOrder.customerId, customerOrder);
      continue;
    }

    customerMap.set(customerOrder.customerId, {
      ...currentCustomerOrder,
      notes: customerOrder.notes ?? currentCustomerOrder.notes,
      items: [...currentCustomerOrder.items, ...customerOrder.items],
    });
  }

  return Array.from(customerMap.values());
}

/**
 * Obtiene pedidos generales con filtros opcionales.
 *
 * Filtros disponibles:
 * - status
 * - customerId
 * - from
 * - to
 *
 * Reglas:
 * - ADMIN ve todos los pedidos.
 * - SELLER ve solo sus pedidos.
 *
 * Nueva lógica:
 * - customerId ya no está directo en Order.
 * - Ahora se busca dentro de customerOrders.
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
    where.customerOrders = {
      some: {
        customerId: filters.customerId,
      },
    };
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
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      customerOrders: {
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Crea un pedido general.
 *
 * Nueva lógica:
 * - Un pedido general puede tener varios clientes.
 * - Cada cliente tiene sus propios artículos.
 * - Los productos se crean o actualizan automáticamente por SKU.
 * - Se calcula total por cliente.
 * - Se calcula total general del pedido.
 *
 * Beneficio:
 * - Soporta pedidos tipo catálogo.
 * - Puedes juntar pedidos de varias personas en una sola captura.
 * - Mantienes historial por cliente y total general.
 */
export async function createOrderService(
  data: CreateOrderDto,
  sellerId: number
) {
  return prisma.$transaction(async (tx) => {
    const normalizedCustomerOrders = normalizeCustomerOrders(data.customers);

    /**
     * Aquí guardamos los clientes ya procesados antes de crear el pedido.
     *
     * Beneficio:
     * - Primero calculamos totales.
     * - Luego creamos el Order general con el total correcto.
     */
    const preparedCustomerOrders: {
      customerId: number;
      notes: string | null;
      total: Prisma.Decimal;
      items: {
        productId: number;
        skuSnapshot: string;
        nameSnapshot: string;
        descriptionSnapshot: string | null;
        unitPriceSnapshot: Prisma.Decimal;
        quantity: number;
        subtotal: Prisma.Decimal;
      }[];
    }[] = [];

    /**
     * Total completo del pedido general.
     */
    let orderTotal = new Prisma.Decimal(0);

    for (const customerOrder of normalizedCustomerOrders) {
      /**
       * Validamos que el cliente exista y esté activo.
       *
       * Beneficio:
       * - Evita crear pedidos para clientes inexistentes o desactivados.
       */
      const customer = await tx.customer.findUnique({
        where: {
          id: customerOrder.customerId,
        },
      });

      if (!customer) {
        throw new Error(`Cliente no encontrado: ${customerOrder.customerId}`);
      }

      if (!customer.isActive) {
        throw new Error(`Cliente inactivo: ${customer.name}`);
      }

      const normalizedItems = normalizeOrderItems(customerOrder.items);

      let customerTotal = new Prisma.Decimal(0);

      const preparedItems: {
        productId: number;
        skuSnapshot: string;
        nameSnapshot: string;
        descriptionSnapshot: string | null;
        unitPriceSnapshot: Prisma.Decimal;
        quantity: number;
        subtotal: Prisma.Decimal;
      }[] = [];

      for (const item of normalizedItems) {
        const unitPrice = new Prisma.Decimal(item.unitPrice);
        const subtotal = unitPrice.mul(item.quantity);

        /**
         * Creamos o actualizamos producto por SKU.
         *
         * Si existe:
         * - actualizamos nombre, descripción y precio.
         *
         * Si no existe:
         * - lo creamos automáticamente.
         *
         * Beneficio:
         * - El catálogo se alimenta mientras capturas pedidos.
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

        customerTotal = customerTotal.add(subtotal);

        preparedItems.push({
          productId: product.id,
          skuSnapshot: item.sku,
          nameSnapshot: item.name,
          descriptionSnapshot: item.description ?? null,
          unitPriceSnapshot: unitPrice,
          quantity: item.quantity,
          subtotal,
        });
      }

      orderTotal = orderTotal.add(customerTotal);

      preparedCustomerOrders.push({
        customerId: customerOrder.customerId,
        notes: customerOrder.notes ?? null,
        total: customerTotal,
        items: preparedItems,
      });
    }

    /**
     * Creamos el pedido general.
     *
     * Beneficio:
     * - Guarda el total completo de todos los clientes.
     */
    const order = await tx.order.create({
      data: {
        sellerId,
        total: orderTotal,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        notes: data.notes ?? null,
      },
    });

    /**
     * Creamos cada CustomerOrder y sus artículos.
     *
     * Beneficio:
     * - Cada cliente queda separado dentro del pedido general.
     */
    for (const preparedCustomerOrder of preparedCustomerOrders) {
      const createdCustomerOrder = await tx.customerOrder.create({
        data: {
          orderId: order.id,
          customerId: preparedCustomerOrder.customerId,
          total: preparedCustomerOrder.total,
          notes: preparedCustomerOrder.notes,
        },
      });

      await tx.orderItem.createMany({
        data: preparedCustomerOrder.items.map((item) => ({
          customerOrderId: createdCustomerOrder.id,
          productId: item.productId,
          skuSnapshot: item.skuSnapshot,
          nameSnapshot: item.nameSnapshot,
          descriptionSnapshot: item.descriptionSnapshot,
          unitPriceSnapshot: item.unitPriceSnapshot,
          quantity: item.quantity,
          subtotal: item.subtotal,
        })),
      });
    }

    /**
     * Regresamos el pedido completo.
     */
    const orderWithDetails = await tx.order.findUnique({
      where: {
        id: order.id,
      },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        customerOrders: {
          include: {
            customer: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    return orderWithDetails;
  });
}

/**
 * Obtiene un pedido general por ID.
 *
 * Incluye:
 * - vendedor
 * - clientes dentro del pedido
 * - artículos de cada cliente
 * - productos relacionados
 *
 * Beneficio:
 * - Permite ver el detalle completo del pedido general.
 */
export async function getOrderByIdService(id: number) {
  const order = await prisma.order.findUnique({
    where: {
      id,
    },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      customerOrders: {
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
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
 * Actualiza datos básicos de un pedido general.
 *
 * Permitimos cambiar:
 * - status
 * - deliveryDate
 * - notes
 *
 * Beneficio:
 * - Podemos actualizar estado del pedido sin tocar sus artículos.
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
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      customerOrders: {
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  });

  return updatedOrder;
}

/**
 * Obtiene historial de pedidos donde aparece un cliente.
 *
 * Nueva lógica:
 * - Un cliente aparece dentro de customerOrders.
 * - Ya no buscamos por Order.customerId.
 *
 * Beneficio:
 * - Mantiene historial del cliente aunque el pedido general tenga más personas.
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
      customerOrders: {
        some: {
          customerId,
        },
      },
    },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },

      /**
       * En historial por cliente solo regresamos la parte de ese cliente.
       *
       * Beneficio:
       * - Si un pedido general tenía 5 clientes, aquí mostramos solo
       *   los artículos del cliente consultado.
       */
      customerOrders: {
        where: {
          customerId,
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}