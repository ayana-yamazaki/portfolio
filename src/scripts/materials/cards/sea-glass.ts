import { makeSeaGlassGeometry } from '../geometry?card=sea-glass';
import type { PreparedCardDefinition } from './types';

export const seaGlassCardDefinition: PreparedCardDefinition = {
  kind: 'sea-glass',
  meshMaterial: 'sea-glass',
  surface: null,
  hasBottomSurface: false,
  caustic: null,
  hasPrism: false,
  shadowColor: 0x000000,
  shadowProfile: 'sea-glass',
  shadowFollowsLift: true,
  cacheDuringMotion: false,
  createGeometry: (width, height, depth) => makeSeaGlassGeometry(width, height, depth),
};
