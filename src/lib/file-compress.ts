/**
 * Compresión de archivos de evidencia. Tres estrategias, ninguna pierde
 * contenido visible:
 *  - Fotos: se achican a un máximo de 1600 px y se recomprimen como JPEG.
 *  - Firmas (PNG): recompresión SIN pérdida visible (mismos píxeles y transparencia).
 *  - Actas PDF: NO se regeneran (el acta firmada no puede cambiar de
 *    contenido: etiquetas, condiciones o el estado de otros daños pudieron
 *    cambiar desde entonces). Se reabre el PDF y solo se reducen las fotos
 *    JPEG embebidas.
 * Todas devuelven `null` si no hay un ahorro real (ver `worthReplacing`) o si
 * algo falla: ante la duda, el archivo original queda como está.
 */
import "server-only";
import sharp from "sharp";
import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from "pdf-lib";
import { worthReplacing } from "@/lib/storage-cleanup-rules";

export const PHOTO_MAX_DIM = 1600;
export const PHOTO_QUALITY = 72;
export const PDF_IMAGE_MAX_DIM = 1100;
export const PDF_IMAGE_QUALITY = 70;

export type Compressed = { body: Buffer; contentType: string };

/** Foto (JPEG/PNG/WebP) → JPEG de hasta 1600 px. `null` si no achica lo suficiente. */
export async function compressPhoto(input: Buffer): Promise<Compressed | null> {
  try {
    const out = await sharp(input, { failOn: "none" })
      .rotate() // aplica la orientación EXIF antes de quitarla
      .resize({ width: PHOTO_MAX_DIM, height: PHOTO_MAX_DIM, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: PHOTO_QUALITY, mozjpeg: true })
      .toBuffer();
    return worthReplacing(input.length, out.length) ? { body: out, contentType: "image/jpeg" } : null;
  } catch {
    return null;
  }
}

/** Firma PNG → PNG recomprimido sin pérdida. `null` si no achica lo suficiente. */
export async function compressSignature(input: Buffer): Promise<Compressed | null> {
  try {
    const out = await sharp(input, { failOn: "none" })
      .png({ compressionLevel: 9, effort: 10, adaptiveFiltering: true })
      .toBuffer();
    return worthReplacing(input.length, out.length) ? { body: out, contentType: "image/png" } : null;
  } catch {
    return null;
  }
}

/**
 * Reduce las fotos JPEG embebidas en un PDF (típicamente 8 fotos a 1600 px en
 * cada acta) sin tocar nada más del documento. `null` si no hay ahorro real.
 */
export async function compressPdfImages(input: Buffer): Promise<Compressed | null> {
  try {
    const doc = await PDFDocument.load(input, { updateMetadata: false });
    const pagesBefore = doc.getPageCount();
    const ctx = doc.context;
    const SUBTYPE = PDFName.of("Subtype");
    const FILTER = PDFName.of("Filter");
    const COLORSPACE = PDFName.of("ColorSpace");

    let replaced = 0;
    for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      const dict = obj.dict;
      // Solo imágenes JPEG "puras" (un único filtro DCT) en RGB.
      if (dict.get(SUBTYPE) !== PDFName.of("Image")) continue;
      if (dict.get(FILTER) !== PDFName.of("DCTDecode")) continue;
      if (dict.get(COLORSPACE) !== PDFName.of("DeviceRGB")) continue;

      const jpeg = Buffer.from(obj.contents);
      const { data, info } = await sharp(jpeg, { failOn: "none" })
        .resize({ width: PDF_IMAGE_MAX_DIM, height: PDF_IMAGE_MAX_DIM, fit: "inside", withoutEnlargement: true })
        .toColourspace("srgb")
        .removeAlpha()
        .jpeg({ quality: PDF_IMAGE_QUALITY, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      if (!worthReplacing(jpeg.length, data.length)) continue;

      const newDict = dict.clone(ctx);
      newDict.set(PDFName.of("Width"), PDFNumber.of(info.width));
      newDict.set(PDFName.of("Height"), PDFNumber.of(info.height));
      newDict.set(PDFName.of("BitsPerComponent"), PDFNumber.of(8));
      newDict.set(PDFName.of("Length"), PDFNumber.of(data.length));
      ctx.assign(ref, PDFRawStream.of(newDict, new Uint8Array(data)));
      replaced++;
    }
    if (replaced === 0) return null;

    const saved = Buffer.from(await doc.save({ useObjectStreams: true }));
    // Verificación: el PDF resultante tiene que volver a abrirse y conservar las páginas.
    const check = await PDFDocument.load(saved, { updateMetadata: false });
    if (check.getPageCount() !== pagesBefore) return null;

    return worthReplacing(input.length, saved.length) ? { body: saved, contentType: "application/pdf" } : null;
  } catch {
    return null;
  }
}
