import { z } from "zod";

/**
 * DTO para cada artículo dentro del pedido de un cliente.
 *
 * Nueva lógica:
 * - Ya no mandamos productId.
 * - Mandamos SKU, nombre, descripción, cantidad y precio.
 * - El backend crea o actualiza el producto automáticamente por SKU.
 *
 * Beneficio:
 * - El usuario puede capturar artículos de catálogo directamente.
 * - No necesita registrar productos antes.
 */
export const createOrderItemSchema = z.object({
  sku: z
    .string({
      error: "El SKU debe ser texto",
    })
    .trim()
    .min(1, "El SKU es obligatorio")
    .max(80, "El SKU no puede tener más de 80 caracteres")
    .transform((value) => value.toUpperCase()),

  name: z
    .string({
      error: "El nombre del artículo debe ser texto",
    })
    .trim()
    .min(1, "El nombre del artículo es obligatorio")
    .max(150, "El nombre no puede tener más de 150 caracteres"),

  description: z
    .string()
    .trim()
    .max(500, "La descripción no puede tener más de 500 caracteres")
    .optional()
    .nullable(),

  quantity: z
    .number({
      error: "La cantidad debe ser un número",
    })
    .int("La cantidad debe ser un número entero")
    .positive("La cantidad debe ser mayor a 0"),

  unitPrice: z
    .number({
      error: "El precio unitario debe ser un número",
    })
    .positive("El precio unitario debe ser mayor a 0"),
});

/**
 * DTO para un cliente dentro del pedido general.
 *
 * Nueva lógica:
 * - Un pedido general puede tener varios clientes.
 * - Cada cliente tiene su propia lista de artículos.
 *
 * Beneficio:
 * - Podemos separar cuánto pidió cada cliente.
 * - Podemos calcular total por cliente y total general.
 */
export const createCustomerOrderSchema = z.object({
  customerId: z
    .number({
      error: "El customerId debe ser un número",
    })
    .int("El customerId debe ser un número entero")
    .positive("El customerId debe ser mayor a 0"),

  notes: z.string().trim().optional().nullable(),

  items: z
    .array(createOrderItemSchema)
    .min(1, "Cada cliente debe tener al menos un artículo"),
});

/**
 * DTO para crear un pedido general.
 *
 * Nueva estructura:
 * {
 *   "notes": "Pedido campaña junio",
 *   "customers": [
 *     {
 *       "customerId": 1,
 *       "items": [...]
 *     },
 *     {
 *       "customerId": 2,
 *       "items": [...]
 *     }
 *   ]
 * }
 *
 * Beneficio:
 * - Un solo pedido puede contener varios clientes.
 * - Cada cliente conserva sus propios artículos.
 */
export const createOrderSchema = z.object({
  deliveryDate: z
    .string()
    .datetime("La fecha de entrega debe tener formato ISO válido")
    .optional()
    .nullable(),

  notes: z.string().trim().optional().nullable(),

  customers: z
    .array(createCustomerOrderSchema)
    .min(1, "El pedido debe tener al menos un cliente"),
});

/**
 * Estados permitidos para un pedido.
 *
 * Deben coincidir con el enum OrderStatus de Prisma.
 */
export const orderStatusSchema = z.enum([
  "PENDING",
  "PAID",
  "DELIVERED",
  "CANCELLED",
]);

/**
 * DTO para actualizar un pedido general.
 *
 * Por ahora solo permitimos actualizar:
 * - status
 * - deliveryDate
 * - notes
 *
 * Beneficio:
 * - Evitamos modificar items accidentalmente.
 * - La edición de artículos la podemos hacer después con una función dedicada.
 */
export const updateOrderSchema = z.object({
  status: orderStatusSchema.optional(),

  deliveryDate: z
    .string()
    .datetime("La fecha de entrega debe tener formato ISO válido")
    .optional()
    .nullable(),

  notes: z.string().trim().optional().nullable(),
});

/**
 * DTO para filtrar pedidos desde query params.
 *
 * Ejemplos:
 * /api/orders?status=PENDING
 * /api/orders?customerId=1
 * /api/orders?from=2026-06-01&to=2026-06-30
 */
export const orderFiltersSchema = z
  .object({
    status: orderStatusSchema.optional(),

    /**
     * customerId viene desde la URL como string.
     *
     * Nueva lógica:
     * - Ya no está directo en Order.
     * - Ahora se filtra a través de customerOrders.
     */
    customerId: z
      .string()
      .optional()
      .transform((value) => {
        if (!value) return undefined;

        const customerId = Number(value);

        if (Number.isNaN(customerId) || customerId <= 0) {
          throw new Error("customerId inválido");
        }

        return customerId;
      }),

    /**
     * from representa fecha inicial.
     *
     * Formato esperado:
     * YYYY-MM-DD
     */
    from: z.string().optional(),

    /**
     * to representa fecha final.
     *
     * Formato esperado:
     * YYYY-MM-DD
     */
    to: z.string().optional(),
  })
  .superRefine((filters, context) => {
    if (filters.from) {
      const fromDate = new Date(filters.from);

      if (Number.isNaN(fromDate.getTime())) {
        context.addIssue({
          code: "custom",
          path: ["from"],
          message: "La fecha from no es válida",
        });
      }
    }

    if (filters.to) {
      const toDate = new Date(filters.to);

      if (Number.isNaN(toDate.getTime())) {
        context.addIssue({
          code: "custom",
          path: ["to"],
          message: "La fecha to no es válida",
        });
      }
    }

    if (filters.from && filters.to) {
      const fromDate = new Date(filters.from);
      const toDate = new Date(filters.to);

      if (fromDate > toDate) {
        context.addIssue({
          code: "custom",
          path: ["from"],
          message: "La fecha from no puede ser mayor que to",
        });
      }
    }
  });

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type CreateCustomerOrderDto = z.infer<typeof createCustomerOrderSchema>;
export type CreateOrderItemDto = z.infer<typeof createOrderItemSchema>;
export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;
export type OrderFiltersDto = z.infer<typeof orderFiltersSchema>;