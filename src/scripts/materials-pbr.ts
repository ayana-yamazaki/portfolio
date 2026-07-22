import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { materialProfiles, sceneTuning, type MaterialKind } from './materials/config';
import {
  createBodyMaterials,
  createGlassMaterial,
  createPaperFaceMaterial,
  createResinFaceMaterial,
  createStoneFaceMaterial,
} from './materials/factories';
import { makePanelGeometry, makeRoundedFaceGeometry } from './materials/geometry';
import {
  makeNoiseTexture,
  makePaperAlbedoTexture,
  makeRoundedMaskTexture,
  makeShadowTexture,
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
  shadowBaseY: number;
  hover: number;
  hoverTarget: number;
};

const canvas = document.querySelector<ManagedCanvas>('[data-materials-pbr]');
const cases = canvas?.closest<HTMLElement>('.home-hero__cases');

if (canvas && cases) {
  canvas.materialsPbrCleanup?.();
  canvas.hidden = false;
  canvas.dataset.rendererState = 'initializing';
  delete canvas.dataset.rendererError;

  let disposed = false;
  let frameId: number | null = null;
  let renderer: THREE.WebGLRenderer | undefined;
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
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
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

    scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
    camera.position.set(0, 0, 6);

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
    let renderFrame = () => {};

    const invalidate = () => {
      if (disposed || !textureReady || !isVisible || frameId !== null) return;
      frameId = requestAnimationFrame(() => renderFrame());
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
    const paperAlbedo = makePaperAlbedoTexture();
    const roundedMask = makeRoundedMaskTexture();
    const shadowMap = makeShadowTexture();
    [stoneMap, paperBump, stoneBump, paperAlbedo, roundedMask, shadowMap]
      .forEach((texture) => trackedTextures.add(texture));

    const refractionSources = Array.from(
      document.querySelectorAll<HTMLElement>('[data-glass-refraction-source]'),
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
    const resinFaceMaterial = createResinFaceMaterial();
    const bodyMaterials = createBodyMaterials(paperBump, stoneBump);
    const stoneFaceMaterial = createStoneFaceMaterial(stoneMap, stoneBump);

    const cardElements = Array.from(cases.querySelectorAll<HTMLElement>('[data-material]'));
    cardElements.forEach((element) => {
      const kind = element.dataset.material as MaterialKind;
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.BufferGeometry(),
        kind === 'glass' ? glassMaterial : bodyMaterials[kind],
      );
      group.add(mesh);

      let surface: THREE.Mesh | undefined;
      if (kind === 'stone') {
        surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), stoneFaceMaterial);
      } else if (kind === 'paper') {
        surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 32, 48), paperFaceMaterial);
      } else if (kind === 'resin') {
        surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), resinFaceMaterial);
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
      scene?.add(shadow, group);

      const state: CardState = {
        element,
        kind,
        group,
        mesh,
        surface,
        shadow,
        shadowBaseY: 0.1,
        hover: 0,
        hoverTarget: 0,
      };
      const setHover = (hoverTarget: number) => {
        state.hoverTarget = hoverTarget;
        invalidate();
      };
      element.addEventListener('pointerenter', () => setHover(1), { signal: eventController.signal });
      element.addEventListener('pointerleave', () => setHover(0), { signal: eventController.signal });
      element.addEventListener('focusin', () => setHover(1), { signal: eventController.signal });
      element.addEventListener('focusout', () => setHover(0), { signal: eventController.signal });
      cardStates.push(state);
    });

    const readTextLines = (element: HTMLElement) => {
      const lines = [''];
      element.childNodes.forEach((node) => {
        if (node.nodeName === 'BR') lines.push('');
        else lines[lines.length - 1] += node.textContent ?? '';
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
          lines.join('\n'),
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
        domRefractionContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
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
        lines.forEach((line, lineIndex) => {
          domRefractionContext.fillText(line, x, y + lineIndex * lineHeight);
        });
      });
      domRefractionContext.globalAlpha = 1;
      domRefractionTexture.needsUpdate = true;
    };

    const syncLayout = (force = false) => {
      const canvasRect = canvas.getBoundingClientRect();
      if (!canvasRect.width || !canvasRect.height) return false;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, sceneTuning.maxPixelRatio);
      const sizeChanged = force
        || canvasRect.width !== lastWidth
        || canvasRect.height !== lastHeight
        || pixelRatio !== lastPixelRatio;
      if (sizeChanged) {
        renderer?.setPixelRatio(pixelRatio);
        renderer?.setSize(canvasRect.width, canvasRect.height, false);
        const aspect = canvasRect.width / canvasRect.height;
        camera.left = -aspect;
        camera.right = aspect;
        camera.top = 1;
        camera.bottom = -1;
        camera.updateProjectionMatrix();
        glassMaterial.uniforms.uCanvasSize.value.set(canvasRect.width, canvasRect.height);
        resinFaceMaterial.uniforms.uCanvasSize.value.set(canvasRect.width, canvasRect.height);
        lastWidth = canvasRect.width;
        lastHeight = canvasRect.height;
        lastPixelRatio = pixelRatio;
      }

      syncDomRefractionTexture(canvasRect, pixelRatio, force || sizeChanged);

      const rects = cardStates.map(({ element }) => (
        element.querySelector<HTMLElement>('.material-card')?.getBoundingClientRect()
      ));
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
          0,
        );
        if (state.surface) {
          state.surface.geometry.dispose();
          if (state.kind === 'stone') {
            state.surface.geometry = makeRoundedFaceGeometry(width - radius * 0.2, height - radius * 0.2, radius * 0.9);
          } else if (state.kind === 'paper') {
            state.surface.geometry = new THREE.PlaneGeometry(width - radius * 0.14, height - radius * 0.14, 32, 48);
          } else {
            state.surface.geometry = new THREE.PlaneGeometry(width - radius * 0.14, height - radius * 0.14);
          }
          state.surface.position.set(0, 0, depth / 2 + depth * 0.25 + 0.001);
        }
        state.shadowBaseY = Math.max(depth * 4.5, 0.11);
        state.shadow.scale.set(
          width * 1.08,
          state.shadowBaseY * THREE.MathUtils.lerp(1.08, 0.82, state.hover),
          1,
        );
        state.shadow.position.set(centerX + depth * 0.7, centerY - height / 2 - depth * 0.8, -0.65);
        if (state.kind === 'glass') {
          glassMaterial.uniforms.uBounds.value.set(
            (rect.left - canvasRect.left) / canvasRect.width,
            1 - ((rect.bottom - canvasRect.top) / canvasRect.height),
            (rect.right - canvasRect.left) / canvasRect.width,
            1 - ((rect.top - canvasRect.top) / canvasRect.height),
          );
          glassMaterial.uniforms.uCardSize.value.set(rect.width, rect.height);
          glassMaterial.uniforms.uRadius.value = radiusPx;
        }
      });
      return true;
    };

    renderFrame = () => {
      frameId = null;
      if (disposed || !textureReady || !isVisible || !renderer || !scene) return;
      if (layoutDirty) layoutDirty = !syncLayout();

      let animationActive = false;
      cardStates.forEach((state) => {
        const hoverDelta = state.hoverTarget - state.hover;
        if (Math.abs(hoverDelta) < 0.001) state.hover = state.hoverTarget;
        else {
          state.hover += hoverDelta * 0.09;
          animationActive = true;
        }
        state.group.rotation.x = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(
          sceneTuning.baseTilt,
          sceneTuning.hoverTilt,
          state.hover,
        ));
        state.group.rotation.y = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(
          sceneTuning.baseYaw,
          sceneTuning.hoverYaw,
          state.hover,
        ));
        state.group.scale.setScalar(THREE.MathUtils.lerp(1.006, 0.994, state.hover));
        state.group.position.z = THREE.MathUtils.lerp(0.08, 0.015, state.hover);
        const shadowMaterial = state.shadow.material as THREE.MeshBasicMaterial;
        shadowMaterial.opacity = THREE.MathUtils.lerp(0.28, 0.42, state.hover);
        const targetShadowScale = state.shadowBaseY * THREE.MathUtils.lerp(1.08, 0.82, state.hover);
        const shadowDelta = targetShadowScale - state.shadow.scale.y;
        if (Math.abs(shadowDelta) < 0.0001) state.shadow.scale.y = targetShadowScale;
        else {
          state.shadow.scale.y += shadowDelta * 0.09;
          animationActive = true;
        }
      });

      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      if (animationActive) invalidate();
    };

    resizeObserver = new ResizeObserver(markLayoutDirty);
    resizeObserver.observe(canvas);
    resizeObserver.observe(cases);
    cardStates.forEach(({ element }) => {
      const card = element.querySelector<HTMLElement>('.material-card');
      if (card) resizeObserver?.observe(card);
    });
    refractionSources.forEach((source) => resizeObserver?.observe(source));

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
