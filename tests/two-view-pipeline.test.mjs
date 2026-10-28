import assert from "node:assert/strict";
import { estimateTwoViewPose } from "../reconstruction/two-view-pipeline.js";

const K=[[800,0,320],[0,800,240],[0,0,1]];
const a=0.08;
const R=[[Math.cos(a),0,Math.sin(a)],[0,1,0],[-Math.sin(a),0,Math.cos(a)]];
const t=[0.5,0.04,0.1];
const points=[];
for(let i=0;i<48;i++){
  const X=[((i*7)%13-6)*0.18,((i*5)%11-5)*0.15,3.2+(i%9)*0.31];
  const X2=R.map((row,j)=>row.reduce((s,z,k)=>s+z*X[k],0)+t[j]);
  points.push({from:{x:800*X[0]/X[2]+320,y:800*X[1]/X[2]+240},
    to:{x:800*X2[0]/X2[2]+320,y:800*X2[1]/X2[2]+240}});
}
// Deterministic outliers ensure robust fitting is exercised.
for(let i=0;i<5;i++)points.push({from:{x:30+i*31,y:45+i*17},to:{x:570-i*23,y:80+i*19}});
const result=estimateTwoViewPose(points,{K1:K,iterations:350,thresholdPixels:1.5,minInliers:20,minimumPoints:12});
assert.ok(["two-view-pose-estimated","ambiguous-pose","pose-recovery-failed","pose-selection-failed"].includes(result.status));
assert.ok(result.epipolar.inlierCount>=20,"robust epipolar fitting should retain the synthetic scene tracks");
assert.equal(result.scaleKnown,false,"monocular two-view translation scale must remain explicitly unknown");
assert.ok(result.status!=="two-view-pose-estimated" || result.pose,"successful status must include a selected pose");
const weak=estimateTwoViewPose(points.slice(0,5),{K1:K});
assert.equal(weak.status,"insufficient-epipolar-support");
assert.equal(weak.pose,null);
console.log("two-view pipeline integration tests passed");
