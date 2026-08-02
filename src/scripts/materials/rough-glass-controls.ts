type NumericUniform = {
  value: number;
};

type RoughGlassControlUniforms = Record<string, NumericUniform>;

type ControlDefinition = {
  label: string;
  uniform: string;
  min: number;
  max: number;
  step: number;
};

const storageKey = 'portfolio:rough-glass-controls';

const controls: ControlDefinition[] = [
  {
    label: '波の密度',
    uniform: 'uWaveScale',
    min: .55,
    max: 1.8,
    step: .01,
  },
  {
    label: 'ランダムさ',
    uniform: 'uWaveRandomness',
    min: 0,
    max: 2.4,
    step: .01,
  },
  {
    label: '波の深さ',
    uniform: 'uWaveAmplitude',
    min: .35,
    max: 2.4,
    step: .01,
  },
  {
    label: '面の傾き',
    uniform: 'uHammeredStrength',
    min: .3,
    max: 1.8,
    step: .01,
  },
  {
    label: 'エッジ反射',
    uniform: 'uWaveEdgeStrength',
    min: 0,
    max: 3,
    step: .01,
  },
  {
    label: '屈折',
    uniform: 'uWaveRefraction',
    min: 0,
    max: 2.5,
    step: .01,
  },
  {
    label: '影',
    uniform: 'uWaveShadow',
    min: 0,
    max: 2.5,
    step: .01,
  },
  {
    label: '分光',
    uniform: 'uSpectralStrength',
    min: 0,
    max: 1.5,
    step: .01,
  },
];

const clamp = (value: number, min: number, max: number) => (
  Math.min(max, Math.max(min, value))
);

export const createRoughGlassControls = (
  uniforms: RoughGlassControlUniforms,
  onChange: () => void,
) => {
  const defaults = Object.fromEntries(controls.map(({ uniform }) => [
    uniform,
    uniforms[uniform]?.value,
  ]));
  let savedValues: Record<string, unknown> = {};
  try {
    savedValues = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
  } catch {
    savedValues = {};
  }

  controls.forEach(({ uniform, min, max }) => {
    const savedValue = savedValues[uniform];
    if (typeof savedValue !== 'number' || !uniforms[uniform]) return;
    uniforms[uniform].value = clamp(savedValue, min, max);
  });

  const host = document.createElement('div');
  host.dataset.roughGlassControls = '';
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
        grid-template-columns: 72px 1fr 38px;
        align-items: center;
        gap: 8px;
      }
      input {
        width: 100%;
        accent-color: #8bc9ff;
      }
      output {
        text-align: right;
        color: #a9d8ff;
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
      <summary>ラフガラス調整</summary>
      <form></form>
    </details>
  `;
  const form = shadow.querySelector('form');
  if (!form) return () => host.remove();

  const persist = () => {
    const values = Object.fromEntries(controls.map(({ uniform }) => [
      uniform,
      uniforms[uniform]?.value,
    ]));
    localStorage.setItem(storageKey, JSON.stringify(values));
  };

  const inputBindings = new Map<string, {
    input: HTMLInputElement;
    output: HTMLOutputElement;
  }>();

  controls.forEach((definition) => {
    const uniform = uniforms[definition.uniform];
    if (!uniform) return;
    const label = document.createElement('label');
    const name = document.createElement('span');
    const input = document.createElement('input');
    const output = document.createElement('output');
    name.textContent = definition.label;
    input.type = 'range';
    input.min = String(definition.min);
    input.max = String(definition.max);
    input.step = String(definition.step);
    input.value = String(uniform.value);
    output.value = uniform.value.toFixed(2);
    input.addEventListener('input', () => {
      uniform.value = Number(input.value);
      output.value = uniform.value.toFixed(2);
      persist();
      onChange();
    });
    inputBindings.set(definition.uniform, { input, output });
    label.append(name, input, output);
    form.append(label);
  });

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.textContent = '初期値に戻す';
  resetButton.addEventListener('click', () => {
    controls.forEach(({ uniform }) => {
      const value = defaults[uniform];
      if (typeof value === 'number' && uniforms[uniform]) {
        uniforms[uniform].value = value;
        const binding = inputBindings.get(uniform);
        if (binding) {
          binding.input.value = String(value);
          binding.output.value = value.toFixed(2);
        }
      }
    });
    localStorage.removeItem(storageKey);
    onChange();
  });
  form.append(resetButton);

  Object.assign(host.style, {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: '10000',
  });
  document.body.append(host);
  onChange();

  return () => host.remove();
};
