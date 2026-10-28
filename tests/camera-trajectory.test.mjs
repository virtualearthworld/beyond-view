import assert from "node:assert/strict";
import { estimateCameraTrajectory } from "../reconstruction/camera-trajectory.js";

const K=[[800,0,320],[0,800,240],[0,0,1]];
const angle=0.07;
const R=[[Math.cos(angle),0,Math.sin(angle)],[0,1,0],[-Math.sin(angle),0,Math.cos(angle)]];
const t=[0.45,0.03,0.08];
const tracks=[];
for(let i=0;i<48;i++){
  const X=[((i*7)%13-6)*0.18,((i*5)%11-5)*0.15,3.2+(i%9)*0.31];
  const X2=R.map((row,j)=>row.reduce((s,z,k)=>s+z*X[k],0)+t[j]);
  tracks.push({from:{x:800*X[0]/X[2]+320,y:800*X[1]/X[2]+240},
    to:{x:800*X2[0]/X2[2]+320,y:800*X2[1]/X2[2]+240}});
}
const trajectory=estimateCameraTrajectory([
  {fromFrame:0,toFrame:1,tracks},
  {fromFrame:1,toFrame:2,tracks},
  {fromFrame:2,toFrame:3,tracks:tracks.slice(0,4)},
  {fromFrame:3,toFrame:4,tracks}
],{K,iterations:350,thresholdPixels:1.5,minInliers:20,minimumPoints:12});
assert.equal(trajectory.segmentCount,4);
assert.equal(trajectory.poses.length,5);
assert.equal(trajectory.scaleKnown,false);
assert.ok(["trajectory-estimated","partial-trajectory","trajectory-unavailable"].includes(trajectory.status));
assert.equal(trajectory.segments[2].status,"insufficient-epipolar-support");
assert.equal(trajectory.poses[3].status,"gap","failed segment must be explicit, not silently interpolated");
assert.notEqual(trajectory.segments[1].componentId, trajectory.segments[3].componentId,
  "a successful pose after a gap must start a separate coordinate component");
assert.equal(trajectory.poses[4].componentId, trajectory.segments[3].componentId,
  "post-gap pose must be labelled with its new local component");
assert.equal(trajectory.poses[4].componentOrigin,true,
  "the first pose after a gap must identify its local coordinate origin");
assert.equal(trajectory.poses[0].translation[0],0);
assert.ok(trajectory.estimatedSegmentCount>=1,"synthetic known-pose segments should yield trajectory progress");
console.log("camera trajectory regression tests passed");
