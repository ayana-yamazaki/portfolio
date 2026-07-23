import type { BufferGeometry } from 'three';
import type { MaterialKind } from '../config';

export type CardMeshMaterialKind = 'gem' | 'sea-glass' | 'glass' | 'body';
export type CardSurfaceKind = 'rough-glass' | null;
export type CardCausticKind = 'gem' | 'rough-glass' | null;
export type CardShadowProfileKind = 'gem' | 'sea-glass' | 'rough-glass' | 'glass';

export type CardGeometryFactory = (
  width: number,
  height: number,
  depth: number,
  radius: number,
  shoulderWidth: number,
) => BufferGeometry;

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
  cacheDuringMotion: boolean;
  createGeometry?: CardGeometryFactory;
};

export type PreparedCardDefinition = CardDefinition & {
  createGeometry: CardGeometryFactory;
};
