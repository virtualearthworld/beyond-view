import { triangulateMultiViewPoint, projectPoint } from "./multiview-geometry.js";

const validMatrix = value => Array.isArray(value) && value.length === 3 &&
  value.every(row => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite));
const validVector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

function projectionMatrix(K, pose) {
  const Rt = pose.rotation.map((row, index) => [...row, pose.translation[index]]);
  return Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 4 }, (_, column) =>
      K[row][0] * Rt[0][column] +
      K[row][1] * Rt[1][column] +
      K[row][2] * Rt[2][column]
    )
  ).flat();
}

function cameraCenter(pose) {
  return pose.rotation[0].map((_, column) =>
    -pose.rotation.reduce((sum, row, index) => sum + row[column] * pose.translation[index], 0)
  );
}

function cameraDepth(pose, point) {
  return pose.rotation.map((row, index) =>
    row.reduce((sum, value, axis) => sum + value * point[axis], pose.translation[index])
  )[2];
}

function maximumTriangulationAngle(point, poses) {
  const centers = poses.map(cameraCenter);
  let maximum = 0;
  for (let i = 0; i < centers.length; i++) {
    for (let j = i + 1; j < centers.length; j++) {
      const a = point.map((value, axis) => value - centers[i][axis]);
      const b = point.map((value, axis) => value - centers[j][axis]);
      const denominator = Math.hypot(...a) * Math.hypot(...b);
      if (denominator <= 1e-12) continue;
      const cosine = a.reduce((sum, value, axis) => sum + value * b[axis], 0) / denominator;
      maximum = Math.max(maximum, Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI);
    }
  }
  return maximum;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Test whether a linked image track behaves like one fixed 3D landmark.
 *
 * Each observation is held out once. The landmark is triangulated from all
 * other observations, then projected into the withheld camera. This is a
 * stronger rigid-scene consistency check than fitting and scoring the same
 * observations. It is not semantic segmentation: inconsistent tracks may be
 * moving subjects, water/reflections, occlusions, mismatches, or pose errors.
 */
export function evaluateMultiViewTrackConsistency(tracks, trajectory, K, {
  minimumObservations = 4,
  minimumHeldOutObservations = 2,
  minimumTriangulationAngleDegrees = 2,
  maxMedianReprojectionErrorPixels = 2,
  maxP95ReprojectionErrorPixels = 4,
  maxSingleReprojectionErrorPixels = 8,
  maxTracks = 5000
} = {}) {
  if (!Array.isArray(tracks) || !trajectory || !Array.isArray(trajectory.poses) ||
      !validMatrix(K) ||
      !Number.isInteger(minimumObservations) || minimumObservations < 3 ||
      !Number.isInteger(minimumHeldOutObservations) || minimumHeldOutObservations < 1 ||
      !Number.isFinite(minimumTriangulationAngleDegrees) ||
      minimumTriangulationAngleDegrees < 0 || minimumTriangulationAngleDegrees > 90 ||
      !Number.isFinite(maxMedianReprojectionErrorPixels) || maxMedianReprojectionErrorPixels < 0 ||
      !Number.isFinite(maxP95ReprojectionErrorPixels) || maxP95ReprojectionErrorPixels < 0 ||
      !Number.isFinite(maxSingleReprojectionErrorPixels) || maxSingleReprojectionErrorPixels < 0 ||
      !Number.isInteger(maxTracks) || maxTracks < 1) {
    throw new TypeError("Invalid multi-view track-consistency inputs.");
  }

  const poseMap = new Map();
  for (const pose of trajectory.poses) {
    if (pose?.status !== "estimated" || !Number.isInteger(pose.frame) ||
        !Number.isInteger(pose.componentId) || !validMatrix(pose.rotation) ||
        !validVector(pose.translation)) continue;
    const key = pose.componentId + ":" + pose.frame;
    if (!poseMap.has(key)) {
      poseMap.set(key, { pose, projection: projectionMatrix(K, pose) });
    }
  }

  const consistentTracks = [];
  const inconsistentTracks = [];
  const uncertainTracks = [];
  const reasons = {
    invalidTrack: 0,
    insufficientObservations: 0,
    missingCameraPose: 0,
    insufficientHeldOutViews: 0,
    failedTriangulationOrParallax: 0,
    invalidProjection: 0
  };

  for (const track of tracks.slice(0, maxTracks)) {
    if (!track || !Number.isInteger(track.componentId) ||
        !Number.isInteger(track.fromPairIndex) || track.fromPairIndex < 0 ||
        !Array.isArray(track.observations) ||
        track.observations.some(point => !point ||
          !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      reasons.invalidTrack++;
      uncertainTracks.push({ ...track, consistencyStatus: "uncertain", consistencyReason: "invalid-track" });
      continue;
    }
    if (track.observations.length < minimumObservations) {
      reasons.insufficientObservations++;
      uncertainTracks.push({ ...track, consistencyStatus: "uncertain", consistencyReason: "insufficient-observations" });
      continue;
    }

    const views = track.observations.map((observation, index) => {
      const record = poseMap.get(track.componentId + ":" + (track.fromPairIndex + index));
      return record ? {
        observation: [observation.x, observation.y],
        pose: record.pose,
        projection: record.projection
      } : null;
    });
    if (views.some(view => !view)) {
      reasons.missingCameraPose++;
      uncertainTracks.push({ ...track, consistencyStatus: "uncertain", consistencyReason: "missing-camera-pose" });
      continue;
    }

    const heldOutErrors = [];
    const heldOutProjections = [];
    let unusableViews = 0;
    let minimumObservedAngle = Infinity;
    for (let heldOutIndex = 0; heldOutIndex < views.length; heldOutIndex++) {
      const heldOut = views[heldOutIndex];
      const training = views.filter((_, index) => index !== heldOutIndex);
      const point = triangulateMultiViewPoint(
        training.map(view => view.projection),
        training.map(view => view.observation)
      );
      if (!point ||
          training.some(view => !(cameraDepth(view.pose, point) > 1e-10)) ||
          !(cameraDepth(heldOut.pose, point) > 1e-10)) {
        unusableViews++;
        continue;
      }

      const angle = maximumTriangulationAngle(point, training.map(view => view.pose));
      minimumObservedAngle = Math.min(minimumObservedAngle, angle);
      if (angle < minimumTriangulationAngleDegrees) {
        unusableViews++;
        continue;
      }

      const projected = projectPoint(heldOut.projection, point);
      if (!projected) {
        unusableViews++;
        continue;
      }
      const error = Math.hypot(
        projected[0] - heldOut.observation[0],
        projected[1] - heldOut.observation[1]
      );
      if (!Number.isFinite(error)) {
        unusableViews++;
        continue;
      }
      heldOutErrors.push(error);
      heldOutProjections.push({
        frame: heldOut.pose.frame,
        componentId: track.componentId,
        observed: { x: heldOut.observation[0], y: heldOut.observation[1] },
        projected: { x: projected[0], y: projected[1] },
        errorPixels: error
      });
    }

    if (heldOutErrors.length < minimumHeldOutObservations) {
      reasons.insufficientHeldOutViews++;
      if (unusableViews) reasons.failedTriangulationOrParallax++;
      uncertainTracks.push({
        ...track,
        consistencyStatus: "uncertain",
        consistencyReason: "insufficient-held-out-views",
        consistency: {
          heldOutCount: heldOutErrors.length,
          unusableViews,
          minimumObservedTriangulationAngleDegrees:
            Number.isFinite(minimumObservedAngle) ? minimumObservedAngle : null
        }
      });
      continue;
    }

    const medianError = median(heldOutErrors);
    const p95Error = percentile(heldOutErrors, 0.95);
    const maxError = Math.max(...heldOutErrors);
    const metrics = {
      heldOutCount: heldOutErrors.length,
      heldOutProjections,
      unusableViews,
      medianReprojectionErrorPixels: medianError,
      p95ReprojectionErrorPixels: p95Error,
      maxReprojectionErrorPixels: maxError,
      minimumObservedTriangulationAngleDegrees:
        Number.isFinite(minimumObservedAngle) ? minimumObservedAngle : null
    };
    const accepted = medianError <= maxMedianReprojectionErrorPixels &&
      p95Error <= maxP95ReprojectionErrorPixels &&
      maxError <= maxSingleReprojectionErrorPixels;
    const annotated = {
      ...track,
      consistencyStatus: accepted ? "multi-view-consistent" : "multi-view-inconsistent",
      consistency: metrics
    };
    if (accepted) consistentTracks.push(annotated);
    else inconsistentTracks.push(annotated);
  }

  return {
    status: consistentTracks.length ? "multi-view-consistency-evaluated" : "no-multi-view-consistent-tracks",
    inputTrackCount: tracks.length,
    evaluatedTrackCount: consistentTracks.length + inconsistentTracks.length,
    consistentTracks,
    inconsistentTracks,
    uncertainTracks,
    reasons,
    thresholds: {
      minimumObservations,
      minimumHeldOutObservations,
      minimumTriangulationAngleDegrees,
      maxMedianReprojectionErrorPixels,
      maxP95ReprojectionErrorPixels,
      maxSingleReprojectionErrorPixels
    },
    limitation: "Leave-one-observation-out reprojection tests whether one fixed 3D point explains a track under the supplied camera path and assumed intrinsics. Inconsistent tracks are not confirmed people or water; camera-pose errors, rolling shutter, occlusion, parallax, and mismatches can also cause rejection. Epipolar-consistent moving content can still pass."
  };
}

/**
 * Rebuild adjacent-pair correspondences only from linked tracks that passed
 * multi-view consistency. Tracks never cross a missing frame or component
 * boundary because their source observations are already contiguous.
 */
export function tracksToAdjacentPairs(tracks, pairCount) {
  if (!Array.isArray(tracks) || !Number.isInteger(pairCount) || pairCount < 0) {
    throw new TypeError("Provide linked tracks and a non-negative adjacent-pair count.");
  }
  const pairs = Array.from({ length: pairCount }, () => []);
  for (const track of tracks) {
    if (!track || !Number.isInteger(track.fromPairIndex) || track.fromPairIndex < 0 ||
        !Array.isArray(track.observations)) continue;
    for (let offset = 0; offset < track.observations.length - 1; offset++) {
      const pairIndex = track.fromPairIndex + offset;
      const from = track.observations[offset];
      const to = track.observations[offset + 1];
      if (pairIndex < 0 || pairIndex >= pairCount ||
          !from || !to ||
          ![from.x, from.y, to.x, to.y].every(Number.isFinite)) continue;
      pairs[pairIndex].push({
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y }
      });
    }
  }
  return pairs;
}
