import * as THREE from 'three';
import { lightingTuning, type MaterialKind } from './config';

export const makeNoiseTexture = () => {
  const size = 512;
  const source = document.createElement('canvas');
  source.width = size;
  source.height = size;
  const context = source.getContext('2d');
  if (!context) throw new Error('Unable to create material texture');
  const image = context.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const fine = Math.sin(x * 0.83 + y * 1.91) * 5 + Math.sin(x * 2.7 - y * 1.13) * 3;
      const wrinkles = Math.sin(x * 0.026 + Math.sin(y * 0.018) * 3.5) * 20
        + Math.sin(y * 0.021 + Math.cos(x * 0.015) * 4) * 13;
      const value = Math.max(0, Math.min(255, 128 + fine + wrinkles));
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(source);
  texture.anisotropy = 1;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.4, 2.1);
  return texture;
};

export const makeCastGlassBumpTexture = () => {
  const width = 384;
  const height = 576;
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const context = source.getContext('2d');
  if (!context) throw new Error('Unable to create cast glass texture');
  const image = context.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const u = x / width;
      const v = y / height;
      const ribPhase = u * 18 * Math.PI * 2;
      const cylindricalRib = Math.cos(ribPhase) * 0.86
        + Math.cos(ribPhase * 2) * 0.14;
      const manufacturingVariation = Math.sin(v * Math.PI * 2 + u * 3.2) * 0.012;
      const heightValue = cylindricalRib + manufacturingVariation;
      const value = Math.max(0, Math.min(255, 128 + heightValue * 48));
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(source);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 2;
  return texture;
};

export const makePaperAlbedoTexture = () => {
  const width = 512;
  const height = 768;
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const context = source.getContext('2d');
  if (!context) throw new Error('Unable to create paper albedo texture');
  const image = context.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const broad = Math.sin(x * 0.018 + Math.sin(y * 0.012) * 2.2) * 2.8
        + Math.sin(y * 0.015 + Math.cos(x * 0.01) * 2.4) * 2.2;
      const fiber = Math.sin(x * 1.7 + y * 0.13) * 1.7 + Math.sin(y * 2.3) * 0.9;
      image.data[index] = 231 + broad + fiber;
      image.data[index + 1] = 224 + broad + fiber * 0.75;
      image.data[index + 2] = 209 + broad + fiber * 0.45;
      image.data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  context.globalAlpha = 0.13;
  context.lineWidth = 0.55;
  for (let index = 0; index < 420; index += 1) {
    const y = (index * 47) % height;
    const x = (index * 83) % width;
    const length = 8 + (index % 29);
    context.strokeStyle = index % 3 === 0 ? '#8f826e' : '#fffaf0';
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(Math.min(width, x + length), y + Math.sin(index) * 1.2);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 1;
  return texture;
};

export const makeRoundedMaskTexture = () => {
  const source = document.createElement('canvas');
  source.width = 512;
  source.height = 768;
  const context = source.getContext('2d');
  if (!context) throw new Error('Unable to create rounded mask texture');
  context.fillStyle = '#000';
  context.fillRect(0, 0, source.width, source.height);
  context.fillStyle = '#fff';
  context.beginPath();
  context.roundRect(2, 2, source.width - 4, source.height - 4, 52);
  context.fill();
  const texture = new THREE.CanvasTexture(source);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

export const makeCardShadowTexture = (kind: MaterialKind) => {
  const source = document.createElement('canvas');
  source.width = 512;
  source.height = 768;
  const context = source.getContext('2d');
  if (!context) throw new Error('Unable to create shadow texture');

  const traceCardShape = (offsetX = 0, offsetY = 0) => {
    const left = 42 + offsetX;
    const top = 44 + offsetY;
    const width = 384;
    const height = 640;
    context.beginPath();
    if (kind === 'gem' || kind === 'sea-glass') {
      const points = [
        { x: left + width * .24, y: top },
        { x: left + width * .86, y: top + height * .05 },
        { x: left + width, y: top + height * .26 },
        { x: left + width * .93, y: top + height * .9 },
        { x: left + width * .61, y: top + height },
        { x: left + width * .06, y: top + height * .92 },
        { x: left, y: top + height * .23 },
      ];
      if (kind === 'gem') {
        context.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      } else {
        const radii = [44, 36, 48, 38, 52, 37, 46];
        const entries = points.map((point, index) => {
          const previous = points[(index - 1 + points.length) % points.length];
          const distance = Math.hypot(previous.x - point.x, previous.y - point.y);
          const ratio = Math.min(.38, radii[index] / distance);
          return {
            x: point.x + (previous.x - point.x) * ratio,
            y: point.y + (previous.y - point.y) * ratio,
          };
        });
        const exits = points.map((point, index) => {
          const next = points[(index + 1) % points.length];
          const distance = Math.hypot(next.x - point.x, next.y - point.y);
          const ratio = Math.min(.38, radii[index] / distance);
          return {
            x: point.x + (next.x - point.x) * ratio,
            y: point.y + (next.y - point.y) * ratio,
          };
        });
        context.moveTo(entries[0].x, entries[0].y);
        points.forEach((point, index) => {
          context.lineTo(entries[index].x, entries[index].y);
          context.quadraticCurveTo(point.x, point.y, exits[index].x, exits[index].y);
        });
      }
      context.closePath();
      return;
    }

    const radius = kind === 'glass' ? 8 : kind === 'resin' ? 14 : 22;
    context.roundRect(left, top, width, height, radius);
  };

  const drawLayer = (
    blur: number,
    opacity: number,
    offsetX: number,
    offsetY: number,
    strokeWidth = 0,
  ) => {
    context.save();
    context.filter = `blur(${blur}px)`;
    context.fillStyle = `rgba(24, 28, 27, ${opacity})`;
    traceCardShape(offsetX, offsetY);
    context.fill();
    if (strokeWidth > 0) {
      context.strokeStyle = `rgba(18, 22, 21, ${Math.min(.72, opacity * 1.7)})`;
      context.lineWidth = strokeWidth;
      context.stroke();
    }
    context.restore();
  };

  drawLayer(
    28,
    .13,
    lightingTuning.shadowLayers.soft.x,
    lightingTuning.shadowLayers.soft.y,
  );
  drawLayer(
    9,
    .18,
    lightingTuning.shadowLayers.middle.x,
    lightingTuning.shadowLayers.middle.y,
  );
  drawLayer(
    1.2,
    .23,
    lightingTuning.shadowLayers.contact.x,
    lightingTuning.shadowLayers.contact.y,
    1.4,
  );

  if (kind === 'gem') {
    context.save();
    context.globalCompositeOperation = 'screen';
    context.filter = 'blur(8px)';
    context.fillStyle = 'rgba(232, 239, 239, .3)';
    context.beginPath();
    context.moveTo(166, 218);
    context.lineTo(356, 166);
    context.lineTo(405, 532);
    context.lineTo(238, 592);
    context.closePath();
    context.fill();
    context.filter = 'blur(1.4px)';
    context.strokeStyle = 'rgba(255, 255, 255, .52)';
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(207, 278);
    context.lineTo(348, 236);
    context.lineTo(296, 546);
    context.stroke();
    context.restore();
  }

  const texture = new THREE.CanvasTexture(source);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

export const makeCastGlassCausticTexture = () => {
  const width = 512;
  const height = 192;
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const context = source.getContext('2d');
  if (!context) throw new Error('Unable to create cast glass caustics');
  const image = context.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const u = x / width;
      const v = y / height;
      const envelope = Math.sin(Math.min(1, v * 1.18) * Math.PI)
        * Math.pow(Math.sin(Math.min(1, u) * Math.PI), 0.55);
      const warp = Math.sin(v * 13 + Math.sin(u * 9) * 2.4) * 0.16;
      const bands = Math.sin((u + warp) * 48 + Math.sin(v * 23) * 3.2)
        + Math.sin(v * 36 - u * 11) * 0.56;
      const bright = Math.pow(Math.max(0, bands * 0.5), 4);
      const dark = Math.pow(Math.max(0, -bands * 0.5), 2);
      const isBright = bright > dark * 0.78;
      const value = isBright ? 245 : 34;
      const alpha = envelope * (isBright ? bright * 0.42 : dark * 0.12);
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = Math.min(255, value + (isBright ? 8 : 0));
      image.data[index + 3] = Math.max(0, Math.min(255, alpha * 255));
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(source);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};
