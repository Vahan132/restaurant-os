/**
 * Minimal dependency-free ZIP writer (STORE method, no compression). Enough to
 * bundle a handful of small text files (the hub package) in the browser without
 * pulling in a zip library. Produces a standard .zip any OS can open.
 */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i] ?? 0;
    c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const u16 = (n: number): Uint8Array => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
const u32 = (n: number): Uint8Array =>
  new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);

export function makeStoreZip(files: { path: string; content: string }[]): Blob {
  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: BlobPart[] = [];
  let offset = 0;
  let centralSize = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.path);
    const data = enc.encode(f.content);
    const crc = crc32(data);

    const local: BlobPart[] = [
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), nameBytes,
    ];
    const localLen = 30 + nameBytes.length;
    parts.push(...local, data);

    central.push(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
      nameBytes,
    );
    centralSize += 46 + nameBytes.length;
    offset += localLen + data.length;
  }

  const eocd: BlobPart[] = [
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralSize), u32(offset), u16(0),
  ];

  return new Blob([...parts, ...central, ...eocd], { type: 'application/zip' });
}
