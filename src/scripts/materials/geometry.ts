import {
  BufferAttribute,
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
  ShapeGeometry,
  ShapeUtils,
  Vector2,
  Vector3,
} from 'three';

const makeRoundedShape = (width: number, height: number, radius: number) => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const safeRadius = Math.min(radius, halfWidth, halfHeight);
  const shape = new Shape();
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
    new Vector2(-halfWidth * 0.52, -halfHeight),
    new Vector2(halfWidth * 0.72, -halfHeight * 0.9),
    new Vector2(halfWidth, -halfHeight * 0.48),
    new Vector2(halfWidth * 0.86, halfHeight * 0.8),
    new Vector2(halfWidth * 0.22, halfHeight),
    new Vector2(-halfWidth * 0.88, halfHeight * 0.84),
    new Vector2(-halfWidth, -halfHeight * 0.54),
  ];
};

const makeGemShape = (width: number, height: number) => new Shape(
  makeGemPoints(width, height),
);

export const makeSeaGlassOutline = (
  width: number,
  height: number,
  radius = -1,
  segments = 48,
) => {
  const points = makeGemPoints(width, height);
  const wear = Math.min(width, height);
  const radiusMultipliers = [1, .82, 1.12, .94, 1.25, .82, 1.06];
  const fallbackCornerRadii = [.16, .13, .18, .15, .2, .13, .17].map(
    (ratio) => wear * ratio,
  );
  const radiusProgress = radius >= 0
    ? 1 - Math.exp(-radius / Math.max(wear * .35, 1e-4))
    : 0;
  const entries: Vector2[] = [];
  const exits: Vector2[] = [];

  points.forEach((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const previousDistance = point.distanceTo(previous);
    const nextDistance = point.distanceTo(next);
    const cornerRadius = radius >= 0
      ? Math.min(previousDistance, nextDistance)
        * .49
        * Math.min(radiusProgress * radiusMultipliers[index], 1)
      : Math.min(
          fallbackCornerRadii[index],
          previousDistance * .3,
          nextDistance * .3,
        );
    entries.push(point.clone().add(
      previous.clone().sub(point).normalize().multiplyScalar(cornerRadius),
    ));
    exits.push(point.clone().add(
      next.clone().sub(point).normalize().multiplyScalar(cornerRadius),
    ));
  });

  const shape = new Shape();
  shape.moveTo(entries[0].x, entries[0].y);
  points.forEach((point, index) => {
    shape.lineTo(entries[index].x, entries[index].y);
    shape.quadraticCurveTo(point.x, point.y, exits[index].x, exits[index].y);
  });
  shape.closePath();
  return shape.getSpacedPoints(segments).slice(0, -1);
};

export const makePanelGeometry = (width: number, height: number, depth: number, radius: number) => {
  const geometry = new ExtrudeGeometry(makeRoundedShape(width, height, radius), {
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

export const getRoughGlassChamferSize = (
  width: number,
  height: number,
  depth: number,
  radius: number,
) => Math.min(
  width * .1,
  height * .08,
  Math.max(radius * .75, depth * .0086),
);

export const makeRoughGlassGeometry = (
  width: number,
  height: number,
  depth: number,
  radius: number,
) => {
  type Point = readonly [number, number, number];
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const halfDepth = depth / 2;
  const chamfer = getRoughGlassChamferSize(width, height, depth, radius);
  const frontZ = halfDepth;
  const chamferBackZ = frontZ - chamfer;
  const topInnerY = halfHeight - chamfer;
  const positions: number[] = [];
  const uvs: number[] = [];
  const edgeProgress: number[] = [];

  const addVertex = ([x, y, z]: Point) => {
    positions.push(x, y, z);
    uvs.push(x / width + .5, y / height + .5);
    edgeProgress.push(x / width + .5);
  };
  const addTriangle = (a: Point, b: Point, c: Point) => {
    addVertex(a);
    addVertex(b);
    addVertex(c);
  };
  const addQuad = (a: Point, b: Point, c: Point, d: Point) => {
    addTriangle(a, b, c);
    addTriangle(a, c, d);
  };
  const addPolygon = (points: Point[]) => {
    for (let index = 1; index < points.length - 1; index += 1) {
      addTriangle(points[0], points[index], points[index + 1]);
    }
  };

  const frontBottomLeft: Point = [-halfWidth, -halfHeight, frontZ];
  const frontBottomRight: Point = [halfWidth, -halfHeight, frontZ];
  const frontTopLeft: Point = [-halfWidth, topInnerY, frontZ];
  const frontTopRight: Point = [halfWidth, topInnerY, frontZ];
  const chamferTopLeft: Point = [-halfWidth, halfHeight, chamferBackZ];
  const chamferTopRight: Point = [halfWidth, halfHeight, chamferBackZ];
  const backBottomLeft: Point = [-halfWidth, -halfHeight, -halfDepth];
  const backBottomRight: Point = [halfWidth, -halfHeight, -halfDepth];
  const backTopLeft: Point = [-halfWidth, halfHeight, -halfDepth];
  const backTopRight: Point = [halfWidth, halfHeight, -halfDepth];

  addQuad(frontBottomLeft, frontBottomRight, frontTopRight, frontTopLeft);
  addQuad(backBottomLeft, backTopLeft, backTopRight, backBottomRight);
  const bodyVertexCount = positions.length / 3;

  addQuad(chamferTopLeft, chamferTopRight, backTopRight, backTopLeft);
  addQuad(backBottomLeft, backBottomRight, frontBottomRight, frontBottomLeft);
  addPolygon([
    frontBottomLeft,
    frontTopLeft,
    chamferTopLeft,
    backTopLeft,
    backBottomLeft,
  ]);
  addPolygon([
    frontBottomRight,
    backBottomRight,
    backTopRight,
    chamferTopRight,
    frontTopRight,
  ]);
  const sideVertexCount = positions.length / 3 - bodyVertexCount;

  addQuad(frontTopLeft, frontTopRight, chamferTopRight, chamferTopLeft);
  const edgeVertexCount = positions.length / 3 - bodyVertexCount - sideVertexCount;

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute(uvs, 2),
  );
  geometry.setAttribute(
    'aEdgeProgress',
    new Float32BufferAttribute(edgeProgress, 1),
  );
  geometry.addGroup(0, bodyVertexCount, 0);
  geometry.addGroup(bodyVertexCount, sideVertexCount, 1);
  geometry.addGroup(
    bodyVertexCount + sideVertexCount,
    edgeVertexCount,
    2,
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

export const makeBeveledRoughGlassGeometry = (
  width: number,
  height: number,
  depth: number,
  radius: number,
) => {
  type Point = readonly [number, number, number];
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const halfDepth = depth / 2;
  const bevel = getRoughGlassChamferSize(
    width,
    height,
    depth,
    radius,
  );
  const innerWidth = halfWidth - bevel;
  const innerHeight = halfHeight - bevel;
  const frontZ = halfDepth;
  const outerFrontZ = frontZ - bevel;
  const positions: number[] = [];
  const uvs: number[] = [];
  const edgeProgress: number[] = [];

  const addVertex = ([x, y, z]: Point) => {
    positions.push(x, y, z);
    uvs.push(x / width + .5, y / height + .5);
    edgeProgress.push(x / width + .5);
  };
  const addTriangle = (a: Point, b: Point, c: Point) => {
    addVertex(a);
    addVertex(b);
    addVertex(c);
  };
  const addQuad = (a: Point, b: Point, c: Point, d: Point) => {
    addTriangle(a, b, c);
    addTriangle(a, c, d);
  };

  const innerBottomLeft: Point = [-innerWidth, -innerHeight, frontZ];
  const innerBottomRight: Point = [innerWidth, -innerHeight, frontZ];
  const innerTopLeft: Point = [-innerWidth, innerHeight, frontZ];
  const innerTopRight: Point = [innerWidth, innerHeight, frontZ];
  const outerBottomLeft: Point = [-halfWidth, -halfHeight, outerFrontZ];
  const outerBottomRight: Point = [halfWidth, -halfHeight, outerFrontZ];
  const outerTopLeft: Point = [-halfWidth, halfHeight, outerFrontZ];
  const outerTopRight: Point = [halfWidth, halfHeight, outerFrontZ];
  const backBottomLeft: Point = [-halfWidth, -halfHeight, -halfDepth];
  const backBottomRight: Point = [halfWidth, -halfHeight, -halfDepth];
  const backTopLeft: Point = [-halfWidth, halfHeight, -halfDepth];
  const backTopRight: Point = [halfWidth, halfHeight, -halfDepth];

  addQuad(
    innerBottomLeft,
    innerBottomRight,
    innerTopRight,
    innerTopLeft,
  );
  addQuad(
    backBottomLeft,
    backTopLeft,
    backTopRight,
    backBottomRight,
  );
  const bodyVertexCount = positions.length / 3;

  addQuad(outerTopLeft, outerTopRight, backTopRight, backTopLeft);
  addQuad(
    backBottomLeft,
    backBottomRight,
    outerBottomRight,
    outerBottomLeft,
  );
  addQuad(outerBottomLeft, outerTopLeft, backTopLeft, backBottomLeft);
  addQuad(
    outerBottomRight,
    backBottomRight,
    backTopRight,
    outerTopRight,
  );
  const sideVertexCount = positions.length / 3 - bodyVertexCount;

  addQuad(innerTopLeft, innerTopRight, outerTopRight, outerTopLeft);
  addQuad(
    innerBottomLeft,
    outerBottomLeft,
    outerBottomRight,
    innerBottomRight,
  );
  addQuad(
    innerBottomLeft,
    innerTopLeft,
    outerTopLeft,
    outerBottomLeft,
  );
  addQuad(
    innerBottomRight,
    outerBottomRight,
    outerTopRight,
    innerTopRight,
  );
  const bevelVertexCount = positions.length / 3
    - bodyVertexCount
    - sideVertexCount;

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute(uvs, 2),
  );
  geometry.setAttribute(
    'aEdgeProgress',
    new Float32BufferAttribute(edgeProgress, 1),
  );
  geometry.addGroup(0, bodyVertexCount, 0);
  geometry.addGroup(bodyVertexCount, sideVertexCount, 1);
  geometry.addGroup(
    bodyVertexCount + sideVertexCount,
    bevelVertexCount,
    2,
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

export const makeGlassPanelGeometry = (
  width: number,
  height: number,
  depth: number,
  radius: number,
  shoulderWidth: number,
) => {
  const shoulder = Math.min(
    shoulderWidth,
    depth * .32,
    radius * .8,
    width * .16,
    height * .16,
  );
  const halfDepth = depth / 2;
  const cornerSegments = 10;
  const profile = [
    { inset: shoulder, z: halfDepth, region: 0 },
    { inset: shoulder * .86, z: halfDepth - depth * .008, region: .07 },
    { inset: shoulder * .64, z: halfDepth - depth * .045, region: .17 },
    { inset: shoulder * .38, z: halfDepth - depth * .13, region: .31 },
    { inset: shoulder * .14, z: halfDepth - depth * .27, region: .48 },
    { inset: 0, z: halfDepth - depth * .5, region: .66 },
    { inset: shoulder * .025, z: halfDepth - depth * .72, region: .79 },
    { inset: shoulder * .23, z: halfDepth - depth * .87, region: .9 },
    { inset: shoulder * .55, z: halfDepth - depth * .97, region: .97 },
    { inset: shoulder * .82, z: -halfDepth, region: 1 },
  ] as const;

  const makeOutline = (inset: number) => {
    const outlineWidth = Math.max(width - inset * 2, 1e-4);
    const outlineHeight = Math.max(height - inset * 2, 1e-4);
    const outlineRadius = Math.max(
      Math.min(radius - inset, outlineWidth / 2, outlineHeight / 2),
      1e-4,
    );
    const halfWidth = outlineWidth / 2;
    const halfHeight = outlineHeight / 2;
    const centers = [
      new Vector2(halfWidth - outlineRadius, halfHeight - outlineRadius),
      new Vector2(-halfWidth + outlineRadius, halfHeight - outlineRadius),
      new Vector2(-halfWidth + outlineRadius, -halfHeight + outlineRadius),
      new Vector2(halfWidth - outlineRadius, -halfHeight + outlineRadius),
    ];
    return centers.flatMap((center, corner) => (
      Array.from({ length: cornerSegments }, (_, segment) => {
        const angle = (corner + segment / cornerSegments) * Math.PI / 2;
        return new Vector2(
          center.x + Math.cos(angle) * outlineRadius,
          center.y + Math.sin(angle) * outlineRadius,
        );
      })
    ));
  };

  const positions: number[] = [];
  const indices: number[] = [];
  const surfaceRegions: number[] = [];
  const opticalThickness: number[] = [];
  const ringStarts: number[] = [];
  const outlines: Vector2[][] = [];

  profile.forEach(({ inset, z, region }) => {
    const outline = makeOutline(inset);
    outlines.push(outline);
    ringStarts.push(positions.length / 3);
    const sidePath = 1 + Math.sin(region * Math.PI) * .62;
    outline.forEach((point) => {
      positions.push(point.x, point.y, z);
      surfaceRegions.push(region);
      opticalThickness.push(sidePath);
    });
  });

  for (let ring = 0; ring < profile.length - 1; ring += 1) {
    const currentStart = ringStarts[ring];
    const nextStart = ringStarts[ring + 1];
    for (let point = 0; point < outlines[ring].length; point += 1) {
      const nextPoint = (point + 1) % outlines[ring].length;
      const front = currentStart + point;
      const frontNext = currentStart + nextPoint;
      const back = nextStart + point;
      const backNext = nextStart + nextPoint;
      indices.push(front, back, backNext, front, backNext, frontNext);
    }
  }

  const addCap = (outline: Vector2[], z: number, front: boolean) => {
    const capStart = positions.length / 3;
    outline.forEach((point) => {
      positions.push(point.x, point.y, z);
      surfaceRegions.push(front ? 0 : 1);
      opticalThickness.push(1);
    });
    ShapeUtils.triangulateShape(outline, []).forEach(([a, b, c]) => {
      indices.push(
        capStart + a,
        capStart + (front ? b : c),
        capStart + (front ? c : b),
      );
    });
  };

  addCap(outlines[0], halfDepth, true);
  addCap(outlines[outlines.length - 1], -halfDepth, false);

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const normals = geometry.getAttribute('normal');
  const bevelProgress = new Float32Array(normals.count);
  for (let index = 0; index < normals.count; index += 1) {
    bevelProgress[index] = Math.min(
      1,
      Math.hypot(normals.getX(index), normals.getY(index)),
    );
  }

  geometry.setAttribute(
    'aSurfaceRegion',
    new Float32BufferAttribute(surfaceRegions, 1),
  );
  geometry.setAttribute(
    'aBevelProgress',
    new BufferAttribute(bevelProgress, 1),
  );
  geometry.setAttribute(
    'aOpticalThickness',
    new Float32BufferAttribute(opticalThickness, 1),
  );
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

export const makeGemGeometry = (width: number, height: number, depth: number) => {
  const outline = makeGemPoints(width, height);
  const innerScale = [.83, .8, .84, .81, .835, .795, .82];
  const innerDepth = [.47, .47, .47, .47, .47, .47, .47];
  const edgeDepth = [.12, .08, .15, .1, .14, .07, .13];
  const inner = outline.map((point, index) => new Vector3(
    point.x * innerScale[index],
    point.y * innerScale[(index + 2) % innerScale.length],
    depth * innerDepth[index],
  ));
  const frontEdge = outline.map((point, index) => new Vector3(
    point.x,
    point.y,
    depth * edgeDepth[index],
  ));
  const tableCenter = new Vector3(-width * .035, height * .025, depth * .47);
  const backEdge = outline.map((point) => new Vector3(
    point.x * .92,
    point.y * .92,
    -depth * .5,
  ));
  const backCenter = new Vector3(0, 0, -depth * .5);
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
    const outward = new Vector3(bridge.x, bridge.y, 0).normalize();
    bridge.addScaledVector(outward, facetScale * sideBulge[index] * .28);
    bridge.z += depth * sideBridgeLift[index];
    return bridge;
  });
  const positions: number[] = [];
  const uvs: number[] = [];

  const addTriangle = (a: Vector3, b: Vector3, c: Vector3) => {
    [a, b, c].forEach((point) => {
      positions.push(point.x, point.y, point.z);
      uvs.push(point.x / width + .5, point.y / height + .5);
    });
  };

  const makeFacetCenter = (
    a: Vector3,
    b: Vector3,
    c: Vector3,
    d: Vector3,
    index: number,
    bulge: number[],
    skew: number[],
    lift: number[],
  ) => {
    const center = a.clone().add(b).add(c).add(d).multiplyScalar(.25);
    const tangent = b.clone().sub(a).setZ(0).normalize();
    const outward = new Vector3(center.x, center.y, 0).normalize();
    center.addScaledVector(outward, facetScale * bulge[index]);
    center.addScaledVector(tangent, facetScale * skew[index]);
    center.z += depth * lift[index];
    return center;
  };

  const addFacetQuad = (
    a: Vector3,
    b: Vector3,
    c: Vector3,
    d: Vector3,
    center: Vector3,
  ) => {
    addTriangle(a, d, center);
    addTriangle(d, c, center);
    addTriangle(c, b, center);
    addTriangle(b, a, center);
  };

  const makeRadialEdge = (
    start: Vector3,
    end: Vector3,
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

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  const facetCenters: number[] = [];
  const facetBarycentrics: number[] = [];
  for (let index = 0; index < positions.length; index += 9) {
    const centerX = (
      positions[index]
      + positions[index + 3]
      + positions[index + 6]
    ) / 3;
    const centerY = (
      positions[index + 1]
      + positions[index + 4]
      + positions[index + 7]
    ) / 3;
    const centerZ = (
      positions[index + 2]
      + positions[index + 5]
      + positions[index + 8]
    ) / 3;
    for (let vertex = 0; vertex < 3; vertex += 1) {
      facetCenters.push(centerX, centerY, centerZ);
    }
    facetBarycentrics.push(
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    );
  }
  geometry.setAttribute(
    'aFacetCenter',
    new Float32BufferAttribute(facetCenters, 3),
  );
  geometry.setAttribute(
    'aFacetBarycentric',
    new Float32BufferAttribute(facetBarycentrics, 3),
  );
  geometry.addGroup(frontStart, frontCount, 0);
  geometry.addGroup(frontCount, positions.length / 3 - frontCount, 1);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

export const makeSeaGlassGeometry = (
  width: number,
  height: number,
  depth: number,
  radius = -1,
) => {
  const outline = makeSeaGlassOutline(width, height, radius);
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
    const contour = ring.map((index) => new Vector2(
      positions[index * 3],
      positions[index * 3 + 1],
    ));
    ShapeUtils.triangulateShape(contour, []).forEach((face) => {
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

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aOpticalThickness', new Float32BufferAttribute(opticalThickness, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

export const makeRoundedFaceGeometry = (width: number, height: number, radius: number) => {
  const geometry = new ShapeGeometry(makeRoundedShape(width, height, radius), 14);
  const positions = geometry.getAttribute('position');
  const uvs = geometry.getAttribute('uv');
  for (let index = 0; index < positions.count; index += 1) {
    uvs.setXY(index, positions.getX(index) / width + 0.5, positions.getY(index) / height + 0.5);
  }
  uvs.needsUpdate = true;
  return geometry;
};
