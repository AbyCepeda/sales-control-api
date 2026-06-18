import type { Customer } from "@prisma/client";

/**
 * Tipo que representa un cliente enviado al frontend.
 *
 * Por ahora usamos Customer completo porque no contiene datos sensibles.
 * Lo dejamos separado para poder ajustar la respuesta más adelante.
 */
export type CustomerResponse = Customer;