import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { createElement as h } from "react";
import { renderToBuffer, Document, Page, Image, Text } from "@react-pdf/renderer";
import { PDFDocument, PDFName, PDFRawStream, PDFNumber } from "pdf-lib";
import { compressPhoto, compressSignature, compressPdfImages } from "@/lib/file-compress";

/** Imagen con ruido para que el JPEG pese de verdad. */
async function noisyJpeg(width: number, height: number, quality = 92): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality }).toBuffer();
}

async function pdfWithJpeg(jpeg: Buffer): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 300]);
  const img = await doc.embedJpg(jpeg);
  page.drawImage(img, { x: 0, y: 0, width: 400, height: 300 });
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

function embeddedImageSizes(doc: PDFDocument): { w: number; h: number }[] {
  const out: { w: number; h: number }[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of("Subtype")) === PDFName.of("Image")) {
      const w = obj.dict.get(PDFName.of("Width")) as PDFNumber;
      const h = obj.dict.get(PDFName.of("Height")) as PDFNumber;
      out.push({ w: w.asNumber(), h: h.asNumber() });
    }
  }
  return out;
}

describe("compressPhoto", () => {
  it("achica una foto grande a 1600 px como máximo y pesa bastante menos", async () => {
    const input = await noisyJpeg(3200, 2400);
    const out = await compressPhoto(input);
    expect(out).not.toBeNull();
    expect(out!.contentType).toBe("image/jpeg");
    expect(out!.body.length).toBeLessThan(input.length * 0.85);
    const meta = await sharp(out!.body).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1600);
  });

  it("no toca una foto que ya está chica (sin ahorro real)", async () => {
    const input = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#888" } })
      .jpeg({ quality: 60 })
      .toBuffer();
    expect(await compressPhoto(input)).toBeNull();
  });

  it("devuelve null con bytes que no son una imagen", async () => {
    expect(await compressPhoto(Buffer.from("no soy una imagen"))).toBeNull();
  });
});

describe("compressSignature", () => {
  it("recomprime sin perder nada visible", async () => {
    // Un PNG poco comprimido: la firma real sale de un canvas, no optimizada.
    const raw = Buffer.alloc(600 * 200 * 4, 0);
    for (let x = 0; x < 600; x++) {
      const y = 100 + Math.round(40 * Math.sin(x / 20));
      for (let dy = -2; dy <= 2; dy++) {
        const i = ((y + dy) * 600 + x) * 4;
        raw[i + 3] = 255;
      }
    }
    const input = await sharp(raw, { raw: { width: 600, height: 200, channels: 4 } })
      .png({ compressionLevel: 0 })
      .toBuffer();
    const out = await compressSignature(input);
    expect(out).not.toBeNull();
    expect(out!.body.length).toBeLessThan(input.length);
    const a = await sharp(input).raw().toBuffer();
    const b = await sharp(out!.body).raw().toBuffer();
    expect(b.length).toBe(a.length);
    // Idéntico en todo lo visible: el optimizador puede cambiar el color RGB de
    // los píxeles 100% transparentes (invisible), nada más.
    for (let p = 0; p < a.length; p += 4) {
      expect(b[p + 3]).toBe(a[p + 3]);
      if (a[p + 3] !== 0) {
        expect([b[p], b[p + 1], b[p + 2]]).toEqual([a[p], a[p + 1], a[p + 2]]);
      }
    }
  });
});

describe("compressPdfImages", () => {
  it("reduce las fotos embebidas, conserva las páginas y el PDF vuelve a abrir", async () => {
    const pdf = await pdfWithJpeg(await noisyJpeg(2400, 1800));
    const out = await compressPdfImages(pdf);
    expect(out).not.toBeNull();
    expect(out!.contentType).toBe("application/pdf");
    expect(out!.body.length).toBeLessThan(pdf.length * 0.85);

    const reopened = await PDFDocument.load(out!.body);
    expect(reopened.getPageCount()).toBe(1);
    const sizes = embeddedImageSizes(reopened);
    expect(sizes).toHaveLength(1);
    expect(Math.max(sizes[0]!.w, sizes[0]!.h)).toBeLessThanOrEqual(1100);
  });

  it("devuelve null si el PDF no tiene fotos que reducir", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    expect(await compressPdfImages(Buffer.from(await doc.save()))).toBeNull();
  });

  it("devuelve null con bytes que no son un PDF", async () => {
    expect(await compressPdfImages(Buffer.from("no soy un pdf"))).toBeNull();
  });
});

describe("compressPdfImages con un PDF real de @react-pdf/renderer", () => {
  it("reconoce las fotos del acta y las achica", async () => {
    // Foto con la calidad que produce el cliente al capturar (1600 px, q72).
    const jpeg = await noisyJpeg(1600, 1200, 72);
    const uri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    const photos = Array.from({ length: 4 }, (_, i) => h(Image, { key: i, src: uri, style: { width: 250, height: 190 } }));
    const pdf = await renderToBuffer(h(Document, null, h(Page, { size: "A4" }, h(Text, null, "Acta"), ...photos)));

    const out = await compressPdfImages(pdf);
    expect(out).not.toBeNull();
    expect(out!.body.length).toBeLessThan(pdf.length * 0.5);
    const reopened = await PDFDocument.load(out!.body);
    expect(reopened.getPageCount()).toBe(1);
  });
});
