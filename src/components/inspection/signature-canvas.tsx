"use client";

import SignaturePad from "signature_pad";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

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
      const pad = new SignaturePad(canvas, { penColor: "#0f172a" });
      padRef.current = pad;

      function resize() {
        if (!canvas) return;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        canvas.getContext("2d")?.scale(ratio, ratio);
        pad.clear();
      }
      resize();
      window.addEventListener("resize", resize);
      return () => {
        window.removeEventListener("resize", resize);
        pad.off();
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
