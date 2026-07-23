import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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

const makeGemPoints = (width: number, height: number) => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return [
    new THREE.Vector2(-halfWidth * 0.52, -halfHeight),
    new THREE.Vector2(halfWidth * 0.72, -halfHeight * 0.9),
    new THREE.Vector2(halfWidth, -halfHeight * 0.48),
    new THREE.Vector2(halfWidth * 0.86, halfHeight * 0.8),
    new THREE.Vector2(halfWidth * 0.22, halfHeight),
    new THREE.Vector2(-halfWidth * 0.88, halfHeight * 0.84),
    new THREE.Vector2(-halfWidth, -halfHeight * 0.54),
  ];
};

const makeGemShape = (width: number, height: number) => new THREE.Shape(
  makeGemPoints(width, height),
);

export const makeSeaGlassOutline = (width: number, height: number, segments = 96) => {
  const points = makeGemPoints(width, height);
  const wear = Math.min(width, height);
  const cornerRadii = [.16, .13, .18, .15, .2, .13, .17].map((ratio) => wear * ratio);
  const entries: THREE.Vector2[] = [];
  const exits: THREE.Vector2[] = [];

  points.forEach((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const radius = Math.min(
      cornerRadii[index],
      point.distanceTo(previous) * .3,
      point.distanceTo(next) * .3,
    );
    entries.push(point.clone().add(previous.clone().sub(point).normalize().multiplyScalar(radius)));
    exits.push(point.clone().add(next.clone().sub(point).normalize().multiplyScalar(radius)));
  });

  const shape = new THREE.Shape();
  shape.moveTo(entries[0].x, entries[0].y);
  points.forEach((point, index) => {
    shape.lineTo(entries[index].x, entries[index].y);
    shape.quadraticCurveTo(point.x, point.y, exits[index].x, exits[index].y);
  });
  shape.closePath();
  return shape.getSpacedPoints(segments).slice(0, -1);
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

export const makeGlassPanelGeometry = (
  width: number,
  height: number,
  depth: number,
  radius: number,
) => {
  const shoulder = Math.min(depth * .22, radius * .24);
  const bodyDepth = Math.max(depth - shoulder * 2, depth * .2);
  const shapeWidth = Math.max(width - shoulder * 2, shoulder * 2);
  const shapeHeight = Math.max(height - shoulder * 2, shoulder * 2);
  const shapeRadius = Math.max(radius - shoulder, 0);
  const geometry = new THREE.ExtrudeGeometry(
    makeRoundedShape(shapeWidth, shapeHeight, shapeRadius),
    {
      depth: bodyDepth,
      steps: 1,
      curveSegments: 40,
      bevelEnabled: true,
      bevelSegments: 24,
      bevelSize: shoulder,
      bevelThickness: shoulder,
    },
  );
  geometry.translate(0, 0, -bodyDepth / 2);
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  const smoothedGeometry = mergeVertices(geometry, 1e-5);
  geometry.dispose();
  smoothedGeometry.computeVertexNormals();
  return smoothedGeometry;
};

export const makeGemGeometry = (width: number, height: number, depth: number) => {
  const outline = makeGemPoints(width, height);
  const innerScale = [.83, .8, .84, .81, .835, .795, .82];
  const innerDepth = [.47, .47, .47, .47, .47, .47, .47];
  const edgeDepth = [.12, .08, .15, .1, .14, .07, .13];
  const inner = outline.map((point, index) => new THREE.Vector3(
    point.x * innerScale[index],
    point.y * innerScale[(index + 2) % innerScale.length],
    depth * innerDepth[index],
  ));
  const frontEdge = outline.map((point, index) => new THREE.Vector3(
    point.x,
    point.y,
    depth * edgeDepth[index],
  ));
  const tableCenter = new THREE.Vector3(-width * .035, height * .025, depth * .47);
  const backEdge = outline.map((point) => new THREE.Vector3(
    point.x * .92,
    point.y * .92,
    -depth * .5,
  ));
  const backCenter = new THREE.Vector3(0, 0, -depth * .5);
  const facetScale = Math.min(width, height);
  const rimBulge = [.018, -.012, .024, -.016, .02, -.01, .014];
  const rimSkew = [-.014, .018, -.01, .016, -.018, .012, -.008];
  const rimLift = [.045, -.035, .052, -.028, .04, -.042, .032];
  const sideBulge = [.022, -.016, .018, -.02, .026, -.012, .016];
  const sideSkew = [.012, -.018, .016, -.01, .02, -.014, .008];
  const sideLift = [-.05, .04, -.032, .052, -.044, .036, -.028];
  const innerRimSegments = [4, 5, 4, 6, 5, 4, 5];
  const outerRimSegments = [6, 5, 7, 4, 6, 7, 5];
  const sideBridgeRatio = [.38, .47, .42, .54, .4, .49, .44];
  const sideBridgeLift = [-.024, .028, -.018, .032, -.026, .022, -.016];
  const sideBridge = frontEdge.map((point, index) => {
    const bridge = point.clone().lerp(backEdge[index], sideBridgeRatio[index]);
    const outward = new THREE.Vector3(bridge.x, bridge.y, 0).normalize();
    bridge.addScaledVector(outward, facetScale * sideBulge[index] * .28);
    bridge.z += depth * sideBridgeLift[index];
    return bridge;
  });
  const positions: number[] = [];
  const uvs: number[] = [];

  const addTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    [a, b, c].forEach((point) => {
      positions.push(point.x, point.y, point.z);
      uvs.push(point.x / width + .5, point.y / height + .5);
    });
  };

  const makeFacetCenter = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    index: number,
    bulge: number[],
    skew: number[],
    lift: number[],
  ) => {
    const center = a.clone().add(b).add(c).add(d).multiplyScalar(.25);
    const tangent = b.clone().sub(a).setZ(0).normalize();
    const outward = new THREE.Vector3(center.x, center.y, 0).normalize();
    center.addScaledVector(outward, facetScale * bulge[index]);
    center.addScaledVector(tangent, facetScale * skew[index]);
    center.z += depth * lift[index];
    return center;
  };

  const addFacetQuad = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    center: THREE.Vector3,
  ) => {
    addTriangle(a, d, center);
    addTriangle(d, c, center);
    addTriangle(c, b, center);
    addTriangle(b, a, center);
  };

  const makeRadialEdge = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    segments: number,
    edgeIndex: number,
    depthJitter: number,
  ) => Array.from({ length: segments + 1 }, (_, step) => {
    const amount = step / segments;
    const point = start.clone().lerp(end, amount);
    if (step > 0 && step < segments) {
      const wave = Math.sin((edgeIndex + 1) * 1.73 + step * 2.31);
      point.z += depth * depthJitter * wave * Math.sin(amount * Math.PI);
    }
    return point;
  });

  const frontStart = 0;
  outline.forEach((_, index) => {
    const next = (index + 1) % outline.length;
    const radialCenter = makeFacetCenter(
      inner[index],
      inner[next],
      frontEdge[next],
      frontEdge[index],
      index,
      rimBulge,
      rimSkew,
      rimLift,
    );
    const outerBoundary = makeRadialEdge(
      frontEdge[index],
      frontEdge[next],
      outerRimSegments[index],
      index,
      .026,
    );
    const innerBoundary = makeRadialEdge(
      inner[next],
      inner[index],
      innerRimSegments[index],
      index + 3,
      .004,
    );
    const radialBoundary = [
      inner[index],
      ...outerBoundary,
      inner[next],
      ...innerBoundary.slice(1, -1),
    ];
    addTriangle(tableCenter, inner[index], inner[next]);
    radialBoundary.forEach((point, boundaryIndex) => {
      const boundaryNext = radialBoundary[(boundaryIndex + 1) % radialBoundary.length];
      addTriangle(radialCenter, point, boundaryNext);
    });
  });
  const frontCount = positions.length / 3;

  outline.forEach((_, index) => {
    const next = (index + 1) % outline.length;
    const frontSideCenter = makeFacetCenter(
      frontEdge[index],
      frontEdge[next],
      sideBridge[next],
      sideBridge[index],
      index,
      sideBulge,
      sideSkew,
      sideLift,
    );
    const backSideCenter = makeFacetCenter(
      sideBridge[index],
      sideBridge[next],
      backEdge[next],
      backEdge[index],
      next,
      sideBulge,
      sideSkew,
      sideLift,
    );
    addFacetQuad(frontEdge[index], frontEdge[next], sideBridge[next], sideBridge[index], frontSideCenter);
    addFacetQuad(sideBridge[index], sideBridge[next], backEdge[next], backEdge[index], backSideCenter);
    addTriangle(backCenter, backEdge[next], backEdge[index]);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.addGroup(frontStart, frontCount, 0);
  geometry.addGroup(frontCount, positions.length / 3 - frontCount, 1);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

export const makeSeaGlassGeometry = (width: number, height: number, depth: number) => {
  const outline = makeSeaGlassOutline(width, height);
  const ringCount = 12;
  const positions: number[] = [];
  const uvs: number[] = [];
  const opticalThickness: number[] = [];
  const indices: number[] = [];
  const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

  const addRing = (scale: number, z: number, thickness: number) => outline.map((point, index) => {
    const angle = index / outline.length * Math.PI * 2;
    const organicScale = 1
      + Math.sin(angle * 3 + .7) * .008
      + Math.sin(angle * 5 - .35) * .004;
    const x = point.x * scale * organicScale;
    const y = point.y * scale * organicScale;
    const vertexIndex = positions.length / 3;
    positions.push(x, y, z);
    uvs.push(clamp01(x / width + .5), clamp01(y / height + .5));
    opticalThickness.push(clamp01(thickness + Math.sin(angle * 4 + .4) * .025));
    return vertexIndex;
  });

  const connectRings = (outer: number[], inner: number[], front: boolean) => {
    outer.forEach((vertex, index) => {
      const next = (index + 1) % outer.length;
      if (front) {
        indices.push(vertex, outer[next], inner[index]);
        indices.push(outer[next], inner[next], inner[index]);
      } else {
        indices.push(vertex, inner[index], outer[next]);
        indices.push(outer[next], inner[index], inner[next]);
      }
    });
  };

  const waist = addRing(1, 0, .94);
  const frontRings = [waist];
  const backRings = [waist];
  for (let ring = 1; ring <= ringCount; ring += 1) {
    const amount = ring / ringCount;
    const eased = amount * amount * (3 - 2 * amount);
    const scale = 1 - eased * .18;
    const z = Math.sin(eased * Math.PI * .5) * depth * .5;
    const thickness = .94 - eased * .62;
    frontRings.push(addRing(scale, z, thickness));
    backRings.push(addRing(scale, -z, thickness));
  }

  for (let ring = 0; ring < ringCount; ring += 1) {
    connectRings(frontRings[ring], frontRings[ring + 1], true);
    connectRings(backRings[ring], backRings[ring + 1], false);
  }

  const addCap = (ring: number[], front: boolean) => {
    const contour = ring.map((index) => new THREE.Vector2(
      positions[index * 3],
      positions[index * 3 + 1],
    ));
    THREE.ShapeUtils.triangulateShape(contour, []).forEach((face) => {
      let a = ring[face[0]];
      let b = ring[face[1]];
      let c = ring[face[2]];
      const ax = positions[a * 3];
      const ay = positions[a * 3 + 1];
      const bx = positions[b * 3];
      const by = positions[b * 3 + 1];
      const cx = positions[c * 3];
      const cy = positions[c * 3 + 1];
      const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if ((front && cross < 0) || (!front && cross > 0)) [b, c] = [c, b];
      indices.push(a, b, c);
    });
  };

  addCap(frontRings[ringCount], true);
  addCap(backRings[ringCount], false);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aOpticalThickness', new THREE.Float32BufferAttribute(opticalThickness, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
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
