import { makeSeaGlassGeometry } from '../geometry?card=sea-glass';
import type { PreparedCardDefinition } from './types';

export const seaGlassCardDefinition: PreparedCardDefinition = {
  kind: 'sea-glass',
  meshMaterial: 'sea-glass',
  surface: null,
  hasBottomSurface: false,
  caustic: null,
  hasPrism: true,
  shadowColor: 0x000000,
  shadowProfile: 'sea-glass',
  shadowFollowsLift: true,
  cacheDuringMotion: false,
  createGeometry: (width, height, depth, radius) => (
    makeSeaGlassGeometry(width, height, depth, radius)
  ),
};
