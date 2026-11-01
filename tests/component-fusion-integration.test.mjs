import assert from "node:assert/strict";
import { estimateCameraTrajectory } from "../reconstruction/camera-trajectory.js";
import { reconstructSparseTrajectory } from "../reconstruction/trajectory-reconstruction.js";
import { fuseSparsePointClouds } from "../reconstruction/point-cloud-fusion.js";

const K = [[800,0,320],[0,800,240],[0,0,1]];
const angle = 0.07;
const R = [[Math.cos(angle),0,Math.sin(angle)],[0,1,0],[-Math.sin(angle),0,Math.cos(angle)]];
const t = [0.45,0.03,0.08];
const tracks = [];
for (let i=0;i<48;i++) {
  const X = [((i*7)%13-6)*0.18,((i*5)%11-5)*0.15,3.2+(i%9)*0.31];
  const X2 = R.map((row,j)=>row.reduce((sum,z,k)=>sum+z*X[k],0)+t[j]);
  tracks.push({
    from:{x:800*X[0]/X[2]+320,y:800*X[1]/X[2]+240},
    to:{x:800*X2[0]/X2[2]+320,y:800*X2[1]/X2[2]+240}
  });
}

const framePairs = [
  {fromFrame:0,toFrame:1,tracks},
  {fromFrame:1,toFrame:2,tracks},
  {fromFrame:2,toFrame:3,tracks:tracks.slice(0,4)},
  {fromFrame:3,toFrame:4,tracks}
];
const trajectory = estimateCameraTrajectory(framePairs, {
  K, iterations:350, thresholdPixels:1.5, minInliers:20, minimumPoints:12
});
assert.equal(trajectory.segments[2].status,"insufficient-epipolar-support");
assert.ok(trajectory.poses.some(p=>p.frame===3 && p.status==="gap"));
const restartedOrigin = trajectory.poses.find(p=>p.frame===3 && p.status==="estimated");
assert.ok(restartedOrigin,"post-gap component must expose its from-frame origin");
assert.equal(restartedOrigin.componentId,trajectory.segments[3].componentId);

const reconstruction = reconstructSparseTrajectory(framePairs,trajectory,K,{
  maxReprojectionError:2, minimumPoints:8
});
assert.equal(reconstruction.segments[2].status,"pose-unavailable");
assert.equal(reconstruction.segments[3].status,"sparse-points-estimated",
  "the resumed segment should produce a sparse cloud");

const fused = fuseSparsePointClouds(reconstruction,trajectory,{mergeDistance:0.025});
assert.equal(fused.status,"provisional-component-clouds-fused");
assert.equal(fused.componentCount,2,"the gap must keep the camera components separate");
assert.ok(fused.acceptedObservations>0);
assert.equal(fused.components.some(c=>c.componentId===trajectory.segments[3].componentId),true,
  "the post-gap sparse cloud must be fused into its own component");
console.log("component fusion integration test passed");
