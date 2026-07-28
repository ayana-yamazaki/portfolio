import {
  ACESFilmicToneMapping,
  BufferGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  CubeCamera,
  DirectionalLight,
  DoubleSide,
  Group,
  HalfFloatType,
  HemisphereLight,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PMREMGenerator,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLCubeRenderTarget,
  WebGLRenderer,
  WebGLRenderTarget,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import {
  glassContactShadowProfile,
  glassTuning,
  lightingTuning,
  materialProfiles,
  roughGlassDesktopShadowProfile,
  seaGlassDesktopShadowProfile,
  sceneTuning,
  simpleShadowProfiles,
  type MaterialKind,
} from './materials/config';
import {
  createBodyMaterials,
  createGemFaceMaterial,
  createGlassMaterial,
  createRoughGlassCausticMaterial,
  createSeaGlassMaterial,
  createRoughGlassFaceMaterial,
  createSideMaterials,
} from './materials/factories';
import {
  getRoughGlassChamferSize,
  makeBeveledRoughGlassGeometry,
  makeRoundedFaceGeometry,
} from './materials/geometry';
import {
  getCardDefinition,
  prepareCardDefinition,
  type CardDefinition,
} from './materials/cards/registry';
import { createRenderHarness, type RenderHarness } from './materials/render-harness';
import {
  createRenderDirtyState,
  RenderDirtyFlag,
  type RenderDirtyFlags,
} from './materials/engine/dirty-state';
import { scheduleIdleWork } from './materials/engine/idle-work';
import {
  createMotionCache,
  type MotionCache,
} from './materials/engine/motion-cache';
import {
  loadRoughGlassTextures,
  makeGemFloorCausticTexture,
  makeGemPrismTexture,
  makeSeaGlassPrismTexture,
  makeCardShadowTexture,
} from './materials/textures';
import { createRoughGlassControls } from './materials/rough-glass-controls';
import { createSeaGlassControls } from './materials/sea-glass-controls';
import { createGemControls } from './materials/gem-controls';
import {
  createRoughGlassMaterialControls,
  type RoughGlassPresentation,
} from './materials/rough-glass-material-controls';

type ManagedCanvas = HTMLCanvasElement & {
  materialsPbrCleanup?: () => void;
};

type MeshBackdropVariant = 'spring' | 'summer' | 'winter' | 'plain';

type MeshBackdropField = {
  center: [number, number];
  radius: [number, number];
  color: string;
  edge: string;
};

type MeshBackdropProfile = {
  base: string;
  fields: MeshBackdropField[];
};

const meshBackdropProfiles: Record<MeshBackdropVariant, MeshBackdropProfile> = {
  spring: {
    base: '#263c76',
    fields: [
      {
        center: [.46, -.08],
        radius: [.78, .48],
        color: 'rgba(248, 237, 218, .98)',
        edge: 'rgba(248, 226, 203, 0)',
      },
      {
        center: [-.08, .28],
        radius: [.6, .42],
        color: 'rgba(246, 210, 179, .82)',
        edge: 'rgba(244, 198, 164, 0)',
      },
      {
        center: [.52, .59],
        radius: [.68, .46],
        color: 'rgba(247, 155, 111, .7)',
        edge: 'rgba(245, 132, 95, 0)',
      },
      {
        center: [.22, 1.02],
        radius: [.62, .5],
        color: 'rgba(246, 121, 79, .76)',
        edge: 'rgba(245, 138, 87, 0)',
      },
      {
        center: [1.08, 1.03],
        radius: [.56, .44],
        color: 'rgba(230, 78, 68, .86)',
        edge: 'rgba(239, 101, 77, 0)',
      },
    ],
  },
  summer: {
    base: '#3582c6',
    fields: [
      {
        center: [.52, -.1],
        radius: [.82, .5],
        color: 'rgba(151, 192, 232, .94)',
        edge: 'rgba(167, 201, 232, 0)',
      },
      {
        center: [.18, .46],
        radius: [.52, .32],
        color: 'rgba(226, 228, 224, .88)',
        edge: 'rgba(230, 225, 216, 0)',
      },
      {
        center: [.84, .51],
        radius: [.56, .34],
        color: 'rgba(238, 229, 215, .84)',
        edge: 'rgba(231, 216, 202, 0)',
      },
      {
        center: [-.08, .92],
        radius: [.66, .44],
        color: 'rgba(248, 183, 128, .78)',
        edge: 'rgba(242, 167, 116, 0)',
      },
      {
        center: [.74, 1.08],
        radius: [.7, .5],
        color: 'rgba(244, 140, 89, .82)',
        edge: 'rgba(247, 165, 103, 0)',
      },
    ],
  },
  winter: {
    base: '#589adc',
    fields: [
      {
        center: [.46, -.12],
        radius: [.8, .48],
        color: 'rgba(5, 12, 64, .98)',
        edge: 'rgba(8, 19, 88, 0)',
      },
      {
        center: [-.08, .56],
        radius: [.62, .44],
        color: 'rgba(15, 39, 134, .78)',
        edge: 'rgba(17, 50, 153, 0)',
      },
      {
        center: [.78, .68],
        radius: [.68, .48],
        color: 'rgba(18, 57, 172, .82)',
        edge: 'rgba(14, 52, 162, 0)',
      },
      {
        center: [.56, 1.08],
        radius: [.56, .44],
        color: 'rgba(23, 83, 208, .78)',
        edge: 'rgba(18, 65, 180, 0)',
      },
      {
        center: [.94, 1.02],
        radius: [.38, .3],
        color: 'rgba(49, 116, 229, .46)',
        edge: 'rgba(49, 116, 229, 0)',
      },
    ],
  },
  plain: {
    base: '#c6dce8',
    fields: [],
  },
};

type CardState = {
  element: HTMLElement;
  kind: MaterialKind;
  definition: CardDefinition;
  group: Group;
  mesh: Mesh;
  surface?: Mesh;
  bottomSurface?: Mesh;
  shadow: Mesh;
  caustic?: Mesh;
  prism?: Mesh;
  renderables: Object3D[];
  geometrySignature: string;
  baseGroupY: number;
  baseShadowY: number;
  baseCausticY: number;
  basePrismY: number;
  liftPx: number;
  liftFromPx: number;
  liftToPx: number;
  liftStartedAt: number;
  baseTiltRad: number;
  baseYawRad: number;
  tiltXRad: number;
  tiltYRad: number;
  tiltTargetXRad: number;
  tiltTargetYRad: number;
  lightStartX: number;
  lightEndX: number;
  hovered: boolean;
  pressed: boolean;
  keyboardFocused: boolean;
};

const canvas = document.querySelector<ManagedCanvas>('[data-materials-pbr]');
const cases = canvas?.closest<HTMLElement>('.home-hero__cases');
const hero = cases?.closest<HTMLElement>('.home-hero');

if (canvas && cases && hero) {
  const carousel = cases.querySelector<HTMLElement>('[data-case-carousel]');
  canvas.materialsPbrCleanup?.();
  canvas.hidden = false;
  canvas.dataset.rendererState = 'initializing';
  delete canvas.dataset.rendererError;

  const isSmallViewport = window.matchMedia('(max-width: 720px)').matches;
  const performanceNavigator = navigator as Navigator & {
    deviceMemory?: number;
    connection?: {
      saveData?: boolean;
    };
  };
  const deviceMemory = performanceNavigator.deviceMemory;
  const hardwareConcurrency = performanceNavigator.hardwareConcurrency || 6;
  const saveData = performanceNavigator.connection?.saveData === true;
  const isLowPowerDevice = (
    saveData
    || (deviceMemory !== undefined && deviceMemory <= 4)
    || hardwareConcurrency <= 4
  );
  const isHighPowerDevice = (
    !saveData
    && deviceMemory !== undefined
    && deviceMemory >= 8
    && hardwareConcurrency >= 8
  );
  const mobileQuality = isLowPowerDevice
    ? {
      tier: 'low',
      maxPixelRatio: 1.25,
      maxPixelCount: 850_000,
    }
    : isHighPowerDevice
    ? {
      tier: 'high',
      maxPixelRatio: 1.5,
      maxPixelCount: 1_200_000,
    }
    : {
      tier: 'balanced',
      maxPixelRatio: 1.35,
      maxPixelCount: 1_000_000,
    };
  if (isSmallViewport) canvas.dataset.rendererQuality = mobileQuality.tier;
  let disposed = false;
  let renderer: WebGLRenderer | undefined;
  let renderHarness: RenderHarness | undefined;
  let motionCache: MotionCache | undefined;
  let cancelMotionCacheWarm: (() => void) | undefined;
  let cancelMobileCardPreparation: (() => void) | undefined;
  let cleanupRoughGlassControls: (() => void) | undefined;
  let cleanupSeaGlassControls: (() => void) | undefined;
  let cleanupGemControls: (() => void) | undefined;
  let cleanupRoughGlassMaterialControls: (() => void) | undefined;
  let scene: Scene | undefined;
  let environmentTarget: WebGLRenderTarget | undefined;
  let gemEnvironmentTarget: WebGLCubeRenderTarget | undefined;
  let intersectionObserver: IntersectionObserver | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let mutationObserver: MutationObserver | undefined;
  const eventController = new AbortController();
  const trackedTextures = new Set<Texture>();
  const cardStates: CardState[] = [];
  const preparedCardKinds = new Set<MaterialKind>();
  const failedCardKinds = new Set<MaterialKind>();
  const preparingCardKinds = new Map<MaterialKind, Promise<void>>();
  let mobileInitialFrameRendered = false;
  let mobileScrollFrameId: number | undefined;

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    cancelMotionCacheWarm?.();
    cancelMotionCacheWarm = undefined;
    cancelMobileCardPreparation?.();
    cancelMobileCardPreparation = undefined;
    cleanupRoughGlassControls?.();
    cleanupRoughGlassControls = undefined;
    cleanupSeaGlassControls?.();
    cleanupSeaGlassControls = undefined;
    cleanupGemControls?.();
    cleanupGemControls = undefined;
    cleanupRoughGlassMaterialControls?.();
    cleanupRoughGlassMaterialControls = undefined;
    if (mobileScrollFrameId !== undefined) {
      cancelAnimationFrame(mobileScrollFrameId);
      mobileScrollFrameId = undefined;
    }
    motionCache?.dispose();
    renderHarness?.dispose();
    eventController.abort();
    intersectionObserver?.disconnect();
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();

    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    scene?.traverse((object) => {
      if (!(object instanceof Mesh)) return;
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

  const failInitialization = (error: unknown) => {
    cleanup();
    canvas.dataset.rendererState = 'error';
    canvas.dataset.rendererError = error instanceof Error
      ? error.message
      : 'webgl-initialization';
    canvas.hidden = true;
  };

  canvas.materialsPbrCleanup = cleanup;

  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = sceneTuning.exposure;
    renderer.setClearColor(0x000000, 0);
    renderHarness = createRenderHarness({
      canvas,
      renderer,
      maxPixelRatio: isSmallViewport
        ? mobileQuality.maxPixelRatio
        : sceneTuning.maxPixelRatio,
      maxPixelCount: isSmallViewport
        ? Math.min(mobileQuality.maxPixelCount, sceneTuning.maxPixelCount)
        : sceneTuning.maxPixelCount,
      maxContinuousFrames: sceneTuning.maxContinuousFrames,
      maxDrawCalls: sceneTuning.maxDrawCalls,
      maxTriangles: sceneTuning.maxTriangles,
    });

    scene = new Scene();
    const cameraFov = 2.5;
    const cameraDistance = 1 / Math.tan(MathUtils.degToRad(cameraFov / 2));
    const camera = new PerspectiveCamera(cameraFov, 1, 0.1, 100);
    camera.position.set(0, 0, cameraDistance);

    const environmentScene = new Scene();
    environmentScene.background = new Color(lightingTuning.environment.background);
    const addEnvironmentPanel = (panel: {
      color: number;
      position: readonly [number, number, number];
      size: readonly [number, number];
      intensity?: number;
    }) => {
      const mesh = new Mesh(
        new PlaneGeometry(...panel.size),
        new MeshBasicMaterial({
          color: new Color(panel.color).multiplyScalar(panel.intensity ?? 1),
          side: DoubleSide,
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

    const pmrem = new PMREMGenerator(renderer);
    environmentTarget = pmrem.fromScene(
      environmentScene,
      0.008,
      0.1,
      100,
      { size: isSmallViewport ? 64 : 128 },
    );
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
    gemEnvironmentTarget = new WebGLCubeRenderTarget(isSmallViewport ? 64 : 128, {
      type: HalfFloatType,
      generateMipmaps: true,
      minFilter: LinearMipmapLinearFilter,
    });
    gemEnvironmentTarget.texture.colorSpace = LinearSRGBColorSpace;
    const gemEnvironmentCamera = new CubeCamera(0.1, 50, gemEnvironmentTarget);
    gemEnvironmentCamera.update(renderer, environmentScene);
    environmentScene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });

    scene.add(new HemisphereLight(
      lightingTuning.hemisphere.skyColor,
      lightingTuning.hemisphere.groundColor,
      lightingTuning.hemisphere.intensity,
    ));
    const keyLight = new DirectionalLight(
      lightingTuning.key.color,
      lightingTuning.key.intensity,
    );
    keyLight.position.set(...lightingTuning.key.position);
    scene.add(keyLight);
    const fillLight = new DirectionalLight(
      lightingTuning.fill.color,
      lightingTuning.fill.intensity,
    );
    fillLight.position.set(...lightingTuning.fill.position);
    scene.add(fillLight);
    const rimLight = new DirectionalLight(
      lightingTuning.rim.color,
      lightingTuning.rim.intensity,
    );
    rimLight.position.set(...lightingTuning.rim.position);
    scene.add(rimLight);

    let textureReady = false;
    let isVisible = true;
    const dirty = createRenderDirtyState(
      RenderDirtyFlag.layout
      | RenderDirtyFlag.backdrop
      | RenderDirtyFlag.appearance
      | RenderDirtyFlag.motionCache,
    );
    let lastWidth = 0;
    let lastHeight = 0;
    let lastPixelRatio = 0;
    let lastSignature = '';
    let lastDomSignature = '';
    let lastBackdropSignature = '';
    let lastFloorY = 0;
    let renderFrame = () => {};

    const invalidate = (flags: RenderDirtyFlags = RenderDirtyFlag.transform) => {
      dirty.add(flags);
      if (disposed || !textureReady || !isVisible) return;
      renderHarness?.schedule(() => renderFrame());
    };

    const markLayoutDirty = () => {
      cancelMotionCacheWarm?.();
      cancelMotionCacheWarm = undefined;
      invalidate(
        RenderDirtyFlag.layout
        | RenderDirtyFlag.backdrop
        | RenderDirtyFlag.appearance
        | RenderDirtyFlag.motionCache,
      );
    };

    const markTextureReady = () => {
      if (disposed || textureReady) return;
      textureReady = true;
      canvas.dataset.rendererState = 'ready';
      cases.classList.add('is-materials-pbr-ready');
      markLayoutDirty();
    };

    const makePlaceholderTexture = (fillStyle: string) => {
      const source = document.createElement('canvas');
      source.width = 1;
      source.height = 1;
      const context = source.getContext('2d');
      if (!context) throw new Error('Unable to create placeholder texture');
      context.fillStyle = fillStyle;
      context.fillRect(0, 0, 1, 1);
      return new CanvasTexture(source);
    };
    let roughGlassTextures: ReturnType<typeof loadRoughGlassTextures> | undefined;
    const roughGlassBump = roughGlassTextures?.bump
      ?? makePlaceholderTexture('#808080');
    const gemFloorCaustic = makeGemFloorCausticTexture();
    const gemPrism = makeGemPrismTexture();
    const seaGlassPrism = makeSeaGlassPrismTexture(!isSmallViewport);
    [
      roughGlassBump,
      gemFloorCaustic,
      gemPrism,
      seaGlassPrism,
    ]
      .forEach((texture) => trackedTextures.add(texture));
    const shadowMaps = new Map<MaterialKind, Texture>();
    const shadowPlaceholderTexture = isSmallViewport
      ? makePlaceholderTexture('rgba(0, 0, 0, 0)')
      : undefined;
    if (shadowPlaceholderTexture) trackedTextures.add(shadowPlaceholderTexture);
    const getShadowMap = (kind: MaterialKind) => {
      const existing = shadowMaps.get(kind);
      if (existing) return existing;
      const texture = makeCardShadowTexture(
        kind,
        !isSmallViewport && kind === 'rough-glass'
          ? roughGlassDesktopShadowProfile
          : !isSmallViewport && kind === 'sea-glass'
            ? seaGlassDesktopShadowProfile
            : undefined,
      );
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
    const meshBackdropSources = Array.from(
      cases.querySelectorAll<HTMLElement>('[data-mesh-gradient-card]'),
    );
    const nanakamadoSwatchImage = cases.querySelector<HTMLImageElement>(
      '[data-nanakamado-swatch-image]',
    );
    nanakamadoSwatchImage?.addEventListener('load', () => {
      lastBackdropSignature = '';
      invalidate(
        RenderDirtyFlag.backdrop
        | RenderDirtyFlag.appearance
        | RenderDirtyFlag.motionCache,
      );
    }, { signal: eventController.signal });
    const domRefractionCanvas = document.createElement('canvas');
    domRefractionCanvas.width = 2;
    domRefractionCanvas.height = 2;
    const domRefractionContext = domRefractionCanvas.getContext('2d');
    if (!domRefractionContext) throw new Error('Unable to create DOM refraction texture');
    const domRefractionTexture = new CanvasTexture(domRefractionCanvas);
    domRefractionTexture.colorSpace = SRGBColorSpace;
    domRefractionTexture.minFilter = LinearFilter;
    domRefractionTexture.magFilter = LinearFilter;
    domRefractionTexture.generateMipmaps = false;
    domRefractionTexture.wrapS = ClampToEdgeWrapping;
    domRefractionTexture.wrapT = ClampToEdgeWrapping;
    trackedTextures.add(domRefractionTexture);

    const glassBackdropCanvas = document.createElement('canvas');
    glassBackdropCanvas.width = 2;
    glassBackdropCanvas.height = 2;
    const glassBackdropContext = glassBackdropCanvas.getContext('2d');
    if (!glassBackdropContext) throw new Error('Unable to create glass backdrop texture');
    const glassBackdropTexture = new CanvasTexture(glassBackdropCanvas);
    glassBackdropTexture.colorSpace = SRGBColorSpace;
    glassBackdropTexture.minFilter = LinearFilter;
    glassBackdropTexture.magFilter = LinearFilter;
    glassBackdropTexture.generateMipmaps = false;
    glassBackdropTexture.wrapS = ClampToEdgeWrapping;
    glassBackdropTexture.wrapT = ClampToEdgeWrapping;
    trackedTextures.add(glassBackdropTexture);

    const seaGlassBlurCanvas = document.createElement('canvas');
    seaGlassBlurCanvas.width = 2;
    seaGlassBlurCanvas.height = 2;
    const seaGlassBlurContext = seaGlassBlurCanvas.getContext('2d');
    if (!seaGlassBlurContext) throw new Error('Unable to create sea glass backdrop texture');
    const seaGlassBlurTexture = new CanvasTexture(seaGlassBlurCanvas);
    seaGlassBlurTexture.colorSpace = SRGBColorSpace;
    seaGlassBlurTexture.minFilter = LinearFilter;
    seaGlassBlurTexture.magFilter = LinearFilter;
    seaGlassBlurTexture.generateMipmaps = false;
    seaGlassBlurTexture.wrapS = ClampToEdgeWrapping;
    seaGlassBlurTexture.wrapT = ClampToEdgeWrapping;
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
    const glassMaterial = createGlassMaterial(
      glassBackdropTexture,
      domRefractionTexture,
      gemEnvironmentTarget.texture,
    );
    const seaGlassMaterial = createSeaGlassMaterial(
      glassBackdropTexture,
      seaGlassBlurTexture,
      domRefractionTexture,
    );
    const roughGlassFaceMaterial = createRoughGlassFaceMaterial(
      roughGlassBump,
      glassBackdropTexture,
      domRefractionTexture,
      gemEnvironmentTarget.texture,
      !isSmallViewport,
    );
    const roughGlassCausticMaterial = createRoughGlassCausticMaterial(
      roughGlassFaceMaterial,
    );
    if (
      import.meta.env.DEV
      && !isSmallViewport
      && new URLSearchParams(window.location.search).has('gemControls')
    ) {
      cleanupGemControls = createGemControls(
        gemFaceMaterial.uniforms,
        () => invalidate(
          RenderDirtyFlag.appearance
          | RenderDirtyFlag.motionCache,
        ),
      );
    }
    if (
      import.meta.env.DEV
      && !isSmallViewport
      && new URLSearchParams(window.location.search).has('seaGlassControls')
    ) {
      cleanupSeaGlassControls = createSeaGlassControls({
        uniforms: seaGlassMaterial.uniforms,
        getRadius: () => materialProfiles['sea-glass'].radiusPx,
        setRadius: (value) => {
          materialProfiles['sea-glass'].radiusPx = value;
        },
        onAppearanceChange: () => invalidate(
          RenderDirtyFlag.appearance
          | RenderDirtyFlag.motionCache,
        ),
        onGeometryChange: () => {
          lastSignature = '';
          markLayoutDirty();
        },
      });
    }
    if (
      import.meta.env.DEV
      && !isSmallViewport
      && new URLSearchParams(window.location.search).has('roughGlassControls')
    ) {
      cleanupRoughGlassControls = createRoughGlassControls(
        roughGlassFaceMaterial.uniforms,
        () => invalidate(
          RenderDirtyFlag.appearance
          | RenderDirtyFlag.motionCache,
        ),
      );
    }
    const baseRefraction = {
      gem: gemFaceMaterial.uniforms.uRefraction.value as number,
      'sea-glass': seaGlassMaterial.uniforms.uRefraction.value as number,
      'rough-glass': roughGlassFaceMaterial.uniforms.uRefractionStrength.value as number,
      glass: glassMaterial.uniforms.uRefraction.value as number,
    } as const;
    const bodyMaterials = createBodyMaterials(!isSmallViewport);
    const sideMaterials = createSideMaterials(
      gemFaceMaterial,
      !isSmallViewport,
    );
    const roughGlassPresentation: RoughGlassPresentation = {
      bodyOpacity: 1.3,
      shadowOpacity: .33,
      shadowSpread: .89,
      shadowDistance: 2,
      projectionSpread: .8,
    };
    const roughGlassBodyBaseOpacity = bodyMaterials['rough-glass'].opacity;
    const roughGlassSideBaseOpacity = sideMaterials['rough-glass'].opacity;
    const roughGlassEdgeBaseOpacity = sideMaterials['rough-glass-edge'].opacity;
    const roughGlassBottomMaterial = isSmallViewport
      ? new MeshBasicMaterial({
          color: 0xa9c4c9,
          transparent: true,
          opacity: .58,
          side: DoubleSide,
          depthWrite: false,
          toneMapped: false,
        })
      : new MeshPhysicalMaterial({
          color: 0xdde9eb,
          roughness: .07,
          metalness: 0,
          transmission: .79,
          thickness: .18,
          ior: 1.5,
          clearcoat: 1,
          clearcoatRoughness: .018,
          envMapIntensity: 1.85,
          transparent: true,
          opacity: 1,
          side: DoubleSide,
          depthWrite: false,
        });
    const gemFloorCausticMaterial = new ShaderMaterial({
      uniforms: {
        uBackdrop: { value: glassBackdropTexture },
        uDomRefraction: { value: domRefractionTexture },
        uCaustic: { value: gemFloorCaustic },
        uOpacity: { value: .84 },
        uSpectralStrength: { value: 1.2 },
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
        uniform float uSpectralStrength;
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
            min(caustic.rgb * uSpectralStrength, vec3(1.0)),
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
    gemPrismMaterial.uniforms.uSpectralStrength.value = 1.38;
    const seaGlassPrismMaterial = gemFloorCausticMaterial.clone();
    seaGlassPrismMaterial.uniforms.uCaustic.value = seaGlassPrism;
    seaGlassPrismMaterial.uniforms.uOpacity.value = isSmallViewport
      ? .62
      : 1;
    seaGlassPrismMaterial.uniforms.uSpectralStrength.value = isSmallViewport
      ? .92
      : 1.48;
    const glassCausticMaterial = new ShaderMaterial({
      uniforms: {
        uStrength: { value: .72 },
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uStrength;
        varying vec2 vUv;

        float band(float value, float center, float width) {
          float offset = (value - center) / width;
          return exp(-offset * offset);
        }

        void main() {
          float broken = .62 + .38 * smoothstep(
            -.25,
            .45,
            sin(vUv.x * 31.0 + vUv.y * 13.0)
          );
          float lowerFocus = band(vUv.y, .09, .032)
            * smoothstep(.05, .22, vUv.x)
            * (1.0 - smoothstep(.84, .98, vUv.x));
          float rightFocus = band(vUv.x, .91, .026)
            * smoothstep(.12, .48, vUv.y)
            * (1.0 - smoothstep(.78, .98, vUv.y));
          float cornerPool = exp(
            -pow((vUv.x - .79) / .2, 2.0)
            -pow((vUv.y - .13) / .07, 2.0)
          );
          float intensity = (
            lowerFocus * .48
              + rightFocus * .2
              + cornerPool * .12
          ) * broken * uStrength;
          vec3 color = mix(
            vec3(.63, .82, 1.0),
            vec3(1.0, .95, .78),
            smoothstep(.2, .88, vUv.x)
          );
          gl_FragColor = vec4(color, clamp(intensity, 0.0, .28));
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });

    const cardLiftPx = 12;
    const cardLiftDurationMs = 360;
    const introLightDelayMs = 80;
    const introLightDurationMs = 900;
    const hoverLightDurationMs = 400;
    const introLightStrengthByMaterial = {
      gem: .3,
      'sea-glass': .8,
      'rough-glass': .6,
      glass: .6,
    } as const;
    const defaultLightX = lightingTuning.key.position[0] / 7.5;
    const defaultLightY = (lightingTuning.key.position[1] - 7.4) / 2.6;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    let introLightStartedAt: number | null = null;
    let introLightAllowed = !reducedMotionQuery.matches;
    let introLightComplete = reducedMotionQuery.matches;
    let settleLightPosition = 0;
    let settleLightStrength = 0;
    let settleLightTarget: MaterialKind | 'all' | null = null;
    let hoverLightState: CardState | null = null;
    let hoverLightStartedAt: number | null = null;
    let activeInteractionState: CardState | null = null;
    let lightX = defaultLightX;
    let lightY = defaultLightY;
    let lightTargetX = defaultLightX;
    let lightTargetY = defaultLightY;
    let lastMotionFrameAt = 0;

    const smoothstep = (value: number) => (
      value * value * (3 - 2 * value)
    );

    const fastEndsSlowMiddle = (value: number) => (
      value + Math.sin(value * Math.PI * 2) * .115
    );

    const cancelIntroLight = () => {
      introLightAllowed = false;
      introLightComplete = true;
      if (introLightStartedAt === null) return;
      introLightStartedAt = null;
    };

    const requestMotionFrame = () => {
      cancelMotionCacheWarm?.();
      cancelMotionCacheWarm = undefined;
      renderHarness?.resetAnimationBudget();
      invalidate(RenderDirtyFlag.transform);
    };

    const startHoverLight = (state: CardState) => {
      if (reducedMotionQuery.matches) return;
      cancelIntroLight();
      hoverLightState = state;
      hoverLightStartedAt = performance.now();
      requestMotionFrame();
    };

    const setLightTarget = (x: number, y: number) => {
      lightTargetX = MathUtils.clamp(x, -1, 1);
      lightTargetY = MathUtils.clamp(y, -1, 1);
      requestMotionFrame();
    };

    const resetTouchInteraction = (state: CardState) => {
      state.tiltTargetXRad = 0;
      state.tiltTargetYRad = 0;
      if (activeInteractionState === state) {
        activeInteractionState = null;
        setLightTarget(defaultLightX, defaultLightY);
      } else {
        requestMotionFrame();
      }
    };

    const updateTouchInteractionFromPoint = (
      state: CardState,
      clientX: number,
      clientY: number,
    ) => {
      cancelIntroLight();
      activeInteractionState = state;
      const cardRect = state.element.getBoundingClientRect();
      const stageRect = cases.getBoundingClientRect();
      const localX = MathUtils.clamp(
        ((clientX - cardRect.left) / Math.max(cardRect.width, 1)) * 2 - 1,
        -1,
        1,
      );
      const localY = MathUtils.clamp(
        ((clientY - cardRect.top) / Math.max(cardRect.height, 1)) * 2 - 1,
        -1,
        1,
      );
      const stageX = (
        ((clientX - stageRect.left) / Math.max(stageRect.width, 1)) * 2 - 1
      );
      const stageY = 1 - (
        ((clientY - stageRect.top) / Math.max(stageRect.height, 1)) * 2
      );
      state.tiltTargetXRad = MathUtils.degToRad(-localY * 2);
      state.tiltTargetYRad = MathUtils.degToRad(localX * 3);
      setLightTarget(stageX, stageY);
    };

    const updateLiftTarget = (state: CardState) => {
      const isActive = (
        state.hovered
        || state.pressed
        || state.keyboardFocused
      ) && !reducedMotionQuery.matches;
      const nextLift = isActive ? cardLiftPx : 0;
      if (nextLift === state.liftToPx) return;
      state.liftFromPx = state.liftPx;
      state.liftToPx = nextLift;
      state.liftStartedAt = performance.now();
      renderHarness?.resetAnimationBudget();
      invalidate(RenderDirtyFlag.transform);
    };

    const cardElements = Array.from(cases.querySelectorAll<HTMLElement>('[data-material]'));
    cardElements.forEach((element) => {
      const kind = element.dataset.material as MaterialKind;
      const definition = getCardDefinition(kind);
      const initiallyPrepared = !isSmallViewport || cardStates.length === 0;
      const waitsForDeferredTexture = (
        !isSmallViewport && kind === 'rough-glass'
      );
      const initiallyVisible = initiallyPrepared && !waitsForDeferredTexture;
      const group = new Group();
      const materialByKind = {
        gem: [gemFaceMaterial, sideMaterials.gem],
        'sea-glass': seaGlassMaterial,
        glass: glassMaterial,
        body: [
          bodyMaterials['rough-glass'],
          sideMaterials['rough-glass'],
          sideMaterials['rough-glass-edge'],
        ],
      };
      const mesh = new Mesh(
        new BufferGeometry(),
        materialByKind[definition.meshMaterial],
      );
      group.add(mesh);

      let surface: Mesh | undefined;
      if (definition.surface === 'rough-glass') {
        surface = new Mesh(new PlaneGeometry(1, 1), roughGlassFaceMaterial);
      }
      if (surface) group.add(surface);

      let bottomSurface: Mesh | undefined;
      if (definition.hasBottomSurface) {
        bottomSurface = new Mesh(
          new PlaneGeometry(1, 1),
          roughGlassBottomMaterial,
        );
        bottomSurface.rotation.x = -Math.PI / 2;
        bottomSurface.renderOrder = 1;
        group.add(bottomSurface);
      }

      const shadow = new Mesh(
        new PlaneGeometry(1, 1),
        new MeshBasicMaterial({
          map: initiallyPrepared
            ? getShadowMap(kind)
            : shadowPlaceholderTexture ?? getShadowMap(kind),
          color: definition.shadowColor,
          transparent: true,
          opacity: 1,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      shadow.position.z = -0.5;
      const caustic = definition.caustic === 'gem'
        ? new Mesh(
          new PlaneGeometry(1, 1),
          gemFloorCausticMaterial,
        )
        : definition.caustic === 'rough-glass' && !isSmallViewport
        ? new Mesh(
          new PlaneGeometry(1, 1),
          roughGlassCausticMaterial,
        )
        : definition.caustic === 'glass'
        ? new Mesh(
          new PlaneGeometry(1, 1),
          glassCausticMaterial,
        )
        : undefined;
      const prism = definition.hasPrism
        ? new Mesh(
          new PlaneGeometry(1, 1),
          definition.kind === 'sea-glass'
            ? seaGlassPrismMaterial
            : gemPrismMaterial,
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
        definition,
        group,
        mesh,
        surface,
        bottomSurface,
        shadow,
        caustic,
        prism,
        renderables: [shadow, group, ...(caustic ? [caustic] : []), ...(prism ? [prism] : [])],
        geometrySignature: '',
        baseGroupY: 0,
        baseShadowY: 0,
        baseCausticY: 0,
        basePrismY: 0,
        liftPx: 0,
        liftFromPx: 0,
        liftToPx: 0,
        liftStartedAt: 0,
        baseTiltRad: 0,
        baseYawRad: 0,
        tiltXRad: 0,
        tiltYRad: 0,
        tiltTargetXRad: 0,
        tiltTargetYRad: 0,
        lightStartX: 0,
        lightEndX: 1,
        hovered: false,
        pressed: false,
        keyboardFocused: false,
      };
      state.renderables.forEach((object) => {
        object.visible = initiallyVisible;
      });
      if (initiallyVisible) {
        preparedCardKinds.add(kind);
        element.dataset.materialPbrReady = '';
      }
      cardStates.push(state);

      element.addEventListener('pointerenter', (event) => {
        if (!hoverQuery.matches || event.pointerType === 'touch') return;
        startHoverLight(state);
        state.hovered = true;
        updateLiftTarget(state);
      }, { signal: eventController.signal });
      element.addEventListener('case-carousel-activate', () => {
        startHoverLight(state);
      }, { signal: eventController.signal });
      element.addEventListener('pointerleave', (event) => {
        if (event.pointerType === 'touch') return;
        state.hovered = false;
        updateLiftTarget(state);
      }, { signal: eventController.signal });
      element.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'touch' || isSmallViewport) return;
        state.pressed = true;
        updateTouchInteractionFromPoint(state, event.clientX, event.clientY);
        updateLiftTarget(state);
      }, { passive: true, signal: eventController.signal });
      element.addEventListener('pointermove', (event) => {
        if (event.pointerType !== 'touch' || isSmallViewport || !state.pressed) return;
        updateTouchInteractionFromPoint(state, event.clientX, event.clientY);
      }, { passive: true, signal: eventController.signal });
      const releaseTouch = (event: PointerEvent) => {
        if (event.pointerType !== 'touch') return;
        state.pressed = false;
        resetTouchInteraction(state);
        updateLiftTarget(state);
      };
      element.addEventListener('pointerup', releaseTouch, {
        passive: true,
        signal: eventController.signal,
      });
      element.addEventListener('pointercancel', releaseTouch, {
        passive: true,
        signal: eventController.signal,
      });
      element.addEventListener('focus', () => {
        state.keyboardFocused = element.matches(':focus-visible');
        if (state.keyboardFocused) {
          cancelIntroLight();
          requestMotionFrame();
        }
        updateLiftTarget(state);
      }, { signal: eventController.signal });
      element.addEventListener('blur', () => {
        state.keyboardFocused = false;
        updateLiftTarget(state);
      }, { signal: eventController.signal });
    });

    if (
      import.meta.env.DEV
      && !isSmallViewport
      && new URLSearchParams(window.location.search).has(
        'roughGlassMaterialControls',
      )
    ) {
      const applyRoughGlassPresentation = () => {
        bodyMaterials['rough-glass'].opacity = (
          roughGlassBodyBaseOpacity * roughGlassPresentation.bodyOpacity
        );
        sideMaterials['rough-glass'].opacity = Math.min(
          1,
          roughGlassSideBaseOpacity * roughGlassPresentation.bodyOpacity,
        );
        sideMaterials['rough-glass-edge'].opacity = Math.min(
          1,
          roughGlassEdgeBaseOpacity * roughGlassPresentation.bodyOpacity,
        );
        const roughGlassState = cardStates.find(
          ({ kind }) => kind === 'rough-glass',
        );
        const shadowMaterial = roughGlassState?.shadow.material;
        if (shadowMaterial && !Array.isArray(shadowMaterial)) {
          shadowMaterial.opacity = roughGlassPresentation.shadowOpacity;
        }
        invalidate(
          RenderDirtyFlag.appearance
          | RenderDirtyFlag.motionCache,
        );
      };
      cleanupRoughGlassMaterialControls = createRoughGlassMaterialControls({
        uniforms: roughGlassFaceMaterial.uniforms,
        presentation: roughGlassPresentation,
        onAppearanceChange: applyRoughGlassPresentation,
        onLayoutChange: () => {
          lastSignature = '';
          markLayoutDirty();
        },
      });
    }

    const prepareRoughGlassTextures = () => {
      if (!roughGlassTextures) {
        roughGlassTextures = loadRoughGlassTextures();
        trackedTextures.add(roughGlassTextures.bump);
        roughGlassFaceMaterial.uniforms.uBump.value = roughGlassTextures.bump;
      }
      return roughGlassTextures.ready;
    };

    const initialCardDefinitionsReady = Promise.all(
      (isSmallViewport ? cardStates.slice(0, 1) : cardStates)
        .map(({ kind }) => prepareCardDefinition(kind)),
    );

    const prepareCard = (
      kind: MaterialKind,
      { urgent = false } = {},
    ) => {
      if (
        (!isSmallViewport && kind !== 'rough-glass')
        || disposed
        || preparedCardKinds.has(kind)
        || (failedCardKinds.has(kind) && !urgent)
      ) {
        return Promise.resolve();
      }
      if (urgent) failedCardKinds.delete(kind);
      const activePreparation = preparingCardKinds.get(kind);
      if (activePreparation) return activePreparation;
      if (urgent) {
        cancelMobileCardPreparation?.();
        cancelMobileCardPreparation = undefined;
      }

      const state = cardStates.find((candidate) => candidate.kind === kind);
      const activeRenderer = renderer;
      const activeScene = scene;
      if (!state || !activeRenderer || !activeScene) return Promise.resolve();

      const preparation = (async () => {
        await Promise.all([
          prepareCardDefinition(kind),
          kind === 'rough-glass'
            ? prepareRoughGlassTextures()
            : Promise.resolve(),
        ]);
        if (disposed) return;
        const shadowMaterial = state.shadow.material as MeshBasicMaterial;
        if (shadowMaterial.map === shadowPlaceholderTexture) {
          shadowMaterial.map = getShadowMap(kind);
          shadowMaterial.needsUpdate = true;
        }
        delete state.element.dataset.materialPbrError;
        if (!syncLayout(true)) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          if (disposed || !syncLayout(true)) return;
        }
        motionCache?.invalidate();
        state.renderables.forEach((object) => {
          object.visible = true;
        });
        await activeRenderer.compileAsync(activeScene, camera);
        if (disposed) return;
        preparedCardKinds.add(kind);
        state.element.dataset.materialPbrReady = '';
        invalidate(
          RenderDirtyFlag.layout
          | RenderDirtyFlag.appearance
          | RenderDirtyFlag.motionCache,
        );
      })().catch(() => {
        state.renderables.forEach((object) => {
          object.visible = false;
        });
        failedCardKinds.add(kind);
        state.element.dataset.materialPbrError = '';
      }).finally(() => {
        preparingCardKinds.delete(kind);
      });
      preparingCardKinds.set(kind, preparation);
      return preparation;
    };

    const scheduleInitialUpcomingCardPreparation = () => {
      if (
        !isSmallViewport
        || disposed
        || !mobileInitialFrameRendered
        || cancelMobileCardPreparation
      ) {
        return;
      }

      const delayId = window.setTimeout(() => {
        const upcomingStates = cardStates.slice(1, 3);
        const prepareNext = (index: number) => {
          const nextState = upcomingStates[index];
          if (!nextState || disposed) return;
          cancelMobileCardPreparation = scheduleIdleWork(() => {
            cancelMobileCardPreparation = undefined;
            void prepareCard(nextState.kind).finally(() => {
              prepareNext(index + 1);
            });
          }, {
            timeoutMs: 3_000,
            fallbackDelayMs: 400,
          });
        };
        prepareNext(0);
      }, 200);
      cancelMobileCardPreparation = () => window.clearTimeout(delayId);
    };

    cardStates.forEach((state) => {
      const prepare = () => {
        void prepareCard(state.kind, { urgent: true });
      };
      state.element.addEventListener('case-carousel-prepare', prepare, {
        signal: eventController.signal,
      });
      state.element.addEventListener('case-carousel-activate', prepare, {
        signal: eventController.signal,
      });
    });

    const syncMobileScrollLight = () => {
      if (
        hoverQuery.matches
        || reducedMotionQuery.matches
        || !introLightComplete
        || activeInteractionState
        || !isVisible
      ) {
        return;
      }
      const heroRect = hero.getBoundingClientRect();
      if (heroRect.bottom <= 0 || heroRect.top >= window.innerHeight) return;
      const progress = MathUtils.clamp(
        -heroRect.top / Math.max(Math.min(heroRect.height, window.innerHeight), 1),
        0,
        1,
      );
      const nextX = MathUtils.lerp(defaultLightX, .62, progress);
      const nextY = MathUtils.lerp(defaultLightY, .35, progress);
      if (
        Math.abs(nextX - lightTargetX) < .04
        && Math.abs(nextY - lightTargetY) < .04
      ) {
        return;
      }
      setLightTarget(nextX, nextY);
    };

    const requestMobileScrollLight = () => {
      if (mobileScrollFrameId !== undefined) return;
      mobileScrollFrameId = requestAnimationFrame(() => {
        mobileScrollFrameId = undefined;
        syncMobileScrollLight();
      });
    };

    window.addEventListener('scroll', requestMobileScrollLight, {
      passive: true,
      signal: eventController.signal,
    });
    const markCardPositionDirty = () => {
      cancelMotionCacheWarm?.();
      cancelMotionCacheWarm = undefined;
      invalidate(
        RenderDirtyFlag.cardPosition
        | RenderDirtyFlag.motionCache,
      );
    };

    carousel?.addEventListener('scroll', markCardPositionDirty, {
      passive: true,
      signal: eventController.signal,
    });
    reducedMotionQuery.addEventListener('change', () => {
      if (!reducedMotionQuery.matches) return;
      cancelIntroLight();
      introLightComplete = true;
      hoverLightState = null;
      hoverLightStartedAt = null;
      activeInteractionState = null;
      cardStates.forEach((state) => {
        state.hovered = false;
        state.pressed = false;
        state.tiltTargetXRad = 0;
        state.tiltTargetYRad = 0;
        updateLiftTarget(state);
      });
      setLightTarget(defaultLightX, defaultLightY);
    }, { signal: eventController.signal });

    motionCache = createMotionCache({
      renderer,
      scene,
      camera,
      samples: sceneTuning.motionCacheSamples,
      items: cardStates.map(({ kind, definition, renderables }) => ({
        id: kind,
        renderables,
        cacheable: definition.cacheDuringMotion,
      })),
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
      targetTexture: CanvasTexture,
      canvasRect: DOMRect,
      pixelRatio: number,
      previousSignature: string,
      blurPx = 0,
      force = false,
    ) => {
      const sourceData = sources.map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const color = element.dataset.refractionColor ?? style.color;
        return { rect, style, color, lines: readTextLines(element) };
      });
      const signature = [
        canvasRect.left,
        canvasRect.top,
        canvasRect.width,
        canvasRect.height,
        pixelRatio,
        sourceData.map(({ rect, style, color, lines }) => [
          rect.left,
          rect.top,
          rect.width,
          rect.height,
          style.fontFamily,
          style.fontSize,
          style.fontWeight,
          style.lineHeight,
          style.letterSpacing,
          color,
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

      sourceData.forEach(({ rect, style, color, lines }) => {
        const fontSize = Number.parseFloat(style.fontSize) || 16;
        const parsedLineHeight = Number.parseFloat(style.lineHeight);
        const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.2;
        targetContext.fillStyle = color;
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
      const backdropClip = backdropImage?.closest<HTMLElement>('picture');
      const backdropClipStyle = backdropClip ? getComputedStyle(backdropClip) : undefined;
      const backdropClipRect = backdropClipStyle?.overflow === 'hidden'
        ? backdropClip?.getBoundingClientRect()
        : undefined;
      const meshBackdropData = meshBackdropSources.map((element) => ({
        element,
        rect: element.getBoundingClientRect(),
        swatchRect: element
          .querySelector<HTMLElement>('.mesh-gradient-card__swatch')
          ?.getBoundingClientRect(),
        style: getComputedStyle(element),
        variant: element.dataset.meshGradientCard as MeshBackdropVariant,
      }));
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
        backdropClipRect?.left,
        backdropClipRect?.top,
        backdropClipRect?.width,
        backdropClipRect?.height,
        backdropClipStyle?.borderRadius,
        nanakamadoSwatchImage?.currentSrc,
        nanakamadoSwatchImage?.naturalWidth,
        nanakamadoSwatchImage?.naturalHeight,
        meshBackdropData.map(({
          rect: meshRect,
          swatchRect,
          style: meshStyle,
          variant,
        }) => [
          variant,
          meshStyle.display,
          meshRect.left,
          meshRect.top,
          meshRect.width,
          meshRect.height,
          meshStyle.borderTopLeftRadius,
          swatchRect?.left,
          swatchRect?.top,
          swatchRect?.width,
          swatchRect?.height,
        ].join('|')).join('::'),
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
      let bandTopScreenY = 1;
      let bandBottomScreenY = 0;
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
        bandTopScreenY = 1 - y / canvasRect.height;
        bandBottomScreenY = 1 - (y + bandHeight) / canvasRect.height;
        const radius = Number.parseFloat(bandStyle.borderTopLeftRadius) || 0;
        glassBackdropContext.save();
        glassBackdropContext.beginPath();
        glassBackdropContext.roundRect(x, y, bandWidth, bandHeight, radius);
        glassBackdropContext.clip();
        glassBackdropContext.fillStyle = bandStyle.backgroundColor || 'transparent';
        glassBackdropContext.fillRect(x, y, bandWidth, bandHeight);
        glassBackdropContext.restore();
      }
      gemFaceMaterial.uniforms.uBandTopY.value = bandTopScreenY;
      seaGlassMaterial.uniforms.uBandTopY.value = bandTopScreenY;
      roughGlassFaceMaterial.uniforms.uBandTopY.value = bandTopScreenY;
      glassMaterial.uniforms.uBandTopY.value = bandTopScreenY;
      roughGlassFaceMaterial.uniforms.uBandBottomY.value = bandBottomScreenY;
      glassMaterial.uniforms.uBandBottomY.value = bandBottomScreenY;

      const drawMeshBackdrop = ({
        rect: meshRect,
        swatchRect,
        style: meshStyle,
        variant,
      }: (typeof meshBackdropData)[number]) => {
        const profile = meshBackdropProfiles[variant];
        if (
          !profile
          || meshStyle.display === 'none'
          || meshRect.width <= 0
          || meshRect.height <= 0
        ) return;

        const x = meshRect.left - canvasRect.left;
        const y = meshRect.top - canvasRect.top;
        const radius = Number.parseFloat(meshStyle.borderTopLeftRadius) || 0;
        glassBackdropContext.save();
        glassBackdropContext.beginPath();
        glassBackdropContext.roundRect(x, y, meshRect.width, meshRect.height, radius);
        glassBackdropContext.clip();
        glassBackdropContext.fillStyle = '#fff';
        glassBackdropContext.fillRect(x, y, meshRect.width, meshRect.height);

        if (!swatchRect) {
          glassBackdropContext.restore();
          return;
        }

        const swatchX = swatchRect.left - canvasRect.left;
        const swatchY = swatchRect.top - canvasRect.top;
        glassBackdropContext.beginPath();
        glassBackdropContext.rect(
          swatchX,
          swatchY,
          swatchRect.width,
          swatchRect.height,
        );
        glassBackdropContext.clip();
        glassBackdropContext.fillStyle = profile.base;
        glassBackdropContext.fillRect(
          swatchX,
          swatchY,
          swatchRect.width,
          swatchRect.height,
        );

        /* Restore this field loop when the CSS mesh gradients are re-enabled.
        profile.fields.forEach((field) => {
          glassBackdropContext.save();
          glassBackdropContext.translate(
            swatchX + swatchRect.width * field.center[0],
            swatchY + swatchRect.height * field.center[1],
          );
          glassBackdropContext.scale(
            Math.max(1, swatchRect.width * field.radius[0]),
            Math.max(1, swatchRect.height * field.radius[1]),
          );
          const gradient = glassBackdropContext.createRadialGradient(0, 0, 0, 0, 0, 1);
          gradient.addColorStop(0, field.color);
          gradient.addColorStop(.56, field.color);
          gradient.addColorStop(1, field.edge);
          glassBackdropContext.fillStyle = gradient;
          glassBackdropContext.fillRect(-1.25, -1.25, 2.5, 2.5);
          glassBackdropContext.restore();
        });
        */
        glassBackdropContext.restore();
      };

      meshBackdropData.forEach(drawMeshBackdrop);
      const visibleSwatches = meshBackdropData
        .map(({ swatchRect, style: meshStyle }) => (
          meshStyle.display !== 'none' && swatchRect && swatchRect.width > 0
            ? swatchRect
            : undefined
        ))
        .filter((swatchRect): swatchRect is DOMRect => Boolean(swatchRect));
      if (
        nanakamadoSwatchImage?.complete
        && nanakamadoSwatchImage.naturalWidth
        && nanakamadoSwatchImage.naturalHeight
        && visibleSwatches.length
      ) {
        const opticalLeft = Math.min(...visibleSwatches.map(({ left }) => left))
          - canvasRect.left;
        const opticalRight = Math.max(...visibleSwatches.map(({ right }) => right))
          - canvasRect.left;
        const opticalTop = Math.min(...visibleSwatches.map(({ top }) => top))
          - canvasRect.top;
        const opticalBottom = Math.max(...visibleSwatches.map(({ bottom }) => bottom))
          - canvasRect.top;
        const opticalWidth = opticalRight - opticalLeft;
        const opticalHeight = opticalBottom - opticalTop;
        const sourceAspect = (
          nanakamadoSwatchImage.naturalWidth
          / nanakamadoSwatchImage.naturalHeight
        );
        const opticalImageWidth = opticalWidth * .9;
        const opticalImageHeight = opticalImageWidth / sourceAspect;
        const opticalImageX = opticalLeft;
        const opticalImageY = (
          opticalTop
          + (opticalHeight - opticalImageHeight) / 2
          + opticalHeight * .2
        );
        glassBackdropContext.save();
        glassBackdropContext.beginPath();
        glassBackdropContext.rect(
          opticalLeft,
          opticalTop,
          opticalWidth,
          opticalHeight,
        );
        glassBackdropContext.clip();
        glassBackdropContext.drawImage(
          nanakamadoSwatchImage,
          opticalImageX,
          opticalImageY,
          opticalImageWidth,
          opticalImageHeight,
        );
        glassBackdropContext.restore();
      }
      if (visibleSwatches.length) {
        gemFaceMaterial.uniforms.uBandTopY.value = 0;
        seaGlassMaterial.uniforms.uBandTopY.value = 0;
        roughGlassFaceMaterial.uniforms.uBandTopY.value = 0;
        glassMaterial.uniforms.uBandTopY.value = 0;
      }

      if (!backdropImage || !rect || !style) {
        glassBackdropTexture.needsUpdate = true;
        syncSeaGlassBlurTexture();
        return;
      }

      const x = rect.left - canvasRect.left;
      const y = rect.top - canvasRect.top;
      const clipRect = backdropClipRect ?? rect;
      const clipStyle = backdropClipRect ? backdropClipStyle : style;
      const clipX = clipRect.left - canvasRect.left;
      const clipY = clipRect.top - canvasRect.top;
      glassBackdropContext.save();
      glassBackdropContext.beginPath();
      glassBackdropContext.roundRect(
        clipX,
        clipY,
        clipRect.width,
        clipRect.height,
        Number.parseFloat(clipStyle?.borderTopLeftRadius ?? '') || 0,
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

    const syncLayout = (
      force = false,
      refreshStaticTextures = true,
    ) => {
      const canvasRect = canvas.getBoundingClientRect();
      const heroRect = hero.getBoundingClientRect();
      if (!canvasRect.width || !canvasRect.height) return false;
      const refractionBoost = window.innerWidth > 720 ? 1.16 : 1;
      gemFaceMaterial.uniforms.uRefraction.value = baseRefraction.gem * .75;
      seaGlassMaterial.uniforms.uRefraction.value = baseRefraction['sea-glass'] * refractionBoost;
      roughGlassFaceMaterial.uniforms.uRefractionStrength.value = (
        baseRefraction['rough-glass'] * refractionBoost
      );
      glassMaterial.uniforms.uRefraction.value = baseRefraction.glass * refractionBoost;
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
        motionCache?.resize(
          canvasRect.width * pixelRatio,
          canvasRect.height * pixelRatio,
        );
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

      if (refreshStaticTextures || sizeChanged) {
        syncDomRefractionTextures(canvasRect, pixelRatio, force || sizeChanged);
      }

      const rects = cardStates.map(({ element }) => (
        element.querySelector<HTMLElement>('.material-card')?.getBoundingClientRect()
      ));
      rects.forEach((rect, index) => {
        const state = cardStates[index];
        if (!rect || !state) return;
        const padding = sceneTuning.motionCachePaddingPx;
        const left = Math.max(0, Math.floor(
          (rect.left - canvasRect.left - padding) * pixelRatio,
        ));
        const top = Math.max(0, Math.floor(
          (rect.top - canvasRect.top - padding) * pixelRatio,
        ));
        const right = Math.min(
          Math.round(canvasRect.width * pixelRatio),
          Math.ceil((rect.right - canvasRect.left + padding) * pixelRatio),
        );
        const bottom = Math.min(
          Math.round(canvasRect.height * pixelRatio),
          Math.ceil((rect.bottom - canvasRect.top + padding) * pixelRatio),
        );
        motionCache?.setItemBounds(state.kind, {
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
        });
      });
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

      cardStates.forEach((state, index) => {
        const rect = rects[index];
        if (!rect) return;
        const width = rect.width * pxX;
        const height = rect.height * pxY;
        const profile = materialProfiles[state.kind];
        const depth = profile.thicknessPx * pxY;
        const radiusPx = (
          state.kind === 'sea-glass' && isSmallViewport
            ? -1
            : profile.radiusPx
        );
        const radius = radiusPx * pxY;
        const shoulderWidth = (
          state.kind === 'glass'
            ? glassTuning.shoulderWidthPx
            : glassTuning.rimWidthPx
        ) * pxY;
        const roughGlassChamfer = state.kind === 'rough-glass'
          ? getRoughGlassChamferSize(width, height, depth, radius)
          : 0;
        const geometrySignature = [
          width,
          height,
          depth,
          radius,
          shoulderWidth,
          roughGlassChamfer,
        ].join('|');
        const createGeometry = state.definition.createGeometry;
        if (!createGeometry) return;
        if (state.geometrySignature !== geometrySignature) {
          state.mesh.geometry.dispose();
          state.mesh.geometry = state.kind === 'rough-glass'
            && !isSmallViewport
            ? makeBeveledRoughGlassGeometry(
                width,
                height,
                depth,
                radius,
              )
            : createGeometry(
                width,
                height,
                depth,
                radius,
                shoulderWidth,
              );
          if (state.surface) {
            state.surface.geometry.dispose();
            state.surface.geometry = !isSmallViewport
              ? makeRoundedFaceGeometry(
                  width - roughGlassChamfer * 2,
                  height - roughGlassChamfer * 2,
                  Math.min(radius * .45, roughGlassChamfer * .35),
                )
              : makeRoundedFaceGeometry(
                  width - radius * 0.2,
                  height - roughGlassChamfer - radius * 0.2,
                  radius * 0.9,
                );
          }
          if (state.bottomSurface) {
            state.bottomSurface.geometry.dispose();
            state.bottomSurface.geometry = new PlaneGeometry(
              width - radius * .2,
              depth * .96,
            );
          }
          state.geometrySignature = geometrySignature;
        }
        const centerX = (((rect.left + rect.width / 2) - canvasRect.left) / canvasRect.width * 2 - 1) * aspect;
        const centerY = 1 - (((rect.top + rect.height / 2) - canvasRect.top) / canvasRect.height * 2);
        state.lightStartX = (rect.left - canvasRect.left) / canvasRect.width;
        state.lightEndX = (rect.right - canvasRect.left) / canvasRect.width;
        state.baseGroupY = centerY;
        state.group.position.set(
          centerX,
          centerY + state.liftPx * pxY,
          state.group.position.z,
        );
        const tilt = MathUtils.degToRad(
          state.kind === 'glass' ? glassTuning.tiltDeg : sceneTuning.baseTilt,
        );
        const yaw = MathUtils.degToRad(
          state.kind === 'glass' ? glassTuning.yawDeg : sceneTuning.baseYaw,
        );
        state.baseTiltRad = tilt;
        state.baseYawRad = yaw;
        state.group.rotation.set(
          tilt + state.tiltXRad,
          yaw + state.tiltYRad,
          MathUtils.degToRad(sceneTuning.baseRoll),
        );
        if (state.kind === 'glass') {
          const projectedWidth = width * Math.abs(Math.cos(yaw))
            + depth * Math.abs(Math.sin(yaw));
          const projectedHeight = height * Math.abs(Math.cos(tilt))
            + depth * Math.abs(Math.sin(tilt));
          state.group.scale.set(
            1.006 * width / projectedWidth,
            1.006 * height / projectedHeight,
            1,
          );
        } else {
          state.group.scale.setScalar(1.006);
        }
        state.group.position.z = 0.08;
        if (state.surface) {
          state.surface.position.set(
            0,
            isSmallViewport ? -roughGlassChamfer / 2 : 0,
            depth / 2 + 0.001,
          );
        }
        if (state.bottomSurface) {
          state.bottomSurface.position.set(0, -height / 2 + radius * .08, 0);
        }
        const isGem = state.definition.shadowProfile === 'gem';
        const simpleShadowProfile = state.definition.shadowProfile === 'rough-glass'
          && !isSmallViewport
          ? roughGlassDesktopShadowProfile
          : state.definition.shadowProfile === 'sea-glass'
            || state.definition.shadowProfile === 'rough-glass'
            ? simpleShadowProfiles[state.definition.shadowProfile]
            : undefined;
        const shadowProfile = state.definition.shadowProfile === 'glass'
          ? glassContactShadowProfile
          : simpleShadowProfile;
        const adjustableRoughGlass = (
          state.kind === 'rough-glass' && !isSmallViewport
        );
        const shadowSpread = adjustableRoughGlass
          ? roughGlassPresentation.shadowSpread
          : 1;
        const shadowDistance = adjustableRoughGlass
          ? roughGlassPresentation.shadowDistance
          : 1;
        state.shadow.scale.set(
          width * (
            isGem ? 1.28 : shadowProfile?.scale[0] ?? 1.1
          ) * shadowSpread,
          height * (
            isGem ? 1.16 : shadowProfile?.scale[1] ?? 1.06
          ) * shadowSpread,
          1,
        );
        state.baseShadowY = centerY + height * (
          isGem
            ? -.06
            : shadowProfile?.offset.yRatio
              ?? lightingTuning.shadowOffset.yRatio
        ) * shadowDistance;
        state.shadow.position.set(
          centerX + width * (
            isGem
              ? .12
              : shadowProfile?.offset.xRatio
                ?? lightingTuning.shadowOffset.xRatio
          ) * shadowDistance,
          state.baseShadowY + state.liftPx * pxY * (
            state.definition.shadowFollowsLift ? .5 : 0
          ),
          -0.65,
        );
        if (adjustableRoughGlass && !Array.isArray(state.shadow.material)) {
          state.shadow.material.opacity = roughGlassPresentation.shadowOpacity;
        }
        if (state.caustic) {
          const isGlass = state.kind === 'glass';
          const isRoughGlass = state.kind === 'rough-glass';
          state.caustic.scale.set(
            width * (
              isGem
                ? 1.26
                : isRoughGlass
                  ? 1.24 * roughGlassPresentation.projectionSpread
                : isGlass
                  ? 1.12
                  : 1.08
            ),
            height * (
              isGem
                ? 1.13
                : isRoughGlass
                  ? 1.1 * roughGlassPresentation.projectionSpread
                : isGlass
                  ? 1.065
                  : 1.04
            ),
            1,
          );
          state.baseCausticY = centerY + height * (
            isGem
              ? -.055
              : isRoughGlass
                ? -.035 * roughGlassPresentation.shadowDistance
              : isGlass
                ? glassContactShadowProfile.offset.yRatio
                : lightingTuning.causticOffset.yRatio
          );
          state.caustic.position.set(
            centerX + width * (
              isGem
                ? .115
                : isRoughGlass
                  ? .13 * roughGlassPresentation.shadowDistance
                : isGlass
                  ? glassContactShadowProfile.offset.xRatio
                  : lightingTuning.causticOffset.xRatio
            ),
            state.baseCausticY + state.liftPx * pxY * .5,
            -0.64,
          );
        }
        if (state.prism) {
          const isFrostedPrism = state.kind === 'sea-glass';
          const enhancedFrostedPrism = isFrostedPrism && !isSmallViewport;
          state.prism.scale.set(
            width * (
              enhancedFrostedPrism
                ? .82
                : isFrostedPrism
                  ? .98
                  : .78
            ),
            height * (
              enhancedFrostedPrism
                ? .52
                : isFrostedPrism
                  ? .64
                  : .48
            ),
            1,
          );
          state.basePrismY = centerY
            -height * (
              enhancedFrostedPrism
                ? .35
                : isFrostedPrism
                  ? .3
                  : .36
            )
            +(enhancedFrostedPrism ? 28 : isFrostedPrism ? 20 : 30) * pxY;
          state.prism.position.set(
            centerX+width*(
              enhancedFrostedPrism
                ? .33
                : isFrostedPrism
                  ? .24
                  : .35
            ),
            state.basePrismY + state.liftPx * pxY * .5,
            -0.63,
          );
        }
        if (state.definition.meshMaterial === 'glass') {
          glassMaterial.uniforms.uWorldCardSize.value.set(width, height);
          glassMaterial.uniforms.uThicknessPx.value = profile.thicknessPx;
        }
      });
      return true;
    };

    const applyLightPosition = (x: number, y: number) => {
      const lightPosition = new Vector3(
        x * 7.5,
        7.4 + y * 2.6,
        6,
      );
      const lightDirection3 = lightPosition.clone().normalize();
      const lightDirection2 = new Vector2(
        x,
        .76 + y * .24,
      ).normalize();
      keyLight.position.copy(lightPosition);
      gemFaceMaterial.uniforms.uLightDirection.value.copy(lightDirection3);
      seaGlassMaterial.uniforms.uLightDirection.value.copy(lightDirection2);
      roughGlassFaceMaterial.uniforms.uLightDirection.value.copy(lightDirection3);
      glassMaterial.uniforms.uLightDirection.value.copy(lightDirection2);
      cancelMotionCacheWarm?.();
      cancelMotionCacheWarm = undefined;
      motionCache?.invalidate();
    };

    const applyIntroLight = (
      position: number,
      strength: number,
      target: MaterialKind | 'all' | null,
    ) => {
      settleLightPosition = position;
      settleLightStrength = strength;
      settleLightTarget = target;
      const introLightMaterials: Array<[
        MaterialKind,
        ShaderMaterial,
        number,
      ]> = [
        ['gem', gemFaceMaterial, introLightStrengthByMaterial.gem],
        [
          'sea-glass',
          seaGlassMaterial,
          introLightStrengthByMaterial['sea-glass'],
        ],
        [
          'rough-glass',
          roughGlassFaceMaterial,
          introLightStrengthByMaterial['rough-glass'],
        ],
        ['glass', glassMaterial, introLightStrengthByMaterial.glass],
      ];
      introLightMaterials.forEach(([kind, material, materialStrength]) => {
        const isTarget = target === 'all' || target === kind;
        material.uniforms.uSettleLightPosition.value = position;
        material.uniforms.uSettleLightStrength.value = (
          isTarget ? strength * materialStrength : 0
        );
      });
      const roughGlassEdgeSettleLight = sideMaterials['rough-glass-edge']
        .userData.settleLightStrength as { value: number } | undefined;
      if (roughGlassEdgeSettleLight) {
        roughGlassEdgeSettleLight.value = (
          target === 'all' || target === 'rough-glass'
            ? strength * introLightStrengthByMaterial['rough-glass']
            : 0
        );
      }
      const roughGlassEdgeLightPosition = sideMaterials['rough-glass-edge']
        .userData.edgeLightPosition as { value: number } | undefined;
      if (roughGlassEdgeLightPosition) {
        roughGlassEdgeLightPosition.value = position;
      }
      cancelMotionCacheWarm?.();
      cancelMotionCacheWarm = undefined;
    };

    const updateSceneMotion = (now: number) => {
      const pxY = lastHeight > 0 ? 2 / lastHeight : 0;
      const frameDelta = lastMotionFrameAt > 0
        ? Math.min(48, Math.max(1, now - lastMotionFrameAt))
        : 16.67;
      lastMotionFrameAt = now;
      const easeAmount = reducedMotionQuery.matches
        ? 1
        : 1 - Math.pow(.78, frameDelta / 16.67);
      let introProgress: number | null = null;
      if (introLightStartedAt !== null) {
        introProgress = MathUtils.clamp(
          (now - introLightStartedAt) / introLightDurationMs,
          0,
          1,
        );
        if (introProgress >= 1) {
          introLightStartedAt = null;
          introLightComplete = true;
        }
      }
      const hoverLightStateForFrame = hoverLightState;
      let hoverLightProgress: number | null = null;
      if (
        hoverLightStartedAt !== null
        && hoverLightStateForFrame
      ) {
        hoverLightProgress = MathUtils.clamp(
          (now - hoverLightStartedAt) / hoverLightDurationMs,
          0,
          1,
        );
        if (hoverLightProgress >= 1) {
          hoverLightStartedAt = null;
          hoverLightState = null;
        }
      }

      const nextLightX = lightTargetX;
      const nextLightY = lightTargetY;
      lightX = MathUtils.lerp(lightX, nextLightX, easeAmount);
      lightY = MathUtils.lerp(lightY, nextLightY, easeAmount);
      if (Math.abs(lightX - nextLightX) < .002) lightX = nextLightX;
      if (Math.abs(lightY - nextLightY) < .002) lightY = nextLightY;

      const lightChanged = (
        Math.abs(keyLight.position.x - lightX * 7.5) > .002
        || Math.abs(keyLight.position.y - (7.4 + lightY * 2.6)) > .002
      );
      if (lightChanged) applyLightPosition(lightX, lightY);

      let nextSettleLightPosition = settleLightPosition;
      let nextSettleLightStrength = 0;
      let nextSettleLightTarget: MaterialKind | 'all' | null = null;
      if (introProgress !== null) {
        const easedIntroProgress = fastEndsSlowMiddle(introProgress);
        nextSettleLightPosition = MathUtils.lerp(
          .035,
          .965,
          easedIntroProgress,
        );
        const fadeIn = smoothstep(MathUtils.clamp(
          easedIntroProgress / .08,
          0,
          1,
        ));
        const fadeOut = smoothstep(MathUtils.clamp(
          (1 - easedIntroProgress) / .08,
          0,
          1,
        ));
        nextSettleLightStrength = fadeIn * fadeOut;
        nextSettleLightTarget = 'all';
      } else if (
        hoverLightProgress !== null
        && hoverLightStateForFrame
      ) {
        const easedHoverProgress = fastEndsSlowMiddle(hoverLightProgress);
        nextSettleLightPosition = MathUtils.lerp(
          hoverLightStateForFrame.lightStartX,
          hoverLightStateForFrame.lightEndX,
          easedHoverProgress,
        );
        const fadeIn = smoothstep(MathUtils.clamp(
          easedHoverProgress / .08,
          0,
          1,
        ));
        const fadeOut = smoothstep(MathUtils.clamp(
          (1 - easedHoverProgress) / .08,
          0,
          1,
        ));
        nextSettleLightStrength = fadeIn * fadeOut;
        nextSettleLightTarget = hoverLightStateForFrame.kind;
      }
      const introLightChanged = (
        Math.abs(settleLightPosition - nextSettleLightPosition) > .001
        || Math.abs(settleLightStrength - nextSettleLightStrength) > .001
        || settleLightTarget !== nextSettleLightTarget
      );
      if (introLightChanged) {
        applyIntroLight(
          nextSettleLightPosition,
          nextSettleLightStrength,
          nextSettleLightTarget,
        );
      }

      const lightAnimating = (
        Math.abs(lightX - lightTargetX) >= .002
        || Math.abs(lightY - lightTargetY) >= .002
      );
      let isAnimating = false;
      const dynamicIds = new Set<MaterialKind>();
      cardStates.forEach((state, index) => {
        if (state.liftPx !== state.liftToPx) {
          const elapsed = now - state.liftStartedAt;
          const progress = reducedMotionQuery.matches
            ? 1
            : Math.min(1, Math.max(0, elapsed / cardLiftDurationMs));
          const eased = progress * progress * (3 - 2 * progress);
          state.liftPx = MathUtils.lerp(state.liftFromPx, state.liftToPx, eased);
          if (progress < 1) {
            isAnimating = true;
          } else {
            state.liftPx = state.liftToPx;
          }
        }

        state.tiltXRad = MathUtils.lerp(
          state.tiltXRad,
          state.tiltTargetXRad,
          easeAmount,
        );
        state.tiltYRad = MathUtils.lerp(
          state.tiltYRad,
          state.tiltTargetYRad,
          easeAmount,
        );
        if (Math.abs(state.tiltXRad - state.tiltTargetXRad) < .0002) {
          state.tiltXRad = state.tiltTargetXRad;
        } else {
          isAnimating = true;
        }
        if (Math.abs(state.tiltYRad - state.tiltTargetYRad) < .0002) {
          state.tiltYRad = state.tiltTargetYRad;
        } else {
          isAnimating = true;
        }

        const liftWorld = state.liftPx * pxY;
        state.group.position.y = state.baseGroupY + liftWorld;
        state.group.rotation.set(
          state.baseTiltRad + state.tiltXRad,
          state.baseYawRad + state.tiltYRad,
          MathUtils.degToRad(sceneTuning.baseRoll),
        );
        state.shadow.position.y = state.baseShadowY + liftWorld * (
          state.definition.shadowFollowsLift ? .5 : 0
        );
        if (state.caustic) {
          state.caustic.position.y = state.baseCausticY + liftWorld * .5;
        }
        if (state.prism) {
          state.prism.position.y = state.basePrismY + liftWorld * .5;
        }
        if (
          Math.abs(state.liftPx) > .01
          || Math.abs(state.liftToPx) > .01
          || Math.abs(state.tiltXRad) > .0002
          || Math.abs(state.tiltYRad) > .0002
        ) {
          dynamicIds.add(state.kind);
        }
      });
      if (
        lightChanged
        || lightAnimating
        || activeInteractionState
        || introLightStartedAt !== null
      ) {
        cardStates.forEach(({ kind }) => dynamicIds.add(kind));
      }
      if (hoverLightStateForFrame) {
        dynamicIds.add(hoverLightStateForFrame.kind);
      }
      return {
        isAnimating: (
          isAnimating
          || lightAnimating
          || introLightStartedAt !== null
          || hoverLightStartedAt !== null
        ),
        dynamicIds,
      };
    };

    const scheduleMotionCacheWarm = () => {
      if (
        disposed
        || !isVisible
        || cancelMotionCacheWarm
        || !motionCache?.needsPreparation()
        || preparedCardKinds.size < cardStates.length
      ) {
        return;
      }

      const warm = () => {
        cancelMotionCacheWarm = undefined;
        if (
          disposed
          || !isVisible
          || dirty.has(RenderDirtyFlag.layout)
          || dirty.has(RenderDirtyFlag.cardPosition)
          || introLightStartedAt !== null
          || hoverLightStartedAt !== null
          || activeInteractionState !== null
          || cardStates.some(({ liftPx, liftToPx }) => (
            Math.abs(liftPx) > 0.01 || Math.abs(liftToPx) > 0.01
          ))
          || cardStates.some(({
            tiltXRad,
            tiltYRad,
            tiltTargetXRad,
            tiltTargetYRad,
          }) => (
            Math.abs(tiltXRad) > .0002
            || Math.abs(tiltYRad) > .0002
            || Math.abs(tiltTargetXRad) > .0002
            || Math.abs(tiltTargetYRad) > .0002
          ))
        ) {
          return;
        }
        motionCache?.prepare();
      };

      cancelMotionCacheWarm = scheduleIdleWork(warm);
    };

    renderFrame = () => {
      if (disposed || !textureReady || !isVisible || !renderer || !scene) return;
      const needsFullLayout = dirty.has(RenderDirtyFlag.layout);
      const needsCardPosition = dirty.has(RenderDirtyFlag.cardPosition);
      if (
        (needsFullLayout || needsCardPosition)
        && syncLayout(false, needsFullLayout)
      ) {
        dirty.clear(
          RenderDirtyFlag.layout
          | RenderDirtyFlag.cardPosition
          | RenderDirtyFlag.backdrop
          | RenderDirtyFlag.appearance,
        );
      }
      if (dirty.has(RenderDirtyFlag.motionCache)) {
        motionCache?.invalidate();
        dirty.clear(RenderDirtyFlag.motionCache);
      }
      const sceneMotion = updateSceneMotion(performance.now());
      const { dynamicIds } = sceneMotion;

      if (!motionCache?.render(dynamicIds)) {
        renderer.setRenderTarget(null);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        renderer.render(scene, camera);
      }
      dirty.clear(RenderDirtyFlag.transform);
      if (isSmallViewport && !mobileInitialFrameRendered) {
        mobileInitialFrameRendered = true;
        scheduleInitialUpcomingCardPreparation();
      }
      if (sceneMotion.isAnimating && renderHarness?.allowNextAnimationFrame()) {
        invalidate(RenderDirtyFlag.transform);
      }
      if (!sceneMotion.isAnimating) scheduleMotionCacheWarm();
    };

    const finishInitialization = async () => {
      const texturesReady = roughGlassTextures?.ready ?? Promise.resolve();
      await initialCardDefinitionsReady;
      if (disposed) return;
      if (!syncLayout(true)) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (disposed) return;
        if (!syncLayout(true)) {
          throw new Error('Unable to resolve material layout before shader compilation');
        }
      }
      const activeRenderer = renderer;
      const activeScene = scene;
      if (!activeRenderer || !activeScene) {
        throw new Error('Unable to initialize material renderer');
      }
      const shadersReady = activeRenderer.compileAsync(activeScene, camera);
      if (isSmallViewport) {
        void texturesReady.then(() => {
          if (!disposed) invalidate(RenderDirtyFlag.appearance);
        }).catch(() => {
          if (!disposed) canvas.dataset.rendererTextureState = 'error';
        });
        await shadersReady;
      } else {
        await Promise.all([texturesReady, shadersReady]);
      }
      if (disposed) return;
      markTextureReady();
      if (!isSmallViewport) {
        cancelMobileCardPreparation = scheduleIdleWork(() => {
          cancelMobileCardPreparation = undefined;
          void prepareCard('rough-glass');
        }, {
          timeoutMs: 2_500,
          fallbackDelayMs: 400,
        });
      }
      if (introLightAllowed && !reducedMotionQuery.matches) {
        introLightComplete = false;
        window.setTimeout(() => {
          if (
            disposed
            || reducedMotionQuery.matches
            || !introLightAllowed
          ) {
            return;
          }
          introLightStartedAt = performance.now();
          requestMotionFrame();
        }, introLightDelayMs);
      }
    };
    void finishInitialization().catch((error) => {
      if (!disposed) failInitialization(error);
    });

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
      if (isVisible) {
        syncMobileScrollLight();
        invalidate();
      }
    });
    intersectionObserver.observe(cases);

    import.meta.hot?.dispose(cleanup);
  } catch (error) {
    failInitialization(error);
  }
}
