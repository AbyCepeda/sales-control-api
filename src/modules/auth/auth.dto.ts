import { z } from "zod";

/**
 * DTO de login.
 *
 * Define y valida qué datos debe mandar el cliente.
 *
 * TypeScript no valida datos en runtime.
 * Zod sí valida cuando la API está ejecutándose.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email("El correo no tiene un formato válido")
    .trim()
    .toLowerCase(),

  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
});

/**
 * Tipo TypeScript generado desde el schema de Zod.
 *
 * Esto evita duplicar tipos manualmente.
 */
export type LoginDto = z.infer<typeof loginSchema>;