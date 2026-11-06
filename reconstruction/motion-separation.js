/**
 * Conservative stationary-vs-independent-motion classification.
 *
 * This classifies image tracks by agreement with a robust background
 * homography. Residual tracks are candidates for independently moving
 * content, parallax, occlusion, or tracking error; they are NOT semantic
 * person/water detections. Ambiguous tracks are preserved.
 */
export function classifyMotionLayers(tracks, homography, {
  width,
  height,
  reprojectionThreshold = 3,
  minimumBackgroundTracks = 8,
  gridColumns = 3,
  gridRows = 3,
  minimumOccupiedCells = 3
} = {}) {
  if (!Array.isArray(tracks) ||
      !Number.isFinite(width) || width <= 0 ||
      !Number.isFinite(height) || height <= 0 ||
      !Number.isFinite(reprojectionThreshold) || reprojectionThreshold <= 0 ||
      !Number.isInteger(minimumBackgroundTracks) || minimumBackgroundTracks < 4 ||
      !Number.isInteger(gridColumns) || gridColumns < 1 ||
      !Number.isInteger(gridRows) || gridRows < 1 ||
      !Number.isInteger(minimumOccupiedCells) || minimumOccupiedCells < 1 ||
      minimumOccupiedCells > gridColumns * gridRows) {
    throw new TypeError("Invalid motion-layer classification options.");
  }

  const valid = tracks.filter(track => track?.from && track?.to &&
    [track.from.x, track.from.y, track.to.x, track.to.y].every(Number.isFinite) &&
    track.from.x >= 0 && track.from.x < width &&
    track.from.y >= 0 && track.from.y < height &&
    track.to.x >= 0 && track.to.x < width &&
    track.to.y >= 0 && track.to.y < height);

  const H = homography?.H;
  const validH = Array.isArray(H) && H.length === 9 && H.every(Number.isFinite);
  const project = point => {
    const z = H[6] * point.x + H[7] * point.y + H[8];
    if (!Number.isFinite(z) || Math.abs(z) < 1e-9) return null;
    const x = (H[0] * point.x + H[1] * point.y + H[2]) / z;
    const y = (H[3] * point.x + H[4] * point.y + H[5]) / z;
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  };

  if (!validH) {
    return {
      status: "insufficient-background-model",
      backgroundConsistent: [],
      independentMotionCandidates: [],
      ambiguous: valid,
      measurements: { validTracks: valid.length, backgroundTracks: 0, candidateTracks: 0, ambiguousTracks: valid.length, occupiedCells: 0 },
      limitation: "No valid background homography was available; all tracks are preserved as ambiguous."
    };
  }

  const measured = valid.map(track => {
    const projected = project(track.from);
    const error = projected
      ? Math.hypot(projected.x - track.to.x, projected.y - track.to.y)
      : Infinity;
    return { track, error };
  });
  const inliers = measured.filter(item => item.error <= reprojectionThreshold);
  const cells = new Set(inliers.map(({track}) => {
    const x = Math.min(gridColumns - 1, Math.floor(track.from.x / width * gridColumns));
    const y = Math.min(gridRows - 1, Math.floor(track.from.y / height * gridRows));
    return y * gridColumns + x;
  }));
  const modelSupported = inliers.length >= minimumBackgroundTracks &&
    cells.size >= minimumOccupiedCells;

  if (!modelSupported) {
    return {
      status: "insufficient-background-model",
      backgroundConsistent: [],
      independentMotionCandidates: [],
      ambiguous: valid,
      measurements: { validTracks: valid.length, backgroundTracks: 0, candidateTracks: 0, ambiguousTracks: valid.length, occupiedCells: cells.size },
      limitation: "The background model lacks enough inliers or spatial coverage; no track is labelled moving or stationary."
    };
  }

  const inlierSet = new Set(inliers.map(item => item.track));
  const backgroundConsistent = [];
  const independentMotionCandidates = [];
  for (const item of measured) {
    if (inlierSet.has(item.track)) backgroundConsistent.push({ ...item.track, backgroundModelErrorPixels: item.error });
    else independentMotionCandidates.push({ ...item.track, backgroundModelErrorPixels: item.error });
  }
  return {
    status: "background-model-supported",
    backgroundConsistent,
    independentMotionCandidates,
    ambiguous: [],
    measurements: {
      validTracks: valid.length,
      backgroundTracks: backgroundConsistent.length,
      candidateTracks: independentMotionCandidates.length,
      ambiguousTracks: 0,
      occupiedCells: cells.size
    },
    limitation: "Residual tracks may be moving subjects, parallax, occlusion, reflections, or matching errors. This is motion segmentation, not semantic detection of people or water."
  };
}
