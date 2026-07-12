import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Config de tests para Andes. Alias `@/` → src (igual que tsconfig) y stub de
// `server-only` para poder importar módulos de servidor desde los tests.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
});
