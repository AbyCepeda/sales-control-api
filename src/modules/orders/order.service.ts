import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreateOrderDto, CreateOrderItemDto, OrderFiltersDto, UpdateOrderDto } from "./order.dto";
import { AppJwtPayload } from "@/lib/jwt";

/**
 * Normaliza los items del pedido.
 *
 * ¿Por qué existe esto?
 * Porque el frontend podría mandar el mismo producto dos veces:
 *
 * [
 *   { productId: 1, quantity: 2 },
 *   { productId: 1, quantity: 3 }
 * ]
 *
 * En vez de guardar dos líneas repetidas, las juntamos:
 *
 * [
 *   { productId: 1, quantity: 5 }
 * ]
 */
function normalizeOrderItems(items: CreateOrderItemDto[]) {
  const itemMap = new Map<number, number>();

  for (const item of items) {
    const currentQuantity = itemMap.get(item.productId) ?? 0;
    itemMap.set(item.productId, currentQuantity + item.quantity);
  }

  return Array.from(itemMap.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
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
  /**
   * Construimos el where de Prisma de forma dinámica.
   *
   * Esto nos permite agregar filtros solo cuando el usuario los manda.
   */
  const where: Prisma.OrderWhereInput = {};

  /**
   * Si el usuario es SELLER, solo puede ver sus pedidos.
   *
   * Esto es seguridad de backend.
   * No dependemos de que el frontend oculte información.
   */
  if (authUser.role === "SELLER") {
    where.sellerId = authUser.userId;
  }

  /**
   * Filtro por estado.
   *
   * Ejemplo:
   * /api/orders?status=PENDING
   */
  if (filters.status) {
    where.status = filters.status;
  }

  /**
   * Filtro por cliente.
   *
   * Ejemplo:
   * /api/orders?customerId=1
   */
  if (filters.customerId) {
    where.customerId = filters.customerId;
  }

  /**
   * Filtro por rango de fechas.
   *
   * Usamos createdAt porque representa cuándo se registró el pedido.
   */
  if (filters.from || filters.to) {
    where.createdAt = {};

    if (filters.from) {
      /**
       * Fecha inicial desde las 00:00:00.
       */
      where.createdAt.gte = new Date(`${filters.from}T00:00:00.000Z`);
    }

    if (filters.to) {
      /**
       * Fecha final hasta las 23:59:59.
       */
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
 * Reglas importantes:
 * 1. El sellerId sale del token, no del body.
 * 2. El total se calcula en backend.
 * 3. El precio unitario se toma desde Product.price.
 * 4. Se valida stock.
 * 5. Se descuenta stock.
 * 6. Todo se hace en una transacción.
 */
export async function createOrderService(
  data: CreateOrderDto,
  sellerId: number
) {
  return prisma.$transaction(async (tx) => {
    /**
     * Validamos que el cliente exista y esté activo.
     *
     * No tiene sentido crear pedidos para clientes desactivados.
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
     * Juntamos productos repetidos para evitar duplicados
     * y para validar stock correctamente.
     */
    const normalizedItems = normalizeOrderItems(data.items);

    const productIds = normalizedItems.map((item) => item.productId);

    /**
     * Buscamos todos los productos activos que vienen en el pedido.
     */
    const products = await tx.product.findMany({
      where: {
        id: {
          in: productIds,
        },
        isActive: true,
      },
    });

    /**
     * Creamos un mapa para encontrar productos rápido por ID.
     */
    const productMap = new Map(
      products.map((product) => [product.id, product])
    );

    /**
     * Aquí construiremos los items finales del pedido.
     */
    const orderItems: {
      productId: number;
      quantity: number;
      unitPrice: Prisma.Decimal;
      subtotal: Prisma.Decimal;
    }[] = [];

    /**
     * Total acumulado del pedido.
     *
     * Usamos Prisma.Decimal para evitar errores de precisión con dinero.
     */
    let total = new Prisma.Decimal(0);

    for (const item of normalizedItems) {
      const product = productMap.get(item.productId);

      /**
       * Si el producto no existe o está inactivo, detenemos el pedido.
       */
      if (!product) {
        throw new Error(`Producto no disponible: ${item.productId}`);
      }

      /**
       * Validamos stock suficiente.
       */
      if (product.stock < item.quantity) {
        throw new Error(`Stock insuficiente para el producto: ${product.name}`);
      }

      const unitPrice = new Prisma.Decimal(product.price);
      const subtotal = unitPrice.mul(item.quantity);

      total = total.add(subtotal);

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        subtotal,
      });
    }

    /**
     * Descontamos stock de cada producto.
     *
     * Esto se hace dentro de la transacción:
     * si algo falla después, Prisma revierte todo.
     */
    for (const item of orderItems) {
      await tx.product.update({
        where: {
          id: item.productId,
        },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });
    }

    /**
     * Creamos el pedido y sus items.
     *
     * El total ya fue calculado por backend.
     * El sellerId viene del token.
     */
    const order = await tx.order.create({
      data: {
        customerId: data.customerId,
        sellerId,
        total,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        notes: data.notes,
        items: {
          create: orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })),
        },
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

    return order;
  });
}

/**
 * Obtiene un pedido por ID con todos sus detalles.
 *
 * Incluye:
 * - Cliente
 * - Vendedor
 * - Productos dentro del pedido
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
 *get
 * Importante:
 * Si el pedido se cancela, regresamos el stock.
 * Si un pedido cancelado se reactiva, volvemos a descontar stock.
 */
export async function updateOrderService(id: number, data: UpdateOrderDto) {
  return prisma.$transaction(async (tx) => {
    /**
     * Buscamos el pedido con sus items.
     *
     * Necesitamos los items para saber cuánto stock regresar
     * si el pedido cambia a CANCELLED.
     */
    const currentOrder = await tx.order.findUnique({
      where: {
        id,
      },
      include: {
        items: true,
      },
    });

    if (!currentOrder) {
      throw new Error("Pedido no encontrado");
    }

    /**
     * Si viene un nuevo status, revisamos si afecta stock.
     */
    if (data.status && data.status !== currentOrder.status) {
      const oldStatus = currentOrder.status;
      const newStatus = data.status;

      /**
       * Caso 1:
       * El pedido estaba activo y ahora se cancela.
       *
       * Como al crear el pedido ya descontamos stock,
       * al cancelarlo debemos regresar esas unidades.
       */
      if (oldStatus !== "CANCELLED" && newStatus === "CANCELLED") {
        for (const item of currentOrder.items) {
          await tx.product.update({
            where: {
              id: item.productId,
            },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      /**
       * Caso 2:
       * El pedido estaba cancelado y se reactiva.
       *
       * Aquí debemos volver a descontar stock.
       * Primero validamos que todavía exista suficiente stock.
       */
      if (oldStatus === "CANCELLED" && newStatus !== "CANCELLED") {
        for (const item of currentOrder.items) {
          const product = await tx.product.findUnique({
            where: {
              id: item.productId,
            },
          });

          if (!product || !product.isActive) {
            throw new Error(`Producto no disponible: ${item.productId}`);
          }

          if (product.stock < item.quantity) {
            throw new Error(`Stock insuficiente para el producto: ${product.name}`);
          }
        }

        /**
         * Si todo tiene stock suficiente, ahora sí descontamos.
         */
        for (const item of currentOrder.items) {
          await tx.product.update({
            where: {
              id: item.productId,
            },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });
        }
      }
    }

    /**
     * Actualizamos el pedido.
     *
     * No actualizamos items aquí.
     * Eso queda para una función más avanzada.
     */
    const updatedOrder = await tx.order.update({
      where: {
        id,
      },
      data: {
        status: data.status,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : data.deliveryDate,
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
  });
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