import * as THREE from 'three';
import {
  lightingTuning,
  materialProfiles,
  sceneTuning,
  simpleShadowProfiles,
  type MaterialKind,
} from './materials/config';
import {
  createBodyMaterials,
  createGemFaceMaterial,
  createGlassMaterial,
  createSeaGlassMaterial,
  createPaperFaceMaterial,
  createRoughGlassFaceMaterial,
  createSideMaterials,
} from './materials/factories';
import {
  makeGemGeometry,
  makeGlassPanelGeometry,
  makePanelGeometry,
  makeRoundedFaceGeometry,
  makeSeaGlassGeometry,
} from './materials/geometry';
import { createRenderHarness, type RenderHarness } from './materials/render-harness';
import {
  makeRoughGlassBumpTexture,
  makeRoughGlassCausticTexture,
  makeGemFloorCausticTexture,
  makeGemPrismTexture,
  makeNoiseTexture,
  makePaperAlbedoTexture,
  makeRoundedMaskTexture,
  makeCardShadowTexture,
} from './materials/textures';

type ManagedCanvas = HTMLCanvasElement & {
  materialsPbrCleanup?: () => void;
};

type CardState = {
  element: HTMLElement;
  kind: MaterialKind;
  group: THREE.Group;
  mesh: THREE.Mesh;
  surface?: THREE.Mesh;
  topSurface?: THREE.Mesh;
  bottomSurface?: THREE.Mesh;
  shadow: THREE.Mesh;
  caustic?: THREE.Mesh;
  prism?: THREE.Mesh;
  baseGroupY: number;
  baseShadowY: number;
  baseCausticY: number;
  basePrismY: number;
  liftPx: number;
  liftFromPx: number;
  liftToPx: number;
  liftStartedAt: number;
  hovered: boolean;
  keyboardFocused: boolean;
};

const canvas = document.querySelector<ManagedCanvas>('[data-materials-pbr]');
const cases = canvas?.closest<HTMLElement>('.home-hero__cases');
const hero = cases?.closest<HTMLElement>('.home-hero');

if (canvas && cases && hero) {
  canvas.materialsPbrCleanup?.();
  canvas.hidden = false;
  canvas.dataset.rendererState = 'initializing';
  delete canvas.dataset.rendererError;

  let disposed = false;
  let renderer: THREE.WebGLRenderer | undefined;
  let renderHarness: RenderHarness | undefined;
  let scene: THREE.Scene | undefined;
  let environmentTarget: THREE.WebGLRenderTarget | undefined;
  let gemEnvironmentTarget: THREE.WebGLCubeRenderTarget | undefined;
  let intersectionObserver: IntersectionObserver | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let mutationObserver: MutationObserver | undefined;
  const eventController = new AbortController();
  const trackedTextures = new Set<THREE.Texture>();
  const cardStates: CardState[] = [];

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    renderHarness?.dispose();
    eventController.abort();
    intersectionObserver?.disconnect();
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
      meshMaterials.forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    trackedTextures.forEach((texture) => texture.dispose());
    if (scene) {
      scene.environment = null;
      scene.clear();
    }
    environmentTarget?.dispose();
    gemEnvironmentTarget?.dispose();
    renderer?.renderLists.dispose();
    renderer?.dispose();
    cases.classList.remove('is-materials-pbr-ready');
    hero.style.removeProperty('--stage-floor-y');
    canvas.dataset.rendererState = 'stopped';
    if (canvas.materialsPbrCleanup === cleanup) delete canvas.materialsPbrCleanup;
  };

  canvas.materialsPbrCleanup = cleanup;

  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = sceneTuning.exposure;
    renderer.setClearColor(0x000000, 0);
    renderHarness = createRenderHarness({
      canvas,
      renderer,
      maxPixelRatio: sceneTuning.maxPixelRatio,
      maxPixelCount: sceneTuning.maxPixelCount,
      maxContinuousFrames: sceneTuning.maxContinuousFrames,
      maxDrawCalls: sceneTuning.maxDrawCalls,
      maxTriangles: sceneTuning.maxTriangles,
    });

    scene = new THREE.Scene();
    const cameraFov = 2.5;
    const cameraDistance = 1 / Math.tan(THREE.MathUtils.degToRad(cameraFov / 2));
    const camera = new THREE.PerspectiveCamera(cameraFov, 1, 0.1, 100);
    camera.position.set(0, 0, cameraDistance);

    const environmentScene = new THREE.Scene();
    environmentScene.background = new THREE.Color(lightingTuning.environment.background);
    const addEnvironmentPanel = (panel: {
      color: number;
      position: readonly [number, number, number];
      size: readonly [number, number];
      intensity?: number;
    }) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(...panel.size),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(panel.color).multiplyScalar(panel.intensity ?? 1),
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      mesh.position.set(...panel.position);
      mesh.lookAt(0, 0, 0);
      environmentScene.add(mesh);
      return mesh;
    };
    addEnvironmentPanel(lightingTuning.environment.keyPanel);
    addEnvironmentPanel(lightingTuning.environment.glintPanel);
    addEnvironmentPanel(lightingTuning.environment.fillPanel);

    const pmrem = new THREE.PMREMGenerator(renderer);
    environmentTarget = pmrem.fromScene(environmentScene, 0.008);
    scene.environment = environmentTarget.texture;
    pmrem.dispose();

    addEnvironmentPanel({
      color: 0x020304,
      position: [5.5, 1, 6.5],
      size: [2.2, 4.8],
    });
    addEnvironmentPanel({
      color: 0x010101,
      position: [0, -5.5, 4],
      size: [6, 1.8],
    });
    addEnvironmentPanel({
      color: 0xffffff,
      position: [-3.8, 4.8, 6],
      size: [6, 7],
      intensity: 1.8,
    });
    gemEnvironmentTarget = new THREE.WebGLCubeRenderTarget(128, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    gemEnvironmentTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
    const gemEnvironmentCamera = new THREE.CubeCamera(0.1, 50, gemEnvironmentTarget);
    gemEnvironmentCamera.update(renderer, environmentScene);
    environmentScene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });

    scene.add(new THREE.HemisphereLight(
      lightingTuning.hemisphere.skyColor,
      lightingTuning.hemisphere.groundColor,
      lightingTuning.hemisphere.intensity,
    ));
    const keyLight = new THREE.DirectionalLight(
      lightingTuning.key.color,
      lightingTuning.key.intensity,
    );
    keyLight.position.set(...lightingTuning.key.position);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(
      lightingTuning.fill.color,
      lightingTuning.fill.intensity,
    );
    fillLight.position.set(...lightingTuning.fill.position);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(
      lightingTuning.rim.color,
      lightingTuning.rim.intensity,
    );
    rimLight.position.set(...lightingTuning.rim.position);
    scene.add(rimLight);

    let textureReady = false;
    let isVisible = true;
    let layoutDirty = true;
    let lastWidth = 0;
    let lastHeight = 0;
    let lastPixelRatio = 0;
    let lastSignature = '';
    let lastDomSignature = '';
    let lastBackdropSignature = '';
    let lastFloorY = 0;
    let renderFrame = () => {};

    const invalidate = () => {
      if (disposed || !textureReady || !isVisible) return;
      renderHarness?.schedule(() => renderFrame());
    };

    const markLayoutDirty = () => {
      layoutDirty = true;
      invalidate();
    };

    const markTextureReady = () => {
      if (disposed || textureReady) return;
      textureReady = true;
      canvas.dataset.rendererState = 'ready';
      cases.classList.add('is-materials-pbr-ready');
      markLayoutDirty();
    };

    const paperBump = makeNoiseTexture();
    const roughGlassBump = makeRoughGlassBumpTexture();
    const roughGlassCaustic = makeRoughGlassCausticTexture();
    const gemFloorCaustic = makeGemFloorCausticTexture();
    const gemPrism = makeGemPrismTexture();
    const paperAlbedo = makePaperAlbedoTexture();
    const roundedMask = makeRoundedMaskTexture();
    [
      paperBump,
      roughGlassBump,
      roughGlassCaustic,
      gemFloorCaustic,
      gemPrism,
      paperAlbedo,
      roundedMask,
    ]
      .forEach((texture) => trackedTextures.add(texture));
    const shadowMaps = new Map<MaterialKind, THREE.Texture>();
    const getShadowMap = (kind: MaterialKind) => {
      const existing = shadowMaps.get(kind);
      if (existing) return existing;
      const texture = makeCardShadowTexture(kind);
      shadowMaps.set(kind, texture);
      trackedTextures.add(texture);
      return texture;
    };

    const refractionSources = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-glass-refraction-source], [data-rough-glass-refraction-source]',
      ),
    );
    const observedTextSources = [...refractionSources];
    const backdropImage = cases.querySelector<HTMLImageElement>('[data-glass-backdrop-image-source]');
    const domRefractionCanvas = document.createElement('canvas');
    domRefractionCanvas.width = 2;
    domRefractionCanvas.height = 2;
    const domRefractionContext = domRefractionCanvas.getContext('2d');
    if (!domRefractionContext) throw new Error('Unable to create DOM refraction texture');
    const domRefractionTexture = new THREE.CanvasTexture(domRefractionCanvas);
    domRefractionTexture.colorSpace = THREE.SRGBColorSpace;
    domRefractionTexture.minFilter = THREE.LinearFilter;
    domRefractionTexture.magFilter = THREE.LinearFilter;
    domRefractionTexture.generateMipmaps = false;
    domRefractionTexture.wrapS = THREE.ClampToEdgeWrapping;
    domRefractionTexture.wrapT = THREE.ClampToEdgeWrapping;
    trackedTextures.add(domRefractionTexture);

    const glassBackdropCanvas = document.createElement('canvas');
    glassBackdropCanvas.width = 2;
    glassBackdropCanvas.height = 2;
    const glassBackdropContext = glassBackdropCanvas.getContext('2d');
    if (!glassBackdropContext) throw new Error('Unable to create glass backdrop texture');
    const glassBackdropTexture = new THREE.CanvasTexture(glassBackdropCanvas);
    glassBackdropTexture.colorSpace = THREE.SRGBColorSpace;
    glassBackdropTexture.minFilter = THREE.LinearFilter;
    glassBackdropTexture.magFilter = THREE.LinearFilter;
    glassBackdropTexture.generateMipmaps = false;
    glassBackdropTexture.wrapS = THREE.ClampToEdgeWrapping;
    glassBackdropTexture.wrapT = THREE.ClampToEdgeWrapping;
    trackedTextures.add(glassBackdropTexture);

    const seaGlassBlurCanvas = document.createElement('canvas');
    seaGlassBlurCanvas.width = 2;
    seaGlassBlurCanvas.height = 2;
    const seaGlassBlurContext = seaGlassBlurCanvas.getContext('2d');
    if (!seaGlassBlurContext) throw new Error('Unable to create sea glass backdrop texture');
    const seaGlassBlurTexture = new THREE.CanvasTexture(seaGlassBlurCanvas);
    seaGlassBlurTexture.colorSpace = THREE.SRGBColorSpace;
    seaGlassBlurTexture.minFilter = THREE.LinearFilter;
    seaGlassBlurTexture.magFilter = THREE.LinearFilter;
    seaGlassBlurTexture.generateMipmaps = false;
    seaGlassBlurTexture.wrapS = THREE.ClampToEdgeWrapping;
    seaGlassBlurTexture.wrapT = THREE.ClampToEdgeWrapping;
    trackedTextures.add(seaGlassBlurTexture);

    const syncSeaGlassBlurTexture = () => {
      const maxSourceDimension = Math.max(glassBackdropCanvas.width, glassBackdropCanvas.height);
      const scale = Math.min(.3, 512 / Math.max(1, maxSourceDimension));
      const width = Math.max(1, Math.round(glassBackdropCanvas.width * scale));
      const height = Math.max(1, Math.round(glassBackdropCanvas.height * scale));
      if (seaGlassBlurCanvas.width !== width || seaGlassBlurCanvas.height !== height) {
        seaGlassBlurCanvas.width = width;
        seaGlassBlurCanvas.height = height;
      }
      seaGlassBlurContext.setTransform(1, 0, 0, 1, 0, 0);
      seaGlassBlurContext.clearRect(0, 0, width, height);
      seaGlassBlurContext.filter = 'blur(18px)';
      seaGlassBlurContext.drawImage(glassBackdropCanvas, 0, 0, width, height);
      seaGlassBlurContext.filter = 'none';
      seaGlassBlurTexture.needsUpdate = true;
    };

    const gemFloorInteraction = getShadowMap('gem');
    const gemFaceMaterial = createGemFaceMaterial(
      glassBackdropTexture,
      domRefractionTexture,
      gemEnvironmentTarget.texture,
      gemFloorInteraction,
    );
    const glassMaterial = createGlassMaterial(glassBackdropTexture, domRefractionTexture);
    const paperFaceMaterial = createPaperFaceMaterial(paperAlbedo, paperBump, roundedMask);
    const seaGlassMaterial = createSeaGlassMaterial(
      glassBackdropTexture,
      seaGlassBlurTexture,
    );
    const roughGlassFaceMaterial = createRoughGlassFaceMaterial(
      roughGlassBump,
      glassBackdropTexture,
      domRefractionTexture,
    );
    const bodyMaterials = createBodyMaterials(paperBump);
    const sideMaterials = createSideMaterials(gemFaceMaterial);
    const roughGlassTopMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: .86,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    const roughGlassBottomMaterial = new THREE.MeshBasicMaterial({
      color: 0xa9c4c9,
      transparent: true,
      opacity: .58,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    const gemFloorCausticMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uBackdrop: { value: glassBackdropTexture },
        uDomRefraction: { value: domRefractionTexture },
        uCaustic: { value: gemFloorCaustic },
        uOpacity: { value: .84 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec2 vScreenUv;

        void main() {
          vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vUv = uv;
          vScreenUv = clip.xy / clip.w * .5 + .5;
          gl_Position = clip;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uBackdrop;
        uniform sampler2D uDomRefraction;
        uniform sampler2D uCaustic;
        uniform float uOpacity;
        varying vec2 vUv;
        varying vec2 vScreenUv;

        vec3 sceneAt(vec2 uv) {
          vec4 backdrop = texture2D(uBackdrop, clamp(uv, vec2(.002), vec2(.998)));
          vec4 dom = texture2D(uDomRefraction, clamp(uv, vec2(.002), vec2(.998)));
          return mix(backdrop.rgb, dom.rgb, dom.a);
        }

        vec3 hardLight(vec3 base, vec3 light) {
          vec3 multiply = 2.0 * base * light;
          vec3 screen = 1.0 - 2.0 * (1.0 - base) * (1.0 - light);
          return mix(multiply, screen, step(vec3(.5), light));
        }

        void main() {
          vec4 caustic = texture2D(uCaustic, vUv);
          vec3 base = sceneAt(vScreenUv);
          vec3 screened = 1.0 - (1.0 - base) * (1.0 - caustic.rgb);
          vec3 hardened = hardLight(base, caustic.rgb);
          float blueSurface = smoothstep(.08, .24, base.b - base.r);
          vec3 light = mix(screened, hardened, blueSurface);
          float spectralRange = max(
            caustic.r,
            max(caustic.g, caustic.b)
          ) - min(
            caustic.r,
            min(caustic.g, caustic.b)
          );
          float prism = smoothstep(.12, .38, spectralRange);
          vec3 spectralLight = mix(
            base,
            min(caustic.rgb * 1.2, vec3(1.0)),
            .96
          );
          light = mix(light, spectralLight, prism);
          gl_FragColor = vec4(light, caustic.a * uOpacity);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const gemPrismMaterial = gemFloorCausticMaterial.clone();
    gemPrismMaterial.uniforms.uCaustic.value = gemPrism;
    gemPrismMaterial.uniforms.uOpacity.value = 1;

    const cardLiftPx = 12;
    const cardLiftDurationMs = 360;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updateLiftTarget = (state: CardState) => {
      const isActive = (state.hovered || state.keyboardFocused) && !reducedMotionQuery.matches;
      const nextLift = isActive ? cardLiftPx : 0;
      if (nextLift === state.liftToPx) return;
      state.liftFromPx = state.liftPx;
      state.liftToPx = nextLift;
      state.liftStartedAt = performance.now();
      renderHarness?.resetAnimationBudget();
      invalidate();
    };

    const cardElements = Array.from(cases.querySelectorAll<HTMLElement>('[data-material]'));
    cardElements.forEach((element) => {
      const kind = element.dataset.material as MaterialKind;
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.BufferGeometry(),
        kind === 'sea-glass'
          ? seaGlassMaterial
          : kind === 'glass'
            ? glassMaterial
            : [
              kind === 'gem' ? gemFaceMaterial : bodyMaterials[kind],
              sideMaterials[kind],
            ],
      );
      group.add(mesh);

      let surface: THREE.Mesh | undefined;
      if (kind === 'paper') {
        surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 32, 48), paperFaceMaterial);
      } else if (kind === 'rough-glass') {
        surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), roughGlassFaceMaterial);
      }
      if (surface) group.add(surface);

      let topSurface: THREE.Mesh | undefined;
      let bottomSurface: THREE.Mesh | undefined;
      if (kind === 'rough-glass') {
        topSurface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), roughGlassTopMaterial);
        bottomSurface = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          roughGlassBottomMaterial,
        );
        topSurface.rotation.x = -Math.PI / 2;
        bottomSurface.rotation.x = -Math.PI / 2;
        topSurface.renderOrder = 3;
        bottomSurface.renderOrder = 1;
        group.add(topSurface, bottomSurface);
      }

      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: getShadowMap(kind),
          color: kind === 'paper' ? 0xffffff : 0x000000,
          transparent: true,
          opacity: 1,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      shadow.position.z = -0.5;
      const caustic = kind === 'gem'
        ? new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          gemFloorCausticMaterial,
        )
        : kind === 'rough-glass'
        ? new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            map: roughGlassCaustic,
            color: 0xffffff,
            transparent: true,
            opacity: .78,
            depthWrite: false,
            toneMapped: false,
          }),
        )
        : undefined;
      const prism = kind === 'gem'
        ? new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          gemPrismMaterial,
        )
        : undefined;
      if (caustic) caustic.position.z = -0.49;
      if (prism) prism.position.z = -0.48;
      scene?.add(shadow);
      scene?.add(group);
      if (caustic) scene?.add(caustic);
      if (prism) scene?.add(prism);

      const state: CardState = {
        element,
        kind,
        group,
        mesh,
        surface,
        topSurface,
        bottomSurface,
        shadow,
        caustic,
        prism,
        baseGroupY: 0,
        baseShadowY: 0,
        baseCausticY: 0,
        basePrismY: 0,
        liftPx: 0,
        liftFromPx: 0,
        liftToPx: 0,
        liftStartedAt: 0,
        hovered: false,
        keyboardFocused: false,
      };
      cardStates.push(state);

      element.addEventListener('pointerenter', (event) => {
        if (!hoverQuery.matches || event.pointerType === 'touch') return;
        state.hovered = true;
        updateLiftTarget(state);
      }, { signal: eventController.signal });
      element.addEventListener('pointerleave', () => {
        state.hovered = false;
        updateLiftTarget(state);
      }, { signal: eventController.signal });
      element.addEventListener('focus', () => {
        state.keyboardFocused = element.matches(':focus-visible');
        updateLiftTarget(state);
      }, { signal: eventController.signal });
      element.addEventListener('blur', () => {
        state.keyboardFocused = false;
        updateLiftTarget(state);
      }, { signal: eventController.signal });
    });

    const readTextLines = (element: HTMLElement) => {
      const lines: Array<{ text: string; fontWeight?: string }> = [{ text: '' }];
      element.childNodes.forEach((node) => {
        if (node.nodeName === 'BR') {
          lines.push({ text: '' });
          return;
        }
        const line = lines[lines.length - 1];
        line.text += node.textContent ?? '';
        if (node instanceof HTMLElement) line.fontWeight = getComputedStyle(node).fontWeight;
      });
      return lines;
    };

    const syncTextTexture = (
      sources: HTMLElement[],
      targetCanvas: HTMLCanvasElement,
      targetContext: CanvasRenderingContext2D,
      targetTexture: THREE.CanvasTexture,
      canvasRect: DOMRect,
      pixelRatio: number,
      previousSignature: string,
      blurPx = 0,
      force = false,
    ) => {
      const sourceData = sources.map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { rect, style, lines: readTextLines(element) };
      });
      const signature = [
        canvasRect.left,
        canvasRect.top,
        canvasRect.width,
        canvasRect.height,
        pixelRatio,
        sourceData.map(({ rect, style, lines }) => [
          rect.left,
          rect.top,
          rect.width,
          rect.height,
          style.fontFamily,
          style.fontSize,
          style.fontWeight,
          style.lineHeight,
          style.letterSpacing,
          style.color,
          style.opacity,
          lines.map(({ text, fontWeight }) => `${text}:${fontWeight ?? style.fontWeight}`).join('\n'),
        ].join('|')).join('::'),
      ].join('::');
      if (!force && signature === previousSignature) return previousSignature;

      const textureWidth = Math.max(1, Math.round(canvasRect.width * pixelRatio));
      const textureHeight = Math.max(1, Math.round(canvasRect.height * pixelRatio));
      if (targetCanvas.width !== textureWidth || targetCanvas.height !== textureHeight) {
        targetCanvas.width = textureWidth;
        targetCanvas.height = textureHeight;
      }
      targetContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      targetContext.clearRect(0, 0, canvasRect.width, canvasRect.height);
      targetContext.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';

      sourceData.forEach(({ rect, style, lines }) => {
        const fontSize = Number.parseFloat(style.fontSize) || 16;
        const parsedLineHeight = Number.parseFloat(style.lineHeight);
        const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.2;
        targetContext.fillStyle = style.color;
        const parsedOpacity = Number.parseFloat(style.opacity);
        targetContext.globalAlpha = Number.isFinite(parsedOpacity) ? parsedOpacity : 1;
        targetContext.textBaseline = 'top';
        targetContext.textAlign = style.textAlign as CanvasTextAlign;
        const contextWithSpacing = targetContext as CanvasRenderingContext2D & {
          letterSpacing?: string;
        };
        if ('letterSpacing' in contextWithSpacing) contextWithSpacing.letterSpacing = style.letterSpacing;

        let x = rect.left - canvasRect.left;
        if (style.textAlign === 'right' || style.textAlign === 'end') x = rect.right - canvasRect.left;
        if (style.textAlign === 'center') x = rect.left - canvasRect.left + rect.width / 2;
        const y = rect.top - canvasRect.top + (lineHeight - fontSize) / 2;
        lines.forEach(({ text, fontWeight: lineFontWeight }, lineIndex) => {
          const fontWeight = lineFontWeight ?? style.fontWeight;
          targetContext.font = `${style.fontStyle} ${fontWeight} ${style.fontSize} ${style.fontFamily}`;
          targetContext.fillText(text, x, y + lineIndex * lineHeight);
        });
      });
      targetContext.globalAlpha = 1;
      targetContext.filter = 'none';
      targetTexture.needsUpdate = true;
      return signature;
    };

    const syncGlassBackdropTexture = (
      canvasRect: DOMRect,
      pixelRatio: number,
    ) => {
      const heroStyle = getComputedStyle(hero);
      const bandStyle = getComputedStyle(cases, '::before');
      const casesRect = cases.getBoundingClientRect();
      const rect = backdropImage?.getBoundingClientRect();
      const style = backdropImage ? getComputedStyle(backdropImage) : undefined;
      const signature = [
        canvasRect.left,
        canvasRect.top,
        canvasRect.width,
        canvasRect.height,
        pixelRatio,
        heroStyle.backgroundColor,
        bandStyle.backgroundColor,
        bandStyle.top,
        bandStyle.left,
        bandStyle.width,
        bandStyle.height,
        bandStyle.borderRadius,
        bandStyle.transform,
        rect?.left,
        rect?.top,
        rect?.width,
        rect?.height,
        backdropImage?.currentSrc,
        backdropImage?.naturalWidth,
        backdropImage?.naturalHeight,
        style?.objectPosition,
        style?.objectFit,
        style?.opacity,
        style?.filter,
      ].join('::');
      if (signature === lastBackdropSignature) return;
      lastBackdropSignature = signature;

      const requestedWidth = Math.max(1, canvasRect.width * pixelRatio);
      const requestedHeight = Math.max(1, canvasRect.height * pixelRatio);
      const resolutionScale = Math.min(
        1,
        1280 / Math.max(requestedWidth, requestedHeight),
        Math.sqrt(1_000_000 / (requestedWidth * requestedHeight)),
      );
      const textureWidth = Math.max(1, Math.round(requestedWidth * resolutionScale));
      const textureHeight = Math.max(1, Math.round(requestedHeight * resolutionScale));
      const backdropPixelRatio = textureWidth / canvasRect.width;
      if (glassBackdropCanvas.width !== textureWidth || glassBackdropCanvas.height !== textureHeight) {
        glassBackdropCanvas.width = textureWidth;
        glassBackdropCanvas.height = textureHeight;
      }
      glassBackdropContext.setTransform(backdropPixelRatio, 0, 0, backdropPixelRatio, 0, 0);
      glassBackdropContext.clearRect(0, 0, canvasRect.width, canvasRect.height);
      glassBackdropContext.fillStyle = heroStyle.backgroundColor || '#f9f3f0';
      glassBackdropContext.fillRect(0, 0, canvasRect.width, canvasRect.height);

      const bandWidth = Number.parseFloat(bandStyle.width);
      const bandHeight = Number.parseFloat(bandStyle.height);
      const bandLeft = Number.parseFloat(bandStyle.left);
      const bandTop = Number.parseFloat(bandStyle.top);
      if (
        Number.isFinite(bandWidth)
        && Number.isFinite(bandHeight)
        && Number.isFinite(bandLeft)
        && Number.isFinite(bandTop)
      ) {
        const transform = bandStyle.transform === 'none'
          ? new DOMMatrixReadOnly()
          : new DOMMatrixReadOnly(bandStyle.transform);
        const x = casesRect.left - canvasRect.left + bandLeft + transform.e;
        const y = casesRect.top - canvasRect.top + bandTop + transform.f;
        const radius = Number.parseFloat(bandStyle.borderTopLeftRadius) || 0;
        glassBackdropContext.save();
        glassBackdropContext.beginPath();
        glassBackdropContext.roundRect(x, y, bandWidth, bandHeight, radius);
        glassBackdropContext.clip();
        glassBackdropContext.fillStyle = bandStyle.backgroundColor || 'transparent';
        glassBackdropContext.fillRect(x, y, bandWidth, bandHeight);
        glassBackdropContext.restore();
      }

      if (!backdropImage || !rect || !style) {
        glassBackdropTexture.needsUpdate = true;
        syncSeaGlassBlurTexture();
        return;
      }

      const x = rect.left - canvasRect.left;
      const y = rect.top - canvasRect.top;
      glassBackdropContext.save();
      glassBackdropContext.beginPath();
      glassBackdropContext.roundRect(
        x,
        y,
        rect.width,
        rect.height,
        Number.parseFloat(style.borderTopLeftRadius) || 0,
      );
      glassBackdropContext.clip();
      const imageOpacity = Number.parseFloat(style.opacity);
      glassBackdropContext.globalAlpha = Number.isFinite(imageOpacity) ? imageOpacity : 1;
      glassBackdropContext.filter = style.filter === 'none' ? 'none' : style.filter;

      if (backdropImage.complete && backdropImage.naturalWidth && backdropImage.naturalHeight) {
        const positionTokens = style.objectPosition.split(/\s+/);
        const resolvePosition = (token: string | undefined, fallback: number) => {
          if (!token) return fallback;
          if (token === 'left' || token === 'top') return 0;
          if (token === 'right' || token === 'bottom') return 1;
          if (token === 'center') return 0.5;
          if (token.endsWith('%')) return Number.parseFloat(token) / 100;
          return fallback;
        };
        const positionX = resolvePosition(positionTokens[0], 0.5);
        const positionY = resolvePosition(positionTokens[1], 0.5);
        const scale = Math.max(
          style.objectFit === 'contain'
            ? Math.min(rect.width / backdropImage.naturalWidth, rect.height / backdropImage.naturalHeight)
            : rect.width / backdropImage.naturalWidth,
          style.objectFit === 'contain'
            ? Math.min(rect.width / backdropImage.naturalWidth, rect.height / backdropImage.naturalHeight)
            : rect.height / backdropImage.naturalHeight,
        );
        const width = backdropImage.naturalWidth * scale;
        const height = backdropImage.naturalHeight * scale;
        glassBackdropContext.drawImage(
          backdropImage,
          x + (rect.width - width) * positionX,
          y + (rect.height - height) * positionY,
          width,
          height,
        );
      }
      glassBackdropContext.restore();
      glassBackdropContext.globalAlpha = 1;
      glassBackdropTexture.needsUpdate = true;
      syncSeaGlassBlurTexture();
    };

    const syncDomRefractionTextures = (
      canvasRect: DOMRect,
      pixelRatio: number,
      force = false,
    ) => {
      lastDomSignature = syncTextTexture(
        refractionSources,
        domRefractionCanvas,
        domRefractionContext,
        domRefractionTexture,
        canvasRect,
        pixelRatio,
        lastDomSignature,
        0,
        force,
      );
      syncGlassBackdropTexture(canvasRect, pixelRatio);
    };

    const syncLayout = (force = false) => {
      const canvasRect = canvas.getBoundingClientRect();
      const heroRect = hero.getBoundingClientRect();
      if (!canvasRect.width || !canvasRect.height) return false;
      const pixelRatio = renderHarness?.resolvePixelRatio(
        canvasRect.width,
        canvasRect.height,
        window.devicePixelRatio || 1,
      ) ?? 1;
      const sizeChanged = force
        || canvasRect.width !== lastWidth
        || canvasRect.height !== lastHeight
        || pixelRatio !== lastPixelRatio;
      if (sizeChanged) {
        renderHarness?.resize(canvasRect.width, canvasRect.height, window.devicePixelRatio || 1);
        const aspect = canvasRect.width / canvasRect.height;
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        glassMaterial.uniforms.uCanvasSize.value.set(canvasRect.width, canvasRect.height);
        gemFaceMaterial.uniforms.uCanvasSize.value.set(canvasRect.width, canvasRect.height);
        seaGlassMaterial.uniforms.uCanvasSize.value.set(canvasRect.width, canvasRect.height);
        lastWidth = canvasRect.width;
        lastHeight = canvasRect.height;
        lastPixelRatio = pixelRatio;
      }

      syncDomRefractionTextures(canvasRect, pixelRatio, force || sizeChanged);

      const rects = cardStates.map(({ element }) => (
        element.querySelector<HTMLElement>('.material-card')?.getBoundingClientRect()
      ));
      const floorY = rects[0]
        ? rects[0].top + rects[0].height * 0.9 - heroRect.top
        : 0;
      const floorScreenY = 1 - (
        (heroRect.top + floorY - canvasRect.top) / canvasRect.height
      );
      glassMaterial.uniforms.uFloorY.value = floorScreenY;
      roughGlassFaceMaterial.uniforms.uFloorY.value = floorScreenY;
      gemFaceMaterial.uniforms.uFloorY.value = floorScreenY;
      if (floorY > 0 && Math.abs(floorY - lastFloorY) > 0.5) {
        hero.style.setProperty('--stage-floor-y', `${floorY}px`);
        lastFloorY = floorY;
      }
      const signature = [
        canvasRect.width,
        canvasRect.height,
        rects.map((rect) => rect
          ? `${rect.left - canvasRect.left},${rect.top - canvasRect.top},${rect.width},${rect.height}`
          : '').join('|'),
      ].join('::');
      if (!force && signature === lastSignature) return true;
      lastSignature = signature;
      const aspect = canvasRect.width / canvasRect.height;
      const pxY = 2 / canvasRect.height;
      const pxX = aspect * 2 / canvasRect.width;
      const roughGlassIndex = cardStates.findIndex(({ kind }) => kind === 'rough-glass');
      const referenceRect = rects[roughGlassIndex] ?? rects[0];
      if (!referenceRect) return false;
      const referenceWidth = referenceRect.width * pxX;
      const referenceHeight = referenceRect.height * pxY;

      cardStates.forEach((state, index) => {
        const rect = rects[index];
        if (!rect) return;
        const width = referenceWidth;
        const height = referenceHeight;
        const profile = materialProfiles[state.kind];
        const depth = profile.thicknessPx * pxY;
        const radiusPx = profile.radiusPx;
        const radius = radiusPx * pxY;
        state.mesh.geometry.dispose();
        state.mesh.geometry = state.kind === 'gem'
          ? makeGemGeometry(width, height, depth)
          : state.kind === 'sea-glass'
            ? makeSeaGlassGeometry(width, height, depth)
            : state.kind === 'glass'
              ? makeGlassPanelGeometry(width, height, depth, radius)
            : makePanelGeometry(width, height, depth, radius);
        const centerX = (((rect.left + rect.width / 2) - canvasRect.left) / canvasRect.width * 2 - 1) * aspect;
        const centerY = 1 - (((rect.top + rect.height / 2) - canvasRect.top) / canvasRect.height * 2);
        state.baseGroupY = centerY;
        state.group.position.set(
          centerX,
          centerY + state.liftPx * pxY,
          state.group.position.z,
        );
        state.group.rotation.set(
          THREE.MathUtils.degToRad(sceneTuning.baseTilt),
          THREE.MathUtils.degToRad(sceneTuning.baseYaw),
          THREE.MathUtils.degToRad(sceneTuning.baseRoll),
        );
        state.group.scale.setScalar(1.006);
        state.group.position.z = 0.08;
        if (state.surface) {
          state.surface.geometry.dispose();
          if (state.kind === 'paper') {
            state.surface.geometry = new THREE.PlaneGeometry(width - radius * 0.14, height - radius * 0.14, 32, 48);
          } else {
            state.surface.geometry = makeRoundedFaceGeometry(
              width - radius * 0.2,
              height - radius * 0.2,
              radius * 0.9,
            );
          }
          state.surface.position.set(
            0,
            0,
            state.kind === 'rough-glass' || state.kind === 'glass'
              ? depth / 2 + 0.001
              : depth / 2 + depth * 0.25 + 0.001,
          );
        }
        if (state.topSurface && state.bottomSurface) {
          state.topSurface.geometry.dispose();
          state.bottomSurface.geometry.dispose();
          state.topSurface.geometry = new THREE.PlaneGeometry(
            width - radius * .2,
            depth * .96,
          );
          state.bottomSurface.geometry = new THREE.PlaneGeometry(
            width - radius * .2,
            depth * .96,
          );
          state.topSurface.position.set(0, height / 2 - radius * .08, 0);
          state.bottomSurface.position.set(0, -height / 2 + radius * .08, 0);
        }
        const isGem = state.kind === 'gem';
        const simpleShadowProfile = state.kind === 'sea-glass'
          || state.kind === 'rough-glass'
          || state.kind === 'glass'
          ? simpleShadowProfiles[state.kind]
          : undefined;
        state.shadow.scale.set(
          width * (
            isGem ? 1.28 : simpleShadowProfile?.scale[0] ?? 1.1
          ),
          height * (
            isGem ? 1.16 : simpleShadowProfile?.scale[1] ?? 1.06
          ),
          1,
        );
        state.baseShadowY = centerY + height * (
          isGem
            ? -.06
            : simpleShadowProfile?.offset.yRatio
              ?? lightingTuning.shadowOffset.yRatio
        );
        state.shadow.position.set(
          centerX + width * (
            isGem
              ? .12
              : simpleShadowProfile?.offset.xRatio
                ?? lightingTuning.shadowOffset.xRatio
          ),
          state.baseShadowY + state.liftPx * pxY * .5,
          -0.65,
        );
        if (state.caustic) {
          state.caustic.scale.set(
            width * (isGem ? 1.26 : 1.08),
            height * (isGem ? 1.13 : 1.04),
            1,
          );
          state.baseCausticY = centerY + height * (
            isGem ? -.055 : lightingTuning.causticOffset.yRatio
          );
          state.caustic.position.set(
            centerX + width * (
              isGem ? .115 : lightingTuning.causticOffset.xRatio
            ),
            state.baseCausticY + state.liftPx * pxY * .5,
            -0.64,
          );
        }
        if (state.prism) {
          state.prism.scale.set(
            width * .78,
            height * .48,
            1,
          );
          state.basePrismY = centerY - height * .36 + 30 * pxY;
          state.prism.position.set(
            centerX + width * .35,
            state.basePrismY + state.liftPx * pxY * .5,
            -0.63,
          );
        }
        if (state.kind === 'glass') {
          glassMaterial.uniforms.uWorldCardSize.value.set(width, height);
          glassMaterial.uniforms.uCardSize.value.set(referenceRect.width, referenceRect.height);
          glassMaterial.uniforms.uRadius.value = radiusPx;
        }
      });
      return true;
    };

    const updateCardLift = (now: number) => {
      const pxY = lastHeight > 0 ? 2 / lastHeight : 0;
      let isAnimating = false;
      cardStates.forEach((state) => {
        if (state.liftPx !== state.liftToPx) {
          const elapsed = now - state.liftStartedAt;
          const progress = reducedMotionQuery.matches
            ? 1
            : Math.min(1, Math.max(0, elapsed / cardLiftDurationMs));
          const eased = progress * progress * (3 - 2 * progress);
          state.liftPx = THREE.MathUtils.lerp(state.liftFromPx, state.liftToPx, eased);
          if (progress < 1) {
            isAnimating = true;
          } else {
            state.liftPx = state.liftToPx;
          }
        }

        const liftWorld = state.liftPx * pxY;
        state.group.position.y = state.baseGroupY + liftWorld;
        state.shadow.position.y = state.baseShadowY + liftWorld * .5;
        if (state.caustic) {
          state.caustic.position.y = state.baseCausticY + liftWorld * .5;
        }
        if (state.prism) {
          state.prism.position.y = state.basePrismY + liftWorld * .5;
        }
      });
      return isAnimating;
    };

    renderFrame = () => {
      if (disposed || !textureReady || !isVisible || !renderer || !scene) return;
      if (layoutDirty) layoutDirty = !syncLayout();
      const liftAnimating = updateCardLift(performance.now());

      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      if (liftAnimating && renderHarness?.allowNextAnimationFrame()) invalidate();
    };

    markTextureReady();

    resizeObserver = new ResizeObserver(markLayoutDirty);
    resizeObserver.observe(canvas);
    resizeObserver.observe(cases);
    cardStates.forEach(({ element }) => {
      const card = element.querySelector<HTMLElement>('.material-card');
      if (card) resizeObserver?.observe(card);
    });
    observedTextSources.forEach((source) => resizeObserver?.observe(source));
    if (backdropImage) resizeObserver.observe(backdropImage);

    mutationObserver = new MutationObserver(markLayoutDirty);
    mutationObserver.observe(hero, { attributes: true });
    mutationObserver.observe(cases, { attributes: true });
    mutationObserver.observe(document.documentElement, { attributes: true });
    observedTextSources.forEach((source) => mutationObserver?.observe(source, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    }));
    if (backdropImage) {
      mutationObserver.observe(backdropImage, { attributes: true });
      backdropImage.addEventListener('load', markLayoutDirty, {
        signal: eventController.signal,
      });
    }

    window.addEventListener('resize', markLayoutDirty, {
      passive: true,
      signal: eventController.signal,
    });
    document.fonts?.ready.then(() => {
      if (disposed) return;
      lastDomSignature = '';
      lastBackdropSignature = '';
      markLayoutDirty();
    });

    intersectionObserver = new IntersectionObserver(([entry]) => {
      const nextVisible = entry?.isIntersecting ?? true;
      if (nextVisible === isVisible) return;
      isVisible = nextVisible;
      if (isVisible) invalidate();
    });
    intersectionObserver.observe(cases);

    import.meta.hot?.dispose(cleanup);
  } catch (error) {
    cleanup();
    canvas.dataset.rendererState = 'error';
    canvas.dataset.rendererError = error instanceof Error ? error.message : 'webgl-initialization';
    canvas.hidden = true;
  }
}
