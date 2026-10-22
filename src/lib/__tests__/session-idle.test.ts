import { describe, expect, it } from "vitest";
import { applyIdleTimeout, IDLE_TIMEOUT_MS } from "../session-idle";

const NOW = 1_800_000_000_000;

describe("applyIdleTimeout", () => {
  it("renueva lastSeen de un empleado activo", () => {
    const token = { owner: false, lastSeen: NOW - 5 * 60 * 1000 };
    expect(applyIdleTimeout(token, NOW)).toEqual({ owner: false, lastSeen: NOW });
  });

  it("cierra la sesión de quien no es propietario tras más de 10 min sin actividad", () => {
    expect(applyIdleTimeout({ owner: false, lastSeen: NOW - IDLE_TIMEOUT_MS - 1 }, NOW)).toBeNull();
  });

  it("justo en el límite todavía no la cierra", () => {
    expect(applyIdleTimeout({ owner: false, lastSeen: NOW - IDLE_TIMEOUT_MS }, NOW)).not.toBeNull();
  });

  it("el propietario nunca se desconecta por inactividad", () => {
    const token = { owner: true, lastSeen: NOW - 200 * 24 * 60 * 60 * 1000 };
    expect(applyIdleTimeout(token, NOW)).toEqual({ owner: true, lastSeen: NOW });
  });

  it("un token sin lastSeen (emitido antes del cambio) cuenta como activo", () => {
    expect(applyIdleTimeout({ owner: false }, NOW)).toEqual({ owner: false, lastSeen: NOW });
  });
});
