import { makeGlassPanelGeometry } from '../geometry';
import type { CardDefinition } from './types';

export const glassCardDefinition: CardDefinition = {
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
