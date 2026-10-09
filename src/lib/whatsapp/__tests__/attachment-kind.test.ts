import { describe, expect, it } from "vitest";
import { classifyOutboundAttachment, attachmentIcon, formatFileSize, sniffBinaryType } from "@/lib/whatsapp/attachment-kind";

describe("classifyOutboundAttachment", () => {
  it("jpeg y png son imagen", () => {
    expect(classifyOutboundAttachment("image/jpeg")).toEqual({ waType: "image", kind: "image" });
    expect(classifyOutboundAttachment("image/png")).toEqual({ waType: "image", kind: "image" });
  });

  it("mp4 y 3gpp son video", () => {
    expect(classifyOutboundAttachment("video/mp4")).toEqual({ waType: "video", kind: "video" });
    expect(classifyOutboundAttachment("video/3gpp")).toEqual({ waType: "video", kind: "video" });
  });

  it("todo lo demás cae a documento (webp, pdf, docx, etc.)", () => {
    expect(classifyOutboundAttachment("image/webp")).toEqual({ waType: "document", kind: "document" });
    expect(classifyOutboundAttachment("application/pdf")).toEqual({ waType: "document", kind: "document" });
    expect(classifyOutboundAttachment("application/vnd.ms-excel")).toEqual({ waType: "document", kind: "document" });
  });
});

describe("attachmentIcon", () => {
  it("distingue imagen/video/pdf/genérico", () => {
    expect(attachmentIcon("image/jpeg")).toBe("🖼️");
    expect(attachmentIcon("video/mp4")).toBe("🎞️");
    expect(attachmentIcon("application/pdf")).toBe("📄");
    expect(attachmentIcon("application/zip")).toBe("📎");
  });
});

describe("formatFileSize", () => {
  it("bytes, KB y MB", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

describe("sniffBinaryType", () => {
  it("reconoce jpeg, png, webp y pdf por los magic numbers reales", () => {
    expect(sniffBinaryType(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(sniffBinaryType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);
    expect(sniffBinaryType(webp)).toBe("image/webp");
    expect(sniffBinaryType(Buffer.from("%PDF-1.4"))).toBe("application/pdf");
  });

  it("null si no matchea ningún formato conocido", () => {
    expect(sniffBinaryType(Buffer.from("cualquier cosa"))).toBeNull();
  });
});
