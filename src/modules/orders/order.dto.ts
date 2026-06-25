import { OrderStatus } from "@prisma/client";
import { z } from "zod";

/**
 * Schema de artículo dentro de un pedido.
 *
 * Para qué sirve:
 * - Valida los productos que el vendedor captura manualmente.
 *
 * Beneficio:
 * - No obligamos a registrar productos antes.
 * - El backend puede crear/actualizar productos automáticamente por SKU.
 */
export const createOrderItemSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "El SKU es obligatorio")
    .max(100, "El SKU no puede superar 100 caracteres"),

  name: z
    .string()
    .trim()
    .min(1, "El nombre del producto es obligatorio")
    .max(150, "El nombre no puede superar 150 caracteres"),

  description: z
    .string()
    .trim()
    .max(500, "La descripción no puede superar 500 caracteres")
    .nullable()
    .optional(),

  quantity: z
    .number({
      error: "La cantidad debe ser numérica",
    })
    .int("La cantidad debe ser un número entero")
    .positive("La cantidad debe ser mayor a cero"),

  unitPrice: z
    .number({
      error: "El precio unitario debe ser numérico",
    })
    .positive("El precio unitario debe ser mayor a cero"),
  isPaid: z.boolean().optional().default(false),
});

/**
 * Schema de cliente capturado dentro del pedido.
 *
 * Nueva lógica:
 * - Ya no pedimos customerId.
 * - Ahora capturamos nombre, teléfono y notas del cliente.
 *
 * Beneficio:
 * - El vendedor puede levantar pedidos rápido sin registrar clientes antes.
 * - El backend crea el cliente automáticamente.
 */
export const createOrderCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre del cliente es obligatorio")
    .max(150, "El nombre del cliente no puede superar 150 caracteres"),

  phone: z
    .string()
    .trim()
    .max(30, "El teléfono no puede superar 30 caracteres")
    .nullable()
    .optional(),

  notes: z
    .string()
    .trim()
    .max(500, "Las notas del cliente no pueden superar 500 caracteres")
    .nullable()
    .optional(),

  items: z
    .array(createOrderItemSchema)
    .min(1, "Cada cliente debe tener al menos un artículo"),
});

/**
 * Schema para crear un pedido general.
 *
 * Nueva estructura:
 * - Order = pedido general.
 * - customers = clientes capturados dentro del pedido.
 * - items = artículos de cada cliente.
 *
 * Beneficio:
 * - Un pedido puede incluir varios clientes.
 * - Cada cliente puede tener sus propios artículos.
 */
export const createOrderSchema = z.object({
  deliveryDate: z
    .string()
    .datetime("La fecha de entrega debe tener formato ISO")
    .nullable()
    .optional(),

  notes: z
    .string()
    .trim()
    .max(500, "Las notas del pedido no pueden superar 500 caracteres")
    .nullable()
    .optional(),

  customers: z
    .array(createOrderCustomerSchema)
    .min(1, "El pedido debe tener al menos un cliente"),
});

/**
 * Schema para actualizar datos básicos de un pedido.
 *
 * Para qué sirve:
 * - Permite cambiar estado, fecha de entrega o notas.
 *
 * Beneficio:
 * - Sirve para edición rápida sin tocar clientes/artículos.
 */
export const updateOrderSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),

  deliveryDate: z
    .string()
    .datetime("La fecha de entrega debe tener formato ISO")
    .nullable()
    .optional(),

  notes: z
    .string()
    .trim()
    .max(500, "Las notas del pedido no pueden superar 500 caracteres")
    .nullable()
    .optional(),
});

/**
 * Schema para edición completa de pedido.
 *
 * Nueva lógica:
 * - Edita datos del pedido.
 * - Reemplaza clientes del pedido.
 * - Reemplaza artículos del pedido.
 *
 * Beneficio:
 * - Permite agregar clientes nuevos.
 * - Permite agregar/quitar artículos.
 * - Permite recalcular totales correctamente.
 */
export const updateFullOrderSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),

  deliveryDate: z
    .string()
    .datetime("La fecha de entrega debe tener formato ISO")
    .nullable()
    .optional(),

  notes: z
    .string()
    .trim()
    .max(500, "Las notas del pedido no pueden superar 500 caracteres")
    .nullable()
    .optional(),

  customers: z
    .array(createOrderCustomerSchema)
    .min(1, "El pedido debe tener al menos un cliente"),
});

/**
 * Schema para filtros de pedidos.
 *
 * Para qué sirve:
 * - Valida los query params de GET /api/orders.
 */
export const orderFiltersSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),

  customerId: z.coerce
    .number()
    .int("El ID del cliente debe ser entero")
    .positive("El ID del cliente debe ser mayor a cero")
    .optional(),

  from: z
    .string()
    .datetime("La fecha inicial debe tener formato ISO")
    .optional(),

  to: z.string().datetime("La fecha final debe tener formato ISO").optional(),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type CreateOrderCustomerDto = z.infer<typeof createOrderCustomerSchema>;
export type CreateOrderItemDto = z.infer<typeof createOrderItemSchema>;
export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;
export type UpdateFullOrderDto = z.infer<typeof updateFullOrderSchema>;
export type OrderFiltersDto = z.infer<typeof orderFiltersSchema>;
