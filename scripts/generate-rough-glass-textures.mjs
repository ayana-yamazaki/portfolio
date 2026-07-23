import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(scriptDirectory, '../src/assets/materials');

const hashGrid = (x, y, seed) => {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 69069);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
};

const smoothCurve = (value) => value * value * (3 - 2 * value);
const mixNumber = (from, to, amount) => from + (to - from) * amount;

const valueNoise = (x, y, scale, seed) => {
  const gridX = x / scale;
  const gridY = y / scale;
  const x0 = Math.floor(gridX);
  const y0 = Math.floor(gridY);
  const tx = smoothCurve(gridX - x0);
  const ty = smoothCurve(gridY - y0);
  const top = mixNumber(hashGrid(x0, y0, seed), hashGrid(x0 + 1, y0, seed), tx);
  const bottom = mixNumber(
    hashGrid(x0, y0 + 1, seed),
    hashGrid(x0 + 1, y0 + 1, seed),
    tx,
  );
  return mixNumber(top, bottom, ty);
};

const cellularRelief = (x, y, cellSize, seed) => {
  const cellX = Math.floor(x / cellSize);
  const cellY = Math.floor(y / cellSize);
  let nearest = 2;

  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const gridX = cellX + offsetX;
      const gridY = cellY + offsetY;
      const pointX = (
        gridX + .18 + hashGrid(gridX, gridY, seed) * .64
      ) * cellSize;
      const pointY = (
        gridY + .18 + hashGrid(gridX, gridY, seed + 37) * .64
      ) * cellSize;
      const distance = Math.hypot(x - pointX, y - pointY) / cellSize;
      nearest = Math.min(nearest, distance);
    }
  }

  const normalized = Math.max(0, Math.min(1, nearest / .82));
  return .5 + Math.cos(normalized * Math.PI) * .5;
};

const makeHeightField = (width, height) => {
  const field = new Float32Array(width * height);
  const unit = width / 7.1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const broad = valueNoise(x, y, unit * 1.85, 11);
      const medium = valueNoise(x + unit * .37, y - unit * .23, unit * .72, 29);
      const carved = cellularRelief(x, y, unit, 47);
      const chipped = cellularRelief(x + unit * .21, y + unit * .34, unit * .48, 83);
      const relief = .5
        + (broad - .5) * .46
        + (medium - .5) * .25
        + (carved - .5) * .4
        + (chipped - .5) * .12;
      field[y * width + x] = Math.max(0, Math.min(1, .5 + (relief - .5) * 1.28));
    }
  }

  return field;
};

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

const makeChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([typeBuffer, data])) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
};

const writePng = async (name, width, height, pixels) => {
  const rowLength = width * 4;
  const scanlines = Buffer.alloc((rowLength + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * rowLength;
    const targetOffset = y * (rowLength + 1);
    scanlines[targetOffset] = 0;
    pixels.copy(scanlines, targetOffset + 1, sourceOffset, sourceOffset + rowLength);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk('IHDR', header),
    makeChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
  await writeFile(resolve(outputDirectory, name), png);
};

const generateBump = async () => {
  const width = 384;
  const height = 576;
  const field = makeHeightField(width, height);
  const pixels = Buffer.alloc(width * height * 4);

  for (let index = 0; index < field.length; index += 1) {
    const value = Math.round(field[index] * 255);
    const pixelIndex = index * 4;
    pixels[pixelIndex] = value;
    pixels[pixelIndex + 1] = value;
    pixels[pixelIndex + 2] = value;
    pixels[pixelIndex + 3] = 255;
  }

  await writePng('rough-glass-bump.png', width, height, pixels);
};

const generateCaustic = async () => {
  const width = 512;
  const height = 192;
  const field = makeHeightField(width, height);
  const pixels = Buffer.alloc(width * height * 4);
  const sample = (x, y) => field[
    Math.max(0, Math.min(height - 1, y)) * width
      + Math.max(0, Math.min(width - 1, x))
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const u = x / width;
      const v = y / height;
      const envelope = Math.sin(Math.min(1, v * 1.18) * Math.PI)
        * Math.pow(Math.sin(Math.min(1, u) * Math.PI), .55);
      const center = sample(x, y);
      const curvature = Math.abs(
        sample(x - 2, y)
          + sample(x + 2, y)
          + sample(x, y - 2)
          + sample(x, y + 2)
          - center * 4
      );
      const bright = Math.pow(Math.min(1, curvature * 4.8), 1.65);
      const dark = Math.min(1, Math.abs(center - .5) * 1.6);
      const isBright = bright > dark * .42;
      const value = isBright ? 245 : 42;
      const alpha = envelope * (isBright ? bright * .34 : dark * .055);
      pixels[index] = value;
      pixels[index + 1] = value;
      pixels[index + 2] = Math.min(255, value + (isBright ? 8 : 0));
      pixels[index + 3] = Math.max(0, Math.min(255, alpha * 255));
    }
  }

  await writePng('rough-glass-caustic.png', width, height, pixels);
};

await mkdir(outputDirectory, { recursive: true });
await Promise.all([generateBump(), generateCaustic()]);
