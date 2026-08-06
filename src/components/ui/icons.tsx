/**
 * Íconos chicos hechos a mano (sin librería), mismo estilo que el SyncIcon
 * de `components/nav/sync-button.tsx` (ese vive ahí porque es específico de
 * ese botón — morphea entre spinner y check según su propio estado — no es
 * un ícono genérico como los de acá).
 */

export function PaymentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c0-1.1 1.1-2 2.5-2s2.5.9 2.5 2-1.1 1.7-2.5 1.7-2.5.7-2.5 1.8 1.1 2 2.5 2 2.5-.9 2.5-2" />
    </svg>
  );
}

export function ServiceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5a1.5 1.5 0 0 1-2.1-2.1z" />
    </svg>
  );
}

/** Lápiz de "editar" — antes duplicado byte a byte en MovementRow y SafeMovementRow. */
export function EditIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.586 2.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 4.793 3 13.172V17h3.828l8.379-8.379-3.828-3.828Z" />
    </svg>
  );
}

/** Cámara (sacar foto) — reemplaza el emoji 📷 en la captura de documentos. */
export function CameraIcon({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

/** Galería (elegir archivo existente) — reemplaza el emoji 🖼️. */
export function GalleryIcon({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.4" />
      <path d="m4 16.5 4.5-4.5 3.5 3.5 3-3 4.5 4.5" />
    </svg>
  );
}

/** X para "quitar/cerrar" — reemplaza el glifo ✕ usado como botón funcional. */
export function CloseIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
