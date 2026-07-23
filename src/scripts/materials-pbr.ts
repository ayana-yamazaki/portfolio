import * as THREE from 'three';
import {
  lightingTuning,
  materialProfiles,
  sceneTuning,
  type MaterialKind,
} from './materials/config';
import {
  createBodyMaterials,
  createGemFaceMaterial,
  createGlassMaterial,
  createSeaGlassMaterial,
  createPaperFaceMaterial,
  createResinFaceMaterial,
  createSideMaterials,
} from './materials/factories';
import {
  makeGemGeometry,
  makePanelGeometry,
  makeRoundedFaceGeometry,
  makeSeaGlassGeometry,
} from './materials/geometry';
import { createRenderHarness, type RenderHarness } from './materials/render-harness';
import {
  makeCastGlassBumpTexture,
  makeCastGlassCausticTexture,
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
  shadow: THREE.Mesh;
  caustic?: THREE.Mesh;
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
    const castGlassBump = makeCastGlassBumpTexture();
    const castGlassCaustic = makeCastGlassCausticTexture();
    const paperAlbedo = makePaperAlbedoTexture();
    const roundedMask = makeRoundedMaskTexture();
    [paperBump, castGlassBump, castGlassCaustic, paperAlbedo, roundedMask]
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
        '[data-glass-refraction-source], [data-resin-refraction-source]',
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
      seaGlassBlurContext.filter = 'blur(7px)';
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
    const resinFaceMaterial = createResinFaceMaterial(
      castGlassBump,
      glassBackdropTexture,
      domRefractionTexture,
    );
    const bodyMaterials = createBodyMaterials(paperBump);
    const sideMaterials = createSideMaterials(gemFaceMaterial);
    const hiddenFaceMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
    });

    const cardElements = Array.from(cases.querySelectorAll<HTMLElement>('[data-material]'));
    cardElements.forEach((element) => {
      const kind = element.dataset.material as MaterialKind;
      const group = new THREE.Group();
      const faceMaterial = kind === 'gem'
        ? gemFaceMaterial
        : kind === 'glass' || kind === 'sea-glass'
          ? hiddenFaceMaterial
          : bodyMaterials[kind];
      const mesh = new THREE.Mesh(
        new THREE.BufferGeometry(),
        kind === 'sea-glass'
          ? seaGlassMaterial
          : [faceMaterial, sideMaterials[kind]],
      );
      group.add(mesh);

      let surface: THREE.Mesh | undefined;
      if (kind === 'paper') {
        surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 32, 48), paperFaceMaterial);
      } else if (kind === 'resin') {
        surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), resinFaceMaterial);
      } else if (kind === 'glass') {
        surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glassMaterial);
      }
      if (surface) group.add(surface);

      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: getShadowMap(kind),
          transparent: true,
          opacity: 1,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      shadow.position.z = -0.5;
      const caustic = kind === 'resin'
        ? new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            map: castGlassCaustic,
            color: 0xffffff,
            transparent: true,
            opacity: 0.78,
            depthWrite: false,
          }),
        )
        : undefined;
      if (caustic) caustic.position.z = -0.49;
      scene?.add(shadow);
      scene?.add(group);
      if (caustic) scene?.add(caustic);

      const state: CardState = {
        element,
        kind,
        group,
        mesh,
        surface,
        shadow,
        caustic,
      };
      cardStates.push(state);
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
      resinFaceMaterial.uniforms.uFloorY.value = floorScreenY;
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
      const referenceRect = rects[0];
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
            : makePanelGeometry(width, height, depth, radius);
        const centerX = (((rect.left + rect.width / 2) - canvasRect.left) / canvasRect.width * 2 - 1) * aspect;
        const centerY = 1 - (((rect.top + rect.height / 2) - canvasRect.top) / canvasRect.height * 2);
        state.group.position.set(centerX, centerY, state.group.position.z);
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
          } else if (state.kind === 'glass') {
            state.surface.geometry = makeRoundedFaceGeometry(
              width - radius * 0.2,
              height - radius * 0.2,
              radius * 0.9,
            );
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
            state.kind === 'resin' || state.kind === 'glass'
              ? depth / 2 + 0.001
              : depth / 2 + depth * 0.25 + 0.001,
          );
        }
        state.shadow.scale.set(
          width * 1.1,
          height * 1.06,
          1,
        );
        state.shadow.position.set(
          centerX + width * lightingTuning.shadowOffset.xRatio,
          centerY + height * lightingTuning.shadowOffset.yRatio,
          -0.65,
        );
        if (state.caustic) {
          state.caustic.scale.set(
            width * 1.08,
            height * 1.04,
            1,
          );
          state.caustic.position.set(
            centerX + width * lightingTuning.causticOffset.xRatio,
            centerY + height * lightingTuning.causticOffset.yRatio,
            -0.64,
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

    renderFrame = () => {
      if (disposed || !textureReady || !isVisible || !renderer || !scene) return;
      if (layoutDirty) layoutDirty = !syncLayout();

      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
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
