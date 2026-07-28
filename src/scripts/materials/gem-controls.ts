type NumericUniform = {
  value: number;
};

type GemControlUniforms = Record<string, NumericUniform>;

type ControlDefinition = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (value: number) => void;
};

const storageKey = 'portfolio:gem-controls';

const clamp = (value: number, min: number, max: number) => (
  Math.min(max, Math.max(min, value))
);

export const createGemControls = (
  uniforms: GemControlUniforms,
  onChange: () => void,
) => {
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
  const redIorOffset=uniforms.uIorRed.value-uniforms.uIorGreen.value;
  const blueIorOffset=uniforms.uIorBlue.value-uniforms.uIorGreen.value;
  const controls: ControlDefinition[] = [
    uniformControl('uRefractionScale', '屈折', 0, 2.5, .01),
    {
      key: 'ior',
      label: 'IOR',
      min: 1,
      max: 2.2,
      step: .005,
      get: () => uniforms.uIor.value,
      set: (value) => {
        uniforms.uIor.value=value;
        uniforms.uIorGreen.value=value;
        uniforms.uIorRed.value=value+redIorOffset;
        uniforms.uIorBlue.value=value+blueIorOffset;
      },
    },
    uniformControl('uDispersionBoost', '色分散', 0, 6, .01),
    uniformControl('uRoughness', '粗さ', .005, .25, .005),
    uniformControl('uEnvironmentIntensity', '環境反射', 0, 3, .01),
    uniformControl('uReflectionExposure', '反射露出', .2, 2, .01),
    uniformControl(
      'uBackgroundReflectionStrength',
      '背景反射',
      0,
      1.5,
      .01,
    ),
    uniformControl('uKeyIntensity', 'ハイライト', 0, 8, .01),
    uniformControl('uInternalShadowStrength', '内部影', 0, 3, .01),
    uniformControl('uFacetShadowHardness', '影の硬さ', 0, 2, .01),
    uniformControl('uUpperTransmissionStrength', '上面透過', 0, 2, .01),
    uniformControl('uFacetHighlightStrength', '面ハイライト', 0, 2, .01),
  ];
  const defaults=Object.fromEntries(controls.map(({key,get})=>[key,get()]));

  let savedValues: Record<string,unknown>={};
  try {
    savedValues=JSON.parse(localStorage.getItem(storageKey)??'{}');
  } catch {
    savedValues={};
  }
  controls.forEach((control)=>{
    const savedValue=savedValues[control.key];
    if(typeof savedValue!=='number') return;
    control.set(clamp(savedValue,control.min,control.max));
  });

  const host=document.createElement('div');
  host.dataset.gemControls='';
  const shadow=host.attachShadow({mode:'open'});
  shadow.innerHTML=`
    <style>
      :host {
        color: #f6f7f8;
        display: block;
        font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      details {
        width: 258px;
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
        padding: 4px 12px 12px;
      }
      label {
        display: grid;
        grid-template-columns: 76px 1fr 44px;
        align-items: center;
        gap: 8px;
      }
      input {
        width: 100%;
        accent-color: #bca8ff;
      }
      output {
        text-align: right;
        color: #d8ceff;
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
      <summary>ジェム調整</summary>
      <form></form>
    </details>
  `;
  const form=shadow.querySelector('form');
  if(!form) return ()=>host.remove();

  const inputBindings=new Map<string,{
    input: HTMLInputElement;
    output: HTMLOutputElement;
  }>();
  const persist=()=>{
    localStorage.setItem(storageKey,JSON.stringify(
      Object.fromEntries(controls.map(({key,get})=>[key,get()])),
    ));
  };

  controls.forEach((control)=>{
    const label=document.createElement('label');
    const name=document.createElement('span');
    const input=document.createElement('input');
    const output=document.createElement('output');
    const value=control.get();
    name.textContent=control.label;
    input.type='range';
    input.min=String(control.min);
    input.max=String(control.max);
    input.step=String(control.step);
    input.value=String(value);
    output.value=value.toFixed(control.step<.01?3:2);
    input.addEventListener('input',()=>{
      const nextValue=Number(input.value);
      control.set(nextValue);
      output.value=nextValue.toFixed(control.step<.01?3:2);
      persist();
      onChange();
    });
    inputBindings.set(control.key,{input,output});
    label.append(name,input,output);
    form.append(label);
  });

  const resetButton=document.createElement('button');
  resetButton.type='button';
  resetButton.textContent='初期値に戻す';
  resetButton.addEventListener('click',()=>{
    controls.forEach((control)=>{
      const value=defaults[control.key];
      if(typeof value!=='number') return;
      control.set(value);
      const binding=inputBindings.get(control.key);
      if(!binding) return;
      binding.input.value=String(value);
      binding.output.value=value.toFixed(control.step<.01?3:2);
    });
    localStorage.removeItem(storageKey);
    onChange();
  });
  form.append(resetButton);

  Object.assign(host.style,{
    position:'fixed',
    top:'16px',
    right:'304px',
    zIndex:'10000',
  });
  document.body.append(host);
  onChange();

  return ()=>host.remove();
};
