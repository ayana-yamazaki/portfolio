export type MaterialKind = 'gem' | 'sea-glass' | 'rough-glass' | 'glass';

export const materialCardNames: Record<MaterialKind, string> = {
  gem: 'ジェム',
  'sea-glass': 'すりガラス',
  'rough-glass': 'ラフガラス',
  glass: 'ラウンドガラス',
};

const gemThicknessPx = 350;

export const materialProfiles: Record<MaterialKind, {
  radiusPx: number;
  thicknessPx: number;
}> = {
  gem: { radiusPx: 22, thicknessPx: gemThicknessPx },
  'sea-glass': { radiusPx: 130, thicknessPx: 110 },
  'rough-glass': { radiusPx: 4, thicknessPx: gemThicknessPx },
  glass: { radiusPx: 32, thicknessPx: 68 },
};

export const sceneTuning = {
  maxPixelRatio: 1.25,
  maxPixelCount: 1_100_000,
  maxContinuousFrames: 180,
  maxDrawCalls: 20,
  maxTriangles: 50_000,
  motionCachePaddingPx: 72,
  motionCacheSamples: 2,
  exposure: 0.82,
  baseTilt: 2,
  baseYaw: 0,
  baseRoll: 0,
} as const;

export const lightingTuning = {
  hemisphere: {
    skyColor: 0xfffcf5,
    groundColor: 0x514d48,
    intensity: 0.14,
  },
  key: {
    color: 0xfff2da,
    intensity: 4.2,
    position: [-5, 9, 6],
  },
  fill: {
    color: 0xc8dcff,
    intensity: 0.04,
    position: [6, -2, 4],
  },
  rim: {
    color: 0xe8f2ff,
    intensity: 1.2,
    position: [-6, 7, -4.5],
  },
  environment: {
    background: 0x26302d,
    keyPanel: {
      color: 0xffffff,
      position: [-2.8, 4.6, 4.2],
      size: [3.2, 5.8],
    },
    glintPanel: {
      color: 0xffffff,
      position: [-2.5, 5.2, 4],
      size: [0.18, 4.4],
      intensity: 4,
    },
    fillPanel: {
      color: 0x536461,
      position: [5, -2, 3],
      size: [3, 5],
    },
  },
  glint: {
    strength: 1.45,
  },
  shadowOffset: {
    xRatio: 0.075,
    yRatio: -0.025,
  },
  shadowLayers: {
    soft: { x: 40, y: 32 },
    middle: { x: 24, y: 19 },
    contact: { x: 12, y: 9 },
  },
  causticOffset: {
    xRatio: 0.08,
    yRatio: -0.022,
  },
} as const;

type SimpleShadowProfile = {
  scale: readonly [number, number];
  offset: {
    xRatio: number;
    yRatio: number;
  };
  layers: {
    soft: { blur: number; opacity: number; x: number; y: number };
    middle: { blur: number; opacity: number; x: number; y: number };
    contact: { blur: number; opacity: number; x: number; y: number };
  };
};

export const simpleShadowProfiles: Record<
  'sea-glass' | 'rough-glass' | 'glass',
  SimpleShadowProfile
> = {
  'sea-glass': {
    scale: [1.3, 1.18],
    offset: { xRatio: .03, yRatio: -.01 },
    layers: {
      soft: { blur: 28, opacity: .12, x: 34, y: 27 },
      middle: { blur: 9, opacity: .19, x: 19, y: 14 },
      contact: { blur: .45, opacity: .24, x: 4, y: 3 },
    },
  },
  'rough-glass': {
    scale: [1.3, 1.18],
    offset: { xRatio: .032, yRatio: -.012 },
    layers: {
      soft: { blur: 32, opacity: .14, x: 38, y: 29 },
      middle: { blur: 10, opacity: .22, x: 23, y: 17 },
      contact: { blur: .45, opacity: .28, x: 4, y: 3 },
    },
  },
  glass: {
    scale: [1.34, 1.18],
    offset: { xRatio: .082, yRatio: -.012 },
    layers: {
      soft: { blur: 32, opacity: .14, x: 54, y: 29 },
      middle: { blur: 10, opacity: .22, x: 34, y: 17 },
      contact: { blur: .45, opacity: .28, x: 8, y: 3 },
    },
  },
};

export const glassContactShadowProfile = {
  scale: simpleShadowProfiles.glass.scale,
  offset: simpleShadowProfiles.glass.offset,
} as const;

export const seaGlassDesktopShadowProfile = {
  scale: [1.32, 1.17],
  offset: { xRatio: .064, yRatio: -.012 },
  layers: {
    soft: { blur: 23, opacity: .15, x: 44, y: 27 },
    middle: { blur: 5.5, opacity: .27, x: 27, y: 14 },
    contact: { blur: .3, opacity: .38, x: 7, y: 3 },
  },
} as const satisfies SimpleShadowProfile;

export const roughGlassDesktopShadowProfile = {
  scale: [1.34, 1.18],
  offset: { xRatio: .074, yRatio: -.012 },
  layers: {
    soft: { blur: 25, opacity: .16, x: 48, y: 28 },
    middle: { blur: 6.5, opacity: .25, x: 31, y: 15 },
    contact: { blur: .35, opacity: .36, x: 8, y: 3 },
  },
} as const satisfies SimpleShadowProfile;

type BackgroundReflectionProfile = {
  strength: number;
  rayDistance: number;
};

export const backgroundReflectionTuning = {
  fallbackColor: 0xf9f3f0,
  profiles: {
    gem: { strength: .16, rayDistance: .17 },
    'sea-glass': { strength: .5, rayDistance: .23 },
    'rough-glass': { strength: .58, rayDistance: .17 },
    glass: { strength: .48, rayDistance: .13 },
  } satisfies Record<
    'gem' | 'sea-glass' | 'rough-glass' | 'glass',
    BackgroundReflectionProfile
  >,
};

export const glintProfiles = {
  gem: {
    roughness: 0.175,
    sideRoughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.01,
    envMapIntensity: 1.89,
  },
  'sea-glass': {
    strength: 0.9,
  },
  glass: {
    strength: 1.5,
  },
} as const;

export const gemTuning = {
  ior: 1.935,
  iorRed: 1.9,
  iorGreen: 1.935,
  iorBlue: 1.98,
  refractionPx: 42,
  refractionScale: 1.11,
  dispersionBoost: 6,
  reflectionExposure: .84,
  keyIntensity: 8,
  internalShadowStrength: 1.63,
  facetShadowHardness: 0,
  upperTransmissionStrength: .54,
  facetHighlightStrength: 0,
} as const;

export const glassTuning = {
  rimWidthPx: 8,
  shoulderWidthPx: 18,
  refractionPx: 54,
  ior: 1.51,
  absorptionStrength: .38,
  dispersionStrength: .07,
  tiltDeg: -5.2,
  yawDeg: -4,
} as const;

export const seaGlassTuning = {
  refractionPx: 46,
  refractionScale: .18,
  blurStrength: .53,
  veilStrength: .87,
  surfaceNoiseStrength: 1.5,
  spectralStrength: .27,
  glintStrength: 3,
} as const;

export const roughGlassTuning = {
  refractionStrength: 1.85,
  glassTransmission: 1,
  glassBrightness: .84,
  glassRoughness: .4,
  glassReflection: 1.05,
  glassEdgeLight: 3,
  projectionStrength: .67,
  hammeredStrength: .71,
  waveScale: 1.17,
  waveRandomness: .46,
  waveAmplitude: .87,
  waveEdgeStrength: 3,
  waveRefraction: 2.5,
  waveShadow: 1.35,
} as const;
