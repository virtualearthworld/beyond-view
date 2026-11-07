import test from "node:test";
import assert from "node:assert/strict";
import { regularizeCameraTrajectory } from "../reconstruction/trajectory-optimization.js";

const trajectory = {
  status: "trajectory-estimated",
  segments: [{status:"estimated",componentId:0},{status:"estimated",componentId:0},{status:"estimated",componentId:0}],
  poses: [
    {frame:0,status:"estimated",componentId:0,translation:[0,0,0],rotation:[[1,0,0],[0,1,0],[0,0,1]]},
    {frame:1,status:"estimated",componentId:0,translation:[1,4,0],rotation:[[1,0,0],[0,1,0],[0,0,1]]},
    {frame:2,status:"estimated",componentId:0,translation:[2,0,0],rotation:[[1,0,0],[0,1,0],[0,0,1]]},
    {frame:3,status:"gap",componentId:null,translation:null,rotation:null},
    {frame:4,status:"estimated",componentId:1,translation:[0,0,0],rotation:[[1,0,0],[0,1,0],[0,0,1]]},
    {frame:5,status:"estimated",componentId:1,translation:[1,0,0],rotation:[[1,0,0],[0,1,0],[0,0,1]]}
  ]
};

test("regularizes translation inside a connected component and anchors endpoints",()=>{
  const tracks=Array.from({length:3},(_,i)=>({componentId:0,fromPairIndex:0,toPairIndex:1,observations:[{x:10+i,y:10},{x:11+i,y:10},{x:12+i,y:10}]}));
  const result=regularizeCameraTrajectory(trajectory,tracks,{lambda:1});
  assert.deepEqual(result.poses[0].translation,[0,0,0]);
  assert.deepEqual(result.poses[2].translation,[2,0,0]);
  assert.ok(result.poses[1].translation[1] < 4);
  // Exact minimizer for (y - 4)^2 + (0 - 2y + 0)^2
  // with endpoints fixed at zero is y = 0.8.
  assert.ok(Math.abs(result.poses[1].translation[1] - 0.8) < 1e-9,
    "fixed endpoint contributions must be included in the interior equation");
  assert.equal(result.poses[3].status,"gap");
  assert.equal(result.poses[4].translation[0],0);
  assert.equal(result.optimization.rotationsOptimized,false);
  assert.equal(result.optimization.reprojectionBundleAdjustment,false);
  assert.equal(result.optimization.supportedPoseCount,3);
});

test("rejects invalid regularization parameters",()=>{
  assert.throws(()=>regularizeCameraTrajectory(trajectory,[],{lambda:-1}),TypeError);
});

test("does not bridge disconnected components or alter rotations",()=>{
  const result=regularizeCameraTrajectory(trajectory,[]);
  assert.deepEqual(result.poses[4].translation,[0,0,0]);
  assert.deepEqual(result.poses[1].rotation,trajectory.poses[1].rotation);
});

test("reports lower optimized acceleration for a noisy middle pose",()=>{
  const noisy={...trajectory,poses:[
    {frame:0,status:"estimated",componentId:0,translation:[0,0,0],rotation:[[1,0,0],[0,1,0],[0,0,1]]},
    {frame:1,status:"estimated",componentId:0,translation:[1,4,0],rotation:[[1,0,0],[0,1,0],[0,0,1]]},
    {frame:2,status:"estimated",componentId:0,translation:[2,0,0],rotation:[[1,0,0],[0,1,0],[0,0,1]]}
  ]};
  const result=regularizeCameraTrajectory(noisy,[],{lambda:1});
  assert.ok(result.optimization.regularizedPathAccelerationRms < result.optimization.rawPathAccelerationRms);
  assert.ok(Number.isFinite(result.optimization.regularizedPathAccelerationRms));
});
