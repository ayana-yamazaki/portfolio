import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import sharp from 'sharp';

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

const renderSvgPng = async (name, svg) => {
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, palette: true })
    .toFile(resolve(outputDirectory, name));
};

const makeSeaGlassShadowShape = () => {
  const width = 384;
  const height = 640;
  const left = 42;
  const top = 44;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const points = [
    [-halfWidth * .52, -halfHeight],
    [halfWidth * .72, -halfHeight * .9],
    [halfWidth, -halfHeight * .48],
    [halfWidth * .86, halfHeight * .8],
    [halfWidth * .22, halfHeight],
    [-halfWidth * .88, halfHeight * .84],
    [-halfWidth, -halfHeight * .54],
  ];
  const radiusMultipliers = [1, .82, 1.12, .94, 1.25, .82, 1.06];
  const radius = 130 * width / 240;
  const radiusProgress = 1 - Math.exp(-radius / (Math.min(width, height) * .35));
  const entries = [];
  const exits = [];

  const distance = (from, to) => Math.hypot(
    from[0] - to[0],
    from[1] - to[1],
  );
  const moveToward = (point, target, amount) => {
    const deltaX = target[0] - point[0];
    const deltaY = target[1] - point[1];
    const length = Math.hypot(deltaX, deltaY) || 1;
    return [
      point[0] + deltaX / length * amount,
      point[1] + deltaY / length * amount,
    ];
  };
  const toCanvasPoint = ([x, y]) => [
    left + halfWidth + x,
    top + halfHeight - y,
  ];

  points.forEach((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const cornerRadius = Math.min(
      distance(point, previous),
      distance(point, next),
    ) * .49 * Math.min(radiusProgress * radiusMultipliers[index], 1);
    entries.push(moveToward(point, previous, cornerRadius));
    exits.push(moveToward(point, next, cornerRadius));
  });

  const firstEntry = toCanvasPoint(entries[0]);
  const commands = [`M${firstEntry[0]} ${firstEntry[1]}`];
  points.forEach((point, index) => {
    const entry = toCanvasPoint(entries[index]);
    const control = toCanvasPoint(point);
    const exit = toCanvasPoint(exits[index]);
    commands.push(
      `L${entry[0]} ${entry[1]}`,
      `Q${control[0]} ${control[1]} ${exit[0]} ${exit[1]}`,
    );
  });
  commands.push('Z');
  return `<path d="${commands.join(' ')}"/>`;
};

const shadowProfiles = {
  gem: {
    shape: '<polygon points="134,44 372,76 426,210 399,620 276,684 65,633 42,191"/>',
    layers: [
      { blur: 34, opacity: .105, x: 54, y: 42 },
      { blur: 34, opacity: .105, x: 54, y: 42 },
      { blur: 11, opacity: .175, x: 31, y: 24 },
      { blur: 1.2, opacity: .098, x: 11, y: 8 },
    ],
  },
  'sea-glass': {
    shape: makeSeaGlassShadowShape(),
    layers: [
      { blur: 23, opacity: .15, x: 44, y: 27 },
      { blur: 5.5, opacity: .27, x: 27, y: 14 },
      { blur: .3, opacity: .38, x: 7, y: 3 },
    ],
  },
  'rough-glass': {
    shape: '<rect x="42" y="44" width="384" height="640" rx="4"/>',
    layers: [
      { blur: 25, opacity: .16, x: 48, y: 28 },
      { blur: 6.5, opacity: .25, x: 31, y: 15 },
      { blur: .35, opacity: .36, x: 8, y: 3 },
    ],
  },
  glass: {
    shape: '<rect x="42" y="44" width="384" height="640" rx="64"/>',
    layers: [
      { blur: 32, opacity: .14, x: 54, y: 29 },
      { blur: 10, opacity: .22, x: 34, y: 17 },
      { blur: .45, opacity: .28, x: 8, y: 3 },
    ],
  },
};

const generateShadows = async () => {
  await Promise.all(Object.entries(shadowProfiles).map(([kind, profile]) => {
    const filters = profile.layers.map(({ blur }, index) => (
      `<filter id="blur-${index}" x="-35%" y="-35%" width="170%" height="170%">`
        + `<feGaussianBlur stdDeviation="${Math.max(.1, blur / 2)}"/>`
        + '</filter>'
    )).join('');
    const layers = profile.layers.map(({ opacity, x, y }, index) => (
      `<g opacity="${opacity}" transform="translate(${x} ${y})" filter="url(#blur-${index})">`
        + profile.shape
        + '</g>'
    )).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="768" viewBox="0 0 512 768">`
      + `<defs>${filters}</defs>`
      + `<g fill="#000">${layers}</g>`
      + '</svg>';
    return renderSvgPng(`shadow-${kind}.png`, svg);
  }));
};

const gemFacets = [
  [[126, 438], [216, 390], [184, 476]],
  [[174, 350], [242, 372], [206, 414]],
  [[214, 404], [268, 386], [246, 456]],
  [[252, 344], [290, 372], [266, 414]],
  [[274, 430], [326, 394], [306, 480]],
  [[316, 366], [380, 390], [340, 432]],
  [[344, 446], [414, 418], [382, 492]],
  [[404, 384], [472, 438], [420, 454]],
  [[198, 494], [254, 470], [222, 544]],
  [[252, 510], [314, 474], [286, 558]],
  [[318, 496], [372, 474], [352, 552]],
  [[390, 514], [468, 488], [426, 568]],
  [[154, 570], [230, 536], [196, 610]],
  [[236, 582], [294, 548], [270, 626]],
  [[306, 590], [366, 554], [344, 636]],
  [[384, 602], [458, 574], [416, 652]],
  [[222, 650], [278, 616], [256, 680]],
  [[334, 660], [392, 626], [374, 688]],
  [[182, 416], [194, 410], [342, 558]],
  [[284, 402], [296, 398], [470, 586]],
  [[236, 522], [246, 518], [356, 690]],
];

const generateGemCaustic = async () => {
  const colors = [
    '#def2ff', '#f6fcff', '#e0f0ff', '#f2faff', '#dcf2ff', '#f8fcff',
    '#e0eeff', '#f4faff', '#e2f6ff', '#f6fcff', '#daf0ff', '#f4f8ff',
    '#e0f2ff', '#f2faff', '#dcf0ff', '#f6fcff', '#e2f6ff', '#f4faff',
    '#eefaff', '#dcf2ff', '#f8fcff',
  ];
  const polygons = gemFacets.map((points, index) => {
    const compact = points.map(([x, y]) => [
      250 + (x - 250) * .58 + 42,
      500 + (y - 500) * .58 + 12,
    ].join(',')).join(' ');
    return `<polygon points="${compact}" fill="${colors[index]}" fill-opacity=".32"/>`;
  }).join('');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="768">'
    + '<defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5"/></filter></defs>'
    + `<g fill="#dcf0ff" fill-opacity=".08" filter="url(#glow)">${polygons}</g>`
    + `<g>${polygons}</g></svg>`;
  await renderSvgPng('gem-floor-caustic.png', svg);
};

const prismRays = [
  { points: [[92, 191], [99, 187], [354, 666]], color: '#46a4ff' },
  { points: [[96, 189], [103, 187], [386, 654]], color: '#48ffae' },
  { points: [[100, 188], [107, 189], [418, 638]], color: '#fff03e' },
  { points: [[104, 189], [111, 192], [450, 614]], color: '#ff7638' },
  { points: [[108, 191], [115, 195], [480, 586]], color: '#ff44a4' },
];

const makePrismRayMarkup = () => prismRays.map(({ points, color }) => {
  const [startA, startB, tip] = points;
  const origin = [
    (startA[0] + startB[0]) * .5,
    (startA[1] + startB[1]) * .5,
  ];
  const interpolate = (from, to, amount) => [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
  ];
  const sharpTip = interpolate(origin, tip, .52);
  const tailStartA = interpolate(startA, tip, .34);
  const tailStartB = interpolate(startB, tip, .34);
  const polygon = (vertices, filter, opacity) => (
    `<polygon points="${vertices.map((point) => point.join(',')).join(' ')}" fill="${color}" opacity="${opacity}" filter="url(#${filter})"/>`
  );
  return polygon(points, 'wide', .94)
    + polygon([tailStartA, tailStartB, tip], 'middle', .94)
    + polygon([startA, startB, sharpTip], 'sharp', .94);
}).join('');

const prismFilters = '<defs>'
  + '<filter id="wide" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>'
  + '<filter id="middle" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>'
  + '<filter id="sharp" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".35"/></filter>'
  + '<filter id="sea-wide" x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation="11"/></filter>'
  + '<filter id="sea-middle" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>'
  + '<filter id="sea-mobile-wide" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="15"/></filter>'
  + '<filter id="sea-mobile-middle" x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation="7"/></filter>'
  + '</defs>';

const generatePrisms = async () => {
  const rays = makePrismRayMarkup();
  const gemSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="768">${prismFilters}${rays}</svg>`;
  const desktopSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="768">${prismFilters}`
    + `<g opacity=".9" transform="translate(-18 -22) scale(1.07 1.057)" filter="url(#sea-wide)">${rays}</g>`
    + `<g opacity=".55" transform="translate(-10 -14) scale(1.039 1.036)" filter="url(#sea-middle)">${rays}</g>`
    + `<g opacity=".3" transform="translate(-4 -6) scale(1.016 1.016)">${rays}</g></svg>`;
  const mobileSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="768">${prismFilters}`
    + `<g opacity=".62" transform="translate(-24 -28) scale(1.094 1.073)" filter="url(#sea-mobile-wide)">${rays}</g>`
    + `<g opacity=".28" transform="translate(-10 -14) scale(1.039 1.036)" filter="url(#sea-mobile-middle)">${rays}</g></svg>`;
  await Promise.all([
    renderSvgPng('gem-prism.png', gemSvg),
    renderSvgPng('sea-glass-prism-desktop.png', desktopSvg),
    renderSvgPng('sea-glass-prism-mobile.png', mobileSvg),
  ]);
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
await Promise.all([
  generateBump(),
  generateCaustic(),
  generateShadows(),
  generateGemCaustic(),
  generatePrisms(),
]);
