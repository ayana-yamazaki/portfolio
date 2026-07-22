import * as THREE from 'three';

export const makeNoiseTexture = (kind: 'paper' | 'stone') => {
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
      const wrinkles = kind === 'paper'
        ? Math.sin(x * 0.026 + Math.sin(y * 0.018) * 3.5) * 20
          + Math.sin(y * 0.021 + Math.cos(x * 0.015) * 4) * 13
        : 0;
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
  texture.repeat.set(kind === 'paper' ? 1.4 : 2.4, kind === 'paper' ? 2.1 : 3.6);
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

export const makeShadowTexture = () => {
  const source = document.createElement('canvas');
  source.width = 512;
  source.height = 192;
  const context = source.getContext('2d');
  if (!context) throw new Error('Unable to create shadow texture');

  const drawDirectionalLayer = (
    blur: number,
    opacity: number,
    farY: number,
    farLeft: number,
    farRight: number,
  ) => {
    context.save();
    context.filter = `blur(${blur}px)`;
    context.fillStyle = `rgba(31, 29, 27, ${opacity})`;
    context.beginPath();
    context.moveTo(116, 24);
    context.lineTo(474, 24);
    context.bezierCurveTo(448, 58, farRight + 42, farY - 24, farRight, farY);
    context.lineTo(farLeft, farY);
    context.bezierCurveTo(farLeft + 34, farY - 32, 92, 60, 116, 24);
    context.closePath();
    context.fill();
    context.restore();
  };

  drawDirectionalLayer(22, 0.11, 174, 10, 308);
  drawDirectionalLayer(11, 0.13, 132, 34, 350);
  drawDirectionalLayer(5, 0.15, 82, 72, 410);

  context.save();
  context.filter = 'blur(1.5px)';
  const contact = context.createLinearGradient(0, 18, 0, 48);
  contact.addColorStop(0, 'rgba(22, 21, 20, .58)');
  contact.addColorStop(0.28, 'rgba(28, 26, 24, .4)');
  contact.addColorStop(1, 'rgba(35, 32, 29, 0)');
  context.fillStyle = contact;
  context.beginPath();
  context.roundRect(112, 18, 362, 28, 8);
  context.fill();
  context.restore();

  const texture = new THREE.CanvasTexture(source);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};
