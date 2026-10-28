import { projectHomography } from "./multiview-geometry.js";

/**
 * Measure residual motion that a fitted 2D homography cannot explain.
 * This is a readiness diagnostic for 3D work, not a camera-pose estimate.
 * All coordinates are observed image points; no unseen content is generated.
 */
export function analyzeParallaxResiduals(tracks, H, {
  residualThresholdPixels = 2.5,
  minTracks = 8,
  gridColumns = 4,
  gridRows = 3
} = {}) {
  if (!Array.isArray(tracks) ||
      !Number.isFinite(residualThresholdPixels) || residualThresholdPixels <= 0 ||
      !Number.isInteger(minTracks) || minTracks < 4 ||
      !Number.isInteger(gridColumns) || gridColumns < 1 ||
      !Number.isInteger(gridRows) || gridRows < 1) {
    throw new TypeError("Invalid parallax diagnostic inputs or options.");
  }
  if (!Array.isArray(H) || H.length !== 9 || H.some(v => !Number.isFinite(v))) {
    throw new TypeError("H must contain nine finite homography values.");
  }
  const valid = tracks.filter(t => t?.from && t?.to &&
    [t.from.x, t.from.y, t.to.x, t.to.y].every(Number.isFinite));
  if (valid.length < minTracks) {
    return { status: "insufficient-tracks", totalTracks: valid.length,
      explainedTracks: 0, residualTracks: 0, residualRatio: 0,
      spatialCoverageCells: 0, medianResidualPixels: null };
  }
  const width = Math.max(1, ...valid.map(t => t.from.x));
  const height = Math.max(1, ...valid.map(t => t.from.y));
  const cells = new Set();
  const residuals = [];
  let explainedTracks = 0;
  for (const t of valid) {
    const projected = projectHomography(H, [t.from.x, t.from.y]);
    if (!projected) continue;
    const residual = Math.hypot(projected[0] - t.to.x, projected[1] - t.to.y);
    residuals.push(residual);
    if (residual <= residualThresholdPixels) explainedTracks++;
    else {
      const gx = Math.min(gridColumns - 1, Math.floor(t.from.x / width * gridColumns));
      const gy = Math.min(gridRows - 1, Math.floor(t.from.y / height * gridRows));
      cells.add(gy * gridColumns + gx);
    }
  }
  residuals.sort((a, b) => a - b);
  const medianResidualPixels = residuals.length
    ? residuals[Math.floor(residuals.length / 2)] : null;
  const residualTracks = residuals.length - explainedTracks;
  const residualRatio = residuals.length ? residualTracks / residuals.length : 0;
  const spatialCoverageCells = cells.size;
  let status = "weak-motion-evidence";
  if (residuals.length < minTracks) status = "insufficient-valid-projections";
  else if (residualTracks >= minTracks && spatialCoverageCells >= 3) status = "distributed-non-homographic-motion";
  else if (explainedTracks / residuals.length >= 0.85) status = "homography-dominant";
  return {
    status, totalTracks: residuals.length, explainedTracks, residualTracks,
    residualRatio, spatialCoverageCells, medianResidualPixels,
    thresholdPixels: residualThresholdPixels,
    limitation: "Residual motion can come from depth parallax, moving objects, or mismatches; this is not a camera-pose or depth solution."
  };
}
