"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type SignaturePad from "signature_pad";

export type SignaturePadHandle = {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
};

export const SignatureCanvas = forwardRef<SignaturePadHandle>(
  function SignatureCanvas(_props, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      let cancelled = false;
      let cleanup: (() => void) | undefined;

      // signature_pad solo hace falta en este paso del wizard ("Firma", el
      // último antes de guardar): se importa dinámicamente para que quede en
      // su propio chunk en vez de ir en el bundle inicial de los 7 pasos.
      import("signature_pad").then(({ default: SignaturePadImpl }) => {
        if (cancelled || !canvas) return;
        const el: HTMLCanvasElement = canvas;
        const pad = new SignaturePadImpl(el, { penColor: "#0f172a" });
        padRef.current = pad;

        const resize = () => {
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          const rect = el.getBoundingClientRect();
          el.width = rect.width * ratio;
          el.height = rect.height * ratio;
          el.getContext("2d")?.scale(ratio, ratio);
          pad.clear();
        };
        resize();
        window.addEventListener("resize", resize);
        cleanup = () => {
          window.removeEventListener("resize", resize);
          pad.off();
        };
      });

      return () => {
        cancelled = true;
        cleanup?.();
      };
    }, []);

    useImperativeHandle(ref, () => ({
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      toDataURL: () => padRef.current?.toDataURL("image/png") ?? "",
      clear: () => padRef.current?.clear(),
    }));

    return (
      <canvas
        ref={canvasRef}
        className="h-48 w-full touch-none rounded-lg border border-foreground/20 bg-white"
      />
    );
  },
);
