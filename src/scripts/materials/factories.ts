import * as THREE from 'three';
import {
  gemTuning,
  glintProfiles,
  glassTuning,
  lightingTuning,
  roughGlassTuning,
  sceneTuning,
  seaGlassTuning,
} from './config';
import {
  gemFragmentShader,
  gemVertexShader,
  glassFragmentShader,
  glassVertexShader,
  seaGlassFragmentShader,
  seaGlassVertexShader,
  roughGlassFragmentShader,
  roughGlassVertexShader,
} from './shaders';

const createGlintUniforms = (
  strength: number,
  lightDirection = new THREE.Vector2(
    lightingTuning.key.position[0],
    lightingTuning.key.position[1],
  ).normalize(),
) => ({
  uLightDirection: {
    value: lightDirection,
  },
  uGlintStrength: { value: strength * lightingTuning.glint.strength },
});

export const createGemFaceMaterial = (
  backdropTexture: THREE.Texture,
  domRefractionTexture: THREE.Texture,
  environmentTexture: THREE.CubeTexture,
  floorInteractionTexture: THREE.Texture,
) => new THREE.ShaderMaterial({
  uniforms: {
    uBackdrop: { value: backdropTexture },
    uDomRefraction: { value: domRefractionTexture },
    uEnvironment: { value: environmentTexture },
    uFloorInteraction: { value: floorInteractionTexture },
    uCanvasSize: { value: new THREE.Vector2(1, 1) },
    uIor: { value: gemTuning.ior },
    uIorRed: { value: gemTuning.iorRed },
    uIorGreen: { value: gemTuning.iorGreen },
    uIorBlue: { value: gemTuning.iorBlue },
    uRefraction: { value: gemTuning.refractionPx },
    uDispersionBoost: { value: gemTuning.dispersionBoost },
    uRoughness: { value: glintProfiles.gem.roughness },
    uEnvironmentIntensity: { value: glintProfiles.gem.envMapIntensity },
    uReflectionExposure: { value: sceneTuning.exposure },
    uFloorY: { value: 0.1 },
    uLightDirection: {
      value: new THREE.Vector3(...lightingTuning.key.position).normalize(),
    },
    uKeyColor: { value: new THREE.Color(lightingTuning.key.color) },
    uKeyIntensity: { value: lightingTuning.key.intensity },
  },
  vertexShader: gemVertexShader,
  fragmentShader: gemFragmentShader,
  side: THREE.DoubleSide,
  depthWrite: true,
  toneMapped: false,
});

export const createGlassMaterial = (
  backdropTexture: THREE.Texture,
  domRefractionTexture: THREE.Texture,
) => new THREE.ShaderMaterial({
  uniforms: {
    uBackdrop: { value: backdropTexture },
    uDomRefraction: { value: domRefractionTexture },
    uCanvasSize: { value: new THREE.Vector2(1, 1) },
    uWorldCardSize: { value: new THREE.Vector2(1, 1) },
    uCardSize: { value: new THREE.Vector2(1, 1) },
    uRadius: { value: 4 },
    uRim: { value: glassTuning.rimWidthPx },
    uRefraction: { value: glassTuning.refractionPx },
    uFloorY: { value: 0.1 },
    uWallColor: { value: new THREE.Vector3(249 / 255, 243 / 255, 240 / 255) },
    uFloorColor: { value: new THREE.Vector3(249 / 255, 243 / 255, 240 / 255) },
    ...createGlintUniforms(
      glintProfiles.glass.strength,
      new THREE.Vector2(-.72, 1).normalize(),
    ),
    uCornerBoost: { value: glintProfiles.glass.cornerBoost },
  },
  vertexShader: glassVertexShader,
  fragmentShader: glassFragmentShader,
  transparent: true,
  depthWrite: true,
  toneMapped: false,
});

export const createPaperFaceMaterial = (
  albedo: THREE.Texture,
  bump: THREE.Texture,
  roundedMask: THREE.Texture,
) => new THREE.MeshPhysicalMaterial({
  map: albedo,
  color: 0xfffcf4,
  roughness: 0.9,
  metalness: 0,
  bumpMap: bump,
  bumpScale: 0.026,
  displacementMap: bump,
  displacementScale: 0.0055,
  displacementBias: -0.00275,
  alphaMap: roundedMask,
  alphaTest: 0.5,
  sheen: 0.06,
  sheenColor: new THREE.Color(0xfff5df),
});

export const createRoughGlassFaceMaterial = (
  roughGlassBump: THREE.Texture,
  backdropTexture: THREE.Texture,
  domRefractionTexture: THREE.Texture,
) => new THREE.ShaderMaterial({
  uniforms: {
    uBump: { value: roughGlassBump },
    uBackdrop: { value: backdropTexture },
    uDomRefraction: { value: domRefractionTexture },
    uTexel: { value: new THREE.Vector2(1 / 384, 1 / 576) },
    uRefractionStrength: { value: roughGlassTuning.refractionStrength },
    uFloorY: { value: 0.1 },
    uWallColor: { value: new THREE.Vector3(249 / 255, 243 / 255, 240 / 255) },
    uFloorColor: { value: new THREE.Vector3(249 / 255, 243 / 255, 240 / 255) },
  },
  vertexShader: roughGlassVertexShader,
  fragmentShader: roughGlassFragmentShader,
  transparent: true,
  depthWrite: false,
  toneMapped: false,
});

export const createSeaGlassMaterial = (
  backdropTexture: THREE.Texture,
  blurredBackdropTexture: THREE.Texture,
) => new THREE.ShaderMaterial({
  uniforms: {
    uBackdrop: { value: backdropTexture },
    uBackdropBlurred: { value: blurredBackdropTexture },
    uCanvasSize: { value: new THREE.Vector2(1, 1) },
    uRefraction: { value: seaGlassTuning.refractionPx },
    ...createGlintUniforms(glintProfiles['sea-glass'].strength),
  },
  vertexShader: seaGlassVertexShader,
  fragmentShader: seaGlassFragmentShader,
  side: THREE.DoubleSide,
  transparent: false,
  depthTest: true,
  depthWrite: true,
  toneMapped: false,
});

export const createBodyMaterials = (paperBump: THREE.Texture) => ({
  paper: new THREE.MeshPhysicalMaterial({
    color: 0xd8cfbd,
    roughness: 0.94,
    metalness: 0,
    bumpMap: paperBump,
    bumpScale: 0.045,
    sheen: 0.08,
    sheenColor: new THREE.Color(0xfff8e8),
  }),
  'rough-glass': new THREE.MeshPhysicalMaterial({
    color: 0xbcd2d5,
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.9,
    transparent: true,
    opacity: 0.035,
    depthWrite: false,
  }),
});

export const createSideMaterials = (gemMaterial: THREE.Material) => ({
  gem: gemMaterial,
  paper: new THREE.MeshPhysicalMaterial({
    color: 0xb9ae99,
    roughness: 0.96,
    metalness: 0,
  }),
  'rough-glass': new THREE.MeshPhysicalMaterial({
    color: 0x9fb9bd,
    roughness: 0.16,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 0.7,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  }),
});
