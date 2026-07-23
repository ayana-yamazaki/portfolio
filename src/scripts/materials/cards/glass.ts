import { makeGlassPanelGeometry } from '../geometry';
import type { CardDefinition } from './types';

export const glassCardDefinition: CardDefinition = {
  kind: 'glass',
  meshMaterial: 'glass',
  surface: null,
  hasBottomSurface: false,
  caustic: null,
  hasPrism: false,
  shadowColor: 0xffffff,
  shadowProfile: 'glass',
  shadowFollowsLift: false,
  cacheDuringMotion: true,
  createGeometry: makeGlassPanelGeometry,
};
