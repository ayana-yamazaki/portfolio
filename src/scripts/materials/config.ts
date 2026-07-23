export type MaterialKind = 'gem' | 'paper' | 'sea-glass' | 'rough-glass' | 'glass';

const gemThicknessPx = 350;

export const materialProfiles: Record<MaterialKind, {
  radiusPx: number;
  thicknessPx: number;
}> = {
  gem: { radiusPx: 22, thicknessPx: gemThicknessPx },
  paper: { radiusPx: 4, thicknessPx: 350 },
  'sea-glass': { radiusPx: 8, thicknessPx: 110 },
  'rough-glass': { radiusPx: 4, thicknessPx: gemThicknessPx },
  glass: { radiusPx: 46, thicknessPx: 34 },
};

export const sceneTuning = {
  maxPixelRatio: 1.25,
  maxPixelCount: 1_500_000,
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

export const glintProfiles = {
  gem: {
    roughness: 0.025,
    sideRoughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.01,
    envMapIntensity: 1.5,
  },
  'sea-glass': {
    strength: 0.9,
  },
  glass: {
    strength: 1.9,
    edgeWidthPx: 9,
    faceBandWidth: 0.075,
    cornerBoost: 1.2,
  },
} as const;

export const gemTuning = {
  ior: 1.485,
  iorRed: 1.45,
  iorGreen: 1.485,
  iorBlue: 1.53,
  refractionPx: 42,
  dispersionBoost: 3.1,
} as const;

export const glassTuning = {
  rimWidthPx: 24,
  refractionPx: 48,
} as const;

export const seaGlassTuning = {
  refractionPx: 46,
} as const;

export const roughGlassTuning = {
  refractionStrength: 1.85,
} as const;
