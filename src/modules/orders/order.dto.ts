import { z } from "zod";

/**
 * DTO para cada artículo dentro de un pedido.
 *
 * Nueva lógica:
 * - El usuario NO necesita registrar productos antes.
 * - El usuario captura el SKU/código del catálogo al crear el pedido.
 * - Si el SKU no existe como producto, el backend lo crea automáticamente.
 *
 * Beneficio:
 * - El flujo es más rápido para ventas tipo Avon/Natura.
 * - El pedido puede crear productos nuevos sin pasar por el módulo Productos.
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
 * DTO para crear un pedido.
 *
 * Importante:
 * - El frontend NO manda total.
 * - El backend calcula el total usando quantity * unitPrice.
 * - Los productos se crean automáticamente por SKU si no existen.
 */
export const createOrderSchema = z.object({
  customerId: z
    .number({
      error: "El customerId debe ser un número",
    })
    .int("El customerId debe ser un número entero")
    .positive("El customerId debe ser mayor a 0"),

  deliveryDate: z
    .string()
    .datetime("La fecha de entrega debe tener formato ISO válido")
    .optional()
    .nullable(),

  notes: z.string().trim().optional().nullable(),

  items: z
    .array(createOrderItemSchema)
    .min(1, "El pedido debe tener al menos un artículo"),
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
 * DTO para actualizar un pedido.
 *
 * Por ahora solo permitimos actualizar:
 * - status
 * - deliveryDate
 * - notes
 *
 * No permitimos editar items todavía porque eso implica recalcular total.
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
     * Lo transformamos a number cuando existe.
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
export type CreateOrderItemDto = z.infer<typeof createOrderItemSchema>;
export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;
export type OrderFiltersDto = z.infer<typeof orderFiltersSchema>;