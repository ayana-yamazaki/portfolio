export type MaterialKind = 'gem' | 'sea-glass' | 'rough-glass' | 'glass';

export const materialCardNames: Record<MaterialKind, string> = {
  gem: 'ジェム',
  'sea-glass': 'すりガラス',
  'rough-glass': 'ラフガラス',
  glass: 'ラウンドガラス',
};

/* EMBEDDED GLASS — BEGIN: restore this block to re-enable the inset glass
export type EmbeddedGlassShape =
  | 'square'
  | 'rounded-square'
  | 'circle'
  | 'diamond';

type EmbeddedGlassProfile = {
  color: string;
  shape: EmbeddedGlassShape;
  size: number;
  position: readonly [number, number];
  opacity: number;
  depth: number;
  reflection: number;
};

export const embeddedGlassProfiles: Record<
  MaterialKind,
  EmbeddedGlassProfile
> = {
  gem: {
    color: '#ed6a2c',
    shape: 'square',
    size: .6,
    position: [.5, .5],
    opacity: .82,
    depth: .09,
    reflection: 1.8,
  },
  'sea-glass': {
    color: '#ed6a2c',
    shape: 'square',
    size: .6,
    position: [.5, .5],
    opacity: .82,
    depth: .09,
    reflection: 1.8,
  },
  'rough-glass': {
    color: '#ed6a2c',
    shape: 'square',
    size: .6,
    position: [.5, .5],
    opacity: .82,
    depth: .09,
    reflection: 1.8,
  },
  glass: {
    color: '#ed6a2c',
    shape: 'square',
    size: .6,
    position: [.5, .5],
    opacity: .82,
    depth: .09,
    reflection: 1.8,
  },
};
EMBEDDED GLASS — END */

const gemThicknessPx = 350;

export const materialProfiles: Record<MaterialKind, {
  radiusPx: number;
  thicknessPx: number;
}> = {
  gem: { radiusPx: 22, thicknessPx: gemThicknessPx },
  'sea-glass': { radiusPx: 135, thicknessPx: 110 },
  'rough-glass': { radiusPx: 4, thicknessPx: gemThicknessPx },
  glass: { radiusPx: 32, thicknessPx: 68 },
};

export const sceneTuning = {
  maxPixelRatio: 1,
  maxPixelCount: 800_000,
  maxContinuousFrames: 180,
  maxDrawCalls: 20,
  maxTriangles: 50_000,
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
};

export const simpleShadowProfiles: Record<
  'sea-glass' | 'rough-glass' | 'glass',
  SimpleShadowProfile
> = {
  'sea-glass': {
    scale: [1.3, 1.18],
    offset: { xRatio: .03, yRatio: -.01 },
  },
  'rough-glass': {
    scale: [1.3, 1.18],
    offset: { xRatio: .032, yRatio: -.012 },
  },
  glass: {
    scale: [1.34, 1.18],
    offset: { xRatio: .082, yRatio: -.012 },
  },
};

export const glassContactShadowProfile = {
  scale: simpleShadowProfiles.glass.scale,
  offset: simpleShadowProfiles.glass.offset,
} as const;

export const seaGlassDesktopShadowProfile = {
  scale: [1.32, 1.17],
  offset: { xRatio: .064, yRatio: -.012 },
} as const satisfies SimpleShadowProfile;

export const roughGlassDesktopShadowProfile = {
  scale: [1.34, 1.18],
  offset: { xRatio: .074, yRatio: -.012 },
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
  refractionScale: .16,
  blurStrength: .7,
  veilStrength: .7,
  surfaceNoiseStrength: 2.5,
  spectralStrength: .42,
  glintStrength: 3,
  shadowOpacity: .66,
} as const;

export const roughGlassTuning = {
  refractionStrength: 1.85,
  glassTransmission: 1,
  glassBrightness: .84,
  glassRoughness: .4,
  glassReflection: 1.05,
  glassEdgeLight: 3,
  projectionStrength: .67,
  hammeredStrength: .8,
  waveScale: 1.22,
  waveRandomness: .68,
  waveAmplitude: .73,
  waveEdgeStrength: 1.87,
  waveRefraction: 2.5,
  waveShadow: 1.61,
  spectralStrength: .47,
  shadowOpacity: .83,
} as const;
