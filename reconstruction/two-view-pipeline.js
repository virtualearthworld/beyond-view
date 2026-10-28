import { estimateEpipolarModel } from "./epipolar-geometry.js";
import { recoverCameraPoseCandidates, selectCameraPose } from "./camera-pose.js";

/**
 * Run the current classical two-view geometry stages on measured pixel tracks.
 * K1/K2 must be camera intrinsic calibration matrices in the same pixel
 * coordinate system as the observations. Moving-object tracks may be RANSAC
 * outliers for camera motion; they should be retained separately for later
 * dynamic-object reconstruction, not discarded from the final scene.
 */
export function estimateTwoViewPose(tracks, {
  K1, K2 = K1,
  thresholdPixels = 2,
  iterations = 250,
  minInliers = 12,
  minimumPoints = 8,
  minimumPositiveDepthRatio = 0.6
} = {}) {
  if (!Array.isArray(tracks) || !Array.isArray(K1) || !Array.isArray(K2)) {
    throw new TypeError("Provide tracks and camera intrinsic matrices K1 and K2.");
  }
  const epipolar = estimateEpipolarModel(tracks, {
    thresholdPixels, iterations, minInliers
  });
  if (!epipolar.F || epipolar.inliers.length < minInliers ||
      epipolar.status !== "epipolar-model-found") {
    return {
      status: "insufficient-epipolar-support",
      epipolar,
      pose: null,
      limitation: "No stable two-view pose is reported unless the epipolar model has sufficient inlier support."
    };
  }
  const F = Array.from({ length: 3 }, (_, row) =>
    epipolar.F.slice(row * 3, row * 3 + 3)
  );
  let recovered;
  try {
    recovered = recoverCameraPoseCandidates(F, K1, K2);
  } catch (error) {
    return {
      status: "pose-recovery-failed",
      epipolar,
      pose: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
  let selection;
  try {
    selection = selectCameraPose(recovered.candidates, epipolar.inliers, K1, K2, {
      minimumPoints,
      minimumPositiveDepthRatio
    });
  } catch (error) {
    return {
      status: "pose-selection-failed",
      epipolar,
      recovered,
      pose: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
  return {
    status: selection.status === "pose-selected" ? "two-view-pose-estimated" : selection.status,
    epipolar: {
      status: epipolar.status,
      totalTracks: epipolar.totalTracks,
      inlierCount: epipolar.inliers.length,
      inlierRatio: epipolar.inlierRatio,
      medianEpipolarErrorPixels: epipolar.medianEpipolarErrorPixels
    },
    pose: selection.selectedIndex === null ? null : recovered.candidates[selection.selectedIndex],
    selectedCandidateIndex: selection.selectedIndex,
    candidateScores: selection.candidates,
    scaleKnown: false,
    limitation: "This estimates relative pose only, up to translation scale. It does not create dense surfaces, infer hidden areas, or by itself make a walkable scene."
  };
}
