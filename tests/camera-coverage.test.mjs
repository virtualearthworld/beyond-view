import assert from "node:assert/strict";
import { summarizeCameraCoverage } from "../reconstruction/camera-coverage.js";

const identity = [[1,0,0],[0,1,0],[0,0,1]];
const pose = (frame, componentId, translation, rotation = identity) => ({
  frame, componentId, rotation, translation, status: "estimated"
});

const trajectory = {
  poses: [
    pose(0, 0, [0,0,0]),
    pose(1, 0, [-1,0,0]),
    pose(2, 0, [-2,0,0]),
    { frame: 3, componentId: null, rotation: null, translation: null, status: "gap" },
    pose(4, 1, [0,0,0]),
    pose(5, 1, [-1,0,0])
  ],
  segments: [
    { fromFrame: 0, toFrame: 1, componentId: 0, status: "estimated" },
    { fromFrame: 1, toFrame: 2, componentId: 0, status: "estimated" },
    { fromFrame: 2, toFrame: 3, status: "pose-unavailable" },
    { fromFrame: 4, toFrame: 5, componentId: 1, status: "estimated" },
    { fromFrame: 5, toFrame: 6, componentId: 1, status: "estimated" }
  ]
};

const result = summarizeCameraCoverage(trajectory);
assert.equal(result.status, "observed-camera-paths-available");
assert.equal(result.componentCount, 2);
assert.equal(result.pathCount, 2);
assert.equal(result.supportedSegmentCount, 3);
assert.equal(result.supportedPoseCount, 5);
assert.equal(result.gapCount, 1);
assert.equal(result.unsupportedSegmentCount, 2);
assert.equal(result.missingPoseEndpointCount, 1);
assert.deepEqual(result.paths[0].frameIndices, [0,1,2]);
assert.deepEqual(result.paths[0].cameraCenters.map(item => item.position), [
  [0,0,0], [1,0,0], [2,0,0]
]);
assert.equal(result.paths[0].pathLengthUnitBaselines, 2);
assert.deepEqual(result.components[0].bounds, {
  min: [0,0,0], max: [2,0,0], span: [2,0,0]
});
assert.deepEqual(result.paths[1].frameIndices, [4,5]);
assert.equal(result.paths[1].pathLengthUnitBaselines, 1);
assert.equal(result.totalPathLengthUnitBaselines, 3);
assert.equal(result.navigation.enabled, false);
assert.equal(result.navigation.extrapolationAllowed, false);
assert.equal(result.navigation.gapBridgingAllowed, false);

// A missing relative pose must split the path; it is never interpolated.
const split = summarizeCameraCoverage({
  poses: [pose(0, 0, [0,0,0]), pose(1, 0, [-1,0,0]),
    pose(2, 0, [-2,0,0]), pose(3, 0, [-3,0,0])],
  segments: [
    { fromFrame: 0, toFrame: 1, componentId: 0, status: "estimated" },
    { fromFrame: 1, toFrame: 2, status: "failed" },
    { fromFrame: 2, toFrame: 3, componentId: 0, status: "estimated" }
  ]
});
assert.equal(split.pathCount, 2);
assert.deepEqual(split.paths.map(path => path.frameIndices), [[0,1],[2,3]]);

// A segment with a malformed rotation cannot extend the observed path.
const malformed = summarizeCameraCoverage({
  poses: [pose(0, 0, [0,0,0]), {
    ...pose(1, 0, [-1,0,0]), rotation: [[1,0,0],[0,1,0],[0,0,-1]]
  }],
  segments: [{ fromFrame: 0, toFrame: 1, componentId: 0, status: "estimated" }]
});
assert.equal(malformed.supportedSegmentCount, 0);
assert.equal(malformed.unsupportedSegmentCount, 1);
assert.equal(malformed.status, "no-observed-camera-paths");
assert.equal(malformed.navigation.enabled, false);

assert.throws(() => summarizeCameraCoverage(null), /trajectory segments and camera poses/);
console.log("camera coverage path tests passed");
