import type { MaterialKind } from '../config';
import type {
  CardDefinition,
  PreparedCardDefinition,
} from './types';

export const cardDefinitions: Record<MaterialKind, CardDefinition> = {
  gem: {
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
  },
  'sea-glass': {
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
  },
  'rough-glass': {
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
  },
  glass: {
    kind: 'glass',
    meshMaterial: 'glass',
    surface: null,
    hasBottomSurface: false,
    caustic: 'glass',
    hasPrism: false,
    shadowColor: 0x000000,
    shadowProfile: 'glass',
    shadowFollowsLift: true,
    cacheDuringMotion: true,
  },
};

const cardDefinitionLoaders = {
  gem: () => import('./gem').then(({ gemCardDefinition }) => gemCardDefinition),
  'sea-glass': () => import('./sea-glass').then(
    ({ seaGlassCardDefinition }) => seaGlassCardDefinition,
  ),
  'rough-glass': () => import('./rough-glass').then(
    ({ roughGlassCardDefinition }) => roughGlassCardDefinition,
  ),
  glass: () => import('./glass').then(
    ({ glassCardDefinition }) => glassCardDefinition,
  ),
} satisfies Record<MaterialKind, () => Promise<PreparedCardDefinition>>;

const cardDefinitionPromises = new Map<
  MaterialKind,
  Promise<PreparedCardDefinition>
>();

export const getCardDefinition = (kind: MaterialKind) => cardDefinitions[kind];

export const prepareCardDefinition = (kind: MaterialKind) => {
  const definition = cardDefinitions[kind];
  if (definition.createGeometry) {
    return Promise.resolve(definition as PreparedCardDefinition);
  }
  const activeLoad = cardDefinitionPromises.get(kind);
  if (activeLoad) return activeLoad;

  const load = cardDefinitionLoaders[kind]().then((loadedDefinition) => {
    definition.createGeometry = loadedDefinition.createGeometry;
    return definition as PreparedCardDefinition;
  }).catch((error) => {
    cardDefinitionPromises.delete(kind);
    throw error;
  });
  cardDefinitionPromises.set(kind, load);
  return load;
};

export type {
  CardDefinition,
  PreparedCardDefinition,
} from './types';
