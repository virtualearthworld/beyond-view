import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../reconstruction-lab.html", import.meta.url), "utf8");
const motion = await readFile(new URL("../reconstruction/motion-separation.js", import.meta.url), "utf8");
assert.match(html, /Multi-frame consistency check/);
assert.match(html, /intervalSeconds:0\.75,maxFrames:32,width:480/);
assert.match(html, /for\(let i=0;i<sampled\.length-1;i\+\+\)/);
assert.match(html, /pairReports\.map\(\(p,i\)=>/);
assert.match(html, /globally aligned or metric 3D reconstruction/);
assert.match(html, /featureSets\[0\]\.length/);
assert.match(html, /estimateCameraTrajectory/);
assert.match(html, /reconstructSparseTrajectory/);
assert.match(html, /reconstructMultiViewLandmarks/);
assert.match(html, /multiViewTracks=cameraModelPairTracks\.length>=2/);
assert.match(html, /minimumObservations:3,minimumTriangulationAngleDegrees:2/);
assert.match(html, /id="multi-view-landmark-count"/);
assert.match(html, /id="multi-view-landmark-rejections"/);

assert.match(html, /projectSparseCloud/);
assert.match(html, /persistent-trajectories/);
assert.match(html, /track-coverage/);
assert.match(html, /linkTrackSequences\(cameraModelPairTracks,/);
assert.doesNotMatch(html, /linkTrackSequences\(cameraModelPairTracks\.slice\(0,2\)/);
assert.match(html, /First sparse 3D point-cloud preview/);
assert.match(html, /pair-local diagnostic/);
assert.match(html, /id="sparse-points"/);
assert.match(html, /Weak-parallax candidates are counted but excluded from the stable sparse cloud/);
assert.match(html, /id="sparse-segments"/);
assert.match(html, /id="sparse-error"/);
assert.match(html, /not yet a globally aligned or metric 3D reconstruction/);
assert.match(html, /pair-local points/);
assert.match(html, /id="focal-length"/);
assert.match(html, /pose-segments/);
assert.match(html, /analysisFocalLength=focalLength\*sampled\[0\]\.width\/video\.videoWidth/);
assert.match(html, /not verified calibration/);
assert.doesNotMatch(html, /textContent=String\(features\.length\)/);
console.log("reconstruction lab multi-frame report integration test passed");

assert.match(html, /fuseSparsePointClouds/);
assert.match(html, /fusion-components/);
assert.match(html, /fused-points/);
assert.match(html, /fusion-observations/);
assert.match(html, /fusion-rejected/);
assert.match(html, /connected camera components/);

assert.match(html, /import \{ classifyMotionLayers \} from "\.\/reconstruction\/motion-separation\.js"/);
assert.match(html, /classifyMotionLayers\(/);
assert.match(motion, /export function classifyMotionLayers/);
assert.match(html, /id="background-tracks"/);
assert.match(html, /id="residual-tracks"/);
assert.match(motion, /moving subjects, parallax, occlusion/);
console.log("background and residual motion diagnostics integration test passed");

assert.match(html, /id="cloud-reset"/);
assert.match(html, /pointerdown/);
assert.match(html, /pointermove/);
assert.match(html, /addEventListener\("wheel"/);
assert.match(html, /cloudYaw/);
assert.match(html, /cloudZoom/);
assert.match(html, /Shift-drag to pan/);
console.log("interactive sparse cloud controls integration test passed");

assert.match(html, /3D accepted \/ input/);
assert.match(html, /3D rejection reasons/);
assert.match(html, /triangulationFailures/);
assert.match(html, /reprojectionRejected/);
console.log("per-pair reconstruction diagnostics integration tests passed");

assert.match(html, /cameraModelPairTracks=rawTrajectory\.segments\.map/);
assert.match(html, /geometryFramePairs=framePairs\.map/);
assert.match(html, /reconstructSparseTrajectory\(geometryFramePairs/);
assert.match(html, /reconstructMultiViewLandmarks\(geometryFramePairs/);
assert.match(html, /linkTrackSequencesByComponent\(cameraModelPairTracks/);
assert.match(html, /Epipolar inliers \/ other tracks/);
assert.match(html, /moving content can still be epipolar-consistent/);
console.log("epipolar inlier geometry-gating integration tests passed");
