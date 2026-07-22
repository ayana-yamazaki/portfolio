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

const makeSeededRandom = (initialSeed: number) => {
  let seed = initialSeed;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
};

const makeIrregularStoneShape = (width: number, height: number) => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const baseAmplitude = Math.min(width, height) * 0.0035;
  const random = makeSeededRandom(8243);
  const points: THREE.Vector2[] = [];

  const addEdge = (
    from: THREE.Vector2,
    to: THREE.Vector2,
    outward: THREE.Vector2,
    segments: number,
    phase: number,
  ) => {
    for (let index = 0; index < segments; index += 1) {
      const t = index / segments;
      const point = from.clone().lerp(to, t);
      const broad = Math.sin(t * Math.PI * 4 + phase) * baseAmplitude * 0.4
        + Math.sin(t * Math.PI * 10 + phase * 1.7) * baseAmplitude * 0.18;
      const chipped = random() < 0.08
        ? -baseAmplitude * (1.8 + random() * 3.5)
        : 0;
      const granular = (random() - 0.5) * baseAmplitude * 0.9;
      point.addScaledVector(outward, broad + granular + chipped);
      points.push(point);
    }
  };

  addEdge(
    new THREE.Vector2(-halfWidth, -halfHeight),
    new THREE.Vector2(halfWidth, -halfHeight),
    new THREE.Vector2(0, -1),
    24,
    0.4,
  );
  addEdge(
    new THREE.Vector2(halfWidth, -halfHeight),
    new THREE.Vector2(halfWidth, halfHeight),
    new THREE.Vector2(1, 0),
    36,
    1.7,
  );
  addEdge(
    new THREE.Vector2(halfWidth, halfHeight),
    new THREE.Vector2(-halfWidth, halfHeight),
    new THREE.Vector2(0, 1),
    24,
    3.1,
  );
  addEdge(
    new THREE.Vector2(-halfWidth, halfHeight),
    new THREE.Vector2(-halfWidth, -halfHeight),
    new THREE.Vector2(-1, 0),
    36,
    4.3,
  );

  return new THREE.Shape(points);
};

export const makePanelGeometry = (width: number, height: number, depth: number, radius: number) => {
  const geometry = new THREE.ExtrudeGeometry(makeRoundedShape(width, height, radius), {
    depth,
    steps: 1,
    curveSegments: 14,
    bevelEnabled: radius > 0,
    bevelSegments: 5,
    bevelSize: Math.min(depth * 0.3, radius * 0.16),
    bevelThickness: depth * 0.24,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();

  if (radius === 0) {
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const uvs = geometry.getAttribute('uv');
    geometry.groups
      .filter(({ materialIndex }) => materialIndex === 1)
      .forEach(({ start, count }) => {
        for (let index = start; index < start + count; index += 1) {
          const isVerticalSide = Math.abs(normals.getX(index)) > Math.abs(normals.getY(index));
          const alongEdge = isVerticalSide
            ? positions.getY(index) / height + .5
            : positions.getX(index) / width + .5;
          const acrossDepth = positions.getZ(index) / depth + .5;
          uvs.setXY(index, alongEdge, acrossDepth);
        }
      });
    uvs.needsUpdate = true;
  }

  return geometry;
};

export const makeIrregularStoneGeometry = (width: number, height: number, depth: number) => {
  const geometry = new THREE.ExtrudeGeometry(makeIrregularStoneShape(width, height), {
    depth,
    steps: 1,
    curveSegments: 1,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: Math.min(depth * 0.12, Math.min(width, height) * 0.0035),
    bevelThickness: depth * 0.16,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();

  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uvs = geometry.getAttribute('uv');
  geometry.groups.forEach(({ start, count, materialIndex }) => {
    for (let index = start; index < start + count; index += 1) {
      if (materialIndex === 0) {
        uvs.setXY(index, positions.getX(index) / width + 0.5, positions.getY(index) / height + 0.5);
        continue;
      }
      const isVerticalSide = Math.abs(normals.getX(index)) > Math.abs(normals.getY(index));
      const alongEdge = isVerticalSide
        ? positions.getY(index) / height + 0.5
        : positions.getX(index) / width + 0.5;
      uvs.setXY(index, alongEdge, positions.getZ(index) / depth + 0.5);
    }
  });
  uvs.needsUpdate = true;
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
