import test from "node:test";
import assert from "node:assert/strict";
import { reconstructSparseTrajectory } from "../reconstruction/trajectory-reconstruction.js";

const K = [[640,0,320],[0,640,180],[0,0,1]];
const identity = [[1,0,0],[0,1,0],[0,0,1]];

test("rejects weak-parallax points from the stable sparse cloud", () => {
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
  assert.equal(result.pointCount, 0);
  assert.equal(result.segments[0].pointCount, 0);
  assert.equal(result.segments[0].diagnostics.lowParallax, 1);
  assert.equal(result.segments[0].diagnostics.lowParallaxRejected, 1);
  assert.equal(result.lowParallaxPointCount, 1);
  assert.equal(result.rejectedLowParallaxPointCount, 1);
  assert.equal(result.validSegmentCount, 0);
  assert.equal(result.scaleKnown, false);
  const accepted = reconstructSparseTrajectory(framePairs, trajectory, K, {
    maxReprojectionError: 0.01,
    minimumPoints: 1,
    minimumTriangulationAngleDegrees: 2
  });
  assert.equal(accepted.pointCount, 1);
  assert.ok(accepted.segments[0].points[0].triangulationAngleDegrees > 2);
});

test("rejects an invalid triangulation-angle threshold", () => {
  assert.throws(() => reconstructSparseTrajectory([], { segments: [] }, K, {
    minimumTriangulationAngleDegrees: 91
  }), TypeError);
});
