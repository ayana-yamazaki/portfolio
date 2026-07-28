type NumericUniform = {
  value: number;
};

type RoughGlassMaterialUniforms = Record<string, NumericUniform>;

export type RoughGlassPresentation = {
  bodyOpacity: number;
  shadowOpacity: number;
  shadowSpread: number;
  shadowDistance: number;
  projectionSpread: number;
};

type ControlDefinition = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (value: number) => void;
  layout?: boolean;
};

type RoughGlassMaterialControlsOptions = {
  uniforms: RoughGlassMaterialUniforms;
  presentation: RoughGlassPresentation;
  onAppearanceChange: () => void;
  onLayoutChange: () => void;
};

const storageKey = 'portfolio:rough-glass-material-controls';

const clamp = (value: number, min: number, max: number) => (
  Math.min(max, Math.max(min, value))
);

export const createRoughGlassMaterialControls = ({
  uniforms,
  presentation,
  onAppearanceChange,
  onLayoutChange,
}: RoughGlassMaterialControlsOptions) => {
  const uniformControl = (
    key: string,
    label: string,
    min: number,
    max: number,
    step = .01,
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
  const presentationControl = (
    key: keyof RoughGlassPresentation,
    label: string,
    min: number,
    max: number,
    layout = false,
  ): ControlDefinition => ({
    key,
    label,
    min,
    max,
    step: .01,
    get: () => presentation[key],
    set: (value) => {
      presentation[key] = value;
    },
    layout,
  });
  const controls: ControlDefinition[] = [
    uniformControl('uGlassTransmission', '透明感', 0, 1),
    uniformControl('uGlassBrightness', '明るさ', .5, 1.5),
    uniformControl('uGlassRoughness', '粗さ', .4, 2.5),
    uniformControl('uGlassReflection', '反射', 0, 2.5),
    uniformControl('uGlassEdgeLight', 'エッジ光', 0, 3),
    presentationControl('bodyOpacity', '側面濃度', .2, 2),
    presentationControl('shadowOpacity', '影の濃さ', 0, 1.5),
    presentationControl('shadowSpread', '影の広がり', .7, 1.6, true),
    presentationControl('shadowDistance', '影の距離', 0, 2, true),
    uniformControl('uProjectionStrength', '影の中の光', 0, 3),
    presentationControl('projectionSpread', '光の広がり', .7, 1.8, true),
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
  let restoredLayout = false;
  controls.forEach((control) => {
    const savedValue = savedValues[control.key];
    if (typeof savedValue !== 'number') return;
    control.set(clamp(savedValue, control.min, control.max));
    restoredLayout ||= control.layout === true;
  });

  const host = document.createElement('div');
  host.dataset.roughGlassMaterialControls = '';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host {
        color: #f6f7f8;
        display: block;
        font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      details {
        width: 272px;
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
        gap: 9px;
        padding: 4px 12px 12px;
      }
      label {
        display: grid;
        grid-template-columns: 82px 1fr 42px;
        align-items: center;
        gap: 8px;
      }
      input {
        width: 100%;
        accent-color: #8fded5;
      }
      output {
        text-align: right;
        color: #b8f2eb;
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
      <summary>ラフガラス本体調整</summary>
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
    output.value = value.toFixed(2);
    input.addEventListener('input', () => {
      const nextValue = Number(input.value);
      control.set(nextValue);
      output.value = nextValue.toFixed(2);
      persist();
      if (control.layout) {
        onLayoutChange();
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
      binding.output.value = value.toFixed(2);
    });
    localStorage.removeItem(storageKey);
    onLayoutChange();
    onAppearanceChange();
  });
  form.append(resetButton);

  Object.assign(host.style, {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: '10000',
  });
  document.body.append(host);
  if (restoredLayout) onLayoutChange();
  onAppearanceChange();

  return () => host.remove();
};
