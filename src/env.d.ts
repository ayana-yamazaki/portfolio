/// <reference types="astro/client" />

declare module '*?card=gem' {
  import type { BufferGeometry } from 'three';

  export const makeGemGeometry: (
    width: number,
    height: number,
    depth: number,
  ) => BufferGeometry;
}

declare module '*?card=sea-glass' {
  import type { BufferGeometry } from 'three';

  export const makeSeaGlassGeometry: (
    width: number,
    height: number,
    depth: number,
  ) => BufferGeometry;
}

declare module '*?card=rough-glass' {
  import type { BufferGeometry } from 'three';

  export const makeRoughGlassGeometry: (
    width: number,
    height: number,
    depth: number,
    radius: number,
  ) => BufferGeometry;
}

declare module '*?card=glass' {
  import type { BufferGeometry } from 'three';

  export const makeGlassPanelGeometry: (
    width: number,
    height: number,
    depth: number,
    radius: number,
    shoulderWidth: number,
  ) => BufferGeometry;
}
