import {
  Box2,
  Color,
  FramebufferTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  Scene,
  UnsignedByteType,
  Vector2,
  Vector4,
  WebGLRenderTarget,
  type Camera,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from 'three';

export type MotionCacheItem = {
  id: string;
  renderables: Object3D[];
  cacheable?: boolean;
};

type MotionCacheBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MotionCacheOptions = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: Camera;
  items: MotionCacheItem[];
  samples?: number;
};

type CachedLayer = {
  texture: FramebufferTexture;
  material: MeshBasicMaterial;
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
};

export const createMotionCache = ({
  renderer,
  scene,
  camera,
  items,
  samples = 2,
}: MotionCacheOptions) => {
  const compositeScene = new Scene();
  const compositeCamera = new OrthographicCamera(0, 1, 1, 0, 0, 2);
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
    scratchTexture: Texture,
  ) => {
    const texture = new FramebufferTexture(bounds.width, bounds.height);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.flipY = false;

    const sourceBottom = height - bounds.y - bounds.height;
    const sourceRegion = new Box2(
      new Vector2(bounds.x, sourceBottom),
      new Vector2(bounds.x + bounds.width, sourceBottom + bounds.height),
    );
    renderer.copyTextureToTexture(
      scratchTexture,
      texture,
      sourceRegion,
      new Vector2(0, 0),
    );

    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new Mesh(
      new PlaneGeometry(bounds.width, bounds.height),
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
    const scratch = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      type: UnsignedByteType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    scratch.texture.colorSpace = SRGBColorSpace;
    scratch.texture.generateMipmaps = false;
    scratch.samples = Math.min(samples, renderer.capabilities.maxSamples);

    const previousTarget = renderer.getRenderTarget();
    const previousViewport = renderer.getViewport(new Vector4());
    const previousScissor = renderer.getScissor(new Vector4());
    const previousScissorTest = renderer.getScissorTest();
    const previousClearColor = renderer.getClearColor(new Color()).clone();
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
