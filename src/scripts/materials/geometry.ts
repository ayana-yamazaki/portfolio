import * as THREE from 'three';

const makeRoundedShape = (width: number, height: number, radius: number) => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const safeRadius = Math.min(radius, halfWidth, halfHeight);
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + safeRadius, -halfHeight);
  shape.lineTo(halfWidth - safeRadius, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + safeRadius);
  shape.lineTo(halfWidth, halfHeight - safeRadius);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - safeRadius, halfHeight);
  shape.lineTo(-halfWidth + safeRadius, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - safeRadius);
  shape.lineTo(-halfWidth, -halfHeight + safeRadius);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + safeRadius, -halfHeight);
  return shape;
};

export const makePanelGeometry = (width: number, height: number, depth: number, radius: number) => {
  const geometry = new THREE.ExtrudeGeometry(makeRoundedShape(width, height, radius), {
    depth,
    steps: 1,
    curveSegments: 14,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: Math.min(depth * 0.3, radius * 0.16),
    bevelThickness: depth * 0.24,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
};

export const makeRoundedFaceGeometry = (width: number, height: number, radius: number) => {
  const geometry = new THREE.ShapeGeometry(makeRoundedShape(width, height, radius), 14);
  const positions = geometry.getAttribute('position');
  const uvs = geometry.getAttribute('uv');
  for (let index = 0; index < positions.count; index += 1) {
    uvs.setXY(index, positions.getX(index) / width + 0.5, positions.getY(index) / height + 0.5);
  }
  uvs.needsUpdate = true;
  return geometry;
};
