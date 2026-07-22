export type MaterialKind = 'stone' | 'paper' | 'resin' | 'glass';

export const materialProfiles: Record<MaterialKind, {
  radiusPx: number;
  thicknessPx: number;
}> = {
  stone: { radiusPx: 32, thicknessPx: 10 },
  paper: { radiusPx: 20, thicknessPx: 10 },
  resin: { radiusPx: 10, thicknessPx: 10 },
  glass: { radiusPx: 4, thicknessPx: 10 },
};

export const sceneTuning = {
  maxPixelRatio: 1.25,
  maxPixelCount: 1_500_000,
  maxContinuousFrames: 180,
  maxDrawCalls: 20,
  maxTriangles: 50_000,
  exposure: 0.82,
  hemisphereIntensity: 0.58,
  keyIntensity: 2.25,
  fillIntensity: 0.38,
  baseTilt: 0,
  baseYaw: -2,
  baseRoll: 0,
  hoverTilt: 0,
  hoverYaw: -1,
} as const;

export const glassTuning = {
  rimWidthPx: 30,
  refractionPx: 46,
} as const;
