import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AppJwtPayload } from "@/lib/jwt";
import type {
  CreateOrderCustomerDto,
  CreateOrderDto,
  CreateOrderItemDto,
  CreateOrderPaymentDto,
  OrderFiltersDto,
  UpdateFullOrderDto,
  UpdateOrderDto,
} from "./order.dto";
import type { OrderWithDetails } from "./order.types";

/**
 * Include estándar para regresar pedidos completos.
 *
 * Para qué sirve:
 * - Evita repetir el mismo include en todos los métodos.
 *
 * Nueva lógica:
 * - Los pagos ya NO viven directo en Order.
 * - Ahora los pagos viven dentro de cada CustomerOrder.
 *
 * Beneficio:
 * - El frontend puede saber cuánto pagó cada cliente.
 * - Cada cliente dentro del pedido conserva su propio historial de abonos.
 */
const orderWithDetailsInclude = {
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

      payments: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

/**
 * Normaliza un texto opcional.
 *
 * Para qué sirve:
 * - Convierte strings vacíos en null.
 *
 * Beneficio:
 * - Evita guardar "" en base de datos cuando realmente no hay dato.
 */
function normalizeOptionalText(value?: string | null) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : null;
}

/**
 * Normaliza SKU.
 *
 * Para qué sirve:
 * - Evita duplicados como "a123", " A123 " y "A123".
 *
 * Beneficio:
 * - El catálogo automático queda más limpio.
 */
function normalizeSku(sku: string) {
  return sku.trim().toUpperCase();
}

/**
 * Calcula resumen de pagos de un cliente dentro de un pedido.
 *
 * Para qué sirve:
 * - Suma todos los abonos registrados en CustomerOrderPayment.
 * - Calcula cuánto queda pendiente de ese cliente.
 *
 * Beneficio:
 * - Ya no calculamos pago por pedido general.
 * - Ahora sabemos exactamente cuánto pagó cada cliente.
 */
function buildPaymentSummary(
  customerOrderTotal: Prisma.Decimal,
  payments: {
    amount: Prisma.Decimal;
  }[],
) {
  const paidAmount = payments.reduce((total, payment) => {
    return total.add(payment.amount);
  }, new Prisma.Decimal(0));

  const pendingAmount = customerOrderTotal.sub(paidAmount);

  return {
    totalAmount: customerOrderTotal,
    paidAmount,
    pendingAmount: pendingAmount.lessThan(0)
      ? new Prisma.Decimal(0)
      : pendingAmount,
    isFullyPaid: paidAmount.greaterThanOrEqualTo(customerOrderTotal),
    hasPayments: paidAmount.greaterThan(0),
  };
}

/**
 * Agrupa artículos repetidos por SKU y por estado de pago.
 *
 * Para qué sirve:
 * - Si el vendedor captura dos veces el mismo SKU y ambos tienen el mismo estado
 *   de pago, los juntamos.
 *
 * Importante:
 * - No juntamos un artículo pagado con uno pendiente aunque tengan el mismo SKU.
 *
 * Beneficio:
 * - Conservamos correctamente qué artículos ya fueron pagados.
 */
function normalizeOrderItems(items: CreateOrderItemDto[]) {
  const itemsMap = new Map<string, CreateOrderItemDto>();

  for (const item of items) {
    const normalizedSku = normalizeSku(item.sku);
    const isPaid = item.isPaid ?? false;

    /**
     * La llave incluye SKU + estado de pago.
     *
     * Ejemplo:
     * - ABC-true
     * - ABC-false
     *
     * Así evitamos mezclar artículos pagados con pendientes.
     */
    const mapKey = `${normalizedSku}-${isPaid}`;
    const existingItem = itemsMap.get(mapKey);

    if (existingItem) {
      itemsMap.set(mapKey, {
        ...existingItem,
        quantity: existingItem.quantity + item.quantity,
      });

      continue;
    }

    itemsMap.set(mapKey, {
      ...item,
      sku: normalizedSku,
      name: item.name.trim(),
      description: normalizeOptionalText(item.description),
      isPaid,
    });
  }

  return Array.from(itemsMap.values());
}

/**
 * Busca o crea cliente durante la creación/edición del pedido.
 *
 * Regla actual:
 * - Si el cliente trae teléfono, intentamos reutilizar un cliente activo
 *   con ese teléfono.
 * - Si no existe, creamos uno nuevo.
 * - Si no trae teléfono, creamos uno nuevo.
 *
 * Beneficio:
 * - El vendedor captura el cliente desde el pedido.
 * - Evitamos duplicar clientes cuando se repite el mismo teléfono.
 */
async function findOrCreateCustomer(
  tx: Prisma.TransactionClient,
  customerData: CreateOrderCustomerDto,
) {
  const phone = normalizeOptionalText(customerData.phone);

  if (phone) {
    const existingCustomer = await tx.customer.findFirst({
      where: {
        phone,
        isActive: true,
      },
    });

    if (existingCustomer) {
      return existingCustomer;
    }
  }

  return tx.customer.create({
    data: {
      name: customerData.name.trim(),
      phone,
      notes: normalizeOptionalText(customerData.notes),
      isActive: true,
    },
  });
}

/**
 * Obtiene todos los pedidos visibles para el usuario.
 *
 * Regla:
 * - ADMIN ve todos.
 * - SELLER ve solo sus propios pedidos.
 */
export async function getOrdersService(
  filters: OrderFiltersDto,
  authUser: AppJwtPayload,
): Promise<OrderWithDetails[]> {
  const where: Prisma.OrderWhereInput = {};

  if (authUser.role === "SELLER") {
    where.sellerId = authUser.userId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  /**
   * Ahora el cliente ya no está directo en Order.
   * Está dentro de customerOrders.
   */
  if (filters.customerId) {
    where.customerOrders = {
      some: {
        customerId: filters.customerId,
      },
    };
  }

  if (filters.from || filters.to) {
    where.purchaseDate = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }

  return prisma.order.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    include: orderWithDetailsInclude,
  });
}

/**
 * Crea un pedido general con clientes capturados manualmente.
 *
 * Nueva lógica:
 * - El frontend manda customers[] con name, phone, notes e items.
 * - El backend crea o reutiliza cliente.
 * - El backend crea/actualiza productos por SKU.
 * - El backend calcula totales.
 */
export async function createOrderService(
  data: CreateOrderDto,
  sellerId: number,
): Promise<OrderWithDetails> {
  return prisma.$transaction(async (tx) => {
    let orderTotal = new Prisma.Decimal(0);

    /**
     * Primero creamos el pedido general en cero.
     * Después actualizamos el total real.
     */
    const order = await tx.order.create({
      data: {
        sellerId,
        total: new Prisma.Decimal(0),
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        notes: normalizeOptionalText(data.notes),
      },
    });

    for (const customerData of data.customers) {
      const customer = await findOrCreateCustomer(tx, customerData);
      const normalizedItems = normalizeOrderItems(customerData.items);

      let customerTotal = new Prisma.Decimal(0);

      const customerOrder = await tx.customerOrder.create({
        data: {
          orderId: order.id,
          customerId: customer.id,
          total: new Prisma.Decimal(0),
          notes: normalizeOptionalText(customerData.notes),
        },
      });

      for (const item of normalizedItems) {
        const unitPrice = new Prisma.Decimal(item.unitPrice);
        const quantity = item.quantity;
        const subtotal = unitPrice.mul(quantity);

        const product = await tx.product.upsert({
          where: {
            sku: item.sku,
          },
          update: {
            name: item.name,
            description: normalizeOptionalText(item.description),
            price: unitPrice,
            isActive: true,
          },
          create: {
            sku: item.sku,
            name: item.name,
            description: normalizeOptionalText(item.description),
            price: unitPrice,
            stock: 0,
            isActive: true,
          },
        });

        await tx.orderItem.create({
          data: {
            customerOrderId: customerOrder.id,
            productId: product.id,
            skuSnapshot: item.sku,
            nameSnapshot: item.name,
            descriptionSnapshot: normalizeOptionalText(item.description),
            unitPriceSnapshot: unitPrice,
            quantity,
            subtotal,
            isPaid: item.isPaid ?? false,
          },
        });

        customerTotal = customerTotal.add(subtotal);
      }

      await tx.customerOrder.update({
        where: {
          id: customerOrder.id,
        },
        data: {
          total: customerTotal,
        },
      });

      orderTotal = orderTotal.add(customerTotal);
    }

    await tx.order.update({
      where: {
        id: order.id,
      },
      data: {
        total: orderTotal,
      },
    });

    const orderWithDetails = await tx.order.findUnique({
      where: {
        id: order.id,
      },
      include: orderWithDetailsInclude,
    });

    if (!orderWithDetails) {
      throw new Error("Pedido no encontrado después de crear");
    }

    return orderWithDetails;
  });
}

/**
 * Obtiene un pedido por ID.
 *
 * Para qué sirve:
 * - Permite consultar el detalle completo de un pedido.
 *
 * Beneficio:
 * - La app móvil podrá abrir una pantalla de detalle.
 */
export async function getOrderByIdService(
  id: number,
): Promise<OrderWithDetails> {
  const order = await prisma.order.findUnique({
    where: {
      id,
    },
    include: orderWithDetailsInclude,
  });

  if (!order) {
    throw new Error("Pedido no encontrado");
  }

  return order;
}

/**
 * Actualiza datos básicos de un pedido.
 *
 * Para qué sirve:
 * - Permite cambiar estado, fecha de entrega o notas.
 *
 * Beneficio:
 * - Sirve para cambios rápidos sin reconstruir clientes ni artículos.
 */
export async function updateOrderService(
  id: number,
  data: UpdateOrderDto,
): Promise<OrderWithDetails> {
  const existingOrder = await prisma.order.findUnique({
    where: {
      id,
    },
  });

  if (!existingOrder) {
    throw new Error("Pedido no encontrado");
  }

  return prisma.order.update({
    where: {
      id,
    },
    data: {
      ...(data.status ? { status: data.status } : {}),

      ...(data.deliveryDate !== undefined
        ? {
            deliveryDate: data.deliveryDate
              ? new Date(data.deliveryDate)
              : null,
          }
        : {}),

      ...(data.notes !== undefined
        ? {
            notes: normalizeOptionalText(data.notes),
          }
        : {}),
    },
    include: orderWithDetailsInclude,
  });
}

/**
 * Edita un pedido completo.
 *
 * Estrategia:
 * - Guarda primero los CustomerOrder actuales con sus pagos.
 * - Actualiza datos generales del pedido.
 * - Elimina los CustomerOrder actuales del pedido.
 * - Vuelve a crear clientes/artículos con la nueva información.
 * - Recalcula total por cliente.
 * - Recalcula total general.
 * - Si el cliente ya existía en el pedido, conserva sus abonos.
 *
 * Beneficio:
 * - Permite editar clientes y artículos.
 * - Evita que los abonos desaparezcan al presionar "Guardar cambios".
 *
 * Importante:
 * - Si eliminas un cliente del pedido, sus abonos ya no se conservan.
 * - Si el cliente sigue en el pedido, se intenta conservar por:
 *   1. customerId
 *   2. teléfono
 *   3. nombre
 */
export async function updateFullOrderService(
  id: number,
  data: UpdateFullOrderDto,
): Promise<OrderWithDetails> {
  return prisma.$transaction(async (tx) => {
    const existingOrder = await tx.order.findUnique({
      where: {
        id,
      },
    });

    if (!existingOrder) {
      throw new Error("Pedido no encontrado");
    }

    /**
     * Guardamos los clientes actuales con sus pagos ANTES de borrar.
     *
     * Para qué sirve:
     * - updateFullOrder reconstruye los CustomerOrder.
     * - Si no guardamos esto antes, los pagos se pierden por cascade.
     */
    const existingCustomerOrders = await tx.customerOrder.findMany({
      where: {
        orderId: id,
      },
      include: {
        customer: true,
        payments: true,
      },
    });

    /**
     * Eliminamos los clientes del pedido.
     *
     * Importante:
     * - No eliminamos clientes reales de la tabla Customer.
     * - Solo eliminamos la relación CustomerOrder de este pedido.
     * - Los OrderItem se eliminan automáticamente por Cascade.
     * - Los CustomerOrderPayment también se eliminan por Cascade,
     *   pero ya los guardamos arriba para restaurarlos.
     */
    await tx.customerOrder.deleteMany({
      where: {
        orderId: id,
      },
    });

    let orderTotal = new Prisma.Decimal(0);

    for (const customerData of data.customers) {
      const customer = await findOrCreateCustomer(tx, customerData);
      const normalizedItems = normalizeOrderItems(customerData.items);

      /**
       * Buscamos si este cliente ya existía dentro del pedido.
       *
       * Para qué sirve:
       * - Si ya tenía abonos, los vamos a restaurar.
       *
       * Beneficio:
       * - Guardar cambios ya no borra los pagos de ese cliente.
       */
      const normalizedPhone = normalizeOptionalText(customerData.phone);
      const normalizedName = customerData.name.trim().toLowerCase();

      const previousCustomerOrder =
        existingCustomerOrders.find((customerOrder) => {
          return customerOrder.customerId === customer.id;
        }) ??
        existingCustomerOrders.find((customerOrder) => {
          return (
            normalizedPhone &&
            customerOrder.customer.phone === normalizedPhone
          );
        }) ??
        existingCustomerOrders.find((customerOrder) => {
          return customerOrder.customer.name.trim().toLowerCase() === normalizedName;
        });

      let customerTotal = new Prisma.Decimal(0);

      const customerOrder = await tx.customerOrder.create({
        data: {
          orderId: id,
          customerId: customer.id,
          total: new Prisma.Decimal(0),
          notes: normalizeOptionalText(customerData.notes),
        },
      });

      for (const item of normalizedItems) {
        const unitPrice = new Prisma.Decimal(item.unitPrice);
        const quantity = item.quantity;
        const subtotal = unitPrice.mul(quantity);

        const product = await tx.product.upsert({
          where: {
            sku: item.sku,
          },
          update: {
            name: item.name,
            description: normalizeOptionalText(item.description),
            price: unitPrice,
            isActive: true,
          },
          create: {
            sku: item.sku,
            name: item.name,
            description: normalizeOptionalText(item.description),
            price: unitPrice,
            stock: 0,
            isActive: true,
          },
        });

        await tx.orderItem.create({
          data: {
            customerOrderId: customerOrder.id,
            productId: product.id,
            skuSnapshot: item.sku,
            nameSnapshot: item.name,
            descriptionSnapshot: normalizeOptionalText(item.description),
            unitPriceSnapshot: unitPrice,
            quantity,
            subtotal,
            isPaid: item.isPaid ?? false,
          },
        });

        customerTotal = customerTotal.add(subtotal);
      }

      await tx.customerOrder.update({
        where: {
          id: customerOrder.id,
        },
        data: {
          total: customerTotal,
        },
      });

      /**
       * Restauramos abonos del cliente anterior.
       *
       * Para qué sirve:
       * - Los pagos estaban ligados al CustomerOrder viejo.
       * - Como ese CustomerOrder se borró, los volvemos a crear en el nuevo.
       *
       * Beneficio:
       * - El usuario puede editar artículos y guardar cambios
       *   sin perder los abonos ya registrados.
       */
      if (previousCustomerOrder?.payments.length) {
        await tx.customerOrderPayment.createMany({
          data: previousCustomerOrder.payments.map((payment) => ({
            customerOrderId: customerOrder.id,
            amount: payment.amount,
            method: payment.method,
            notes: payment.notes,
          })),
        });
      }

      orderTotal = orderTotal.add(customerTotal);
    }

    await tx.order.update({
      where: {
        id,
      },
      data: {
        total: orderTotal,

        ...(data.status ? { status: data.status } : {}),

        ...(data.deliveryDate !== undefined
          ? {
              deliveryDate: data.deliveryDate
                ? new Date(data.deliveryDate)
                : null,
            }
          : {}),

        ...(data.notes !== undefined
          ? {
              notes: normalizeOptionalText(data.notes),
            }
          : {}),
      },
    });

    const updatedOrder = await tx.order.findUnique({
      where: {
        id,
      },
      include: orderWithDetailsInclude,
    });

    if (!updatedOrder) {
      throw new Error("Pedido no encontrado después de editar");
    }

    return updatedOrder;
  });
}

/**
 * Obtiene pedidos relacionados a un cliente.
 *
 * Nueva estructura:
 * - Order no tiene customerId.
 * - La relación está en CustomerOrder.
 */
export async function getOrdersByCustomerIdService(
  customerId: number,
): Promise<OrderWithDetails[]> {
  return prisma.order.findMany({
    where: {
      customerOrders: {
        some: {
          customerId,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      ...orderWithDetailsInclude,
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

          payments: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
    },
  });
}

/**
 * Registra un pago o abono para un cliente dentro de un pedido.
 *
 * Para qué sirve:
 * - Permite guardar pagos parciales o completos de un CustomerOrder.
 * - Cada pago queda en historial del cliente dentro del pedido.
 *
 * Beneficio:
 * - Podemos saber qué cliente pagó.
 * - Podemos saber cuánto debe cada cliente.
 * - Ya no mezclamos pagos de diferentes clientes en el mismo pedido.
 */
export async function createCustomerOrderPaymentService(
  customerOrderId: number,
  data: CreateOrderPaymentDto,
  authUser: AppJwtPayload,
): Promise<OrderWithDetails> {
  return prisma.$transaction(async (tx) => {
    const existingCustomerOrder = await tx.customerOrder.findUnique({
      where: {
        id: customerOrderId,
      },
      include: {
        order: true,
        payments: true,
      },
    });

    if (!existingCustomerOrder) {
      throw new Error("Cliente del pedido no encontrado");
    }

    /**
     * Seguridad:
     * - ADMIN puede registrar pagos en cualquier pedido.
     * - SELLER solo puede registrar pagos en pedidos que él creó.
     */
    if (
      authUser.role === "SELLER" &&
      existingCustomerOrder.order.sellerId !== authUser.userId
    ) {
      throw new Error("No tienes permisos para modificar este pedido");
    }

    const amount = new Prisma.Decimal(data.amount);

    await tx.customerOrderPayment.create({
      data: {
        customerOrderId,
        amount,
        method: data.method,
        notes: normalizeOptionalText(data.notes),
      },
    });

    const updatedOrder = await tx.order.findUnique({
      where: {
        id: existingCustomerOrder.orderId,
      },
      include: orderWithDetailsInclude,
    });

    if (!updatedOrder) {
      throw new Error("Pedido no encontrado después de registrar pago");
    }

    return updatedOrder;
  });
}

/**
 * Obtiene resumen de pagos de un cliente dentro de un pedido.
 *
 * Para qué sirve:
 * - Calcula total del cliente.
 * - Calcula cuánto ha pagado ese cliente.
 * - Calcula cuánto le queda pendiente a ese cliente.
 *
 * Beneficio:
 * - La app puede mostrar:
 *   Total / Pagado / Pendiente por cliente.
 */
export async function getCustomerOrderPaymentSummaryService(
  customerOrderId: number,
  authUser: AppJwtPayload,
) {
  const customerOrder = await prisma.customerOrder.findUnique({
    where: {
      id: customerOrderId,
    },
    include: {
      order: true,
      payments: true,
    },
  });

  if (!customerOrder) {
    throw new Error("Cliente del pedido no encontrado");
  }

  if (
    authUser.role === "SELLER" &&
    customerOrder.order.sellerId !== authUser.userId
  ) {
    throw new Error("No tienes permisos para consultar este pedido");
  }

  return buildPaymentSummary(customerOrder.total, customerOrder.payments);
}