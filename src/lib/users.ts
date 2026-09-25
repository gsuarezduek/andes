import type { Prisma } from "@prisma/client";

/**
 * Usuarios "operativos": activos y no observadores. Es el filtro para
 * cualquier lista o selector de personas en la parte operativa (asignar
 * tareas, usuarios en línea, etc.). Los observadores solo se ven en /users.
 */
export const OPERATOR_FILTER = { active: true, observer: false } satisfies Prisma.UserWhereInput;
