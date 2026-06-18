import { z } from "zod";

/**
 * DTO para crear un cliente.
 *
 * Un cliente representa a la persona que realiza pedidos.
 * No se borra físicamente porque puede volver a comprar
 * y porque sus pedidos anteriores deben conservarse como historial.
 */
export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres"),

  phone: z
    .string()
    .trim()
    .min(7, "El teléfono debe tener al menos 7 caracteres")
    .optional()
    .nullable(),

  notes: z
    .string()
    .trim()
    .optional()
    .nullable(),

  /**
   * Por defecto todo cliente nuevo queda activo.
   *
   * Esto permite ocultarlo después sin borrar sus pedidos.
   */
  isActive: z
    .boolean()
    .optional()
    .default(true),
});

/**
 * DTO para actualizar un cliente.
 *
 * partial permite actualizar solo algunos campos.
 * Ejemplo: cambiar solo teléfono o desactivar el cliente.
 */
export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;