import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio"),
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener mínimo 6 caracteres"),
  role: z.enum(["ADMIN", "SELLER"]).default("SELLER"),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").optional(),
  email: z.string().trim().email("Email inválido").optional(),
  password: z
    .string()
    .min(6, "La contraseña debe tener mínimo 6 caracteres")
    .optional(),
  role: z.enum(["ADMIN", "SELLER"]).optional(),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type UpdateUserStatusDto = z.infer<typeof updateUserStatusSchema>;