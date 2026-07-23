import type * as THREE from 'three';
import type { MaterialKind } from '../config';

export type CardMeshMaterialKind = 'gem' | 'sea-glass' | 'glass' | 'body';
export type CardSurfaceKind = 'rough-glass' | null;
export type CardCausticKind = 'gem' | 'rough-glass' | null;
export type CardShadowProfileKind = 'gem' | 'sea-glass' | 'rough-glass' | 'glass';

export type CardDefinition = {
  kind: MaterialKind;
  meshMaterial: CardMeshMaterialKind;
  surface: CardSurfaceKind;
  hasBottomSurface: boolean;
  caustic: CardCausticKind;
  hasPrism: boolean;
  shadowColor: number;
  shadowProfile: CardShadowProfileKind;
  shadowFollowsLift: boolean;
  createGeometry: (
    width: number,
    height: number,
    depth: number,
    radius: number,
    shoulderWidth: number,
  ) => THREE.BufferGeometry;
};
