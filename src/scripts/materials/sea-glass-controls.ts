type NumericUniform = {
  value: number;
};

type SeaGlassControlUniforms = Record<string, NumericUniform>;

type ControlDefinition = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (value: number) => void;
  geometry?: boolean;
};

type SeaGlassControlsOptions = {
  uniforms: SeaGlassControlUniforms;
  getRadius: () => number;
  setRadius: (value: number) => void;
  onAppearanceChange: () => void;
  onGeometryChange: () => void;
};

const storageKey = 'portfolio:sea-glass-controls';

const clamp = (value: number, min: number, max: number) => (
  Math.min(max, Math.max(min, value))
);

export const createSeaGlassControls = ({
  uniforms,
  getRadius,
  setRadius,
  onAppearanceChange,
  onGeometryChange,
}: SeaGlassControlsOptions) => {
  const uniformControl = (
    key: string,
    label: string,
    min: number,
    max: number,
    step: number,
  ): ControlDefinition => ({
    key,
    label,
    min,
    max,
    step,
    get: () => uniforms[key]?.value ?? 0,
    set: (value) => {
      if (uniforms[key]) uniforms[key].value = value;
    },
  });

  const controls: ControlDefinition[] = [
    {
      key: 'radius',
      label: '形状のR',
      min: 0,
      max: 150,
      step: 1,
      get: getRadius,
      set: setRadius,
      geometry: true,
    },
    uniformControl('uRefractionScale', '屈折', 0, 2.5, .01),
    uniformControl('uBlurStrength', 'ぼかし', 0, 1.8, .01),
    uniformControl('uVeilStrength', '白い霞', 0, 1.6, .01),
    uniformControl('uSurfaceNoiseStrength', '表面粒子', 0, 2.5, .01),
    uniformControl('uSpectralStrength', '分光', 0, 1.5, .01),
    uniformControl('uGlintStrength', 'ハイライト', 0, 3, .01),
    uniformControl('uBackdropShadow', '背面影', 0, 1.5, .01),
    uniformControl('uShadowSoftBlur', '柔影ぼかし', 0, 60, 1),
    uniformControl('uShadowSoftOpacity', '柔影濃度', 0, 1.5, .01),
    uniformControl('uShadowMiddleBlur', '中影ぼかし', 0, 40, 1),
    uniformControl('uShadowMiddleOpacity', '中影濃度', 0, 1.5, .01),
    uniformControl('uShadowContactBlur', '接地ぼかし', 0, 20, 1),
    uniformControl('uShadowContactOpacity', '接地濃度', 0, 1.5, .01),
  ];
  const defaults = Object.fromEntries(controls.map(({ key, get }) => [
    key,
    get(),
  ]));

  let savedValues: Record<string, unknown> = {};
  try {
    savedValues = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
  } catch {
    savedValues = {};
  }
  let restoredGeometry = false;
  controls.forEach((control) => {
    const savedValue = savedValues[control.key];
    if (typeof savedValue !== 'number') return;
    control.set(clamp(savedValue, control.min, control.max));
    restoredGeometry ||= control.geometry === true;
  });

  const host = document.createElement('div');
  host.dataset.seaGlassControls = '';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host {
        color: #f6f7f8;
        display: block;
        font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      details {
        width: 248px;
        border: 1px solid rgb(255 255 255 / 18%);
        border-radius: 10px;
        background: rgb(15 18 24 / 88%);
        box-shadow: 0 12px 36px rgb(0 0 0 / 28%);
        backdrop-filter: blur(16px);
        overflow: hidden;
      }
      summary {
        padding: 10px 12px;
        cursor: pointer;
        font-weight: 700;
        letter-spacing: .04em;
        user-select: none;
      }
      form {
        display: grid;
        gap: 10px;
        max-height: calc(100vh - 78px);
        padding: 4px 12px 12px;
        overflow-y: auto;
      }
      label {
        display: grid;
        grid-template-columns: 72px 1fr 42px;
        align-items: center;
        gap: 8px;
      }
      input {
        width: 100%;
        accent-color: #9ed7ff;
      }
      output {
        text-align: right;
        color: #b7e2ff;
        font-variant-numeric: tabular-nums;
      }
      button {
        border: 1px solid rgb(255 255 255 / 18%);
        border-radius: 6px;
        padding: 6px 8px;
        color: inherit;
        background: rgb(255 255 255 / 8%);
        cursor: pointer;
      }
      button:hover {
        background: rgb(255 255 255 / 14%);
      }
    </style>
    <details open>
      <summary>すりガラス調整</summary>
      <form></form>
    </details>
  `;
  const form = shadow.querySelector('form');
  if (!form) return () => host.remove();

  const inputBindings = new Map<string, {
    input: HTMLInputElement;
    output: HTMLOutputElement;
  }>();
  const persist = () => {
    localStorage.setItem(storageKey, JSON.stringify(
      Object.fromEntries(controls.map(({ key, get }) => [key, get()])),
    ));
  };

  controls.forEach((control) => {
    const label = document.createElement('label');
    const name = document.createElement('span');
    const input = document.createElement('input');
    const output = document.createElement('output');
    const value = control.get();
    name.textContent = control.label;
    input.type = 'range';
    input.min = String(control.min);
    input.max = String(control.max);
    input.step = String(control.step);
    input.value = String(value);
    output.value = control.step >= 1
      ? String(Math.round(value))
      : value.toFixed(2);
    input.addEventListener('input', () => {
      const nextValue = Number(input.value);
      control.set(nextValue);
      output.value = control.step >= 1
        ? String(Math.round(nextValue))
        : nextValue.toFixed(2);
      persist();
      if (control.geometry) {
        onGeometryChange();
      } else {
        onAppearanceChange();
      }
    });
    inputBindings.set(control.key, { input, output });
    label.append(name, input, output);
    form.append(label);
  });

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.textContent = '初期値に戻す';
  resetButton.addEventListener('click', () => {
    controls.forEach((control) => {
      const value = defaults[control.key];
      if (typeof value !== 'number') return;
      control.set(value);
      const binding = inputBindings.get(control.key);
      if (!binding) return;
      binding.input.value = String(value);
      binding.output.value = control.step >= 1
        ? String(Math.round(value))
        : value.toFixed(2);
    });
    localStorage.removeItem(storageKey);
    onGeometryChange();
    onAppearanceChange();
  });
  form.append(resetButton);

  Object.assign(host.style, {
    position: 'fixed',
    top: '16px',
    right: '304px',
    zIndex: '10000',
  });
  document.body.append(host);
  if (restoredGeometry) onGeometryChange();
  onAppearanceChange();

  return () => host.remove();
};
