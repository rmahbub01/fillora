/**
 * Utility to sanitize TrueType / OpenType font buffers.
 * 
 * Many widely distributed fonts (such as Nikosh.ttf, NikoshBAN, etc.) contain corrupted,
 * non-standard, or oversized metadata records (e.g. nameID 10/13 descriptions with >17KB-35KB 
 * of corrupted surrogate or UTF-16 bytes).
 * Modern browser engines (Firefox, Chromium, Safari) run OpenType Sanitizer (OTS) which rejects
 * any font file with malformed name records, throwing "SyntaxError: Invalid font data in ArrayBuffer"
 * or "NetworkError: A network error occurred."
 * 
 * This sanitizer strips oversized metadata strings while preserving all essential font metrics,
 * glyph definitions, and OpenType layout tables (GPOS/GSUB/cmap/loca/glyf).
 */
export function sanitizeFontBuffer(buffer: ArrayBuffer): ArrayBuffer {
  try {
    if (buffer.byteLength < 16) {
      return buffer;
    }

    const view = new DataView(buffer);
    const sfntVersion = view.getUint32(0);

    // Only process standard SFNT headers (TrueType 0x00010000, OpenType 'OTTO', or Apple 'true')
    if (sfntVersion !== 0x00010000 && sfntVersion !== 0x4F54544F && sfntVersion !== 0x74727565) {
      return buffer; // Compressed formats like WOFF / WOFF2 are returned as-is
    }

    const numTables = view.getUint16(4);
    if (numTables > 100 || 12 + numTables * 16 > buffer.byteLength) {
      return buffer;
    }

    let nameTableOffset = 0;
    let nameTableLength = 0;
    let nameTableRecordIndex = -1;

    for (let i = 0; i < numTables; i++) {
      const rOffset = 12 + i * 16;
      const tag = String.fromCharCode(
        view.getUint8(rOffset),
        view.getUint8(rOffset + 1),
        view.getUint8(rOffset + 2),
        view.getUint8(rOffset + 3)
      );
      if (tag === 'name') {
        nameTableRecordIndex = i;
        nameTableOffset = view.getUint32(rOffset + 8);
        nameTableLength = view.getUint32(rOffset + 12);
        break;
      }
    }

    if (nameTableRecordIndex === -1 || nameTableLength < 6 || nameTableOffset + nameTableLength > buffer.byteLength) {
      return buffer;
    }

    const nameView = new DataView(buffer, nameTableOffset, nameTableLength);
    const format = nameView.getUint16(0);
    if (format !== 0 && format !== 1) {
      return buffer;
    }

    const count = nameView.getUint16(2);
    const stringOffset = nameView.getUint16(4);
    if (6 + count * 12 > nameTableLength || stringOffset > nameTableLength) {
      return buffer;
    }

    interface CleanNameRecord {
      platformID: number;
      encodingID: number;
      languageID: number;
      nameID: number;
      length: number;
      strBytes: Uint8Array;
    }

    const records: CleanNameRecord[] = [];
    let hasOversized = false;

    for (let i = 0; i < count; i++) {
      const rOffset = 6 + i * 12;
      const platformID = nameView.getUint16(rOffset);
      const encodingID = nameView.getUint16(rOffset + 2);
      const languageID = nameView.getUint16(rOffset + 4);
      const nameID = nameView.getUint16(rOffset + 6);
      const length = nameView.getUint16(rOffset + 8);
      const offset = nameView.getUint16(rOffset + 10);

      // Filter out corrupted strings or excessive license/description records (> 512 bytes)
      if (length > 512 || nameID === 10 || nameID === 13) {
        hasOversized = true;
        continue;
      }

      const strStart = nameTableOffset + stringOffset + offset;
      if (strStart + length > buffer.byteLength) {
        hasOversized = true;
        continue;
      }

      const strBytes = new Uint8Array(buffer, strStart, length);
      records.push({ platformID, encodingID, languageID, nameID, length, strBytes });
    }

    // If no oversized or corrupt records found, keep original buffer unchanged
    if (!hasOversized) {
      return buffer;
    }

    // Reconstruct clean 'name' table
    const newHeaderSize = 6 + records.length * 12;
    let stringStorageSize = 0;
    for (const r of records) {
      stringStorageSize += r.length;
    }

    // Align to 4 bytes
    const newNameTableSize = (newHeaderSize + stringStorageSize + 3) & ~3;
    const newNameTable = new Uint8Array(newNameTableSize);
    const newNameView = new DataView(newNameTable.buffer);

    newNameView.setUint16(0, 0); // format 0
    newNameView.setUint16(2, records.length);
    newNameView.setUint16(4, newHeaderSize);

    let curStrOffset = 0;
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const rOffset = 6 + i * 12;
      newNameView.setUint16(rOffset, r.platformID);
      newNameView.setUint16(rOffset + 2, r.encodingID);
      newNameView.setUint16(rOffset + 4, r.languageID);
      newNameView.setUint16(rOffset + 6, r.nameID);
      newNameView.setUint16(rOffset + 8, r.length);
      newNameView.setUint16(rOffset + 10, curStrOffset);

      newNameTable.set(r.strBytes, newHeaderSize + curStrOffset);
      curStrOffset += r.length;
    }

    // Recalculate checksum for clean 'name' table
    let nameChecksum = 0;
    const nameWords = Math.floor(newNameTableSize / 4);
    for (let i = 0; i < nameWords; i++) {
      nameChecksum = (nameChecksum + newNameView.getUint32(i * 4)) >>> 0;
    }

    // Assemble new font file with updated table directory
    interface TableEntry {
      tag: string;
      data: Uint8Array;
      checksum: number;
    }

    const tables: TableEntry[] = [];
    for (let i = 0; i < numTables; i++) {
      const rOffset = 12 + i * 16;
      const tag = String.fromCharCode(
        view.getUint8(rOffset),
        view.getUint8(rOffset + 1),
        view.getUint8(rOffset + 2),
        view.getUint8(rOffset + 3)
      );
      const offset = view.getUint32(rOffset + 8);
      const length = view.getUint32(rOffset + 12);

      if (tag === 'name') {
        tables.push({ tag, data: newNameTable, checksum: nameChecksum });
      } else {
        const paddedLen = (length + 3) & ~3;
        const data = new Uint8Array(buffer, offset, Math.min(paddedLen, buffer.byteLength - offset));
        const checksum = view.getUint32(rOffset + 4);
        tables.push({ tag, data, checksum });
      }
    }

    let totalSize = 12 + numTables * 16;
    for (const t of tables) {
      totalSize += (t.data.byteLength + 3) & ~3;
    }

    const outBuffer = new ArrayBuffer(totalSize);
    const outView = new DataView(outBuffer);
    const outBytes = new Uint8Array(outBuffer);

    // Copy original SFNT header
    outBytes.set(new Uint8Array(buffer, 0, 12), 0);

    let tableDataOffset = 12 + numTables * 16;
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      const rOffset = 12 + i * 16;
      outView.setUint8(rOffset, t.tag.charCodeAt(0));
      outView.setUint8(rOffset + 1, t.tag.charCodeAt(1));
      outView.setUint8(rOffset + 2, t.tag.charCodeAt(2));
      outView.setUint8(rOffset + 3, t.tag.charCodeAt(3));
      outView.setUint32(rOffset + 4, t.checksum);
      outView.setUint32(rOffset + 8, tableDataOffset);
      outView.setUint32(rOffset + 12, t.data.byteLength);

      outBytes.set(t.data, tableDataOffset);
      tableDataOffset += (t.data.byteLength + 3) & ~3;
    }

    return outBuffer;
  } catch (err) {
    console.warn('Font sanitization encountered non-fatal error, using original buffer:', err);
    return buffer;
  }
}
