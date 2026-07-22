export type MaterialKind = 'stone' | 'paper' | 'resin' | 'glass';

export const materialProfiles: Record<MaterialKind, {
  radiusPx: number;
  thicknessPx: number;
}> = {
  stone: { radiusPx: 4, thicknessPx: 35 },
  paper: { radiusPx: 4, thicknessPx: 35 },
  resin: { radiusPx: 4, thicknessPx: 35 },
  glass: { radiusPx: 4, thicknessPx: 35 },
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
  baseYaw: -15,
  baseRoll: 0,
} as const;

export const glassTuning = {
  rimWidthPx: 30,
  refractionPx: 46,
} as const;
