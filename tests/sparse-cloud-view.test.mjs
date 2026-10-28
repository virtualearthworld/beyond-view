import assert from "node:assert/strict";
import { projectSparseCloud } from "../reconstruction/sparse-cloud-view.js";

const points = [];
for (let i = 0; i < 30; i++) {
  points.push({ position: [Math.sin(i) * 2, Math.cos(i * 0.7), 3 + i * 0.1], reprojectionError: 0.2 });
}
const view = projectSparseCloud(points, { width: 640, height: 360 });
assert.equal(view.status, "preview-available");
assert.equal(view.pointCount, 30);
assert.equal(view.coordinateFrame, "pair-local");
assert.equal(view.scaleKnown, false);
assert.ok(view.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
assert.ok(view.points.every(p => p.x >= 24 && p.x <= 616 && p.y >= 24 && p.y <= 336),
  "projected points should remain inside the preview margins");
assert.equal(projectSparseCloud([]).status, "no-valid-points");
assert.throws(() => projectSparseCloud(points, { width: 20, height: 20, margin: 12 }), /Invalid sparse-cloud/);
console.log("sparse cloud view tests passed");
