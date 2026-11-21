import assert from "node:assert/strict";
import { buildSourceColoredMultiViewCloud } from "../reconstruction/source-colored-multiview-cloud.js";

function makeFrame(color, time) {
  const width = 5, height = 5;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = color[0];
    rgba[i * 4 + 1] = color[1];
    rgba[i * 4 + 2] = color[2];
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, rgba, time };
}

const sourceFrames = [
  makeFrame([10, 20, 30], 0),
  makeFrame([30, 40, 50], 0.75),
  makeFrame([20, 30, 40], 1.5)
];
const landmarks = {
  points: [
    {
      position: [1, 2, 3], componentId: 0, observations: 3,
      meanReprojectionError: 0.4, maxReprojectionError: 0.8,
      maximumTriangulationAngleDegrees: 9,
      sourceObservations: [
        { frame: 0, x: 2, y: 2 },
        { frame: 1, x: 2, y: 2 },
        { frame: 2, x: 2, y: 2 }
      ]
    },
    {
      position: [4, 5, 6], componentId: 1, observations: 1,
      meanReprojectionError: 0.2,
      sourceObservations: [{ frame: 0, x: 1, y: 1 }]
    }
  ]
};
const cloud = buildSourceColoredMultiViewCloud(landmarks, sourceFrames, {
  minimumColorViews: 2, patchRadius: 1
});
assert.equal(cloud.status, "source-colored-multiview-cloud-ready");
assert.equal(cloud.componentCount, 2, "disconnected camera components remain separate");
assert.equal(cloud.colorizedPointCount, 1);
assert.equal(cloud.uncoloredPointCount, 1, "insufficient color views do not discard valid geometry");
const first = cloud.components.find(component => component.componentId === 0).points[0];
assert.deepEqual(first.rgb, [20, 30, 40], "RGB is the per-channel median across original source observations");
assert.deepEqual(first.sourceFrames, [0, 1, 2]);
assert.deepEqual(first.sourceTimesSeconds, [0, 0.75, 1.5]);
assert.equal(first.coordinateFrame, "component-local");
assert.equal(first.support, 3);
assert.equal(first.colorObservationCount, 3);
assert.equal(first.meanReprojectionError, 0.4);
const second = cloud.components.find(component => component.componentId === 1).points[0];
assert.equal(second.rgb, null);
assert.equal(second.colorObservationCount, 1);
assert.deepEqual(second.position, [4, 5, 6]);

const invalidOnly = buildSourceColoredMultiViewCloud({
  points: [{ position: [NaN, 0, 1], componentId: 0 }]
}, sourceFrames);
assert.equal(invalidOnly.rejectedGeometryPointCount, 1);
assert.equal(invalidOnly.componentCount, 0);
assert.equal(invalidOnly.status, "no-validated-multiview-points");

const noFrames = buildSourceColoredMultiViewCloud(landmarks, [], { minimumColorViews: 2 });
assert.equal(noFrames.colorizedPointCount, 0);
assert.equal(noFrames.uncoloredPointCount, 2);
assert.throws(() => buildSourceColoredMultiViewCloud(landmarks, sourceFrames, {
  minimumColorViews: 0
}), /Invalid/);
assert.throws(() => buildSourceColoredMultiViewCloud(landmarks, sourceFrames, {
  patchRadius: 5
}), /Invalid/);
console.log("source-colored multi-view cloud tests passed");
