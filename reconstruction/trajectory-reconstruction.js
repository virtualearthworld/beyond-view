import { triangulatePoint, projectPoint } from "./multiview-geometry.js";

const validK = K => Array.isArray(K) && K.length === 3 &&
  K.every(row => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite));


const validPose = pose => pose && Array.isArray(pose.rotation) && pose.rotation.length === 3 && pose.rotation.every(row => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite)) && Array.isArray(pose.translationDirection) && pose.translationDirection.length === 3 && pose.translationDirection.every(Number.isFinite);
const validTrack = track => track && track.from && track.to && Number.isFinite(track.from.x) && Number.isFinite(track.from.y) && Number.isFinite(track.to.x) && Number.isFinite(track.to.y);

function applyTranspose(R, vector) {
  return R[0].map((_, column) => R.reduce((sum, row, index) => sum + row[column] * vector[index], 0));
}

function projectionMatrix(K, R, t) {
  const Rt = R.map((row, i) => [...row, t[i]]);
  const P = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      P.push(K[row][0] * Rt[0][col] +
        K[row][1] * Rt[1][col] +
        K[row][2] * Rt[2][col]);
    }
  }
  return P;
}

/**
 * Triangulate independently in each estimated adjacent-frame coordinate
 * system. These are local pairwise point clouds, not yet a fused world model.
 * Failed poses remain empty; points must pass positive-depth and reprojection
 * checks in both views. Points below the minimum triangulation angle are
 * counted as weak-parallax candidates but excluded from the stable sparse cloud.
 */
export function reconstructSparseTrajectory(framePairs, trajectory, K, {
  maxReprojectionError = 2,
  minimumPoints = 8,
  minimumTriangulationAngleDegrees = 2
} = {}) {
  if (!Array.isArray(framePairs) || !trajectory ||
      !Array.isArray(trajectory.segments) || !validK(K) ||
      !Number.isFinite(maxReprojectionError) || maxReprojectionError < 0 ||
      !Number.isInteger(minimumPoints) || minimumPoints < 1 ||
      !Number.isFinite(minimumTriangulationAngleDegrees) || minimumTriangulationAngleDegrees < 0 || minimumTriangulationAngleDegrees > 90) {
    throw new TypeError("Invalid sparse trajectory reconstruction inputs.");
  }
  if (framePairs.length !== trajectory.segments.length) {
    throw new RangeError("Frame-pair and trajectory segment counts must match.");
  }
  const identity = [[1,0,0],[0,1,0],[0,0,1]];
  const origin = [0,0,0];
  const P1 = projectionMatrix(K, identity, origin);
  const segments = framePairs.map((pair, index) => {
    const poseSegment = trajectory.segments[index];
    if (!pair || !Array.isArray(pair.tracks)) {
      throw new TypeError("Each frame pair must include a tracks array.");
    }
    if (poseSegment?.status !== "estimated" || !validPose(poseSegment.pose)) {
      return {
        index,
        fromFrame: pair.fromFrame ?? index,
        toFrame: pair.toFrame ?? index + 1,
        status: "pose-unavailable",
        points: [],
        pointCount: 0,
        medianReprojectionError: null,
        diagnostics: { inputTracks: pair.tracks.length, invalidTracks: 0, triangulationFailures: 0, negativeDepth: 0, projectionFailures: 0, reprojectionRejected: 0, accepted: 0 }
      };
    }
    const pose = poseSegment.pose;
    const P2 = projectionMatrix(K, pose.rotation, pose.translationDirection);
    const cameraCenter2 = applyTranspose(pose.rotation, pose.translationDirection.map(value => -value));
    const points = [];
    const diagnostics = { inputTracks: pair.tracks.length, invalidTracks: 0, triangulationFailures: 0,
      negativeDepth: 0, projectionFailures: 0, reprojectionRejected: 0, lowParallax: 0, lowParallaxRejected: 0, accepted: 0 };
    const cameraDepth = (P, point) => P[8] * point[0] + P[9] * point[1] + P[10] * point[2] + P[11];
    for (const track of pair.tracks) {
      if (!validTrack(track)) { diagnostics.invalidTracks++; continue; }
      const point = triangulatePoint(P1, P2, [track.from.x, track.from.y], [track.to.x, track.to.y]);
      if (!point) { diagnostics.triangulationFailures++; continue; }
      const depth1 = cameraDepth(P1, point), depth2 = cameraDepth(P2, point);
      if (depth1 <= 1e-10 || depth2 <= 1e-10) { diagnostics.negativeDepth++; continue; }
      const p1 = projectPoint(P1, point), p2 = projectPoint(P2, point);
      if (!p1 || !p2) { diagnostics.projectionFailures++; continue; }
      const error1 = Math.hypot(p1[0] - track.from.x, p1[1] - track.from.y);
      const error2 = Math.hypot(p2[0] - track.to.x, p2[1] - track.to.y);
      const reprojectionError = (error1 + error2) / 2;
      if (reprojectionError > maxReprojectionError) { diagnostics.reprojectionRejected++; continue; }
      const ray1 = point;
      const ray2 = point.map((value, axis) => value - cameraCenter2[axis]);
      const norm1 = Math.hypot(...ray1), norm2 = Math.hypot(...ray2);
      const cosine = norm1 > 0 && norm2 > 0
        ? ray1.reduce((sum, value, axis) => sum + value * ray2[axis], 0) / (norm1 * norm2)
        : 1;
      const triangulationAngleDegrees = Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
      if (triangulationAngleDegrees < minimumTriangulationAngleDegrees) {
        diagnostics.lowParallax++;
        diagnostics.lowParallaxRejected++;
        continue;
      }
      points.push({ position: point, reprojectionError, triangulationAngleDegrees, observations: 2, depth1, depth2 });
      diagnostics.accepted++;
    }
    const errors = points.map(point => point.reprojectionError).sort((a,b)=>a-b);
    const angles = points.map(point => point.triangulationAngleDegrees).sort((a,b)=>a-b);
    const medianReprojectionError = errors.length
      ? errors[Math.floor(errors.length / 2)] : null;
    return {
      index,
      fromFrame: pair.fromFrame ?? index,
      toFrame: pair.toFrame ?? index + 1,
      status: points.length >= minimumPoints ? "sparse-points-estimated" : "insufficient-valid-points",
      points,
      pointCount: points.length,
      medianReprojectionError,
      medianTriangulationAngleDegrees: angles.length ? angles[Math.floor(angles.length / 2)] : null,
      diagnostics,
      coordinateFrame: "local-to-from-frame",
      scaleKnown: false
    };
  });
  const validSegments = segments.filter(s => s.status === "sparse-points-estimated");
  const pointCount = segments.reduce((sum, s) => sum + s.pointCount, 0);
  const errors = validSegments.map(s => s.medianReprojectionError)
    .filter(Number.isFinite).sort((a,b)=>a-b);
  const angles = validSegments.map(s => s.medianTriangulationAngleDegrees)
    .filter(Number.isFinite).sort((a,b)=>a-b);
  return {
    status: validSegments.length === segments.length
      ? "sparse-reconstruction-estimated"
      : validSegments.length ? "partial-sparse-reconstruction" : "sparse-reconstruction-unavailable",
    segmentCount: segments.length,
    segments,
    validSegmentCount: validSegments.length,
    pointCount,
    medianReprojectionError: errors.length ? errors[Math.floor(errors.length / 2)] : null,
    medianTriangulationAngleDegrees: angles.length ? angles[Math.floor(angles.length / 2)] : null,
    minimumTriangulationAngleDegrees,
    lowParallaxPointCount: segments.reduce((sum, segment) => sum + (segment.diagnostics?.lowParallax || 0), 0),
    rejectedLowParallaxPointCount: segments.reduce((sum, segment) => sum + (segment.diagnostics?.lowParallaxRejected || 0), 0),
    scaleKnown: false,
    fusedWorldModel: false,
    limitation: "Points are triangulated per frame pair in local coordinates. Verified calibration, scale recovery, trajectory optimization, and multi-frame point fusion are still required for a consistent world reconstruction."
  };
}
