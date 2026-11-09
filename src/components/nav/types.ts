export type Item = { href: string; label: string; badge?: number };

/** "Ver como…" del menú de cuenta: roles que la sesión real puede simular. */
export type ViewAsMenu = {
  /** Etiqueta del rol simulado, o null si está en su vista propia. */
  current: string | null;
  currentRole: string | null;
  options: { role: string; label: string }[];
  /** Server action: recibe `role` en el FormData. */
  set: (formData: FormData) => Promise<void>;
  clear: () => Promise<void>;
};
