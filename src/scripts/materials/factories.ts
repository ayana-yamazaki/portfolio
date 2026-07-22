import * as THREE from 'three';
import { glassTuning } from './config';
import {
  glassFragmentShader,
  glassVertexShader,
} from './shaders';

export const createGlassMaterial = (domRefractionTexture: THREE.Texture) => new THREE.ShaderMaterial({
  uniforms: {
    uDomRefraction: { value: domRefractionTexture },
    uCanvasSize: { value: new THREE.Vector2(1, 1) },
    uWorldCardSize: { value: new THREE.Vector2(1, 1) },
    uCardSize: { value: new THREE.Vector2(1, 1) },
    uRadius: { value: 4 },
    uRim: { value: glassTuning.rimWidthPx },
    uRefraction: { value: glassTuning.refractionPx },
  },
  vertexShader: glassVertexShader,
  fragmentShader: glassFragmentShader,
  transparent: true,
  depthWrite: false,
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

export const createResinFaceMaterial = (image: THREE.Texture) => new THREE.MeshPhysicalMaterial({
  map: image,
  color: 0xffffff,
  roughness: 0.3,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.12,
  envMapIntensity: 0.35,
  transparent: true,
  alphaTest: 0.01,
  depthWrite: true,
});

export const createBodyMaterials = (
  paperBump: THREE.Texture,
  stoneBump: THREE.Texture,
) => ({
  stone: new THREE.MeshPhysicalMaterial({
    color: 0x77736b,
    roughness: 0.86,
    metalness: 0,
    bumpMap: stoneBump,
    bumpScale: 0.018,
  }),
  paper: new THREE.MeshPhysicalMaterial({
    color: 0xd8cfbd,
    roughness: 0.94,
    metalness: 0,
    bumpMap: paperBump,
    bumpScale: 0.045,
    sheen: 0.08,
    sheenColor: new THREE.Color(0xfff8e8),
  }),
  resin: new THREE.MeshPhysicalMaterial({
    color: 0xf5f2ee,
    roughness: 0.24,
    metalness: 0,
    bumpMap: stoneBump,
    bumpScale: 0.006,
    clearcoat: 1,
    clearcoatRoughness: 0.17,
  }),
});

export const createSideMaterials = (stoneTexture: THREE.Texture) => ({
  stone: new THREE.MeshPhysicalMaterial({
    map: stoneTexture,
    color: 0xc0bfbc,
    roughness: 0.96,
    metalness: 0,
    bumpMap: stoneTexture,
    bumpScale: 0.06,
  }),
  paper: new THREE.MeshPhysicalMaterial({
    color: 0xb9ae99,
    roughness: 0.96,
    metalness: 0,
  }),
  resin: new THREE.MeshPhysicalMaterial({
    color: 0xb9b7b1,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
  }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0xa9c0c4,
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    transparent: false,
    depthWrite: true,
  }),
});

export const createStoneFaceMaterial = (image: THREE.Texture) => {
  const material = new THREE.MeshPhysicalMaterial({
    map: image,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.22,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <colorspace_fragment>',
      `float stoneLuma = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      gl_FragColor.rgb = mix(vec3(stoneLuma), gl_FragColor.rgb, 1.5);
      #include <colorspace_fragment>`,
    );
  };
  material.customProgramCacheKey = () => 'stone-face-lit-saturation-1.5';
  return material;
};
