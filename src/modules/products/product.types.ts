import type { Product } from "@prisma/client";

/**
 * Tipo de producto que exponemos al frontend.
 *
 * Por ahora usamos Product completo porque no contiene datos sensibles.
 * Aun así lo dejamos separado por si después queremos ocultar campos.
 */
export type ProductResponse = Product;