import assert from "node:assert/strict";
import { estimateEpipolarModel } from "../reconstruction/epipolar-geometry.js";

// Exact synthetic correspondences for a simple epipolar relation y2 = y1.
const tracks=[];
for(let i=0;i<24;i++){
  const x=20+(i*37)%300, y=15+(i*23)%180, dx=8+(i*11)%70;
  tracks.push({from:{x,y},to:{x:x+dx,y}});
}
const result=estimateEpipolarModel(tracks,{thresholdPixels:0.01,iterations:400,minInliers:12});
assert.ok(result.F,"fundamental matrix hypothesis should be estimated");
assert.equal(result.status,"epipolar-model-found");
assert.ok(result.inliers.length>=20);
assert.ok(result.medianEpipolarErrorPixels<0.01);
assert.equal(estimateEpipolarModel(tracks.slice(0,5)).status,"insufficient-tracks");
assert.throws(()=>estimateEpipolarModel(tracks,{thresholdPixels:0}),/Invalid/);
console.log("Epipolar geometry regression tests passed.");
