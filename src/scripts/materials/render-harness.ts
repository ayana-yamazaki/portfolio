import type { WebGLRenderer } from 'three';

export type RenderDiagnostics = {
  scheduledFrames: number;
  renderedFrames: number;
  coalescedRequests: number;
  continuousFrames: number;
  lastFrameMs: number;
  maxFrameMs: number;
  drawCalls: number;
  triangles: number;
  pixelRatio: number;
  pixelCount: number;
  budgetExceeded: boolean;
};

type HarnessOptions = {
  canvas: HTMLCanvasElement;
  renderer: WebGLRenderer;
  maxPixelRatio: number;
  maxPixelCount: number;
  maxContinuousFrames: number;
  maxDrawCalls: number;
  maxTriangles: number;
};

export const createRenderHarness = ({
  canvas,
  renderer,
  maxPixelRatio,
  maxPixelCount,
  maxContinuousFrames,
  maxDrawCalls,
  maxTriangles,
}: HarnessOptions) => {
  let disposed = false;
  let frameId: number | null = null;
  const diagnostics: RenderDiagnostics = {
    scheduledFrames: 0,
    renderedFrames: 0,
    coalescedRequests: 0,
    continuousFrames: 0,
    lastFrameMs: 0,
    maxFrameMs: 0,
    drawCalls: 0,
    triangles: 0,
    pixelRatio: 1,
    pixelCount: 0,
    budgetExceeded: false,
  };
  if (import.meta.env.DEV) {
    Object.assign(canvas, { materialsPbrDiagnostics: diagnostics });
  }

  const resolvePixelRatio = (width: number, height: number, devicePixelRatio: number) => {
    const pixelBudgetRatio = Math.sqrt(maxPixelCount / Math.max(width * height, 1));
    return Math.max(0.75, Math.min(devicePixelRatio || 1, maxPixelRatio, pixelBudgetRatio));
  };

  const resize = (width: number, height: number, devicePixelRatio: number) => {
    const pixelRatio = resolvePixelRatio(width, height, devicePixelRatio);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    diagnostics.pixelRatio = pixelRatio;
    diagnostics.pixelCount = Math.round(width * height * pixelRatio * pixelRatio);
    return pixelRatio;
  };

  const schedule = (render: () => void) => {
    if (disposed) return false;
    if (frameId !== null) {
      diagnostics.coalescedRequests += 1;
      return false;
    }
    diagnostics.scheduledFrames += 1;
    frameId = requestAnimationFrame(() => {
      frameId = null;
      if (disposed) return;
      const startedAt = performance.now();
      render();
      const frameMs = performance.now() - startedAt;
      diagnostics.renderedFrames += 1;
      diagnostics.lastFrameMs = frameMs;
      diagnostics.maxFrameMs = Math.max(diagnostics.maxFrameMs, frameMs);
      diagnostics.drawCalls = renderer.info.render.calls;
      diagnostics.triangles = renderer.info.render.triangles;
      diagnostics.budgetExceeded = diagnostics.budgetExceeded
        || diagnostics.drawCalls > maxDrawCalls
        || diagnostics.triangles > maxTriangles
        || diagnostics.pixelCount > maxPixelCount;
    });
    return true;
  };

  const resetAnimationBudget = () => {
    diagnostics.continuousFrames = 0;
  };

  const allowNextAnimationFrame = () => {
    diagnostics.continuousFrames += 1;
    if (diagnostics.continuousFrames <= maxContinuousFrames) return true;
    diagnostics.budgetExceeded = true;
    return false;
  };

  const dispose = () => {
    disposed = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    delete (canvas as HTMLCanvasElement & { materialsPbrDiagnostics?: RenderDiagnostics }).materialsPbrDiagnostics;
  };

  return {
    diagnostics,
    resolvePixelRatio,
    resize,
    schedule,
    resetAnimationBudget,
    allowNextAnimationFrame,
    dispose,
  };
};

export type RenderHarness = ReturnType<typeof createRenderHarness>;
