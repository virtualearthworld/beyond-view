/**
 * Beyond View — first-party sparse reconstruction primitives.
 *
 * No hosted converter, remote model, or third-party reconstruction API is used.
 * This is an early classical-CV stage, not yet a complete video-to-walkable-3D
 * converter. Monocular scale, camera pose, occlusion, and dense surfaces still
 * need to be solved and validated before this output can be called a finished
 * reconstruction.
 *
 * The output deliberately contains only measured image features and parallax
 * observations. It does not synthesize unseen objects or hidden surfaces.
 */

export function sampleVideoFrames(video, {
  intervalSeconds = 0.5,
  maxFrames = 80,
  width = 640
} = {}) {
  if (!(video instanceof HTMLVideoElement)) {
    throw new TypeError("Expected an HTMLVideoElement.");
  }
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    throw new Error("The video must be loaded and have a finite duration.");
  }
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, width / video.videoWidth);
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D is unavailable.");

  const times = [];
  const step = Math.max(0.1, intervalSeconds);
  for (let t = 0; t < video.duration && times.length < maxFrames; t += step) {
    times.push(t);
  }

  return new Promise((resolve, reject) => {
    const frames = [];
    let index = 0;
    const previousTime = video.currentTime;
    const restore = () => {
      video.removeEventListener("seeked", onSeeked);
      try { video.currentTime = previousTime; } catch {}
    };
    const onSeeked = () => {
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push({
          time: times[index],
          width: canvas.width,
          height: canvas.height,
          rgba: new Uint8ClampedArray(ctx.getImageData(
            0, 0, canvas.width, canvas.height
          ).data)
        });
        index += 1;
        if (index >= times.length) {
          restore();
          resolve(frames);
          return;
        }
        video.currentTime = times[index];
      } catch (error) {
        restore();
        reject(error);
      }
    };
    video.addEventListener("seeked", onSeeked);
    // Seeking to the current time (often 0) may not emit a seeked event.
    // Force an initial seek so the first frame cannot leave analysis hanging.
    video.currentTime = Math.min(video.duration, Math.max(0.01, times[0]));
  });
}

function grayAt(frame, x, y) {
  const i = (y * frame.width + x) * 4;
  const p = frame.rgba;
  return 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
}

/** Detect repeatable corners with a small Harris-style structure tensor. */
export function detectFeatures(frame, { maxFeatures = 900, minDistance = 8 } = {}) {
  const { width: w, height: h } = frame;
  const candidates = [];
  const grad = (x, y) => ({
    x: grayAt(frame, x + 1, y) - grayAt(frame, x - 1, y),
    y: grayAt(frame, x, y + 1) - grayAt(frame, x, y - 1)
  });

  for (let y = 3; y < h - 3; y += 2) {
    for (let x = 3; x < w - 3; x += 2) {
      let xx = 0, yy = 0, xy = 0;
      for (let wy = -1; wy <= 1; wy++) {
        for (let wx = -1; wx <= 1; wx++) {
          const g = grad(x + wx, y + wy);
          xx += g.x * g.x;
          yy += g.y * g.y;
          xy += g.x * g.y;
        }
      }
      const det = xx * yy - xy * xy;
      const trace = xx + yy;
      const score = det - 0.045 * trace * trace;
      if (score > 1e7) candidates.push({ x, y, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const selected = [];
  const cellSize = minDistance;
  const occupied = new Set();
  for (const p of candidates) {
    const gx = Math.floor(p.x / cellSize);
    const gy = Math.floor(p.y / cellSize);
    let crowded = false;
    for (let dy = -1; dy <= 1 && !crowded; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (occupied.has((gx + dx) + ":" + (gy + dy))) {
          crowded = true;
          break;
        }
      }
    }
    if (crowded) continue;
    selected.push(p);
    occupied.add(gx + ":" + gy);
    if (selected.length >= maxFeatures) break;
  }
  return selected;
}

function patchError(a, ax, ay, b, bx, by, radius = 3) {
  let error = 0, count = 0;
  const meanA = grayAt(a, ax, ay);
  const meanB = grayAt(b, bx, by);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const va = grayAt(a, ax + dx, ay + dy) - meanA;
      const vb = grayAt(b, bx + dx, by + dy) - meanB;
      error += Math.abs(va - vb);
      count++;
    }
  }
  return error / count;
}

/**
 * Track local image patches between adjacent frames.
 * Tracks are observations, not proof of 3D geometry; mismatches are retained
 * only when the best match is sufficiently distinct from the second best.
 */
export function trackFeatures(a, b, features, {
  searchRadius = 28,
  patchRadius = 3,
  maxMeanError = 24,
  uniqueness = 0.88
} = {}) {
  const tracks = [];
  for (const p of features) {
    let best = Infinity, second = Infinity, match = null;
    const minX = Math.max(patchRadius + 1, p.x - searchRadius);
    const maxX = Math.min(b.width - patchRadius - 2, p.x + searchRadius);
    const minY = Math.max(patchRadius + 1, p.y - searchRadius);
    const maxY = Math.min(b.height - patchRadius - 2, p.y + searchRadius);
    for (let y = minY; y <= maxY; y += 2) {
      for (let x = minX; x <= maxX; x += 2) {
        const e = patchError(a, p.x, p.y, b, x, y, patchRadius);
        if (e < best) {
          second = best;
          best = e;
          match = { x, y };
        } else if (e < second) {
          second = e;
        }
      }
    }
    if (match && best <= maxMeanError && best < second * uniqueness) {
      tracks.push({
        from: { x: p.x, y: p.y },
        to: match,
        patchError: best,
        parallaxPixels: Math.hypot(match.x - p.x, match.y - p.y)
      });
    }
  }
  return tracks;
}


/**
 * Estimate a dominant 2D translation with a median model and return inliers.
 * This is a robust diagnostic for simple motion, not a full camera-pose solve:
 * perspective, rotation, and independently moving objects can violate it.
 */
export function estimateDominantTranslation(tracks, { inlierThreshold = 3 } = {}) {
  if (!Array.isArray(tracks) || !Number.isFinite(inlierThreshold) || inlierThreshold < 0) {
    throw new TypeError("Expected tracks and a non-negative inlier threshold.");
  }
  const valid = tracks.filter(t =>
    t && t.from && t.to &&
    Number.isFinite(t.from.x) && Number.isFinite(t.from.y) &&
    Number.isFinite(t.to.x) && Number.isFinite(t.to.y)
  );
  const median = values => {
    if (!values.length) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const dxValues = valid.map(t => t.to.x - t.from.x);
  const dyValues = valid.map(t => t.to.y - t.from.y);
  const dx = median(dxValues), dy = median(dyValues);
  if (dx === null || dy === null) {
    return { dx: null, dy: null, inliers: [], outliers: [], inlierRatio: 0, status: "insufficient-tracks" };
  }
  const inliers = [], outliers = [];
  for (const track of valid) {
    const error = Math.hypot((track.to.x - track.from.x) - dx, (track.to.y - track.from.y) - dy);
    (error <= inlierThreshold ? inliers : outliers).push({ ...track, motionModelErrorPixels: error });
  }
  return {
    dx, dy, inliers, outliers,
    inlierRatio: inliers.length / valid.length,
    status: inliers.length >= 8 ? "dominant-translation-found" : "weak-motion-support",
    limitation: "A 2D translation model is only a diagnostic; it is not camera rotation, depth, or 3D geometry."
  };
}

/**
 * Produce a transparent diagnostic summary of measured parallax. This is
 * intentionally not named a mesh or scene: without calibrated camera poses
 * and triangulation, 2D displacement alone cannot determine reliable depth.
 */
export function summarizeParallax(frameA, frameB, tracks) {
  const width = frameA.width;
  const height = frameA.height;
  const valid = tracks.filter(t =>
    t.from.x >= 0 && t.from.x < width &&
    t.from.y >= 0 && t.from.y < height &&
    t.to.x >= 0 && t.to.x < frameB.width &&
    t.to.y >= 0 && t.to.y < frameB.height
  );
  const dx = valid.map(t => t.to.x - t.from.x).sort((a, b) => a - b);
  const dy = valid.map(t => t.to.y - t.from.y).sort((a, b) => a - b);
  const median = values => values.length
    ? values[Math.floor(values.length / 2)] : null;
  return {
    matchedFeatures: valid.length,
    medianDisplacementPixels: valid.length
      ? Math.hypot(median(dx), median(dy)) : 0,
    medianDxPixels: median(dx),
    medianDyPixels: median(dy),
    tracks: valid,
    status: valid.length >= 30
      ? "parallax-observed"
      : "insufficient-tracks",
    limitation: "No calibrated camera pose or metric depth has been solved yet."
  };
}


/**
 * Link adjacent-frame correspondences into short multi-frame trajectories.
 * Matching is based only on observed image coordinates; this does not imply
 * stable 3D identity when an object is occluded or a patch match is wrong.
 */
export function linkTrackSequences(pairwiseTracks, {
  joinTolerancePixels = 3,
  minObservations = 3
} = {}) {
  if (!Array.isArray(pairwiseTracks) ||
      !Number.isFinite(joinTolerancePixels) || joinTolerancePixels < 0 ||
      !Number.isInteger(minObservations) || minObservations < 2) {
    throw new TypeError("Invalid track-sequence options.");
  }
  if (pairwiseTracks.length === 0) return [];
  let trajectories = pairwiseTracks[0]
    .filter(t => t?.from && t?.to &&
      [t.from.x,t.from.y,t.to.x,t.to.y].every(Number.isFinite))
    .map(t => ({ observations: [{...t.from},{...t.to}], patchErrors: [t.patchError].filter(Number.isFinite) }));
  for (let pairIndex = 1; pairIndex < pairwiseTracks.length; pairIndex++) {
    const nextTracks = pairwiseTracks[pairIndex].filter(t => t?.from && t?.to &&
      [t.from.x,t.from.y,t.to.x,t.to.y].every(Number.isFinite));
    const candidates = [];
    trajectories.forEach((trajectory, ti) => {
      const last = trajectory.observations[trajectory.observations.length - 1];
      nextTracks.forEach((track, ni) => {
        const error = Math.hypot(last.x-track.from.x,last.y-track.from.y);
        if (error <= joinTolerancePixels) candidates.push({ti,ni,error});
      });
    });
    candidates.sort((a,b)=>a.error-b.error);
    const usedTrajectories = new Set(), usedTracks = new Set();
    const joined = new Map();
    for (const candidate of candidates) {
      if (usedTrajectories.has(candidate.ti) || usedTracks.has(candidate.ni)) continue;
      usedTrajectories.add(candidate.ti); usedTracks.add(candidate.ni);
      joined.set(candidate.ti, nextTracks[candidate.ni]);
    }
    trajectories = trajectories.flatMap((trajectory,index)=>{
      const track = joined.get(index);
      if (!track) return [];
      return [{
        observations: [...trajectory.observations,{...track.to}],
        patchErrors: [...trajectory.patchErrors,...(Number.isFinite(track.patchError)?[track.patchError]:[])]
      }];
    });
  }
  return trajectories.filter(t=>t.observations.length>=minObservations);
}
