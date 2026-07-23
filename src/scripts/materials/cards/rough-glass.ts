import { makeRoughGlassGeometry } from '../geometry';
import type { CardDefinition } from './types';

export const roughGlassCardDefinition: CardDefinition = {
  kind: 'rough-glass',
  meshMaterial: 'body',
  surface: 'rough-glass',
  hasBottomSurface: true,
  caustic: 'rough-glass',
  hasPrism: false,
  shadowColor: 0x000000,
  shadowProfile: 'rough-glass',
  shadowFollowsLift: true,
  cacheDuringMotion: true,
  createGeometry: makeRoughGlassGeometry,
};
