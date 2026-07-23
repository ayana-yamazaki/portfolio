import { makeGemGeometry } from '../geometry';
import type { CardDefinition } from './types';

export const gemCardDefinition: CardDefinition = {
  kind: 'gem',
  meshMaterial: 'gem',
  surface: null,
  hasBottomSurface: false,
  caustic: 'gem',
  hasPrism: true,
  shadowColor: 0x000000,
  shadowProfile: 'gem',
  shadowFollowsLift: true,
  cacheDuringMotion: true,
  createGeometry: (width, height, depth) => makeGemGeometry(width, height, depth),
};
