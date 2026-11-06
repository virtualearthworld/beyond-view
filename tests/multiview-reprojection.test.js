import test from "node:test";
import assert from "node:assert/strict";
import { evaluateMultiViewReprojection } from "../reconstruction/multiview-reprojection.js";

const K=[[100,0,50],[0,100,50],[0,0,1]];
const pose=(frame,tx)=>({frame,status:"estimated",componentId:0,rotation:[[1,0,0],[0,1,0],[0,0,1]],translation:[tx,0,0]});
const trajectory={poses:[pose(0,0),pose(1,-1),pose(2,-2)]};
const tracks=[{componentId:0,fromPairIndex:0,observations:[{x:50,y:50},{x:30,y:50},{x:10,y:50}]}];

test("evaluates persistent landmarks across all observed views",()=>{
  const result=evaluateMultiViewReprojection(tracks,trajectory,K);
  assert.equal(result.status,"multi-view-reprojection-evaluated");
  assert.equal(result.evaluatedLandmarks,1);
  assert.equal(result.evaluatedObservations,3);
  assert.ok(result.medianReprojectionErrorPixels < 1e-5);
});

test("uses original translations for raw-path comparison",()=>{
  const optimized={poses:trajectory.poses.map((p,i)=>({...p,rawTranslation:p.translation.slice(),translation:[p.translation[0],i===1?0.2:p.translation[1],p.translation[2]]}))};
  const raw=evaluateMultiViewReprojection(tracks,optimized,K,{path:"raw"});
  assert.equal(raw.evaluatedLandmarks,1);
  assert.ok(raw.medianReprojectionErrorPixels < 1e-5);
});

test("reports insufficient tracks without inventing an error",()=>{
  const result=evaluateMultiViewReprojection([],trajectory,K);
  assert.equal(result.status,"insufficient-multi-view-tracks");
  assert.equal(result.medianReprojectionErrorPixels,null);
});
