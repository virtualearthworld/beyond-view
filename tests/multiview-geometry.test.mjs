import { strict as assert } from "node:assert";
import { projectPoint, triangulatePoint, triangulateTracks } from "../reconstruction/multiview-geometry.js";

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
