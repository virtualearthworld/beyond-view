/**
 * Camera-calibration sensitivity sweep for the Reconstruction Lab.
 *
 * This evaluates provisional focal-length assumptions without selecting a
 * "best" calibration. In addition to pose-recovery counts, it compares each
 * pairwise relative pose with the tested assumption nearest the user's
 * entered focal length. These deltas quantify sensitivity, not correctness.
 */
const validRotation = value => Array.isArray(value) && value.length === 3 &&
  value.every(row => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite));
const validVector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const vectorNorm = value => Math.hypot(...value);

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function rotationDifferenceDegrees(first, second) {
  // trace(R1^T R2) is the Frobenius inner product for proper rotations.
  let trace = 0;
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      trace += first[row][column] * second[row][column];
    }
  }
  return Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2))) * 180 / Math.PI;
}

function directionDifferenceDegrees(first, second) {
  const firstNorm = vectorNorm(first), secondNorm = vectorNorm(second);
  if (firstNorm <= 1e-12 || secondNorm <= 1e-12) return null;
  const cosine = first.reduce((sum, value, index) =>
    sum + value * second[index], 0) / (firstNorm * secondNorm);
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

function hasUsableRelativePose(segment) {
  return segment?.status === "estimated" && Number.isInteger(segment.index) &&
    validRotation(segment.pose?.rotation) &&
    validVector(segment.pose?.translationDirection) &&
    vectorNorm(segment.pose.translationDirection) > 1e-12;
}

function comparePairwisePoses(referenceTrajectory, candidateTrajectory, {
  referenceMultiplier,
  referenceFocalLengthPixels,
  isReference
}) {
  const referenceSegments = new Map((referenceTrajectory?.segments || [])
    .filter(hasUsableRelativePose).map(segment => [segment.index, segment]));
  const candidateSegments = new Map((candidateTrajectory?.segments || [])
    .filter(hasUsableRelativePose).map(segment => [segment.index, segment]));
  const pairComparisons = [];

  for (const [pairIndex, reference] of referenceSegments) {
    const candidate = candidateSegments.get(pairIndex);
    if (!candidate) continue;
    const rotationDeltaDegrees = rotationDifferenceDegrees(
      reference.pose.rotation, candidate.pose.rotation
    );
    const translationDirectionDeltaDegrees = directionDifferenceDegrees(
      reference.pose.translationDirection, candidate.pose.translationDirection
    );
    if (!Number.isFinite(rotationDeltaDegrees) ||
        !Number.isFinite(translationDirectionDeltaDegrees)) continue;
    pairComparisons.push({
      pairIndex,
      rotationDeltaDegrees,
      translationDirectionDeltaDegrees
    });
  }

  const rotationDeltas = pairComparisons.map(pair => pair.rotationDeltaDegrees);
  const translationDeltas = pairComparisons.map(pair => pair.translationDirectionDeltaDegrees);
  return {
    status: isReference ? "reference" :
      pairComparisons.length ? "compared" : "no-common-estimated-pairs",
    referenceMultiplier,
    referenceFocalLengthPixels,
    isReference,
    referenceEstimatedPairCount: referenceSegments.size,
    candidateEstimatedPairCount: candidateSegments.size,
    comparedPairCount: pairComparisons.length,
    referenceOnlyPairCount: [...referenceSegments.keys()].filter(index => !candidateSegments.has(index)).length,
    candidateOnlyPairCount: [...candidateSegments.keys()].filter(index => !referenceSegments.has(index)).length,
    medianRotationDeltaDegrees: median(rotationDeltas),
    p95RotationDeltaDegrees: percentile(rotationDeltas, 0.95),
    medianTranslationDirectionDeltaDegrees: median(translationDeltas),
    p95TranslationDirectionDeltaDegrees: percentile(translationDeltas, 0.95),
    pairComparisons
  };
}

/**
 * @param {Array} framePairs Adjacent frame correspondences.
 * @param {object} options
 * @param {number} options.width Analysis-frame width.
 * @param {number} options.height Analysis-frame height.
 * @param {number[]} [options.focalMultipliers] Tested focal lengths as multiples of image width.
 * @param {number} [options.referenceFocalLengthPixels] User-entered focal length in analysis pixels.
 * @param {Function} options.estimateTrajectory Camera-trajectory estimator.
 */
export function analyzeCalibrationSensitivity(framePairs, {
  width,
  height,
  focalMultipliers = [0.8, 1, 1.2, 1.4, 1.6],
  referenceFocalLengthPixels,
  estimateTrajectory
} = {}) {
  if (!Array.isArray(framePairs) || framePairs.length === 0 ||
      !Number.isFinite(width) || width <= 0 ||
      !Number.isFinite(height) || height <= 0 ||
      !Array.isArray(focalMultipliers) || focalMultipliers.length === 0 ||
      focalMultipliers.some(value => !Number.isFinite(value) || value <= 0) ||
      (referenceFocalLengthPixels !== undefined &&
        (!Number.isFinite(referenceFocalLengthPixels) || referenceFocalLengthPixels <= 0)) ||
      typeof estimateTrajectory !== "function") {
    throw new TypeError("Provide frame pairs, image dimensions, positive focal multipliers, an optional positive reference focal length, and an estimator.");
  }

  const referenceFocal = referenceFocalLengthPixels ?? width;
  const referenceMultiplier = referenceFocal / width;
  const runs = focalMultipliers.map(multiplier => {
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
      scaleKnown: false,
      trajectory
    };
  });

  let referenceIndex = 0;
  for (let index = 1; index < runs.length; index++) {
    if (Math.abs(runs[index].multiplier - referenceMultiplier) <
        Math.abs(runs[referenceIndex].multiplier - referenceMultiplier)) {
      referenceIndex = index;
    }
  }
  const referenceRun = runs[referenceIndex];
  return runs.map((run, index) => {
    const poseSensitivity = comparePairwisePoses(referenceRun.trajectory, run.trajectory, {
      referenceMultiplier: referenceRun.multiplier,
      referenceFocalLengthPixels: referenceRun.focalLengthPixels,
      isReference: index === referenceIndex
    });
    const { trajectory, ...publicRun } = run;
    return { ...publicRun, poseSensitivity };
  });
}
