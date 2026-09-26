/**
 * Paleta de comandos (Ctrl/⌘ + K): catálogo de destinos y filtrado. Lógica pura,
 * sin React — la UI vive en `components/nav/command-palette.tsx`.
 *
 * Las rutas que hacen `requireAdmin` se marcan `adminOnly` para no ofrecerle a
 * un empleado un destino que lo rebotaría. La guarda real sigue estando en la
 * página; esto es solo no mostrar lo que no puede usar.
 */

export type CommandGroup = "Ir a" | "Crear" | "Configuración";

export type Command = {
  id: string;
  label: string;
  href: string;
  group: CommandGroup;
  /** Sinónimos para encontrarlo escribiendo otra palabra ("plata" → Caja). */
  keywords?: string[];
  adminOnly?: boolean;
};

const COMMANDS: Command[] = [
  { id: "home", label: "Inicio", href: "/", group: "Ir a", keywords: ["home", "dashboard", "hoy", "alertas"] },
  { id: "rentals", label: "Alquileres", href: "/rentals", group: "Ir a", keywords: ["reservas", "entregas", "devoluciones"] },
  { id: "whatsapp", label: "WhatsApp", href: "/whatsapp", group: "Ir a", keywords: ["chat", "mensajes", "clientes", "inbox"] },
  { id: "calendar", label: "Calendario", href: "/calendar", group: "Ir a", keywords: ["agenda", "timeline", "gantt", "disponibilidad"] },
  { id: "vehicles", label: "Vehículos", href: "/vehicles", group: "Ir a", keywords: ["autos", "flota", "patente", "service"] },
  { id: "rooms", label: "Habitaciones", href: "/rooms", group: "Ir a", keywords: ["airbnb", "booking", "temporario", "hospedaje", "cuarto"] },
  { id: "caja", label: "Caja", href: "/caja", group: "Ir a", keywords: ["plata", "cobros", "pagos", "ingresos", "egresos", "saldos", "garantias", "proveedores", "asociados"] },
  { id: "tasks", label: "Tareas", href: "/tasks", group: "Ir a", keywords: ["pendientes", "todo"] },
  { id: "reports", label: "Reportes", href: "/reports", group: "Ir a", keywords: ["estadisticas", "ocupacion", "ingresos", "metricas"], adminOnly: true },
  { id: "competitor-prices", label: "Precios de la competencia", href: "/competitor-prices", group: "Ir a", keywords: ["competencia", "tarifas", "comparar"], adminOnly: true },
  { id: "gps", label: "GPS", href: "/gps", group: "Ir a", keywords: ["dispositivos", "rastreo"] },
  { id: "sync", label: "Sincronización", href: "/sync", group: "Ir a", keywords: ["vikrentcar", "wordpress", "importar", "flota"] },
  { id: "profile", label: "Perfil", href: "/profile", group: "Ir a", keywords: ["contraseña", "cuenta"] },

  { id: "new-rental", label: "Nueva reserva", href: "/rentals/new", group: "Crear", keywords: ["alquiler manual", "agregar"] },
  { id: "new-vehicle", label: "Nuevo vehículo", href: "/vehicles/new", group: "Crear", keywords: ["auto", "agregar"], adminOnly: true },
  { id: "new-room", label: "Nueva habitación", href: "/rooms/new", group: "Crear", keywords: ["airbnb", "booking", "agregar"], adminOnly: true },
  { id: "vehicle-qr", label: "Hoja de QR de la flota", href: "/vehicles/qr", group: "Crear", keywords: ["imprimir", "codigos"], adminOnly: true },
  { id: "new-user", label: "Nuevo usuario", href: "/users/new", group: "Crear", keywords: ["empleado", "administrador", "alta"], adminOnly: true },

  { id: "settings", label: "Configuración", href: "/settings", group: "Configuración", keywords: ["ajustes"], adminOnly: true },
  { id: "settings-general", label: "Condiciones y checklist", href: "/settings/general", group: "Configuración", keywords: ["franquicia", "km", "seguro", "service"], adminOnly: true },
  { id: "settings-calendar", label: "Orden del calendario", href: "/settings/calendar", group: "Configuración", keywords: ["autos"], adminOnly: true },
  { id: "settings-payment-methods", label: "Medios de pago", href: "/settings/payment-methods", group: "Configuración", keywords: ["cuentas", "comision", "recargo", "efectivo", "tarjeta"], adminOnly: true },
  { id: "settings-expense-categories", label: "Categorías de gasto", href: "/settings/expense-categories", group: "Configuración", keywords: ["egresos"], adminOnly: true },
  { id: "settings-emails", label: "Correos electrónicos", href: "/settings/emails", group: "Configuración", keywords: ["mails", "resend", "acta"], adminOnly: true },
  { id: "settings-whatsapp", label: "Cuenta de WhatsApp", href: "/settings/whatsapp", group: "Configuración", keywords: ["chakra", "webhook", "plantillas"], adminOnly: true },
  { id: "settings-whatsapp-bot", label: "Bot de WhatsApp", href: "/settings/whatsapp/bot", group: "Configuración", keywords: ["ia", "entrenar", "prompt", "documentos"], adminOnly: true },
  { id: "settings-cloud", label: "Nube (uso de espacio)", href: "/settings/cloud", group: "Configuración", keywords: ["r2", "base de datos", "archivos"], adminOnly: true },
  { id: "settings-cloud-cleanup", label: "Limpiar archivos de la nube", href: "/settings/cloud/cleanup", group: "Configuración", keywords: ["comprimir", "eliminar", "descargar", "fotos"], adminOnly: true },
  { id: "users", label: "Usuarios", href: "/users", group: "Configuración", keywords: ["empleados", "logins", "historial"], adminOnly: true },
];

export function getCommands(isAdmin: boolean): Command[] {
  return COMMANDS.filter((c) => isAdmin || !c.adminOnly);
}

/** Minúsculas y sin tildes: "Vehiculos" encuentra "Vehículos". */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Puntaje de un comando para una consulta (0 = no matchea). Todos los términos
 * tienen que aparecer en alguna parte (etiqueta, sinónimos o grupo); el título
 * pesa más que un sinónimo, y empezar con el término más que contenerlo.
 */
function score(command: Command, terms: string[]): number {
  const label = normalizeSearch(command.label);
  const labelWords = label.split(/\s+/);
  const keywords = (command.keywords ?? []).map(normalizeSearch);
  const group = normalizeSearch(command.group);

  let total = 0;
  for (const term of terms) {
    if (label.startsWith(term)) total += 100;
    else if (labelWords.some((w) => w.startsWith(term))) total += 80;
    else if (label.includes(term)) total += 50;
    else if (keywords.some((k) => k.startsWith(term))) total += 30;
    else if (keywords.some((k) => k.includes(term))) total += 20;
    else if (group.includes(term)) total += 5;
    else return 0;
  }
  return total;
}

/**
 * Filtra y ordena por relevancia; sin consulta devuelve el catálogo tal cual
 * (el orden de `COMMANDS` es el de uso habitual). A igual puntaje se conserva
 * el orden del catálogo.
 */
export function filterCommands(commands: Command[], query: string): Command[] {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return commands;

  return commands
    .map((command, index) => ({ command, index, s: score(command, terms) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map((r) => r.command);
}
