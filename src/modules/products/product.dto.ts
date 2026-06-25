import { z } from "zod";

/**
 * DTO para crear un producto.
 *
 * Para qué sirve:
 * - Define qué datos puede mandar el cliente cuando crea un producto.
 * - Valida esos datos antes de llegar al service.
 *
 * Beneficio:
 * - Evitamos guardar productos incompletos o inválidos en la base de datos.
 * - TypeScript obtiene los tipos directamente desde Zod.
 */
export const createProductSchema = z.object({
  /**
   * SKU del producto.
   *
   * Para qué sirve:
   * - Identifica de forma única un producto.
   * - Es importante porque el flujo de pedidos usa SKU para crear o reutilizar productos.
   *
   * Beneficio:
   * - Evita productos duplicados con el mismo código.
   * - Permite buscar productos de forma más confiable.
   */
  sku: z
    .string()
    .trim()
    .min(1, "El SKU es obligatorio")
    .max(50, "El SKU no puede superar 50 caracteres")
    .transform((value) => value.toUpperCase()),

  /**
   * Nombre visible del producto.
   */
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres"),

  /**
   * Descripción opcional del producto.
   *
   * Puede ser null porque a veces un producto no necesita descripción.
   */
  description: z
    .string()
    .trim()
    .optional()
    .nullable(),

  /**
   * Precio del producto.
   *
   * Debe ser mayor a 0 porque no tendría sentido vender un producto con precio 0.
   */
  price: z
    .number({
      error: "El precio debe ser un número",
    })
    .positive("El precio debe ser mayor a 0"),

  /**
   * Stock disponible.
   *
   * Puede ser 0, pero no negativo.
   */
  stock: z
    .number({
      error: "El stock debe ser un número",
    })
    .int("El stock debe ser un número entero")
    .min(0, "El stock no puede ser negativo")
    .default(0),

  /**
   * Estado del producto.
   *
   * Para qué sirve:
   * - Permite ocultar/desactivar productos sin borrarlos.
   *
   * Beneficio:
   * - Conservamos historial de pedidos aunque el producto ya no se venda.
   */
  isActive: z
    .boolean()
    .optional()
    .default(true),
});

/**
 * DTO para actualizar un producto.
 *
 * Usamos partial porque al actualizar no siempre se mandan todos los campos.
 *
 * Ejemplo:
 * - Puedes actualizar solo stock.
 * - Puedes actualizar solo precio.
 * - Puedes actualizar solo isActive.
 */
export const updateProductSchema = createProductSchema.partial();

/**
 * Tipos TypeScript generados desde Zod.
 *
 * Para qué sirve:
 * - Evita duplicar tipos manualmente.
 *
 * Beneficio:
 * - Si cambia el schema, los tipos se actualizan automáticamente.
 */
export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;