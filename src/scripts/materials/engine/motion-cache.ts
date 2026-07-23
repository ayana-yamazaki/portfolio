import * as THREE from 'three';

export type MotionCacheItem = {
  id: string;
  renderables: THREE.Object3D[];
};

type MotionCacheOptions = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  items: MotionCacheItem[];
};

export const createMotionCache = ({
  renderer,
  scene,
  camera,
  items,
}: MotionCacheOptions) => {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  target.texture.generateMipmaps = false;
  target.samples = 4;

  const compositeScene = new THREE.Scene();
  const compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  compositeCamera.position.z = 1;
  const compositeGeometry = new THREE.PlaneGeometry(2, 2);
  const compositeMaterial = new THREE.MeshBasicMaterial({
    map: target.texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const composite = new THREE.Mesh(compositeGeometry, compositeMaterial);
  composite.frustumCulled = false;
  compositeScene.add(composite);

  let cacheDirty = true;
  let dynamicSignature = '';

  const setVisibility = (visibleIds?: Set<string>) => {
    items.forEach((item) => {
      const visible = visibleIds ? visibleIds.has(item.id) : true;
      item.renderables.forEach((object) => {
        object.visible = visible;
      });
    });
  };

  const resize = (width: number, height: number) => {
    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));
    if (target.width === nextWidth && target.height === nextHeight) return;
    target.setSize(nextWidth, nextHeight);
    cacheDirty = true;
  };

  const invalidate = () => {
    cacheDirty = true;
  };

  const renderStaticCards = (dynamicIds: Set<string>) => {
    const staticIds = new Set(
      items
        .filter(({ id }) => !dynamicIds.has(id))
        .map(({ id }) => id),
    );
    setVisibility(staticIds);
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    setVisibility();
    renderer.setRenderTarget(null);
    cacheDirty = false;
  };

  const render = (dynamicIds: Set<string>) => {
    if (dynamicIds.size === 0) return false;
    const nextSignature = [...dynamicIds].sort().join('|');
    if (nextSignature !== dynamicSignature) {
      dynamicSignature = nextSignature;
      cacheDirty = true;
    }
    if (cacheDirty) renderStaticCards(dynamicIds);

    const previousAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(compositeScene, compositeCamera);
    renderer.clearDepth();
    setVisibility(dynamicIds);
    renderer.render(scene, camera);
    setVisibility();
    renderer.autoClear = previousAutoClear;
    return true;
  };

  const reset = () => {
    dynamicSignature = '';
    cacheDirty = true;
    setVisibility();
  };

  const dispose = () => {
    setVisibility();
    target.dispose();
    compositeGeometry.dispose();
    compositeMaterial.dispose();
    compositeScene.clear();
  };

  return {
    resize,
    invalidate,
    render,
    reset,
    dispose,
  };
};

export type MotionCache = ReturnType<typeof createMotionCache>;
