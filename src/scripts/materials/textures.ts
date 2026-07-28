import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three';
import gemCausticUrl from '../../assets/materials/gem-floor-caustic.png?url';
import gemPrismUrl from '../../assets/materials/gem-prism.png?url';
import gemShadowUrl from '../../assets/materials/shadow-gem.png?url';
import glassShadowUrl from '../../assets/materials/shadow-glass.png?url';
import roughGlassBumpUrl from '../../assets/materials/rough-glass-bump.png?url';
import roughGlassShadowUrl from '../../assets/materials/shadow-rough-glass.png?url';
import seaGlassPrismDesktopUrl from '../../assets/materials/sea-glass-prism-desktop.png?url';
import seaGlassPrismMobileUrl from '../../assets/materials/sea-glass-prism-mobile.png?url';
import seaGlassShadowUrl from '../../assets/materials/shadow-sea-glass.png?url';
import type { MaterialKind } from './config';

const staticTextureLoader = new TextureLoader();

const loadStaticTexture = (
  url: string,
  configure: (texture: Texture) => void,
) => {
  let texture!: Texture;
  const ready = new Promise<Texture>((resolve, reject) => {
    texture = staticTextureLoader.load(url, resolve, undefined, reject);
  });
  configure(texture);
  return { texture, ready };
};

const configureMaterialTexture = (texture: Texture) => {
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
};

export const loadRoughGlassTextures = () => {
  const bump = loadStaticTexture(roughGlassBumpUrl, (texture) => {
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.anisotropy = 2;
  });
  return {
    bump: bump.texture,
    ready: bump.ready.then(() => undefined),
  };
};

export const loadBakedMaterialTextures = (enhancedSeaGlass: boolean) => {
  const shadowSources: Record<MaterialKind, string> = {
    gem: gemShadowUrl,
    'sea-glass': seaGlassShadowUrl,
    'rough-glass': roughGlassShadowUrl,
    glass: glassShadowUrl,
  };
  const shadowLoads = Object.fromEntries(
    Object.entries(shadowSources).map(([kind, url]) => [
      kind,
      loadStaticTexture(url, (texture) => {
        configureMaterialTexture(texture);
        if (kind === 'glass') texture.colorSpace = SRGBColorSpace;
      }),
    ]),
  ) as Record<
    MaterialKind,
    ReturnType<typeof loadStaticTexture>
  >;
  const gemFloorCaustic = loadStaticTexture(
    gemCausticUrl,
    configureMaterialTexture,
  );
  const gemPrism = loadStaticTexture(gemPrismUrl, configureMaterialTexture);
  const seaGlassPrism = loadStaticTexture(
    enhancedSeaGlass
      ? seaGlassPrismDesktopUrl
      : seaGlassPrismMobileUrl,
    configureMaterialTexture,
  );

  const shadowTextures = Object.fromEntries(
    Object.entries(shadowLoads).map(([kind, load]) => [kind, load.texture]),
  ) as Record<MaterialKind, Texture>;
  const shadowReady = Object.fromEntries(
    Object.entries(shadowLoads).map(([kind, load]) => [kind, load.ready]),
  ) as Record<MaterialKind, Promise<Texture>>;
  const ready = Promise.all([
    ...Object.values(shadowReady),
    gemFloorCaustic.ready,
    gemPrism.ready,
    seaGlassPrism.ready,
  ]).then(() => undefined);

  return {
    shadows: shadowTextures,
    shadowReady,
    gemFloorCaustic: gemFloorCaustic.texture,
    gemFloorCausticReady: gemFloorCaustic.ready,
    gemPrism: gemPrism.texture,
    gemPrismReady: gemPrism.ready,
    seaGlassPrism: seaGlassPrism.texture,
    seaGlassPrismReady: seaGlassPrism.ready,
    ready,
  };
};
