import { makeGlassPanelGeometry } from '../geometry?card=glass';
import type { PreparedCardDefinition } from './types';

export const glassCardDefinition: PreparedCardDefinition = {
  kind: 'glass',
  meshMaterial: 'glass',
  surface: null,
  hasBottomSurface: false,
  caustic: null,
  hasPrism: false,
  shadowColor: 0x000000,
  shadowProfile: 'glass',
  shadowFollowsLift: true,
  cacheDuringMotion: true,
  createGeometry: makeGlassPanelGeometry,
};
