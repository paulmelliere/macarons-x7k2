// Draws the macaron app icon and writes PNGs with no dependencies (node built-ins only).
// Usage: node scripts/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BLEU = [0, 85, 164];
const CREAM = [255, 248, 240];
const SHELL = [232, 85, 122];
const FILL = [255, 194, 210];
const ROUGE = [239, 65, 53];

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// colour at (x, y) in unit square, or null when transparent
function colorAt(x, y) {
  // background: bleu with a subtle tricolore band along the bottom
  let c = BLEU;
  if (y > 0.90) c = x < 0.5 ? [255, 255, 255] : ROUGE;

  // cream medallion
  const dm = Math.hypot(x - 0.5, y - 0.47);
  if (dm < 0.40) c = CREAM;

  const inEll = (cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

  // bottom shell
  if (y >= 0.585 && inEll(0.5, 0.585, 0.30, 0.13)) c = mix(SHELL, [0, 0, 0], 0.08);
  // filling
  const fx = Math.abs(x - 0.5), fy = Math.abs(y - 0.555);
  if (fx <= 0.32 && fy <= 0.035) c = FILL;
  // top dome
  if (y <= 0.525 && inEll(0.5, 0.525, 0.30, 0.20)) c = SHELL;
  // highlight
  if (y <= 0.5 && inEll(0.37, 0.40, 0.09, 0.045)) c = mix(SHELL, [255, 255, 255], 0.55);
  return c;
}

function render(size) {
  const SS = 3;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = colorAt((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const o = py * (size * 3 + 1) + 1 + px * 3;
      const n = SS * SS;
      raw[o] = Math.round(r / n); raw[o + 1] = Math.round(g / n); raw[o + 2] = Math.round(b / n);
    }
  }
  return encodePNG(size, size, raw);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePNG(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  fs.writeFileSync(path.join(out, name), render(size));
  console.log('wrote', name);
}
