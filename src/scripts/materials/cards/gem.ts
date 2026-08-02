import { makeGemGeometry } from '../geometry?card=gem';
import type { PreparedCardDefinition } from './types';

export const gemCardDefinition: PreparedCardDefinition = {
  kind: 'gem',
  meshMaterial: 'gem',
  surface: null,
  hasBottomSurface: false,
  caustic: 'gem',
  hasPrism: true,
  shadowColor: 0x000000,
  shadowProfile: 'gem',
  shadowFollowsLift: true,
  createGeometry: (width, height, depth) => makeGemGeometry(width, height, depth),
};
