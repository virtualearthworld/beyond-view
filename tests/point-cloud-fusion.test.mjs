import assert from "node:assert/strict";
import { fuseSparsePointClouds } from "../reconstruction/point-cloud-fusion.js";

const I = [[1,0,0],[0,1,0],[0,0,1]];
const reconstruction = { segments: [
  { fromFrame:0, status:"sparse-points-estimated", points:[
    { position:[0,0,5], reprojectionError:0.2 },
    { position:[2,0,5], reprojectionError:0.3 }
  ]},
  { fromFrame:1, status:"sparse-points-estimated", points:[
    { position:[1.005,0,5], reprojectionError:0.4 }
  ]},
  { fromFrame:3, status:"sparse-points-estimated", points:[
    { position:[0,0,5], reprojectionError:0.1 }
  ]}
]};
const trajectory = {
  segments: [
    { status:"estimated", componentId:0, fromFrame:0 },
    { status:"estimated", componentId:0, fromFrame:1 },
    { status:"estimated", componentId:1, fromFrame:3 }
  ],
  poses: [
    { frame:0, status:"estimated", rotation:I, translation:[0,0,0] },
    { frame:1, status:"estimated", rotation:I, translation:[1,0,0] },
    { frame:3, status:"estimated", rotation:I, translation:[0,0,0] }
  ]
};
const result = fuseSparsePointClouds(reconstruction, trajectory, { mergeDistance:0.02 });
assert.equal(result.status, "provisional-component-clouds-fused");
assert.equal(result.componentCount, 2, "disconnected camera paths must remain separate");
assert.equal(result.fusedPointCount, 3, "only nearby points in the same component should merge");
assert.equal(result.acceptedObservations, 4);
assert.equal(result.scaleKnown, false);
assert.equal(result.metricGeometry, false);

// Duplicate detections inside one frame-pair cloud must not count as
// independent multi-view support, even when they fall inside merge distance.
const duplicateOnly = {
  segments:[{fromFrame:0,status:"sparse-points-estimated",points:[
    {position:[0,0,5],reprojectionError:0.1},
    {position:[0.001,0,5],reprojectionError:0.1}
  ]}],
};
const onePose = {
  segments:[{status:"estimated",componentId:0,fromFrame:0}],
  poses:[{frame:0,status:"estimated",rotation:I,translation:[0,0,0]}]
};
const noFalseSupport = fuseSparsePointClouds(duplicateOnly,onePose,{
  mergeDistance:0.02,minimumSupport:2
});
assert.equal(noFalseSupport.acceptedObservations,2);
assert.equal(noFalseSupport.filteredBySupportPointCount,2,
  "same-pair detections must remain separate and both fail multi-pair support");
assert.equal(noFalseSupport.fusedPointCount,0);
const duplicatePreserved = fuseSparsePointClouds(duplicateOnly,onePose,{
  mergeDistance:0.02,minimumSupport:1
});
assert.equal(duplicatePreserved.fusedPointCount,2,
  "nearby points from one pair must not merge into false support");
const connected = result.components.find(c => c.componentId === 0);
assert.equal(connected.pointCount, 2);
assert.equal(connected.points[0].support, 2);
assert.deepEqual(connected.points[0].sourceSegments, [0,1]);
assert.ok(Math.abs(connected.points[0].position[0] - 0.0025) < 1e-9);
const separate = result.components.find(c => c.componentId === 1);
assert.equal(separate.pointCount, 1, "points across a camera-path gap must not be fused");
const supportedOnly = fuseSparsePointClouds(reconstruction, trajectory, {
  mergeDistance:0.02,
  minimumSupport:2
});
assert.equal(supportedOnly.minimumSupport, 2);
assert.equal(supportedOnly.filteredBySupportPointCount, 2,
  "single-observation points should be reported as filtered from the stable cloud");
assert.equal(supportedOnly.fusedPointCount, 1,
  "only a point observed in multiple frame-pair clouds should remain");
assert.equal(supportedOnly.components.find(c => c.componentId === 0).points[0].support, 2);
assert.throws(() => fuseSparsePointClouds(reconstruction, trajectory, { mergeDistance:0 }), /Invalid/);
console.log("point-cloud fusion regression tests passed");
