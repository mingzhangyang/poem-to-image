/**
 * Parse JPEG segment lengths until the first Start Of Scan (SOS), requiring a
 * supported Start Of Frame (SOF) with bounded dimensions. Header signatures
 * alone do not bound the decoded bitmap memory of a tiny, highly compressed
 * malicious JPEG. Reject truncated/invalid marker ranges.
 *
 * Entropy-coded scan bytes may contain escaped 0xff bytes; parsing them as
 * metadata markers is incorrect. The browser decoder handles the full codec.
 */
export function validJpegDimensions(bytes: Uint8Array, maxDimension = 4096): boolean {
  const size = bytes.length;
  if (size < 16 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  // Canvas-generated JPEGs terminate with the EOI marker.
  if (bytes[size - 2] !== 0xff || bytes[size - 1] !== 0xd9) return false;

  let offset = 2;
  let foundFrame = false;
  while (offset < size - 2) {
    if (bytes[offset++] !== 0xff) return false;
    while (offset < size && bytes[offset] === 0xff) offset++;
    if (offset >= size - 2) return false;
    const marker = bytes[offset++];
    // Markers without a length are forbidden before SOS.
    if (marker === 0 || marker === 0x01 || marker === 0xd8 || marker === 0xd9
      || (marker >= 0xd0 && marker <= 0xd7)) return false;
    if (offset + 2 > size - 2) return false;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > size - 2) return false;

    // Baseline DCT, extended sequential and progressive DCT are supported
    // by the web canvas decoder. Lossless/arithmetic JPEG modes are rejected.
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (foundFrame || length < 11 || bytes[offset + 2] !== 8) return false;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const components = bytes[offset + 7];
      if (!height || !width || width > maxDimension || height > maxDimension
        || components < 1 || components > 4 || length !== 8 + 3 * components) return false;
      foundFrame = true;
    } else if ((marker >= 0xc0 && marker <= 0xcf)
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      // Other SOF types must not bypass the size check.
      return false;
    }
    if (marker === 0xda) {
      // The first SOS must follow a valid frame header. Require an entropy
      // payload between the scan header and the EOI marker.
      return foundFrame && offset + length < size - 2;
    }
    offset += length;
  }
  return false;
}
