import type { NextConfig } from "next";

// El streaming de RSC de Next (`self.__next_f`) inyecta <script> inline en
// cada carga de página, en dev y en producción — verificado contra un build
// de producción real (`next build && next start`): un script-src 'self' sin
// 'unsafe-inline' rompe la hidratación de toda la app. La forma correcta de
// evitarlo es un CSP con nonce generado por request (patrón documentado por
// Next.js), que acá requeriría engancharse al proxy de Auth.js (src/proxy.ts)
// — queda como mejora a futuro. Hasta entonces, 'unsafe-inline' en script-src
// es la opción pragmática; el resto de las directivas sigue estricto
// (frame-ancestors, object-src, form-action, base-uri).
const scriptSrc =
  process.env.NODE_ENV === "development"
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  // Los estilos de Tailwind son clases estáticas; el único inline real son
  // los `style={{...}}` de React (croquis, barra de progreso), sin sesgo de
  // seguridad práctico como el de scripts inline.
  "style-src 'self' 'unsafe-inline'",
  // blob: para las previews de fotos/firma (URL.createObjectURL en el
  // wizard); data: para el ícono/manifest.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // data: acá es imprescindible: el paso "Firma" convierte el canvas a blob
  // vía `fetch(dataUrl)` (src/components/inspection/inspection-wizard.tsx) —
  // sin esto, connect-src bloquea esa conversión y la firma local (el
  // fallback sin QR remoto) queda rota en silencio. Encontrado recién al
  // probar el flujo de firma completo después de agregar el CSP.
  "connect-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // El wizard usa cámara (fotos) y geolocalización (tag de la inspección);
  // el resto de las APIs sensibles no se usan en ningún lado.
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=()" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
