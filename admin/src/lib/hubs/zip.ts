/**
 * Minimal dependency-free ZIP writer (STORE method, no compression). Enough to
 * bundle a handful of small text files (the hub package) in the browser without
 * pulling in a zip library. Produces a standard .zip any OS can open.
 *
 * Everything is written into ONE ArrayBuffer (via DataView) and handed to Blob as
 * that buffer, so we never put a `Uint8Array<ArrayBufferLike>` into `BlobPart[]`
 * (which the strict DOM lib types reject because the buffer could be shared).
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

export function makeStoreZip(files: { path: string; content: string }[]): Blob {
  const enc = new TextEncoder();
  const entries = files.map((f) => {
    const name = enc.encode(f.path);
    const data = enc.encode(f.content);
    return { name, data, crc: crc32(data) };
  });

  let total = 22; // end-of-central-directory record
  for (const e of entries) {
    total += 30 + e.name.length + e.data.length; // local header + name + data
    total += 46 + e.name.length; // central-directory header + name
  }

  const buffer = new ArrayBuffer(total);
  const out = new Uint8Array(buffer);
  const dv = new DataView(buffer);
  let p = 0;

  const w16 = (n: number): void => {
    dv.setUint16(p, n & 0xffff, true);
    p += 2;
  };
  const w32 = (n: number): void => {
    dv.setUint32(p, n >>> 0, true);
    p += 4;
  };
  const wb = (b: Uint8Array): void => {
    out.set(b, p);
    p += b.length;
  };

  const offsets: number[] = [];
  for (const e of entries) {
    offsets.push(p);
    w32(0x04034b50); // local file header signature
    w16(20); // version needed
    w16(0); // flags
    w16(0); // method: store
    w16(0); // mod time
    w16(0); // mod date
    w32(e.crc);
    w32(e.data.length);
    w32(e.data.length);
    w16(e.name.length);
    w16(0); // extra len
    wb(e.name);
    wb(e.data);
  }

  const centralStart = p;
  entries.forEach((e, i) => {
    w32(0x02014b50); // central file header signature
    w16(20); // version made by
    w16(20); // version needed
    w16(0); // flags
    w16(0); // method
    w16(0); // mod time
    w16(0); // mod date
    w32(e.crc);
    w32(e.data.length);
    w32(e.data.length);
    w16(e.name.length);
    w16(0); // extra len
    w16(0); // comment len
    w16(0); // disk number
    w16(0); // internal attrs
    w32(0); // external attrs
    w32(offsets[i] ?? 0); // local header offset
    wb(e.name);
  });
  const centralSize = p - centralStart;

  w32(0x06054b50); // end of central directory signature
  w16(0); // disk number
  w16(0); // disk with central dir
  w16(entries.length);
  w16(entries.length);
  w32(centralSize);
  w32(centralStart);
  w16(0); // comment len

  return new Blob([buffer], { type: 'application/zip' });
}
