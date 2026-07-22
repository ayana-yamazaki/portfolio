export type MaterialKind = 'stone' | 'paper' | 'resin' | 'glass';

export const materialProfiles: Record<MaterialKind, {
  radiusPx: number;
  thicknessPx: number;
}> = {
  stone: { radiusPx: 32, thicknessPx: 12 },
  paper: { radiusPx: 20, thicknessPx: 5 },
  resin: { radiusPx: 10, thicknessPx: 12 },
  glass: { radiusPx: 4, thicknessPx: 34 },
};

export const sceneTuning = {
  maxPixelRatio: 1.25,
  exposure: 0.82,
  hemisphereIntensity: 0.58,
  keyIntensity: 2.25,
  fillIntensity: 0.38,
  baseTilt: -3.4,
  baseYaw: -1.15,
  hoverTilt: -1.2,
  hoverYaw: 0,
} as const;

export const glassTuning = {
  rimWidthPx: 30,
  refractionPx: 46,
} as const;
