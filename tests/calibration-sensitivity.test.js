import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCalibrationSensitivity } from "../reconstruction/calibration-sensitivity.js";

test("sweeps focal assumptions without choosing a calibration", () => {
  const framePairs = [{ tracks: [] }, { tracks: [] }, { tracks: [] }];
  const calls = [];
  const results = analyzeCalibrationSensitivity(framePairs, {
    width: 640,
    height: 360,
    focalMultipliers: [0.8, 1, 1.2],
    estimateTrajectory: (_pairs, K, multiplier) => {
      calls.push({ K, multiplier });
      const count = Math.round(multiplier * 100);
      return {
        status: "partial-trajectory",
        segments: [
          { status: "estimated", diagnostics: { epipolar: { inlierCount: count } } },
          { status: "gap" },
          { status: "estimated", diagnostics: { epipolar: { inlierCount: count + 2 } } }
        ]
      };
    }
  });

  assert.equal(results.length, 3);
  assert.equal(results[0].focalLengthPixels, 512);
  assert.equal(results[1].focalLengthPixels, 640);
  assert.equal(results[2].focalLengthPixels, 768);
  assert.deepEqual(results.map(result => result.recoveredPairs), [2, 2, 2]);
  assert.deepEqual(results.map(result => result.medianEpipolarInliers), [81, 101, 121]);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[1].K, [[640, 0, 320], [0, 640, 180], [0, 0, 1]]);
  assert.ok(results.every(result => result.scaleKnown === false));
});

test("rejects invalid calibration sweep inputs", () => {
  assert.throws(() => analyzeCalibrationSensitivity([], {
    width: 640, height: 360, estimateTrajectory: () => ({ segments: [] })
  }), TypeError);
});
