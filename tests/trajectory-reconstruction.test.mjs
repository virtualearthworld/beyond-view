import assert from "node:assert/strict";
import { reconstructSparseTrajectory } from "../reconstruction/trajectory-reconstruction.js";

const K = [[800,0,320],[0,800,240],[0,0,1]];
const angle = 0.04;
const R = [[Math.cos(angle),0,Math.sin(angle)],[0,1,0],[-Math.sin(angle),0,Math.cos(angle)]];
const t = [0.5,0.02,0.03];
const tracks = [];
for (let i=0;i<40;i++) {
  const X = [((i*7)%13-6)*0.12,((i*5)%11-5)*0.1,3+(i%9)*0.25];
  const X2 = R.map((row,j)=>row.reduce((sum,z,k)=>sum+z*X[k],0)+t[j]);
  tracks.push({
    from:{x:800*X[0]/X[2]+320,y:800*X[1]/X[2]+240},
    to:{x:800*X2[0]/X2[2]+320,y:800*X2[1]/X2[2]+240}
  });
}
const pairs = [{fromFrame:0,toFrame:1,tracks},{fromFrame:1,toFrame:2,tracks}];
const trajectory = {segments:[
  {status:"estimated",pose:{rotation:R,translationDirection:t}},
  {status:"insufficient-epipolar-support",pose:null}
]};
const result = reconstructSparseTrajectory(pairs,trajectory,K,{maxReprojectionError:1,minimumPoints:8});
assert.equal(result.segmentCount,2);
assert.equal(result.segments[0].status,"sparse-points-estimated");
assert.ok(result.segments[0].pointCount>=30,"known synthetic scene should triangulate a useful point set");
assert.ok(result.segments[0].medianReprojectionError<0.01,"synthetic point reprojection error should be very small");
assert.equal(result.segments[0].coordinateFrame,"local-to-from-frame");
assert.equal(result.segments[1].status,"pose-unavailable");
assert.equal(result.segments[1].pointCount,0,"failed camera poses must not fabricate points");
assert.equal(result.fusedWorldModel,false);
assert.equal(result.scaleKnown,false);
console.log("trajectory sparse reconstruction tests passed");
