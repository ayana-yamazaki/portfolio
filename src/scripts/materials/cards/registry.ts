import type { MaterialKind } from '../config';
import { gemCardDefinition } from './gem';
import { glassCardDefinition } from './glass';
import { roughGlassCardDefinition } from './rough-glass';
import { seaGlassCardDefinition } from './sea-glass';
import type { CardDefinition } from './types';

export const cardDefinitions = {
  gem: gemCardDefinition,
  'sea-glass': seaGlassCardDefinition,
  'rough-glass': roughGlassCardDefinition,
  glass: glassCardDefinition,
} satisfies Record<MaterialKind, CardDefinition>;

export const getCardDefinition = (kind: MaterialKind) => cardDefinitions[kind];

export type { CardDefinition } from './types';
