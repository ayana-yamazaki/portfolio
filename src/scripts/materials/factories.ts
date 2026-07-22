import * as THREE from 'three';
import { glassTuning } from './config';
import {
  glassFragmentShader,
  glassVertexShader,
  milkResinFragmentShader,
  resinFragmentShader,
  resinVertexShader,
} from './shaders';

export const createGlassMaterial = (
  domRefractionTexture: THREE.Texture,
  glassTitleTexture: THREE.Texture,
) => new THREE.ShaderMaterial({
  uniforms: {
    uDomRefraction: { value: domRefractionTexture },
    uGlassTitle: { value: glassTitleTexture },
    uCanvasSize: { value: new THREE.Vector2(1, 1) },
    uWorldCardSize: { value: new THREE.Vector2(1, 1) },
    uCardSize: { value: new THREE.Vector2(1, 1) },
    uRadius: { value: 4 },
    uRim: { value: glassTuning.rimWidthPx },
    uRefraction: { value: glassTuning.refractionPx },
    uFloorY: { value: 0.1 },
    uWallColor: { value: new THREE.Vector3(31 / 255, 93 / 255, 205 / 255) },
    uFloorColor: { value: new THREE.Vector3(249 / 255, 243 / 255, 240 / 255) },
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

export const createResinFaceMaterial = (
  castGlassBump: THREE.Texture,
  domRefractionTexture: THREE.Texture,
) => new THREE.ShaderMaterial({
  uniforms: {
    uBump: { value: castGlassBump },
    uDomRefraction: { value: domRefractionTexture },
    uTexel: { value: new THREE.Vector2(1 / 384, 1 / 576) },
    uFloorY: { value: 0.1 },
    uWallColor: { value: new THREE.Vector3(31 / 255, 93 / 255, 205 / 255) },
    uFloorColor: { value: new THREE.Vector3(249 / 255, 243 / 255, 240 / 255) },
  },
  vertexShader: resinVertexShader,
  fragmentShader: resinFragmentShader,
  transparent: true,
  depthWrite: false,
  toneMapped: false,
});

export const createMilkResinFaceMaterial = () => new THREE.ShaderMaterial({
  uniforms: {
    uCardSize: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: resinVertexShader,
  fragmentShader: milkResinFragmentShader,
  transparent: true,
  depthTest: false,
  depthWrite: false,
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
  'milk-resin': new THREE.MeshPhysicalMaterial({
    color: 0xff9200,
    roughness: 0.48,
    metalness: 0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.05,
  }),
  resin: new THREE.MeshPhysicalMaterial({
    color: 0xbcd2d5,
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.9,
    transparent: true,
    opacity: 0.065,
    depthWrite: false,
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
  'milk-resin': new THREE.MeshPhysicalMaterial({
    color: 0xe37000,
    roughness: 0.5,
    metalness: 0,
    clearcoat: 0.1,
    clearcoatRoughness: 0.42,
    envMapIntensity: 0.05,
  }),
  resin: new THREE.MeshPhysicalMaterial({
    color: 0x4d676c,
    roughness: 0.22,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.5,
    transparent: true,
    opacity: 0.72,
    depthWrite: true,
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

export const createStoneFaceMaterial = (
  albedo: THREE.Texture,
  height: THREE.Texture,
  roughness: THREE.Texture,
) => {
  const material = new THREE.MeshPhysicalMaterial({
    map: albedo,
    color: 0xffffff,
    roughness: 0.97,
    roughnessMap: roughness,
    metalness: 0,
    bumpMap: height,
    bumpScale: 0.022,
    envMapIntensity: 0.18,
  });
  return material;
};
