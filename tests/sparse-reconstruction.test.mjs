import { strict as assert } from "node:assert";
import { detectFeatures, summarizeParallax, trackFeatures, estimateDominantTranslation, linkTrackSequences } from "../reconstruction/sparse-reconstruction.js";

// Deterministic textured frame: corner detection must find image evidence,
// not fabricate a feature list for a blank frame.
function texturedFrame(width, height) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  let seed = 123456789;
  for (let i = 0; i < width * height; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const value = (seed >>> 24) & 255;
    rgba[i * 4] = value;
    rgba[i * 4 + 1] = value;
    rgba[i * 4 + 2] = value;
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, rgba };
}


function shiftFrame(source, dx, dy) {
  const rgba = new Uint8ClampedArray(source.width * source.height * 4);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const sx = x - dx, sy = y - dy;
      const to = (y * source.width + x) * 4;
      if (sx >= 0 && sx < source.width && sy >= 0 && sy < source.height) {
        const from = (sy * source.width + sx) * 4;
        rgba[to] = source.rgba[from];
        rgba[to + 1] = source.rgba[from + 1];
        rgba[to + 2] = source.rgba[from + 2];
        rgba[to + 3] = 255;
      } else {
        rgba[to] = rgba[to + 1] = rgba[to + 2] = 0;
        rgba[to + 3] = 255;
      }
    }
  }
  return { width: source.width, height: source.height, rgba };
}

const frame = texturedFrame(96, 72);
const features = detectFeatures(frame, { maxFeatures: 80, minDistance: 5 });
assert.ok(features.length > 0, "textured frame should yield detectable corners");
assert.ok(features.length <= 80, "feature count must respect configured limit");

// Known synthetic camera/image motion: a translated texture should track with
// the measured displacement, giving us an end-to-end test of the matching step.
const movedFrame = shiftFrame(frame, 4, 2);
const measuredTracks = trackFeatures(frame, movedFrame, features, {
  searchRadius: 8, patchRadius: 2, maxMeanError: 3, uniqueness: 0.9
});
assert.ok(measuredTracks.length >= 5, "translated texture should produce consistent tracks");
const correctMotion = measuredTracks.filter(t =>
  t.to.x - t.from.x === 4 && t.to.y - t.from.y === 2
);
assert.ok(correctMotion.length / measuredTracks.length >= 0.7,
  "most accepted tracks should recover the known +4,+2 pixel translation");

const frameB = texturedFrame(96, 72);
const tracks = [
  { from: { x: 10, y: 12 }, to: { x: 15, y: 14 }, patchError: 0, parallaxPixels: Math.sqrt(29) },
  { from: { x: 20, y: 24 }, to: { x: 25, y: 26 }, patchError: 0, parallaxPixels: Math.sqrt(29) }
];
const summary = summarizeParallax(frame, frameB, tracks);
assert.equal(summary.matchedFeatures, 2);
assert.equal(summary.medianDxPixels, 5);
assert.equal(summary.medianDyPixels, 2);
assert.equal(summary.status, "insufficient-tracks", "small track sets must not claim robust parallax");
assert.match(summary.limitation, /camera pose|depth/i);

console.log("sparse reconstruction tests passed");

const motionTracks = [
  ...Array.from({ length: 8 }, (_, i) => ({
    from: { x: i * 10, y: i * 5 },
    to: { x: i * 10 + 4, y: i * 5 + 2 }
  })),
  { from: { x: 30, y: 30 }, to: { x: 90, y: 5 } }
];
const motion = estimateDominantTranslation(motionTracks, { inlierThreshold: 2 });
assert.equal(motion.dx, 4);
assert.equal(motion.dy, 2);
assert.equal(motion.inliers.length, 8);
assert.equal(motion.outliers.length, 1);
assert.equal(motion.status, "dominant-translation-found");
assert.ok(motion.inlierRatio > 0.8);
console.log("dominant motion robust-outlier test passed");

const pair01 = [
  {from:{x:10,y:10},to:{x:12,y:11},patchError:2},
  {from:{x:30,y:20},to:{x:32,y:21},patchError:3},
  {from:{x:50,y:50},to:{x:90,y:90},patchError:4}
];
const pair12 = [
  {from:{x:12.5,y:11},to:{x:15,y:12},patchError:2},
  {from:{x:32,y:21.5},to:{x:34,y:22},patchError:3},
  {from:{x:90,y:90},to:{x:95,y:95},patchError:4}
];
const pair23 = [
  {from:{x:15,y:12},to:{x:18,y:13},patchError:2},
  {from:{x:34,y:22},to:{x:36,y:23},patchError:3}
];
const trajectories = linkTrackSequences([pair01,pair12,pair23], {
  joinTolerancePixels: 1, minObservations: 4
});
assert.equal(trajectories.length, 2, "only trajectories consistently observed across all three frame pairs should remain");
assert.ok(trajectories.every(t=>t.observations.length===4), "each trajectory should contain one observation per frame");
assert.deepEqual(trajectories[0].observations[0], {x:10,y:10});
assert.deepEqual(trajectories[0].observations[3], {x:18,y:13});
assert.equal(linkTrackSequences([], {}).length, 0, "empty frame sequences should return no trajectories");
assert.throws(()=>linkTrackSequences([], {joinTolerancePixels:-1}), /Invalid track-sequence options/);
console.log("multi-frame trajectory linking tests passed");

const { linkTrackSequencesByComponent } = await import("../reconstruction/sparse-reconstruction.js");
const componentAware = linkTrackSequencesByComponent(
  [pair01, pair12, pair23, pair01, pair12],
  [0, 0, null, 1, 1],
  { joinTolerancePixels: 1, minObservations: 3 }
);
assert.ok(componentAware.length >= 2, "tracks should be linked independently inside valid components");
assert.ok(componentAware.every(t => t.componentId === 0 || t.componentId === 1));
assert.ok(componentAware.every(t => !(t.fromPairIndex <= 2 && t.toPairIndex >= 3)),
  "a trajectory must never bridge a camera-component boundary");
assert.ok(componentAware.filter(t => t.componentId === 0).every(t => t.toPairIndex <= 1));
assert.ok(componentAware.filter(t => t.componentId === 1).every(t => t.fromPairIndex >= 3));
assert.throws(
  () => linkTrackSequencesByComponent([pair01], [0, 1]),
  /one non-negative component ID/
);
console.log("component-aware trajectory linking tests passed");
