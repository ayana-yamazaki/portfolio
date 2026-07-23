import * as THREE from 'three';
import roughGlassBumpUrl from '../../assets/materials/rough-glass-bump.png?url';
import roughGlassCausticUrl from '../../assets/materials/rough-glass-caustic.png?url';
import {
  lightingTuning,
  materialProfiles,
  simpleShadowProfiles,
  type MaterialKind,
} from './config';
import { makeSeaGlassOutline } from './geometry';

const staticTextureLoader = new THREE.TextureLoader();

const loadStaticTexture = (
  url: string,
  configure: (texture: THREE.Texture) => void,
) => {
  let texture!: THREE.Texture;
  const ready = new Promise<THREE.Texture>((resolve, reject) => {
    texture = staticTextureLoader.load(url, resolve, undefined, reject);
  });
  configure(texture);
  return { texture, ready };
};

export const loadRoughGlassTextures = () => {
  const bump = loadStaticTexture(roughGlassBumpUrl, (texture) => {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 2;
  });
  const caustic = loadStaticTexture(roughGlassCausticUrl, (texture) => {
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
  });

  return {
    bump: bump.texture,
    caustic: caustic.texture,
    ready: Promise.all([bump.ready, caustic.ready]).then(() => undefined),
  };
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
    if (kind === 'sea-glass') {
      const points = makeSeaGlassOutline(width, height);
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      context.moveTo(centerX + points[0].x, centerY - points[0].y);
      points.slice(1).forEach((point) => {
        context.lineTo(centerX + point.x, centerY - point.y);
      });
      context.closePath();
      return;
    }

    if (kind === 'gem') {
      const points = [
        { x: left + width * .24, y: top },
        { x: left + width * .86, y: top + height * .05 },
        { x: left + width, y: top + height * .26 },
        { x: left + width * .93, y: top + height * .9 },
        { x: left + width * .61, y: top + height },
        { x: left + width * .06, y: top + height * .92 },
        { x: left, y: top + height * .23 },
      ];
      context.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.closePath();
      return;
    }

    const radius = materialProfiles[kind].radiusPx
      * (kind === 'glass' ? 1.2 : 1);
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
    const neutralBlack = kind === 'sea-glass'
      || kind === 'rough-glass'
      || kind === 'glass';
    context.fillStyle = neutralBlack
      ? `rgba(0, 0, 0, ${opacity})`
      : `rgba(24, 28, 27, ${opacity})`;
    traceCardShape(offsetX, offsetY);
    context.fill();
    if (strokeWidth > 0) {
      context.strokeStyle = neutralBlack
        ? `rgba(0, 0, 0, ${Math.min(.72, opacity * 1.7)})`
        : `rgba(18, 22, 21, ${Math.min(.72, opacity * 1.7)})`;
      context.lineWidth = strokeWidth;
      context.stroke();
    }
    context.restore();
  };

  if (kind === 'gem') {
    drawLayer(34, .105, 54, 42);
    drawLayer(11, .175, 31, 24);
    drawLayer(1.2, .098, 11, 8, 1.2);
  } else if (
    kind === 'sea-glass'
    || kind === 'rough-glass'
    || kind === 'glass'
  ) {
    const profile = kind === 'glass'
      ? simpleShadowProfiles['rough-glass']
      : simpleShadowProfiles[kind];
    drawLayer(
      profile.layers.soft.blur,
      profile.layers.soft.opacity,
      profile.layers.soft.x,
      profile.layers.soft.y,
    );
    drawLayer(
      profile.layers.middle.blur,
      profile.layers.middle.opacity,
      profile.layers.middle.x,
      profile.layers.middle.y,
    );
    drawLayer(
      profile.layers.contact.blur,
      profile.layers.contact.opacity,
      profile.layers.contact.x,
      profile.layers.contact.y,
    );
  } else {
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
  }

  if (kind === 'glass') {
    context.save();
    context.globalCompositeOperation = 'destination-in';
    const horizontalFade = context.createLinearGradient(0, 0, source.width, 0);
    horizontalFade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    horizontalFade.addColorStop(.07, 'rgba(0, 0, 0, 1)');
    horizontalFade.addColorStop(.93, 'rgba(0, 0, 0, 1)');
    horizontalFade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = horizontalFade;
    context.fillRect(0, 0, source.width, source.height);

    const verticalFade = context.createLinearGradient(0, 0, 0, source.height);
    verticalFade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    verticalFade.addColorStop(.05, 'rgba(0, 0, 0, 1)');
    verticalFade.addColorStop(.95, 'rgba(0, 0, 0, 1)');
    verticalFade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = verticalFade;
    context.fillRect(0, 0, source.width, source.height);
    context.restore();
  }

  const texture = new THREE.CanvasTexture(source);
  if (kind === 'glass') texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

export const makeGemFloorCausticTexture = () => {
  const source = document.createElement('canvas');
  source.width = 512;
  source.height = 768;
  const context = source.getContext('2d');
  if (!context) throw new Error('Unable to create gem floor caustics');

  const traceFacet = (
    points: Array<[number, number]>,
    color: string | CanvasGradient,
    blur = 0,
  ) => {
    context.save();
    context.filter = blur > 0 ? `blur(${blur}px)` : 'none';
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(...points[0]);
    points.slice(1).forEach((point) => context.lineTo(...point));
    context.closePath();
    context.fill();
    context.restore();
  };

  const scatteredFacets: Array<{
    points: Array<[number, number]>;
    color: string;
    blur: number;
  }> = [
    { points: [[126, 438], [216, 390], [184, 476]], color: 'rgba(222, 242, 255, .34)', blur: 1 },
    { points: [[174, 350], [242, 372], [206, 414]], color: 'rgba(246, 252, 255, .28)', blur: .7 },
    { points: [[214, 404], [268, 386], [246, 456]], color: 'rgba(224, 240, 255, .38)', blur: 1.1 },
    { points: [[252, 344], [290, 372], [266, 414]], color: 'rgba(242, 250, 255, .26)', blur: .8 },
    { points: [[274, 430], [326, 394], [306, 480]], color: 'rgba(220, 242, 255, .4)', blur: .7 },
    { points: [[316, 366], [380, 390], [340, 432]], color: 'rgba(248, 252, 255, .27)', blur: 1.2 },
    { points: [[344, 446], [414, 418], [382, 492]], color: 'rgba(224, 238, 255, .34)', blur: .8 },
    { points: [[404, 384], [472, 438], [420, 454]], color: 'rgba(244, 250, 255, .25)', blur: 1 },
    { points: [[198, 494], [254, 470], [222, 544]], color: 'rgba(226, 246, 255, .32)', blur: .8 },
    { points: [[252, 510], [314, 474], [286, 558]], color: 'rgba(246, 252, 255, .28)', blur: 1.1 },
    { points: [[318, 496], [372, 474], [352, 552]], color: 'rgba(218, 240, 255, .38)', blur: .7 },
    { points: [[390, 514], [468, 488], [426, 568]], color: 'rgba(244, 248, 255, .25)', blur: 1.3 },
    { points: [[154, 570], [230, 536], [196, 610]], color: 'rgba(224, 242, 255, .3)', blur: 1 },
    { points: [[236, 582], [294, 548], [270, 626]], color: 'rgba(242, 250, 255, .28)', blur: .8 },
    { points: [[306, 590], [366, 554], [344, 636]], color: 'rgba(220, 240, 255, .35)', blur: 1 },
    { points: [[384, 602], [458, 574], [416, 652]], color: 'rgba(246, 252, 255, .24)', blur: .7 },
    { points: [[222, 650], [278, 616], [256, 680]], color: 'rgba(226, 246, 255, .3)', blur: .9 },
    { points: [[334, 660], [392, 626], [374, 688]], color: 'rgba(244, 250, 255, .25)', blur: .7 },
    { points: [[182, 416], [194, 410], [342, 558]], color: 'rgba(238, 250, 255, .3)', blur: .5 },
    { points: [[284, 402], [296, 398], [470, 586]], color: 'rgba(220, 242, 255, .28)', blur: .6 },
    { points: [[236, 522], [246, 518], [356, 690]], color: 'rgba(248, 252, 255, .24)', blur: .5 },
  ];
  scatteredFacets.forEach(({ points, color, blur }) => {
    const anchor: [number, number] = [250, 500];
    const compactPoints = points.map(([x, y]) => [
      anchor[0] + (x - anchor[0]) * .58 + 42,
      anchor[1] + (y - anchor[1]) * .58 + 12,
    ] as [number, number]);
    traceFacet(compactPoints, 'rgba(220, 240, 255, .08)', 5);
    traceFacet(compactPoints, color, blur * .72);
  });

  const texture = new THREE.CanvasTexture(source);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

export const makeGemPrismTexture = () => {
  const source = document.createElement('canvas');
  source.width = 512;
  source.height = 768;
  const context = source.getContext('2d');
  if (!context) throw new Error('Unable to create gem prism light');

  const rays = [
    { points: [[92, 191], [99, 187], [354, 666]], color: 'rgba(70, 164, 255, .94)' },
    { points: [[96, 189], [103, 187], [386, 654]], color: 'rgba(72, 255, 174, .94)' },
    { points: [[100, 188], [107, 189], [418, 638]], color: 'rgba(255, 240, 62, .96)' },
    { points: [[104, 189], [111, 192], [450, 614]], color: 'rgba(255, 118, 56, .94)' },
    { points: [[108, 191], [115, 195], [480, 586]], color: 'rgba(255, 68, 164, .92)' },
  ] satisfies Array<{
    points: Array<[number, number]>;
    color: string;
  }>;

  const trace = (
    points: Array<[number, number]>,
    color: string,
    blur: number,
  ) => {
    context.save();
    context.filter = `blur(${blur}px)`;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(...points[0]);
    points.slice(1).forEach((point) => context.lineTo(...point));
    context.closePath();
    context.fill();
    context.restore();
  };
  const interpolate = (
    from: [number, number],
    to: [number, number],
    amount: number,
  ): [number, number] => [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
  ];

  rays.forEach(({ points, color }) => {
    const [startA, startB, tip] = points;
    const origin: [number, number] = [
      (startA[0] + startB[0]) * .5,
      (startA[1] + startB[1]) * .5,
    ];
    const sharpTip = interpolate(origin, tip, .52);
    const tailStartA = interpolate(startA, tip, .34);
    const tailStartB = interpolate(startB, tip, .34);
    trace(points, color, 12);
    trace([tailStartA, tailStartB, tip], color, 7);
    trace([startA, startB, sharpTip], color, .7);
  });

  const texture = new THREE.CanvasTexture(source);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};
