import type { Role } from "@/lib/user-permissions";

export type RoleAccessInfo = {
  /** `"owner"` no es un valor de `UserRole` — es el flag `User.owner`, aparte del rol. */
  role: Role | "owner";
  label: string;
  /** Qué suma este nivel por encima del anterior en la jerarquía (empleado < admin < finanzas < observador < propietario). */
  access: string[];
};

/**
 * Descripción en texto plano de qué puede ver/hacer cada rol — solo para
 * mostrarle al propietario en `/users` (`RolesAccessSection`), de referencia.
 * Es un espejo manual de la jerarquía real (`ROLE_RANK`/`hasAdminAccess`/
 * `hasFinanceAccess` en `user-permissions.ts`) y de los `requireAdmin`/
 * `hasFinanceAccess` repartidos por la app — si se agrega o se saca un
 * permiso en el código, actualizar esta lista a mano, no se deriva sola.
 */
export const ROLE_ACCESS: RoleAccessInfo[] = [
  {
    role: "empleado",
    label: "Empleado",
    access: [
      "Todo el flujo operativo: entregas/devoluciones, reservas, Calendario, vehículos, habitaciones, WhatsApp, Tareas, Horarios.",
      'Caja: ve los Ingresos completos y solo sus propios Egresos ("Mis movimientos"); puede cargar/editar/eliminar movimientos, Garantías, Facturación y cuentas corrientes de Proveedores.',
      'No ve: Configuración, Usuarios, Reportes, Saldos/Caja fuerte, Asociados, exportar CSV, ni credenciales marcadas "solo admin".',
    ],
  },
  {
    role: "admin",
    label: "Administrador",
    access: [
      "Todo lo de Empleado, más:",
      "Configuración completa (Checklist, Condiciones, Medios de pago, Calendario, Correos, WhatsApp, Nube), Usuarios (gestiona empleados), Reportes, Saldos/Caja fuerte, Asociados, exportar CSV, credenciales \"solo admin\".",
      "No puede crear ni modificar a otro admin/Finanzas/Observador (eso es solo del propietario).",
      'No ve las cuentas de Medios de pago marcadas "Solo Finanzas".',
    ],
  },
  {
    role: "finanzas",
    label: "Finanzas",
    access: [
      "Todo lo de Administrador, más:",
      'Ve y puede usar las cuentas de Medios de pago marcadas "Solo Finanzas" — en Configuración, Saldos y cualquier selector de medio de pago de la app.',
      "No puede marcar/desmarcar esa opción en una cuenta, ni crear o tocar a otro admin/Finanzas/Observador (eso es solo del propietario).",
    ],
  },
  {
    role: "observador",
    label: "Observador",
    access: [
      "Todo lo de Finanzas, más:",
      'No aparece en las listas operativas del equipo (asignar tareas, "usuarios en línea") — pensado para supervisar sin participar del día a día operativo.',
    ],
  },
  {
    role: "owner",
    label: "Propietario",
    access: [
      "Ve y puede todo, sin ninguna restricción.",
      'Es el único que puede crear o modificar a otro admin/Finanzas/Observador, y el único que puede marcar/desmarcar "Solo Finanzas" en una cuenta de Medios de pago.',
      "Su propia cuenta no la puede tocar (editar, desactivar, borrar) nadie más que él mismo.",
      "Se asigna por base de datos — no hay botón para otorgarlo desde la app.",
    ],
  },
];
