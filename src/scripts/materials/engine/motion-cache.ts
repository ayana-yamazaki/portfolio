import * as THREE from 'three';

export type MotionCacheItem = {
  id: string;
  renderables: THREE.Object3D[];
  cacheable?: boolean;
};

type MotionCacheBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MotionCacheOptions = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  items: MotionCacheItem[];
  samples?: number;
};

type CachedLayer = {
  texture: THREE.FramebufferTexture;
  material: THREE.MeshBasicMaterial;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
};

export const createMotionCache = ({
  renderer,
  scene,
  camera,
  items,
  samples = 2,
}: MotionCacheOptions) => {
  const compositeScene = new THREE.Scene();
  const compositeCamera = new THREE.OrthographicCamera(0, 1, 1, 0, 0, 2);
  compositeCamera.position.z = 1;

  const cachedItems = items.filter(({ cacheable }) => cacheable !== false);
  const alwaysLiveIds = new Set(
    items
      .filter(({ cacheable }) => cacheable === false)
      .map(({ id }) => id),
  );
  const itemBounds = new Map<string, MotionCacheBounds>();
  const layers = new Map<string, CachedLayer>();
  let width = 1;
  let height = 1;
  let cacheDirty = true;
  let cacheReady = false;

  const setVisibility = (visibleIds: Set<string>) => {
    items.forEach((item) => {
      const visible = visibleIds.has(item.id);
      item.renderables.forEach((object) => {
        object.visible = visible;
      });
    });
  };

  const showAllItems = () => {
    items.forEach((item) => {
      item.renderables.forEach((object) => {
        object.visible = true;
      });
    });
  };

  const disposeLayers = () => {
    layers.forEach(({ texture, material, mesh }) => {
      compositeScene.remove(mesh);
      mesh.geometry.dispose();
      texture.dispose();
      material.dispose();
    });
    layers.clear();
  };

  const markDirty = () => {
    cacheDirty = true;
    cacheReady = false;
    disposeLayers();
  };

  const resize = (nextWidth: number, nextHeight: number) => {
    const resolvedWidth = Math.max(1, Math.round(nextWidth));
    const resolvedHeight = Math.max(1, Math.round(nextHeight));
    if (width === resolvedWidth && height === resolvedHeight) return;
    width = resolvedWidth;
    height = resolvedHeight;
    compositeCamera.right = width;
    compositeCamera.top = height;
    compositeCamera.updateProjectionMatrix();
    markDirty();
  };

  const setItemBounds = (id: string, bounds: MotionCacheBounds) => {
    const nextBounds = {
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(1, Math.round(bounds.width)),
      height: Math.max(1, Math.round(bounds.height)),
    };
    const previous = itemBounds.get(id);
    if (
      previous
      && previous.x === nextBounds.x
      && previous.y === nextBounds.y
      && previous.width === nextBounds.width
      && previous.height === nextBounds.height
    ) {
      return;
    }
    itemBounds.set(id, nextBounds);
    markDirty();
  };

  const invalidate = () => {
    markDirty();
  };

  const createLayer = (
    id: string,
    bounds: MotionCacheBounds,
    scratchTexture: THREE.Texture,
  ) => {
    const texture = new THREE.FramebufferTexture(bounds.width, bounds.height);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.flipY = false;

    const sourceBottom = height - bounds.y - bounds.height;
    const sourceRegion = new THREE.Box2(
      new THREE.Vector2(bounds.x, sourceBottom),
      new THREE.Vector2(bounds.x + bounds.width, sourceBottom + bounds.height),
    );
    renderer.copyTextureToTexture(
      scratchTexture,
      texture,
      sourceRegion,
      new THREE.Vector2(0, 0),
    );

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(bounds.width, bounds.height),
      material,
    );
    mesh.position.set(
      bounds.x + bounds.width / 2,
      height - bounds.y - bounds.height / 2,
      0,
    );
    mesh.frustumCulled = false;
    compositeScene.add(mesh);
    layers.set(id, { texture, material, mesh });
  };

  const prepare = () => {
    if (!cacheDirty && cacheReady) return true;
    if (cachedItems.some(({ id }) => !itemBounds.has(id))) return false;

    disposeLayers();
    const scratch = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    scratch.texture.colorSpace = THREE.SRGBColorSpace;
    scratch.texture.generateMipmaps = false;
    scratch.samples = Math.min(samples, renderer.capabilities.maxSamples);

    const previousTarget = renderer.getRenderTarget();
    const previousViewport = renderer.getViewport(new THREE.Vector4());
    const previousScissor = renderer.getScissor(new THREE.Vector4());
    const previousScissorTest = renderer.getScissorTest();
    const previousClearColor = renderer.getClearColor(new THREE.Color()).clone();
    const previousClearAlpha = renderer.getClearAlpha();
    const previousAutoClear = renderer.autoClear;

    try {
      renderer.autoClear = false;
      renderer.setRenderTarget(scratch);

      cachedItems.forEach((item) => {
        const bounds = itemBounds.get(item.id);
        if (!bounds) return;
        setVisibility(new Set([item.id]));
        renderer.setRenderTarget(scratch);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        createLayer(item.id, bounds, scratch.texture);
      });

      cacheDirty = false;
      cacheReady = layers.size === cachedItems.length;
      return cacheReady;
    } finally {
      showAllItems();
      renderer.setRenderTarget(previousTarget);
      renderer.setViewport(previousViewport);
      renderer.setScissor(previousScissor);
      renderer.setScissorTest(previousScissorTest);
      renderer.setClearColor(previousClearColor, previousClearAlpha);
      renderer.autoClear = previousAutoClear;
      scratch.dispose();
    }
  };

  const render = (dynamicIds: Set<string>) => {
    if (dynamicIds.size === 0 || !cacheReady) return false;

    const liveIds = new Set([...alwaysLiveIds, ...dynamicIds]);
    layers.forEach(({ mesh }, id) => {
      mesh.visible = !liveIds.has(id);
    });

    const previousAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(compositeScene, compositeCamera);
    renderer.clearDepth();
    setVisibility(liveIds);
    renderer.render(scene, camera);
    showAllItems();
    renderer.autoClear = previousAutoClear;
    return true;
  };

  const reset = () => {
    markDirty();
    showAllItems();
  };

  const dispose = () => {
    showAllItems();
    disposeLayers();
    compositeScene.clear();
  };

  return {
    resize,
    setItemBounds,
    invalidate,
    needsPreparation: () => cacheDirty || !cacheReady,
    prepare,
    render,
    reset,
    dispose,
  };
};

export type MotionCache = ReturnType<typeof createMotionCache>;
