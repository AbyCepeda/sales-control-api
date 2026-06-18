import { z } from "zod";

/**
 * DTO para crear un producto.
 *
 * Aquí definimos qué datos puede mandar el cliente cuando crea un producto.
 * Zod valida estos datos en runtime, cosa que TypeScript no puede hacer solo.
 */
export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres"),

  description: z
    .string()
    .trim()
    .optional()
    .nullable(),

  price: z
    .number({
      error: "El precio debe ser un número",
    })
    .positive("El precio debe ser mayor a 0"),

  stock: z
    .number({
      error: "El stock debe ser un número",
    })
    .int("El stock debe ser un número entero")
    .min(0, "El stock no puede ser negativo")
    .default(0),

  isActive: z
    .boolean()
    .optional()
    .default(true),
});

/**
 * DTO para actualizar un producto.
 *
 * Usamos partial porque al actualizar no siempre se mandan todos los campos.
 * Por ejemplo, podrías actualizar solo el stock o solo el precio.
 */
export const updateProductSchema = createProductSchema.partial();

/**
 * Tipos TypeScript generados desde Zod.
 *
 * Así no duplicamos manualmente los tipos.
 */
export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;