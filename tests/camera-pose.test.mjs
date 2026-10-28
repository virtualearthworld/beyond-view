import assert from "node:assert/strict";
import { recoverCameraPoseCandidates } from "../reconstruction/camera-pose.js";
const mul=(a,b)=>a.map(r=>b[0].map((_,j)=>r.reduce((s,x,k)=>s+x*b[k][j],0)));
const tr=a=>a[0].map((_,j)=>a.map(r=>r[j]));
const det=a=>a[0][0]*(a[1][1]*a[2][2]-a[1][2]*a[2][1])-a[0][1]*(a[1][0]*a[2][2]-a[1][2]*a[2][0])+a[0][2]*(a[1][0]*a[2][1]-a[1][1]*a[2][0]);
const K=[[800,0,320],[0,800,240],[0,0,1]];
const a=.12, R=[[Math.cos(a),0,Math.sin(a)],[0,1,0],[-Math.sin(a),0,Math.cos(a)]];
const t=[.4,.1,.2], tx=[[0,-t[2],t[1]],[t[2],0,-t[0]],[-t[1],t[0],0]];
const Kinv=[[1/800,0,-.4],[0,1/800,-.3],[0,0,1]];
const F=mul(mul(tr(Kinv),mul(tx,R)),Kinv);
const out=recoverCameraPoseCandidates(F,K);
assert.equal(out.status,"pose-candidates-recovered");
assert.equal(out.candidates.length,4);
assert.ok(out.candidates.every(c=>Math.abs(c.rotationDeterminant-1)<1e-6));
const rotError=R2=>Math.acos(Math.max(-1,Math.min(1,(mul(R2,tr(R))[0][0]+mul(R2,tr(R))[1][1]+mul(R2,tr(R))[2][2]-1)/2)));
assert.ok(Math.min(...out.candidates.map(c=>rotError(c.rotation)))<1e-4,"one candidate should recover the synthetic rotation");
const tn=t.map(x=>x/Math.hypot(...t));
assert.ok(out.candidates.some(c=>Math.hypot(...c.translationDirection.map((x,i)=>x-tn[i]))<1e-4),"one candidate should recover translation direction");
assert.throws(()=>recoverCameraPoseCandidates([[0,0,0],[0,0,0],[0,0,0]],K),/degenerate/i);
assert.throws(()=>recoverCameraPoseCandidates(F,[[1,2],[3,4]]),/3x3/i);

import { selectCameraPose } from "../reconstruction/camera-pose.js";
// Generate measured pixel correspondences from a known 3D point cloud.
const points=[];
for(let i=0;i<30;i++){
  const X=[(i%6-2.5)*0.22, (Math.floor(i/6)-2)*0.17, 3.5+(i%4)*0.35];
  const X2=R.map((row,j)=>row.reduce((s,z,k)=>s+z*X[k],0)+t[j]);
  const p1=[800*X[0]/X[2]+320,800*X[1]/X[2]+240];
  const p2=[800*X2[0]/X2[2]+320,800*X2[1]/X2[2]+240];
  points.push({from:{x:p1[0],y:p1[1]},to:{x:p2[0],y:p2[1]}});
}
const chosen=selectCameraPose(out.candidates,points,K);
assert.equal(chosen.status,"pose-selected");
assert.notEqual(chosen.selectedIndex,null);
assert.ok(chosen.candidates[0].positiveDepthRatio>0.9,"best candidate should put almost all synthetic points in front of both cameras");
assert.equal(selectCameraPose(out.candidates,points.slice(0,3),K).status,"insufficient-correspondences");

console.log("Camera-pose candidate and cheirality regression tests passed.");
