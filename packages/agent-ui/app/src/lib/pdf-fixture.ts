// pdf-fixture.ts — a hand-built, byte-exact minimal single-page PDF (test-only helper). Real-world PDFs
// need pdf.js's full font/encoding/content-stream machinery (the whole reason ADR-0202 exists); this
// fixture only needs to exercise the mechanical round trip (worker load → parse → getTextContent) with a
// standard-14 font (Helvetica, no embedded font program) and a correct xref table, so it is built by
// hand rather than shelling out to a PDF-writing library this repo doesn't otherwise depend on.
export function buildMinimalPdf(text: string): Uint8Array<ArrayBuffer> {
  const escaped = text.replace(/([()\\])/g, '\\$1')
  const contentStream = `BT /F1 24 Tf 20 150 Td (${escaped}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 300 300] /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  // `new Uint8Array(...)` over an existing Uint8Array copies into a FRESH backing `ArrayBuffer` — TS types
  // this constructor overload as `Uint8Array<ArrayBuffer>` (never the broader `ArrayBufferLike` union
  // `TextEncoder.encode()` alone returns), which is what `BlobPart`/`new File([...])` below actually wants.
  return new Uint8Array(new TextEncoder().encode(pdf))
}

/** A single-page PDF with an empty content stream — no text-showing operator at all (the honest
 *  "image-only / no text layer" shape ADR-0202 cl.5 names, without needing a real embedded raster). */
export function buildNoTextPdf(): Uint8Array<ArrayBuffer> {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /Resources << >> /MediaBox [0 0 300 300] /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  // `new Uint8Array(...)` over an existing Uint8Array copies into a FRESH backing `ArrayBuffer` — TS types
  // this constructor overload as `Uint8Array<ArrayBuffer>` (never the broader `ArrayBufferLike` union
  // `TextEncoder.encode()` alone returns), which is what `BlobPart`/`new File([...])` below actually wants.
  return new Uint8Array(new TextEncoder().encode(pdf))
}
