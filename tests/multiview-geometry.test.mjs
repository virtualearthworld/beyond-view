import { strict as assert } from "node:assert";
import { projectPoint, triangulatePoint, triangulateTracks, estimateHomographyRansac, projectHomography } from "../reconstruction/multiview-geometry.js";

const P1 = [
  1,0,0,0,
  0,1,0,0,
  0,0,1,0
];
const P2 = [
  1,0,0,-1,
  0,1,0,0,
  0,0,1,0
];
const expected = [0.2, -0.1, 5];
const image1 = projectPoint(P1, expected);
const image2 = projectPoint(P2, expected);
assert.ok(image1 && image2);
const actual = triangulatePoint(P1, P2, image1, image2);
assert.ok(actual, "triangulation should return a point");
for (let i = 0; i < 3; i++) {
  assert.ok(Math.abs(actual[i] - expected[i]) < 1e-6,
    `coordinate ${i}: expected ${expected[i]}, got ${actual[i]}`);
}
const tracks = [{
  from: { x: image1[0], y: image1[1] },
  to: { x: image2[0], y: image2[1] }
}];
const sparse = triangulateTracks(P1, P2, tracks, { maxReprojectionError: 1e-5 });
assert.equal(sparse.length, 1);
assert.equal(sparse[0].observations, 2);
console.log("multiview geometry tests passed");

// A point behind both cameras can still satisfy image equations. It must not
// be accepted as a visible 3D reconstruction point.
const behind = [-0.2, 0.1, -5];
const behind1 = projectPoint(P1, behind);
const behind2 = projectPoint(P2, behind);
const rejectedBehind = triangulateTracks(P1, P2, [{
  from: {x: behind1[0], y: behind1[1]},
  to: {x: behind2[0], y: behind2[1]}
}]);
assert.equal(rejectedBehind.length, 0,
  "triangulation must reject points with negative camera-space depth");
const allowedBehind = triangulateTracks(P1, P2, [{
  from: {x: behind1[0], y: behind1[1]},
  to: {x: behind2[0], y: behind2[1]}
}], {requirePositiveDepth: false});
assert.equal(allowedBehind.length, 1,
  "positive-depth filtering should be explicitly switchable for nonstandard camera conventions");
assert.throws(() => triangulateTracks(P1, P2, [], {maxReprojectionError: -1}),
  /Invalid triangulation quality options/);
console.log("triangulation visibility and option validation tests passed");

const knownH = [1.1, 0.05, 7, -0.03, 0.95, 4, 0.0008, -0.0004, 1];
const perspectiveTracks = [];
for (let y = 0; y < 4; y++) {
  for (let x = 0; x < 4; x++) {
    const from = { x: 20 + x * 35, y: 15 + y * 28 };
    const to = projectHomography(knownH, [from.x, from.y]);
    perspectiveTracks.push({ from, to: { x: to[0], y: to[1] } });
  }
}
perspectiveTracks.push(
  { from: { x: 33, y: 40 }, to: { x: 200, y: 15 } },
  { from: { x: 90, y: 75 }, to: { x: 2, y: 240 } },
  { from: { x: 170, y: 60 }, to: { x: 280, y: 220 } }
);
const robustH = estimateHomographyRansac(perspectiveTracks, { thresholdPixels: 0.5, iterations: 300 });
assert.ok(robustH.H, "RANSAC should estimate a perspective mapping");
assert.equal(robustH.inliers.length, 16, "all synthetic perspective correspondences should be inliers");
assert.equal(robustH.outliers.length, 3, "inconsistent correspondences should be rejected");
assert.equal(robustH.status, "perspective-model-found");
const projected = projectHomography(robustH.H, [81, 49]);
const expectedProjected = projectHomography(knownH, [81, 49]);
assert.ok(Math.hypot(projected[0] - expectedProjected[0], projected[1] - expectedProjected[1]) < 0.5,
  "estimated homography should reproduce a held-out point");
console.log("perspective homography RANSAC test passed");

const tooFew = estimateHomographyRansac(perspectiveTracks.slice(0, 3));
assert.equal(tooFew.status, "insufficient-tracks", "fewer than four tracks must not produce a model");
assert.equal(tooFew.H, null);
assert.ok(robustH.medianReprojectionErrorPixels < 0.5, "the model should report low median reprojection error");
assert.ok(robustH.coverage.spanX > 100 && robustH.coverage.spanY > 50,
  "the model should report the spatial spread of supporting observations");
const collinear = Array.from({length: 8}, (_, i) => ({
  from: {x: i * 10, y: i * 5},
  to: {x: i * 12 + 3, y: i * 6 - 2}
}));
const degenerate = estimateHomographyRansac(collinear, {iterations: 40});
assert.notEqual(degenerate.status, "perspective-model-found",
  "collinear observations must not be presented as strong perspective evidence");
console.log("homography quality and degeneracy tests passed");
