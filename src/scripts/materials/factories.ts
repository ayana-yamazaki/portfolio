import * as THREE from 'three';
import {
  backgroundReflectionTuning,
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

const createIntroLightUniforms = () => ({
  uSettleLightPosition: { value: 0 },
  uSettleLightStrength: { value: 0 },
});

const createBackgroundReflectionUniforms = (
  kind: keyof typeof backgroundReflectionTuning.profiles,
) => {
  const profile = backgroundReflectionTuning.profiles[kind];
  return {
    uBackgroundReflectionFallback: {
      value: new THREE.Color(backgroundReflectionTuning.fallbackColor),
    },
    uBandTopY: { value: 1 },
    uBackgroundReflectionStrength: { value: profile.strength },
    uBackgroundReflectionRayDistance: { value: profile.rayDistance },
  };
};

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
    ...createIntroLightUniforms(),
    ...createBackgroundReflectionUniforms('gem'),
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
  environmentTexture: THREE.CubeTexture,
) => new THREE.ShaderMaterial({
  uniforms: {
    uBackdrop: { value: backdropTexture },
    uDomRefraction: { value: domRefractionTexture },
    uEnvironment: { value: environmentTexture },
    uCanvasSize: { value: new THREE.Vector2(1, 1) },
    uWorldCardSize: { value: new THREE.Vector2(1, 1) },
    uThicknessPx: { value: 80 },
    uRefraction: { value: glassTuning.refractionPx },
    uIor: { value: glassTuning.ior },
    uAbsorptionStrength: { value: glassTuning.absorptionStrength },
    uDispersionStrength: { value: glassTuning.dispersionStrength },
    uFloorY: { value: 0.1 },
    uBandBottomY: { value: 0.1 },
    uWallColor: { value: new THREE.Vector3(249 / 255, 243 / 255, 240 / 255) },
    uFloorColor: { value: new THREE.Vector3(249 / 255, 243 / 255, 240 / 255) },
    ...createGlintUniforms(
      glintProfiles.glass.strength,
      new THREE.Vector2(-.72, 1).normalize(),
    ),
    ...createIntroLightUniforms(),
    ...createBackgroundReflectionUniforms('glass'),
  },
  vertexShader: glassVertexShader,
  fragmentShader: glassFragmentShader,
  transparent: false,
  depthTest: true,
  depthWrite: true,
  toneMapped: false,
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
    uLightDirection: {
      value: new THREE.Vector2(
        lightingTuning.key.position[0],
        lightingTuning.key.position[1],
      ).normalize(),
    },
    uFloorY: { value: 0.1 },
    uBandBottomY: { value: 0.1 },
    uWallColor: { value: new THREE.Vector3(249 / 255, 243 / 255, 240 / 255) },
    uFloorColor: { value: new THREE.Vector3(249 / 255, 243 / 255, 240 / 255) },
    ...createIntroLightUniforms(),
    ...createBackgroundReflectionUniforms('rough-glass'),
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
    ...createIntroLightUniforms(),
    ...createBackgroundReflectionUniforms('sea-glass'),
  },
  vertexShader: seaGlassVertexShader,
  fragmentShader: seaGlassFragmentShader,
  side: THREE.DoubleSide,
  transparent: false,
  depthTest: true,
  depthWrite: true,
  toneMapped: false,
});

export const createBodyMaterials = () => ({
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

const createRoughGlassSideMaterial = () => new THREE.MeshPhysicalMaterial({
  color: 0x9fb9bd,
  roughness: 0.16,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.06,
  envMapIntensity: 0.7,
  transparent: true,
  opacity: 0.38,
  depthWrite: false,
});

const createRoughGlassEdgeMaterial = () => {
  const settleLightStrength = { value: 0 };
  const edgeLightPosition = { value: .5 };
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xa9c0c3,
    roughness: 0.025,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.008,
    envMapIntensity: 1.55,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  material.userData.settleLightStrength = settleLightStrength;
  material.userData.edgeLightPosition = edgeLightPosition;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSettleLightStrength = settleLightStrength;
    shader.uniforms.uEdgeLightPosition = edgeLightPosition;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `
          #include <common>
          varying float vEdgeScreenX;
        `,
      )
      .replace(
        '#include <project_vertex>',
        `
          #include <project_vertex>
          vEdgeScreenX = gl_Position.x / gl_Position.w * .5 + .5;
        `,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `
          #include <common>
          uniform float uSettleLightStrength;
          uniform float uEdgeLightPosition;
          varying float vEdgeScreenX;
        `,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `
          #include <emissivemap_fragment>
          float edgeLightDistance = (
            vEdgeScreenX - uEdgeLightPosition
          );
          float edgeGlintCore = exp(
            -pow(edgeLightDistance / .012, 2.0)
          ) * uSettleLightStrength;
          float edgeGlintHalo = exp(
            -pow(edgeLightDistance / .035, 2.0)
          ) * uSettleLightStrength;
          totalEmissiveRadiance += vec3(1.0, .985, .9)
            * (edgeGlintCore * 5.0 + edgeGlintHalo * .42);
        `,
      );
  };
  material.customProgramCacheKey = () => 'rough-glass-edge-glint-v2';
  return material;
};

export const createSideMaterials = (gemMaterial: THREE.Material) => ({
  gem: gemMaterial,
  'rough-glass': createRoughGlassSideMaterial(),
  'rough-glass-edge': createRoughGlassEdgeMaterial(),
});
