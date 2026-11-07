import { triangulatePoint, projectPoint } from "./multiview-geometry.js";

const validMatrix = value => Array.isArray(value) && value.length === 3 &&
  value.every(row => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite));
const validVector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

function projectionMatrix(K, pose, translation) {
  const Rt = pose.rotation.map((row, i) => [...row, translation[i]]);
  return Array.from({length:3}, (_, row) =>
    Array.from({length:4}, (_, col) =>
      K[row][0] * Rt[0][col] + K[row][1] * Rt[1][col] + K[row][2] * Rt[2][col]
    )
  ).flat();
}

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a,b)=>a-b);
  const middle = Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
}

/**
 * Evaluate persistent image tracks against a multi-frame camera path.
 * Each landmark is triangulated from its first and last observation, then
 * reprojected into every observed frame. Raw and regularized paths use the
 * exact same tracks and calibration. Translation scale remains arbitrary.
 */
export function evaluateMultiViewReprojection(tracks, trajectory, K, {
  path = "optimized",
  maxTracks = 5000
} = {}) {
  if (!Array.isArray(tracks) || !trajectory || !Array.isArray(trajectory.poses) ||
      !validMatrix(K) || !["raw","optimized"].includes(path) ||
      !Number.isInteger(maxTracks) || maxTracks < 1) {
    throw new TypeError("Invalid multi-view reprojection evaluation inputs.");
  }
  const poseMap = new Map();
  for (const pose of trajectory.poses) {
    if (pose?.status !== "estimated" || !Number.isInteger(pose.frame) ||
        !Number.isInteger(pose.componentId) || !validMatrix(pose.rotation)) continue;
    const translation = path === "raw"
      ? (validVector(pose.rawTranslation) ? pose.rawTranslation : pose.translation)
      : pose.translation;
    if (!validVector(translation)) continue;
    poseMap.set(pose.componentId + ":" + pose.frame, {
      projection: projectionMatrix(K, pose, translation),
      rotation: pose.rotation,
      translation
    });
  }

  const errors = [], heldOutErrors = [];
  let evaluatedLandmarks = 0, skippedTracks = 0, evaluatedObservations = 0, heldOutObservations = 0;
  for (const track of tracks.slice(0,maxTracks)) {
    if (!track || !Number.isInteger(track.componentId) ||
        !Number.isInteger(track.fromPairIndex) || !Array.isArray(track.observations) ||
        track.observations.length < 3 ||
        track.observations.some(p=>!p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      skippedTracks++; continue;
    }
    const views = track.observations.map((observation,index)=>({
      observation,
      pose: poseMap.get(track.componentId + ":" + (track.fromPairIndex + index))
    }));
    if (views.some(view=>!view.pose)) { skippedTracks++; continue; }
    const first = views[0], last = views[views.length-1];
    const point = triangulatePoint(
      first.pose.projection, last.pose.projection,
      [first.observation.x,first.observation.y],
      [last.observation.x,last.observation.y]
    );
    if (!point) { skippedTracks++; continue; }
    const pointErrors = [], trackHeldOutErrors = [];
    for (let viewIndex=0; viewIndex<views.length; viewIndex++) {
      const view=views[viewIndex];
      const projected = projectPoint(view.pose.projection,point);
      if (!projected) continue;
      const error=Math.hypot(projected[0]-view.observation.x,projected[1]-view.observation.y);
      pointErrors.push(error);
      // First and last views construct the landmark; interior views are held out.
      if (viewIndex>0 && viewIndex<views.length-1) trackHeldOutErrors.push(error);
    }
    if (pointErrors.length !== views.length || !pointErrors.every(Number.isFinite)) {
      skippedTracks++; continue;
    }
    errors.push(...pointErrors);
    heldOutErrors.push(...trackHeldOutErrors);
    evaluatedLandmarks++;
    evaluatedObservations += pointErrors.length;
    heldOutObservations += trackHeldOutErrors.length;
  }
  const sortedErrors=errors.slice().sort((a,b)=>a-b);
  const percentile95=sortedErrors.length ? sortedErrors[Math.min(sortedErrors.length-1,Math.ceil(sortedErrors.length*0.95)-1)] : null;
  const sortedHeldOut=heldOutErrors.slice().sort((a,b)=>a-b);
  const heldOutP95=sortedHeldOut.length ? sortedHeldOut[Math.min(sortedHeldOut.length-1,Math.ceil(sortedHeldOut.length*0.95)-1)] : null;
  return {
    status: evaluatedLandmarks ? "multi-view-reprojection-evaluated" : "insufficient-multi-view-tracks",
    path,
    evaluatedLandmarks,
    evaluatedObservations,
    skippedTracks,
    medianReprojectionErrorPixels: median(errors),
    meanReprojectionErrorPixels: errors.length ? errors.reduce((a,b)=>a+b,0)/errors.length : null,
    p95ReprojectionErrorPixels: percentile95,
    heldOutObservations,
    heldOutMedianReprojectionErrorPixels: median(heldOutErrors),
    heldOutP95ReprojectionErrorPixels: heldOutP95,
    heldOutPolicy: "Interior observations are excluded from endpoint triangulation and reported separately. Camera poses may still have been estimated or optimized using the same video observations, so this is not an independent camera-pose holdout.",
    calibrationAssumed: true,
    metricScaleKnown: false,
    limitation: "This is a track-based diagnostic using the supplied camera path and assumed intrinsics. Interior views are held out only from endpoint landmark triangulation; camera poses may still depend on the same video observations. It is not independent camera-pose validation or ground-truth accuracy."
  };
}
