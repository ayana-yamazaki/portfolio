import * as THREE from 'three';
import { glassTuning } from './config';
import {
  glassFragmentShader,
  glassVertexShader,
  resinFragmentShader,
  resinVertexShader,
} from './shaders';

export const createGlassMaterial = (domRefractionTexture: THREE.Texture) => new THREE.ShaderMaterial({
  uniforms: {
    uDomRefraction: { value: domRefractionTexture },
    uCanvasSize: { value: new THREE.Vector2(1, 1) },
    uBounds: { value: new THREE.Vector4() },
    uCardSize: { value: new THREE.Vector2(1, 1) },
    uRadius: { value: 4 },
    uRim: { value: glassTuning.rimWidthPx },
    uRefraction: { value: glassTuning.refractionPx },
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

export const createResinFaceMaterial = () => new THREE.ShaderMaterial({
  uniforms: {
    uCanvasSize: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: resinVertexShader,
  fragmentShader: resinFragmentShader,
  transparent: false,
  depthWrite: true,
  toneMapped: false,
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
    color: 0xd8d4cb,
    roughness: 0.24,
    metalness: 0,
    bumpMap: stoneBump,
    bumpScale: 0.006,
    clearcoat: 1,
    clearcoatRoughness: 0.17,
  }),
});

export const createStoneFaceMaterial = (
  image: THREE.Texture,
  bump: THREE.Texture,
) => new THREE.MeshPhysicalMaterial({
  map: image,
  roughness: 0.72,
  metalness: 0,
  bumpMap: bump,
  bumpScale: 0.012,
  polygonOffset: true,
  polygonOffsetFactor: -2,
});
