import {
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  ShaderMaterial,
  Vector2,
  Vector3,
  type CubeTexture,
  type Material,
  type Texture,
} from 'three';
import {
  backgroundReflectionTuning,
  gemTuning,
  glintProfiles,
  glassTuning,
  lightingTuning,
  roughGlassTuning,
  seaGlassTuning,
} from './config';
import {
  gemFragmentShader,
  gemVertexShader,
  glassFragmentShader,
  glassVertexShader,
  roughGlassCausticFragmentShader,
  roughGlassCausticVertexShader,
  seaGlassFragmentShader,
  seaGlassVertexShader,
  roughGlassFragmentShader,
  roughGlassVertexShader,
} from './shaders';

const createGlintUniforms = (
  strength: number,
  lightDirection = new Vector2(
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
      value: new Color(backgroundReflectionTuning.fallbackColor),
    },
    uBandColor: { value: new Color(0x1f5dcd) },
    uBandTopY: { value: 1 },
    uBackgroundReflectionStrength: { value: profile.strength },
    uBackgroundReflectionRayDistance: { value: profile.rayDistance },
  };
};

export const createGemFaceMaterial = (
  backdropTexture: Texture,
  // EMBEDDED GLASS: embeddedGlassTexture: Texture,
  domRefractionTexture: Texture,
  environmentTexture: CubeTexture,
  floorInteractionTexture: Texture,
) => new ShaderMaterial({
  uniforms: {
    uBackdrop: { value: backdropTexture },
    // EMBEDDED GLASS: uEmbeddedGlass: { value: embeddedGlassTexture },
    uDomRefraction: { value: domRefractionTexture },
    uEnvironment: { value: environmentTexture },
    uFloorInteraction: { value: floorInteractionTexture },
    uCanvasSize: { value: new Vector2(1, 1) },
    uIor: { value: gemTuning.ior },
    uIorRed: { value: gemTuning.iorRed },
    uIorGreen: { value: gemTuning.iorGreen },
    uIorBlue: { value: gemTuning.iorBlue },
    uRefraction: { value: gemTuning.refractionPx },
    uRefractionScale: { value: gemTuning.refractionScale },
    uDispersionBoost: { value: gemTuning.dispersionBoost },
    uRoughness: { value: glintProfiles.gem.roughness },
    uEnvironmentIntensity: { value: glintProfiles.gem.envMapIntensity },
    uReflectionExposure: { value: gemTuning.reflectionExposure },
    uFloorY: { value: 0.1 },
    uLightDirection: {
      value: new Vector3(...lightingTuning.key.position).normalize(),
    },
    uKeyColor: { value: new Color(lightingTuning.key.color) },
    uKeyIntensity: { value: gemTuning.keyIntensity },
    uInternalShadowStrength: { value: gemTuning.internalShadowStrength },
    uFacetShadowHardness: { value: gemTuning.facetShadowHardness },
    uUpperTransmissionStrength: { value: gemTuning.upperTransmissionStrength },
    uFacetHighlightStrength: { value: gemTuning.facetHighlightStrength },
    ...createIntroLightUniforms(),
    ...createBackgroundReflectionUniforms('gem'),
  },
  vertexShader: gemVertexShader,
  fragmentShader: gemFragmentShader,
  side: DoubleSide,
  depthWrite: true,
  toneMapped: false,
});

export const createGlassMaterial = (
  backdropTexture: Texture,
  // EMBEDDED GLASS: embeddedGlassTexture: Texture,
  domRefractionTexture: Texture,
  environmentTexture: CubeTexture,
) => new ShaderMaterial({
  uniforms: {
    uBackdrop: { value: backdropTexture },
    // EMBEDDED GLASS: uEmbeddedGlass: { value: embeddedGlassTexture },
    uDomRefraction: { value: domRefractionTexture },
    uEnvironment: { value: environmentTexture },
    uCanvasSize: { value: new Vector2(1, 1) },
    uWorldCardSize: { value: new Vector2(1, 1) },
    uThicknessPx: { value: 80 },
    uRefraction: { value: glassTuning.refractionPx },
    uIor: { value: glassTuning.ior },
    uAbsorptionStrength: { value: glassTuning.absorptionStrength },
    uDispersionStrength: { value: glassTuning.dispersionStrength },
    uFloorY: { value: 0.1 },
    uBandBottomY: { value: 0.1 },
    uWallColor: { value: new Vector3(249 / 255, 243 / 255, 240 / 255) },
    uFloorColor: { value: new Vector3(249 / 255, 243 / 255, 240 / 255) },
    ...createGlintUniforms(
      glintProfiles.glass.strength,
      new Vector2(-.72, 1).normalize(),
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
  roughGlassBump: Texture,
  backdropTexture: Texture,
  // EMBEDDED GLASS: embeddedGlassTexture: Texture,
  domRefractionTexture: Texture,
  environmentTexture: CubeTexture,
  enhancedSurface: boolean,
) => new ShaderMaterial({
  uniforms: {
    uBump: { value: roughGlassBump },
    uBackdrop: { value: backdropTexture },
    // EMBEDDED GLASS: uEmbeddedGlass: { value: embeddedGlassTexture },
    uDomRefraction: { value: domRefractionTexture },
    uEnvironment: { value: environmentTexture },
    uTexel: { value: new Vector2(1 / 384, 1 / 576) },
    uRefractionStrength: { value: roughGlassTuning.refractionStrength },
    uGlassTransmission: { value: roughGlassTuning.glassTransmission },
    uGlassBrightness: { value: roughGlassTuning.glassBrightness },
    uGlassRoughness: { value: roughGlassTuning.glassRoughness },
    uGlassReflection: { value: roughGlassTuning.glassReflection },
    uGlassEdgeLight: { value: roughGlassTuning.glassEdgeLight },
    uProjectionStrength: { value: roughGlassTuning.projectionStrength },
    uHammeredStrength: { value: roughGlassTuning.hammeredStrength },
    uWaveScale: { value: roughGlassTuning.waveScale },
    uWaveRandomness: { value: roughGlassTuning.waveRandomness },
    uWaveAmplitude: { value: roughGlassTuning.waveAmplitude },
    uWaveEdgeStrength: { value: roughGlassTuning.waveEdgeStrength },
    uWaveRefraction: { value: roughGlassTuning.waveRefraction },
    uWaveShadow: { value: roughGlassTuning.waveShadow },
    uEnhancedSurface: { value: enhancedSurface ? 1 : 0 },
    uLightDirection: {
      value: new Vector3(...lightingTuning.key.position).normalize(),
    },
    uFloorY: { value: 0.1 },
    uBandBottomY: { value: 0.1 },
    uWallColor: { value: new Vector3(249 / 255, 243 / 255, 240 / 255) },
    uFloorColor: { value: new Vector3(249 / 255, 243 / 255, 240 / 255) },
    ...createIntroLightUniforms(),
    ...createBackgroundReflectionUniforms('rough-glass'),
  },
  vertexShader: roughGlassVertexShader,
  fragmentShader: roughGlassFragmentShader,
  transparent: true,
  depthWrite: false,
  toneMapped: false,
});

export const createRoughGlassCausticMaterial = (
  surfaceMaterial: ShaderMaterial,
) => new ShaderMaterial({
  uniforms: {
    uHammeredStrength: surfaceMaterial.uniforms.uHammeredStrength,
    uWaveScale: surfaceMaterial.uniforms.uWaveScale,
    uWaveRandomness: surfaceMaterial.uniforms.uWaveRandomness,
    uWaveAmplitude: surfaceMaterial.uniforms.uWaveAmplitude,
    uWaveEdgeStrength: surfaceMaterial.uniforms.uWaveEdgeStrength,
    uWaveShadow: surfaceMaterial.uniforms.uWaveShadow,
    uProjectionStrength: surfaceMaterial.uniforms.uProjectionStrength,
    uLightDirection: surfaceMaterial.uniforms.uLightDirection,
  },
  vertexShader: roughGlassCausticVertexShader,
  fragmentShader: roughGlassCausticFragmentShader,
  transparent: true,
  depthWrite: false,
  toneMapped: false,
});

export const createSeaGlassMaterial = (
  backdropTexture: Texture,
  blurredBackdropTexture: Texture,
  // EMBEDDED GLASS: embeddedGlassTexture: Texture,
  domRefractionTexture: Texture,
) => new ShaderMaterial({
  uniforms: {
    uBackdrop: { value: backdropTexture },
    uBackdropBlurred: { value: blurredBackdropTexture },
    // EMBEDDED GLASS: uEmbeddedGlass: { value: embeddedGlassTexture },
    uDomRefraction: { value: domRefractionTexture },
    uCanvasSize: { value: new Vector2(1, 1) },
    uRefraction: { value: seaGlassTuning.refractionPx },
    uRefractionScale: { value: seaGlassTuning.refractionScale },
    uBlurStrength: { value: seaGlassTuning.blurStrength },
    uVeilStrength: { value: seaGlassTuning.veilStrength },
    uSurfaceNoiseStrength: { value: seaGlassTuning.surfaceNoiseStrength },
    uSpectralStrength: { value: seaGlassTuning.spectralStrength },
    ...createGlintUniforms(glintProfiles['sea-glass'].strength),
    uGlintStrength: { value: seaGlassTuning.glintStrength },
    ...createIntroLightUniforms(),
    ...createBackgroundReflectionUniforms('sea-glass'),
  },
  vertexShader: seaGlassVertexShader,
  fragmentShader: seaGlassFragmentShader,
  side: DoubleSide,
  transparent: false,
  depthTest: true,
  depthWrite: true,
  toneMapped: false,
});

export const createBodyMaterials = (enhancedRoughGlass = true) => ({
  'rough-glass': new MeshPhysicalMaterial({
    color: enhancedRoughGlass ? 0xdcebed : 0xbcd2d5,
    roughness: enhancedRoughGlass ? 0.09 : 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: enhancedRoughGlass ? 0.035 : 0.08,
    envMapIntensity: enhancedRoughGlass ? 1.35 : 0.9,
    transparent: true,
    opacity: enhancedRoughGlass ? 0.045 : 0.035,
    depthWrite: false,
  }),
});

const createRoughGlassSideMaterial = (
  enhancedRoughGlass: boolean,
) => new MeshPhysicalMaterial({
  color: enhancedRoughGlass ? 0xd7e8eb : 0x9fb9bd,
  roughness: enhancedRoughGlass ? 0.1 : 0.16,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: enhancedRoughGlass ? 0.025 : 0.06,
  envMapIntensity: enhancedRoughGlass ? 1.4 : 0.7,
  transparent: true,
  opacity: enhancedRoughGlass ? 0.3 : 0.38,
  depthWrite: false,
});

const createRoughGlassEdgeMaterial = (
  enhancedRoughGlass: boolean,
) => {
  const settleLightStrength = { value: 0 };
  const edgeLightPosition = { value: .5 };
  const material = new MeshPhysicalMaterial({
    color: enhancedRoughGlass ? 0xf0f8f8 : 0xa9c0c3,
    roughness: enhancedRoughGlass ? 0.018 : 0.025,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: enhancedRoughGlass ? 0.004 : 0.008,
    envMapIntensity: enhancedRoughGlass ? 2.25 : 1.55,
    transparent: true,
    opacity: enhancedRoughGlass ? 0.86 : 1,
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

export const createSideMaterials = (
  gemMaterial: Material,
  enhancedRoughGlass = true,
) => ({
  gem: gemMaterial,
  'rough-glass': createRoughGlassSideMaterial(enhancedRoughGlass),
  'rough-glass-edge': createRoughGlassEdgeMaterial(enhancedRoughGlass),
});
