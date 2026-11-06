/**
 * Camera-calibration sensitivity sweep for the Reconstruction Lab.
 *
 * This deliberately evaluates a range of provisional focal lengths without
 * selecting a "best" calibration. Successful relative-pose recovery is a
 * robustness diagnostic, not proof that the intrinsics or poses are accurate.
 */
export function analyzeCalibrationSensitivity(framePairs, {
  width,
  height,
  focalMultipliers = [0.8, 1, 1.2, 1.4, 1.6],
  estimateTrajectory
} = {}) {
  if (!Array.isArray(framePairs) || framePairs.length === 0 ||
      !Number.isFinite(width) || width <= 0 ||
      !Number.isFinite(height) || height <= 0 ||
      !Array.isArray(focalMultipliers) || focalMultipliers.length === 0 ||
      focalMultipliers.some(value => !Number.isFinite(value) || value <= 0) ||
      typeof estimateTrajectory !== "function") {
    throw new TypeError("Provide frame pairs, image dimensions, positive focal multipliers, and an estimator.");
  }

  const median = values => {
    if (!values.length) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  return focalMultipliers.map(multiplier => {
    const focalLengthPixels = width * multiplier;
    const K = [
      [focalLengthPixels, 0, width / 2],
      [0, focalLengthPixels, height / 2],
      [0, 0, 1]
    ];
    const trajectory = estimateTrajectory(framePairs, K, multiplier);
    const segments = Array.isArray(trajectory?.segments) ? trajectory.segments : [];
    const estimated = segments.filter(segment => segment?.status === "estimated");
    const inlierCounts = estimated
      .map(segment => segment.diagnostics?.epipolar?.inlierCount)
      .filter(Number.isFinite);
    return {
      multiplier,
      focalLengthPixels,
      pairCount: framePairs.length,
      recoveredPairs: estimated.length,
      medianEpipolarInliers: median(inlierCounts),
      trajectoryStatus: trajectory?.status ?? "unavailable",
      scaleKnown: false
    };
  });
}
