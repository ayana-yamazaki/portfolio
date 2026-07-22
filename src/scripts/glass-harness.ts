import { defaultGlassConfig } from './glass-config';

type GlassStatus = {
  textureReady: boolean;
  coverage: number;
  canvasWidth: number;
  canvasHeight: number;
  backdropWidth: number;
  backdropHeight: number;
};

const root = document.querySelector<HTMLElement>('[data-glass-harness-root]');
const canvas = root?.querySelector<HTMLCanvasElement>('[data-glass-harness]');
const card = root?.querySelector<HTMLElement>('[data-glass-card]');

if (root && canvas && card) {
  const controls = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-glass-control]'),
  );

  const applyControl = (control: HTMLInputElement | HTMLSelectElement) => {
    const parameter = control.dataset.glassControl;
    if (!parameter) return;

    const output = root.querySelector<HTMLOutputElement>(`[data-glass-value="${parameter}"]`);
    if (output) output.value = control.value;

    if (parameter === 'thickness') {
      card.style.setProperty('--card-thickness', `${control.value}px`);
      return;
    }

    canvas.dataset[parameter] = control.value;
  };

  const applyAllControls = () => controls.forEach(applyControl);
  const readiness = root.querySelector<HTMLElement>('[data-glass-readiness]');
  const warning = root.querySelector<HTMLElement>('[data-glass-warning]');
  const syncRendererState = () => {
    const state = canvas.dataset.rendererState ?? 'initializing';
    if (readiness) readiness.textContent = state;
    const coverage = root.querySelector<HTMLElement>('[data-glass-coverage]');
    if (coverage && canvas.dataset.coverage) {
      coverage.textContent = `${(Number(canvas.dataset.coverage) * 100).toFixed(1)}%`;
    }
    if (state === 'error' && warning) {
      warning.hidden = false;
      warning.textContent = `WebGL renderer error: ${canvas.dataset.rendererError ?? 'unknown'}`;
    }
  };

  controls.forEach((control) => control.addEventListener('input', () => applyControl(control)));
  root.querySelector<HTMLFormElement>('[data-glass-controls]')?.addEventListener('reset', () => {
    requestAnimationFrame(applyAllControls);
  });

  root.addEventListener('glass:status', (event) => {
    const status = (event as CustomEvent<GlassStatus>).detail;
    const coverage = root.querySelector<HTMLElement>('[data-glass-coverage]');

    if (coverage) coverage.textContent = `${(status.coverage * 100).toFixed(1)}%`;
    if (readiness) readiness.textContent = status.textureReady ? 'ready' : 'loading';
    if (warning) {
      const isCovered = status.coverage >= 0.999;
      warning.hidden = isCovered;
      warning.textContent = isCovered
        ? ''
        : '背景がCanvas全体を覆っていません。不透明化や色抜けの原因になります。';
    }
  });

  canvas.dataset.blurStep ??= String(defaultGlassConfig.blurStep);
  canvas.dataset.rimWidth ??= String(defaultGlassConfig.rimWidth);
  canvas.dataset.rimDisplacement ??= String(defaultGlassConfig.rimDisplacement);
  canvas.dataset.scatterStrength ??= String(defaultGlassConfig.scatterStrength);
  canvas.dataset.frostAmount ??= String(defaultGlassConfig.frostAmount);
  canvas.dataset.veilOpacity ??= String(defaultGlassConfig.veilOpacity);
  canvas.dataset.cornerRadius ??= String(defaultGlassConfig.cornerRadius);
  canvas.dataset.lightX ??= String(defaultGlassConfig.lightX);
  canvas.dataset.lightY ??= String(defaultGlassConfig.lightY);
  canvas.dataset.baseTilt ??= String(defaultGlassConfig.baseTilt);
  canvas.dataset.baseYaw ??= String(defaultGlassConfig.baseYaw);
  canvas.dataset.hoverTilt ??= String(defaultGlassConfig.hoverTilt);
  canvas.dataset.hoverYaw ??= String(defaultGlassConfig.hoverYaw);
  canvas.dataset.debugMode ??= defaultGlassConfig.debugMode;
  new MutationObserver(syncRendererState).observe(canvas, {
    attributes: true,
    attributeFilter: ['data-renderer-state', 'data-renderer-error'],
  });
  applyAllControls();
  syncRendererState();
}
