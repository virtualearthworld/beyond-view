import test from "node:test";
import assert from "node:assert/strict";
import { optimizeBundleAdjustment } from "../reconstruction/bundle-adjustment.js";

const K=[[100,0,50],[0,100,50],[0,0,1]];
const I=[[1,0,0],[0,1,0],[0,0,1]];
const poses=[0,1,2].map((frame)=>({frame,status:"estimated",componentId:0,rotation:I,translation:[-frame,0,0]}));
const trajectory={poses,segments:[{componentId:0,status:"estimated"}]};
const tracks=[{componentId:0,fromPairIndex:0,observations:[{x:50,y:50},{x:30,y:50},{x:10,y:50}]}];

test("bundle adjustment retains a consistent measured landmark and anchored first pose",()=>{
  const result=optimizeBundleAdjustment(tracks,trajectory,K,{iterations:2});
  assert.equal(result.status,"experimental-translation-landmark-bundle-adjustment");
  assert.equal(result.optimizedTracks,1);
  assert.equal(result.poses[0].translation[0],0);
  assert.ok(Number.isFinite(result.initialMedianError));
  assert.ok(Number.isFinite(result.finalMedianError));
  assert.ok(result.finalMedianError <= result.initialMedianError+1e-6);
  assert.equal(result.rotationOptimization,false);
  assert.equal(result.scaleKnown,false);
});

test("rejects invalid minimum observation counts",()=>{
  assert.throws(()=>optimizeBundleAdjustment(tracks,trajectory,K,{minObservations:1}),/Invalid bundle-adjustment inputs/);
  assert.throws(()=>optimizeBundleAdjustment(tracks,trajectory,K,{minObservations:2.5}),/Invalid bundle-adjustment inputs/);
});

test("reports insufficient tracks without fabricating reprojection metrics",()=>{
  const result=optimizeBundleAdjustment([],trajectory,K);
  assert.equal(result.status,"insufficient-tracks");
  assert.equal(result.optimizedTracks,0);
  assert.equal(result.initialMedianError,null);
  assert.equal(result.finalMedianError,null);
});

test("bundle adjustment corrects a perturbed middle camera using multiple landmarks", () => {
  const truth = [
    [0.1,0.1,4], [-0.5,0.2,5], [0.7,-0.3,6], [0.3,0.5,7],
    [-0.8,-0.2,5.5], [0.9,0.4,8], [-0.2,0.6,4.5], [0.5,-0.6,6.5]
  ];
  const trueTranslations = [[0,0,0],[-1,0,0],[-2,0,0]];
  const project = (point, translation) => [
    100 * (point[0] + translation[0]) / (point[2] + translation[2]) + 50,
    100 * (point[1] + translation[1]) / (point[2] + translation[2]) + 50
  ];
  const manyTracks = truth.map(point => ({
    componentId: 0,
    fromPairIndex: 0,
    observations: trueTranslations.map(translation => {
      const [x,y] = project(point, translation);
      return {x,y};
    })
  }));
  const imperfectTrajectory = {poses: [
    {frame:0,status:"estimated",componentId:0,rotation:I,translation:[0,0,0]},
    {frame:1,status:"estimated",componentId:0,rotation:I,translation:[-0.65,0.12,0.05]},
    {frame:2,status:"estimated",componentId:0,rotation:I,translation:[-2,0,0]}
  ]};
  const result = optimizeBundleAdjustment(manyTracks, imperfectTrajectory, K,
    {maxTracks:100,iterations:5,minObservations:3});
  assert.equal(result.optimizedTracks, truth.length);
  assert.deepEqual(result.poses[0].translation,[0,0,0]);
  assert.ok(result.finalMedianError < result.initialMedianError * 0.5,
    "joint refinement should substantially reduce the perturbed camera reprojection error");
  assert.ok(result.poses[1].translation.every(Number.isFinite));
});
