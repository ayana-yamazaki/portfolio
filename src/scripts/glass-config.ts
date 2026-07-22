export const glassDebugModes = {
  final: 0,
  source: 1,
  blur: 2,
  rim: 3,
  scatter: 4,
} as const;

export const defaultGlassConfig = {
  blurStep: 18,
  rimWidth: 30,
  rimDisplacement: 50,
  scatterStrength: 3.2,
  frostAmount: 0.8,
  veilOpacity: 0.16,
  cornerRadius: 38,
  lightX: -0.68,
  lightY: 0.74,
  baseTilt: -7,
  baseYaw: -2.2,
  hoverTilt: -3,
  hoverYaw: 0.2,
  debugMode: 'final' as keyof typeof glassDebugModes,
};

const readNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const readGlassConfig = (canvas: HTMLCanvasElement) => {
  const requestedDebugMode = canvas.dataset.debugMode as keyof typeof glassDebugModes | undefined;
  const debugMode = requestedDebugMode && requestedDebugMode in glassDebugModes
    ? requestedDebugMode
    : defaultGlassConfig.debugMode;

  return {
    blurStep: readNumber(canvas.dataset.blurStep, defaultGlassConfig.blurStep),
    rimWidth: readNumber(canvas.dataset.rimWidth, defaultGlassConfig.rimWidth),
    rimDisplacement: readNumber(canvas.dataset.rimDisplacement, defaultGlassConfig.rimDisplacement),
    scatterStrength: readNumber(canvas.dataset.scatterStrength, defaultGlassConfig.scatterStrength),
    frostAmount: readNumber(canvas.dataset.frostAmount, defaultGlassConfig.frostAmount),
    veilOpacity: readNumber(canvas.dataset.veilOpacity, defaultGlassConfig.veilOpacity),
    cornerRadius: readNumber(canvas.dataset.cornerRadius, defaultGlassConfig.cornerRadius),
    lightX: readNumber(canvas.dataset.lightX, defaultGlassConfig.lightX),
    lightY: readNumber(canvas.dataset.lightY, defaultGlassConfig.lightY),
    baseTilt: readNumber(canvas.dataset.baseTilt, defaultGlassConfig.baseTilt),
    baseYaw: readNumber(canvas.dataset.baseYaw, defaultGlassConfig.baseYaw),
    hoverTilt: readNumber(canvas.dataset.hoverTilt, defaultGlassConfig.hoverTilt),
    hoverYaw: readNumber(canvas.dataset.hoverYaw, defaultGlassConfig.hoverYaw),
    debugMode,
  };
};
