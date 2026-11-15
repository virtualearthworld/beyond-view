/**
 * Camera-path coverage audit from estimated camera poses.
 *
 * This reports only camera-center edges backed by successful adjacent-pose
 * estimates. It deliberately does not turn a camera path into a walkable
 * volume: scale, gravity alignment, scene surfaces, and free-space coverage
 * remain unverified.
 */

const finite3 = value => Array.isArray(value) &&
  value.length === 3 && value.every(Number.isFinite);

function validRotation(rotation) {
  if (!Array.isArray(rotation) || rotation.length !== 3 ||
      rotation.some(row => !Array.isArray(row) || row.length !== 3 ||
        row.some(value => !Number.isFinite(value)))) return false;
  const columns = [0, 1, 2].map(column =>
    rotation.map(row => row[column]));
  let orthogonalityError = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const dot = columns[i].reduce((sum, value, k) =>
        sum + value * columns[j][k], 0);
      orthogonalityError += (dot - (i === j ? 1 : 0)) ** 2;
    }
  }
  const determinant =
    rotation[0][0] * (rotation[1][1] * rotation[2][2] - rotation[1][2] * rotation[2][1]) -
    rotation[0][1] * (rotation[1][0] * rotation[2][2] - rotation[1][2] * rotation[2][0]) +
    rotation[0][2] * (rotation[1][0] * rotation[2][1] - rotation[1][1] * rotation[2][0]);
  return Math.sqrt(orthogonalityError) <= 0.05 &&
    Math.abs(determinant - 1) <= 0.05;
}

function validPose(pose) {
  return pose?.status === "estimated" &&
    Number.isInteger(pose.componentId) && pose.componentId >= 0 &&
    Number.isFinite(pose.frame) &&
    validRotation(pose.rotation) && finite3(pose.translation);
}

// The trajectory stores world-to-camera transforms: Xc = R * Xw + t.
// Therefore the camera center in the component-local world is -R^T * t.
function cameraCenter(pose) {
  return [0, 1, 2].map(column => -(
    pose.rotation[0][column] * pose.translation[0] +
    pose.rotation[1][column] * pose.translation[1] +
    pose.rotation[2][column] * pose.translation[2]
  ));
}

function boundsOf(centers) {
  if (!centers.length) return null;
  const min = [0, 1, 2].map(axis =>
    Math.min(...centers.map(item => item.position[axis])));
  const max = [0, 1, 2].map(axis =>
    Math.max(...centers.map(item => item.position[axis])));
  return { min, max, span: max.map((value, axis) => value - min[axis]) };
}

const distance3 = (a, b) => Math.hypot(
  a[0] - b[0], a[1] - b[1], a[2] - b[2]
);

/**
 * Summarize only the camera-center path edges represented by successful
 * trajectory segments. Failed segments and missing pose endpoints are
 * reported, never interpolated or bridged.
 */
export function summarizeCameraCoverage(trajectory) {
  if (!trajectory || !Array.isArray(trajectory.segments) ||
      !Array.isArray(trajectory.poses)) {
    throw new TypeError("Expected trajectory segments and camera poses.");
  }

  const posesByKey = new Map();
  for (const pose of trajectory.poses) {
    if (validPose(pose)) {
      posesByKey.set(pose.componentId + ":" + pose.frame, pose);
    }
  }

  const edgesByComponent = new Map();
  const unsupportedSegments = [];
  let missingPoseEndpointCount = 0;

  trajectory.segments.forEach((segment, index) => {
    const fromFrame = segment?.fromFrame ?? index;
    const toFrame = segment?.toFrame ?? index + 1;
    if (segment?.status !== "estimated" ||
        !Number.isInteger(segment.componentId) || segment.componentId < 0 ||
        !Number.isFinite(fromFrame) || !Number.isFinite(toFrame) ||
        fromFrame === toFrame) {
      unsupportedSegments.push({
        index, fromFrame, toFrame,
        status: segment?.status ?? "invalid-segment"
      });
      return;
    }

    const prefix = segment.componentId + ":";
    const fromPose = posesByKey.get(prefix + fromFrame);
    const toPose = posesByKey.get(prefix + toFrame);
    if (!fromPose || !toPose) {
      missingPoseEndpointCount++;
      unsupportedSegments.push({
        index, fromFrame, toFrame, status: "missing-camera-pose-endpoint"
      });
      return;
    }

    const fromCenter = cameraCenter(fromPose);
    const toCenter = cameraCenter(toPose);
    const edge = {
      index, componentId: segment.componentId, fromFrame, toFrame,
      fromCenter, toCenter,
      length: distance3(fromCenter, toCenter)
    };
    if (!edgesByComponent.has(segment.componentId)) {
      edgesByComponent.set(segment.componentId, []);
    }
    edgesByComponent.get(segment.componentId).push(edge);
  });

  const paths = [];
  const components = [];
  let totalPathLengthUnitBaselines = 0;
  const supportedPoseKeys = new Set();

  for (const [componentId, edges] of edgesByComponent) {
    edges.sort((a, b) =>
      a.fromFrame - b.fromFrame || a.toFrame - b.toFrame || a.index - b.index);
    const componentPaths = [];
    let current = null;

    for (const edge of edges) {
      supportedPoseKeys.add(componentId + ":" + edge.fromFrame);
      supportedPoseKeys.add(componentId + ":" + edge.toFrame);
      const lastCenter = current?.cameraCenters[current.cameraCenters.length - 1];
      if (!current || lastCenter.frame !== edge.fromFrame) {
        current = {
          componentId,
          cameraCenters: [
            { frame: edge.fromFrame, position: edge.fromCenter },
            { frame: edge.toFrame, position: edge.toCenter }
          ],
          segmentIndices: [edge.index],
          pathLengthUnitBaselines: edge.length
        };
        componentPaths.push(current);
        paths.push(current);
      } else {
        current.cameraCenters.push({
          frame: edge.toFrame, position: edge.toCenter
        });
        current.segmentIndices.push(edge.index);
        current.pathLengthUnitBaselines += edge.length;
      }
    }

    for (let pathIndex = 0; pathIndex < componentPaths.length; pathIndex++) {
      const path = componentPaths[pathIndex];
      path.pathIndex = pathIndex;
      path.frameIndices = path.cameraCenters.map(item => item.frame);
      path.bounds = boundsOf(path.cameraCenters);
      totalPathLengthUnitBaselines += path.pathLengthUnitBaselines;
    }

    const uniqueCenters = new Map();
    for (const path of componentPaths) {
      for (const center of path.cameraCenters) {
        uniqueCenters.set(center.frame, center);
      }
    }
    const cameraCenters = [...uniqueCenters.values()]
      .sort((a, b) => a.frame - b.frame);
    components.push({
      componentId,
      paths: componentPaths,
      frameIndices: cameraCenters.map(item => item.frame),
      cameraCenters,
      pathLengthUnitBaselines: componentPaths.reduce(
        (sum, path) => sum + path.pathLengthUnitBaselines, 0),
      bounds: boundsOf(cameraCenters)
    });
  }

  components.sort((a, b) => a.componentId - b.componentId);
  paths.sort((a, b) =>
    a.componentId - b.componentId ||
    a.cameraCenters[0].frame - b.cameraCenters[0].frame);

  const supportedSegmentCount = paths.reduce(
    (sum, path) => sum + path.segmentIndices.length, 0);
  const gapCount = trajectory.segments.filter(
    segment => segment?.status !== "estimated").length;

  return {
    status: supportedSegmentCount
      ? "observed-camera-paths-available"
      : "no-observed-camera-paths",
    components,
    paths,
    componentCount: components.length,
    pathCount: paths.length,
    supportedPoseCount: supportedPoseKeys.size,
    supportedSegmentCount,
    unsupportedSegmentCount: unsupportedSegments.length,
    missingPoseEndpointCount,
    gapCount,
    unsupportedSegments,
    totalPathLengthUnitBaselines,
    scaleKnown: false,
    gravityAligned: false,
    navigation: {
      enabled: false,
      extrapolationAllowed: false,
      gapBridgingAllowed: false,
      reason: "Camera-center paths do not establish a traversable surface or free-space volume. Navigation remains disabled until source-supported geometry and coverage are validated."
    },
    limitation: "This is a relative camera-center path audit only. It has unknown monocular scale, is not gravity-aligned, and does not establish surface coverage, safe free space, or a walkable 3D environment."
  };
}
