import { strict as assert } from "node:assert";
import { detectFeatures, summarizeParallax } from "../reconstruction/sparse-reconstruction.js";

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

const frame = texturedFrame(96, 72);
const features = detectFeatures(frame, { maxFeatures: 80, minDistance: 5 });
assert.ok(features.length > 0, "textured frame should yield detectable corners");
assert.ok(features.length <= 80, "feature count must respect configured limit");

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
