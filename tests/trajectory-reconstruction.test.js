import test from "node:test";
import assert from "node:assert/strict";
import { reconstructSparseTrajectory } from "../reconstruction/trajectory-reconstruction.js";

const K = [[640,0,320],[0,640,180],[0,0,1]];
const identity = [[1,0,0],[0,1,0],[0,0,1]];

test("reports triangulation angle and flags weak parallax without discarding valid points", () => {
  const framePairs = [{
    fromFrame: 0,
    toFrame: 1,
    tracks: [{ from: { x: 320, y: 180 }, to: { x: 192, y: 180 } }]
  }];
  const trajectory = {
    segments: [{
      status: "estimated",
      pose: { rotation: identity, translationDirection: [-1,0,0] }
    }]
  };
  const result = reconstructSparseTrajectory(framePairs, trajectory, K, {
    maxReprojectionError: 0.01,
    minimumPoints: 1,
    minimumTriangulationAngleDegrees: 12
  });
  assert.equal(result.pointCount, 1);
  assert.ok(Math.abs(result.segments[0].points[0].triangulationAngleDegrees - 11.31) < 0.1);
  assert.equal(result.segments[0].diagnostics.lowParallax, 1);
  assert.equal(result.lowParallaxPointCount, 1);
  assert.equal(result.scaleKnown, false);
});

test("rejects an invalid triangulation-angle threshold", () => {
  assert.throws(() => reconstructSparseTrajectory([], { segments: [] }, K, {
    minimumTriangulationAngleDegrees: 91
  }), TypeError);
});
