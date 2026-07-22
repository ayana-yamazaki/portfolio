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

export const makeStoneSurfaceMaps = () => {
  const width = 512;
  const height = 768;
  const heightSource = document.createElement('canvas');
  const roughnessSource = document.createElement('canvas');
  [heightSource, roughnessSource].forEach((source) => {
    source.width = width;
    source.height = height;
  });
  const heightContext = heightSource.getContext('2d');
  const roughnessContext = roughnessSource.getContext('2d');
  if (!heightContext || !roughnessContext) {
    throw new Error('Unable to create procedural stone surface maps');
  }

  const heightImage = heightContext.createImageData(width, height);
  const roughnessImage = roughnessContext.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const broad = Math.sin(x * 0.017 + Math.sin(y * 0.012) * 2.7) * 4.2
        + Math.cos(y * 0.014 - Math.sin(x * 0.009) * 2.1) * 3.4;
      const mineral = Math.sin(x * 0.21 + y * 0.13) * 2.8
        + Math.sin(x * 0.79 - y * 0.51) * 1.7;
      const grain = Math.sin(x * 2.31 + y * 1.47) * 2.1
        + Math.cos(x * 3.73 - y * 2.17) * 1.4;
      const heightValue = 146 + broad * 1.5 + mineral * 2.2 + grain * 3.5;
      heightImage.data[index] = heightValue;
      heightImage.data[index + 1] = heightValue;
      heightImage.data[index + 2] = heightValue;
      heightImage.data[index + 3] = 255;

      const roughnessValue = 224 + grain * 1.8 - broad * 0.5;
      roughnessImage.data[index] = roughnessValue;
      roughnessImage.data[index + 1] = roughnessValue;
      roughnessImage.data[index + 2] = roughnessValue;
      roughnessImage.data[index + 3] = 255;
    }
  }
  heightContext.putImageData(heightImage, 0, 0);
  roughnessContext.putImageData(roughnessImage, 0, 0);

  let seed = 4819;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let index = 0; index < 360; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const large = random() > 0.9;
    const radiusX = large ? 2.8 + random() * 8 : 0.45 + random() * 2.1;
    const radiusY = radiusX * (0.48 + random() * 0.9);
    const rotation = random() * Math.PI;

    const pitDepth = large ? 42 + random() * 35 : 72 + random() * 42;
    heightContext.fillStyle = `rgb(${pitDepth}, ${pitDepth}, ${pitDepth})`;
    heightContext.beginPath();
    heightContext.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
    heightContext.fill();

    roughnessContext.fillStyle = `rgb(${large ? 252 : 242}, ${large ? 252 : 242}, ${large ? 252 : 242})`;
    roughnessContext.beginPath();
    roughnessContext.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
    roughnessContext.fill();
  }

  const configure = (texture: THREE.CanvasTexture) => {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 2;
    return texture;
  };
  return {
    height: configure(new THREE.CanvasTexture(heightSource)),
    roughness: configure(new THREE.CanvasTexture(roughnessSource)),
  };
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
      const warpX = Math.sin(v * 17 + Math.sin(v * 5) * 2.3) * 0.042
        + Math.sin(v * 43 + u * 7) * 0.014;
      const warpY = Math.sin(u * 15 + Math.cos(u * 4) * 2.7) * 0.036
        + Math.cos(u * 37 - v * 8) * 0.013;
      const vertical = Math.sin((u + warpX) * 49 + Math.sin(v * 25) * 2.2);
      const horizontal = Math.sin((v + warpY) * 64 + Math.cos(u * 21) * 2.5);
      const brokenRidges = Math.sin((u * 33 + v * 10) + Math.sin(v * 51) * 3.4)
        * Math.sin((v * 39 - u * 6) + Math.cos(u * 43) * 2.6);
      const broad = Math.sin(u * 11 + v * 8) + Math.cos(v * 13 - u * 7);
      const heightValue = vertical * 0.31 + horizontal * 0.27 + brokenRidges * 0.29 + broad * 0.13;
      const value = Math.max(0, Math.min(255, 128 + heightValue * 77));
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

export const makeStoneSideTexture = () => {
  const size = 384;
  const source = document.createElement('canvas');
  source.width = size;
  source.height = size;
  const context = source.getContext('2d');
  if (!context) throw new Error('Unable to create stone side texture');

  context.fillStyle = '#a99c84';
  context.fillRect(0, 0, size, size);

  let seed = 1979;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let index = 0; index < 1050; index += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = .55 + random() * (random() > .88 ? 4.2 : 1.8);
    const depth = .13 + random() * .34;
    context.fillStyle = `rgba(28, 28, 27, ${depth})`;
    context.beginPath();
    context.ellipse(x, y, radius, radius * (.65 + random() * .65), random() * Math.PI, 0, Math.PI * 2);
    context.fill();

    if (radius > 1.25) {
      context.strokeStyle = `rgba(205, 205, 201, ${.14 + random() * .2})`;
      context.lineWidth = .45;
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.2, 1);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
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
