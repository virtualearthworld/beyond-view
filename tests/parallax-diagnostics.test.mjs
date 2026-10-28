import assert from "node:assert/strict";
import { analyzeParallaxResiduals } from "../reconstruction/parallax-diagnostics.js";

const H = [1,0,5, 0,1,3, 0,0,1];
const points = [];
for (let y=20; y<=80; y+=20) {
  for (let x=20; x<=80; x+=20) {
    points.push({from:{x,y},to:{x:x+5,y:y+3}});
  }
}
const planar = analyzeParallaxResiduals(points,H);
assert.equal(planar.status,"homography-dominant");
assert.equal(planar.residualTracks,0);
assert.equal(planar.medianResidualPixels,0);

const varied = points.map((p,i)=>({
  from:p.from,
  to:{x:p.to.x+(i%3===0?12:0), y:p.to.y+(i%4===0?-9:0)}
}));
const parallax = analyzeParallaxResiduals(varied,H);
assert.equal(parallax.status,"distributed-non-homographic-motion");
assert.ok(parallax.residualTracks >= 8);
assert.ok(parallax.spatialCoverageCells >= 3);

assert.equal(analyzeParallaxResiduals(points.slice(0,3),H).status,"insufficient-tracks");
assert.throws(()=>analyzeParallaxResiduals(points,H,{residualThresholdPixels:0}),/Invalid/);
console.log("Parallax residual diagnostics: all tests passed.");
