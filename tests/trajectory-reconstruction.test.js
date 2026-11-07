import test from "node:test";
import assert from "node:assert/strict";
import { reconstructSparseTrajectory, reconstructMultiViewLandmarks } from "../reconstruction/trajectory-reconstruction.js";

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


test("reconstructs a shared landmark from three camera views", () => {
  const point = [0.2, 0.1, 5];
  const project = (cameraX) => [
    (point[0] - cameraX) / point[2],
    point[1] / point[2]
  ];
  const observations = [project(0), project(1), project(2)];
  const framePairs = [
    { fromFrame: 0, toFrame: 1, tracks: [{ from: {x: observations[0][0], y: observations[0][1]}, to: {x: observations[1][0], y: observations[1][1]} }] },
    { fromFrame: 1, toFrame: 2, tracks: [{ from: {x: observations[1][0], y: observations[1][1]}, to: {x: observations[2][0], y: observations[2][1]} }] }
  ];
  const linkedTracks = [{
    componentId: 0, fromPairIndex: 0, toPairIndex: 1,
    observations: observations.map(([x,y]) => ({x,y}))
  }];
  const trajectory = {
    poses: [
      {frame:0,status:"estimated",componentId:0,rotation:identity,translation:[0,0,0]},
      {frame:1,status:"estimated",componentId:0,rotation:identity,translation:[-1,0,0]},
      {frame:2,status:"estimated",componentId:0,rotation:identity,translation:[-2,0,0]}
    ]
  };
  const result = reconstructMultiViewLandmarks(framePairs, linkedTracks, trajectory,
    [[1,0,0],[0,1,0],[0,0,1]], {
      minimumObservations:3, minimumTriangulationAngleDegrees:2,
      maxMeanReprojectionError:1e-6, maxSingleReprojectionError:1e-6
    });
  assert.equal(result.pointCount,1);
  assert.equal(result.status,"multi-view-landmarks-estimated");
  assert.ok(Math.abs(result.points[0].position[0]-point[0])<1e-6);
  assert.ok(Math.abs(result.points[0].position[1]-point[1])<1e-6);
  assert.ok(Math.abs(result.points[0].position[2]-point[2])<1e-5);
  assert.equal(result.points[0].observations,3);
  assert.equal(result.scaleKnown,false);
});

test("rejects a multi-view landmark with an inconsistent frame observation", () => {
  const framePairs = [
    {fromFrame:0,toFrame:1,tracks:[]},
    {fromFrame:1,toFrame:2,tracks:[]}
  ];
  const linkedTracks = [{
    componentId:0,fromPairIndex:0,toPairIndex:1,
    observations:[{x:0.04,y:0.02},{x:-0.16,y:0.02},{x:-0.26,y:0.02}]
  }];
  const trajectory = {poses:[
    {frame:0,status:"estimated",componentId:0,rotation:identity,translation:[0,0,0]},
    {frame:1,status:"estimated",componentId:0,rotation:identity,translation:[-1,0,0]},
    {frame:2,status:"estimated",componentId:0,rotation:identity,translation:[-2,0,0]}
  ]};
  const result = reconstructMultiViewLandmarks(framePairs,linkedTracks,trajectory,
    [[1,0,0],[0,1,0],[0,0,1]], {
      minimumObservations:3,minimumTriangulationAngleDegrees:2,
      maxMeanReprojectionError:0.01,maxSingleReprojectionError:0.02
    });
  assert.equal(result.pointCount,0);
  assert.equal(result.rejected.reprojectionError,1);
});
