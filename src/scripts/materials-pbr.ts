import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { materialProfiles, sceneTuning, type MaterialKind } from './materials/config';
import {
  createBodyMaterials,
  createGlassMaterial,
  createPaperFaceMaterial,
  createResinFaceMaterial,
  createSideMaterials,
  createStoneFaceMaterial,
} from './materials/factories';
import { makePanelGeometry, makeRoundedFaceGeometry } from './materials/geometry';
import { createRenderHarness, type RenderHarness } from './materials/render-harness';
import {
  makeCastGlassBumpTexture,
  makeCastGlassCausticTexture,
  makeNoiseTexture,
  makePaperAlbedoTexture,
  makeRoundedMaskTexture,
  makeShadowTexture,
  makeStoneSideTexture,
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
  shadowBaseY: number;
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
    const cameraFov = 10;
    const cameraDistance = 1 / Math.tan(THREE.MathUtils.degToRad(cameraFov / 2));
    const camera = new THREE.PerspectiveCamera(cameraFov, 1, 0.1, 20);
    camera.position.set(0, 0, cameraDistance);

    const pmrem = new THREE.PMREMGenerator(renderer);
    environmentTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = environmentTarget.texture;
    pmrem.dispose();

    scene.add(new THREE.HemisphereLight(0xfffcf5, 0x514d48, sceneTuning.hemisphereIntensity));
    const keyLight = new THREE.DirectionalLight(0xfff2da, sceneTuning.keyIntensity);
    keyLight.position.set(-8, 9, 4.2);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xc8dcff, sceneTuning.fillIntensity);
    fillLight.position.set(6, -1, 3);
    scene.add(fillLight);

    let textureReady = false;
    let isVisible = true;
    let layoutDirty = true;
    let lastWidth = 0;
    let lastHeight = 0;
    let lastPixelRatio = 0;
    let lastSignature = '';
    let lastDomSignature = '';
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

    const textureLoader = new THREE.TextureLoader();
    const stoneMap = textureLoader.load(
      canvas.dataset.stoneSrc ?? '',
      markTextureReady,
      undefined,
      markTextureReady,
    );
    stoneMap.colorSpace = THREE.SRGBColorSpace;
    stoneMap.minFilter = THREE.LinearMipmapLinearFilter;
    stoneMap.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const paperBump = makeNoiseTexture('paper');
    const stoneBump = makeNoiseTexture('stone');
    const castGlassBump = makeCastGlassBumpTexture();
    const castGlassCaustic = makeCastGlassCausticTexture();
    const paperAlbedo = makePaperAlbedoTexture();
    const stoneSideTexture = makeStoneSideTexture();
    const roundedMask = makeRoundedMaskTexture();
    const shadowMap = makeShadowTexture();
    [stoneMap, paperBump, stoneBump, castGlassBump, castGlassCaustic, paperAlbedo, stoneSideTexture, roundedMask, shadowMap]
      .forEach((texture) => trackedTextures.add(texture));

    const refractionSources = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-glass-refraction-source], [data-resin-refraction-source], [data-glass-title-refraction-source]',
      ),
    );
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

    const glassMaterial = createGlassMaterial(domRefractionTexture);
    const paperFaceMaterial = createPaperFaceMaterial(paperAlbedo, paperBump, roundedMask);
    const resinFaceMaterial = createResinFaceMaterial(castGlassBump, domRefractionTexture);
    const bodyMaterials = createBodyMaterials(paperBump, stoneBump);
    const sideMaterials = createSideMaterials(stoneSideTexture);
    const stoneFaceMaterial = createStoneFaceMaterial(stoneMap);
    const glassHiddenFaceMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
    });

    const cardElements = Array.from(cases.querySelectorAll<HTMLElement>('[data-material]'));
    cardElements.forEach((element) => {
      const kind = element.dataset.material as MaterialKind;
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.BufferGeometry(),
        kind === 'glass'
          ? [glassHiddenFaceMaterial, sideMaterials.glass]
          : [bodyMaterials[kind], sideMaterials[kind]],
      );
      group.add(mesh);

      let surface: THREE.Mesh | undefined;
      if (kind === 'stone') {
        surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), stoneFaceMaterial);
        surface.renderOrder = 10;
      } else if (kind === 'paper') {
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
          map: shadowMap,
          transparent: true,
          opacity: 0.34,
          depthWrite: false,
        }),
      );
      shadow.position.z = -0.5;
      const caustic = kind === 'resin'
        ? new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            map: castGlassCaustic,
            transparent: true,
            opacity: 0.78,
            depthWrite: false,
          }),
        )
        : undefined;
      if (caustic) caustic.position.z = -0.49;
      scene?.add(shadow, group);
      if (caustic) scene?.add(caustic);

      const state: CardState = {
        element,
        kind,
        group,
        mesh,
        surface,
        shadow,
        caustic,
        shadowBaseY: 0.1,
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

    const syncDomRefractionTexture = (
      canvasRect: DOMRect,
      pixelRatio: number,
      force = false,
    ) => {
      const sourceData = refractionSources.map((element) => {
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
      if (!force && signature === lastDomSignature) return;
      lastDomSignature = signature;

      const textureWidth = Math.max(1, Math.round(canvasRect.width * pixelRatio));
      const textureHeight = Math.max(1, Math.round(canvasRect.height * pixelRatio));
      if (domRefractionCanvas.width !== textureWidth || domRefractionCanvas.height !== textureHeight) {
        domRefractionCanvas.width = textureWidth;
        domRefractionCanvas.height = textureHeight;
      }
      domRefractionContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      domRefractionContext.clearRect(0, 0, canvasRect.width, canvasRect.height);

      sourceData.forEach(({ rect, style, lines }) => {
        const fontSize = Number.parseFloat(style.fontSize) || 16;
        const parsedLineHeight = Number.parseFloat(style.lineHeight);
        const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.2;
        domRefractionContext.fillStyle = style.color;
        const parsedOpacity = Number.parseFloat(style.opacity);
        domRefractionContext.globalAlpha = Number.isFinite(parsedOpacity) ? parsedOpacity : 1;
        domRefractionContext.textBaseline = 'top';
        domRefractionContext.textAlign = style.textAlign as CanvasTextAlign;
        const contextWithSpacing = domRefractionContext as CanvasRenderingContext2D & {
          letterSpacing?: string;
        };
        if ('letterSpacing' in contextWithSpacing) contextWithSpacing.letterSpacing = style.letterSpacing;

        let x = rect.left - canvasRect.left;
        if (style.textAlign === 'right' || style.textAlign === 'end') x = rect.right - canvasRect.left;
        if (style.textAlign === 'center') x = rect.left - canvasRect.left + rect.width / 2;
        const y = rect.top - canvasRect.top + (lineHeight - fontSize) / 2;
        lines.forEach(({ text, fontWeight: lineFontWeight }, lineIndex) => {
          const fontWeight = lineFontWeight ?? style.fontWeight;
          domRefractionContext.font = `${style.fontStyle} ${fontWeight} ${style.fontSize} ${style.fontFamily}`;
          domRefractionContext.fillText(text, x, y + lineIndex * lineHeight);
        });
      });
      domRefractionContext.globalAlpha = 1;
      domRefractionTexture.needsUpdate = true;
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
        lastWidth = canvasRect.width;
        lastHeight = canvasRect.height;
        lastPixelRatio = pixelRatio;
      }

      syncDomRefractionTexture(canvasRect, pixelRatio, force || sizeChanged);

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
      const stoneIndex = cardStates.findIndex(({ kind }) => kind === 'stone');
      const referenceRect = rects[stoneIndex] ?? rects[0];
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
        state.mesh.geometry = makePanelGeometry(width, height, depth, radius);
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
          if (state.kind === 'stone') {
            state.surface.geometry = makeRoundedFaceGeometry(width - radius * 0.2, height - radius * 0.2, radius * 0.9);
          } else if (state.kind === 'paper') {
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
            state.kind === 'stone' || state.kind === 'resin' || state.kind === 'glass'
              ? depth / 2 + 0.001
              : depth / 2 + depth * 0.25 + 0.001,
          );
        }
        state.shadowBaseY = Math.max(depth * 7, 0.16);
        state.shadow.scale.set(
          -width * 1.25,
          state.shadowBaseY * 1.08,
          1,
        );
        state.shadow.position.set(
          centerX + width * 0.09,
          centerY - height / 2 - state.shadowBaseY * 0.48,
          -0.65,
        );
        if (state.caustic) {
          state.caustic.scale.copy(state.shadow.scale);
          state.caustic.position.set(
            state.shadow.position.x,
            state.shadow.position.y,
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

    resizeObserver = new ResizeObserver(markLayoutDirty);
    resizeObserver.observe(canvas);
    resizeObserver.observe(cases);
    cardStates.forEach(({ element }) => {
      const card = element.querySelector<HTMLElement>('.material-card');
      if (card) resizeObserver?.observe(card);
    });
    refractionSources.forEach((source) => resizeObserver?.observe(source));
    document.fonts?.ready.then(() => {
      if (disposed) return;
      lastDomSignature = '';
      markLayoutDirty();
    });

    mutationObserver = new MutationObserver(markLayoutDirty);
    refractionSources.forEach((source) => mutationObserver?.observe(source, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    }));

    window.addEventListener('resize', markLayoutDirty, {
      passive: true,
      signal: eventController.signal,
    });
    document.fonts?.ready.then(() => {
      if (disposed) return;
      lastDomSignature = '';
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
