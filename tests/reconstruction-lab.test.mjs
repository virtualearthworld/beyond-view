import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../reconstruction-lab.html", import.meta.url), "utf8");
const motion = await readFile(new URL("../reconstruction/motion-separation.js", import.meta.url), "utf8");
const coverage = await readFile(new URL("../reconstruction/camera-coverage.js", import.meta.url), "utf8");
assert.match(html, /Multi-frame consistency check/);
assert.match(html, /intervalSeconds:0\.75,maxFrames:32,width:480/);
assert.match(html, /0\.75-second intervals \(up to 32 frames\)/);
assert.match(html, /for\(let i=0;i<sampled\.length-1;i\+\+\)/);
assert.match(html, /pairReports\.map\(\(p,i\)=>/);
assert.match(html, /globally aligned or metric 3D reconstruction/);
assert.match(html, /featureSets\[0\]\.length/);
assert.match(html, /estimateCameraTrajectory/);
assert.match(html, /reconstructSparseTrajectory/);
assert.match(html, /reconstructMultiViewLandmarks/);
assert.match(html, /multiViewTracks=cameraModelPairTracks\.length>=2/);
assert.match(html, /regularizeCameraTrajectory\(trajectoryBase,staticGeometryReady\?geometryTracks:\[\]/);
assert.match(html, /optimizeBundleAdjustment\(staticGeometryReady\?geometryTracks:\[\],regularizedTrajectory/);
assert.match(html, /evaluateMultiViewReprojection\(geometryTracksForOutput,trajectory,K/);
assert.match(html, /id="multiview-track-count"/);
assert.match(html, /Tracks spanning every sampled frame \(strict subset\)/);
assert.match(html, /minimumObservations:4,minimumTriangulationAngleDegrees:2/);
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
assert.match(html, /reconstructMultiViewLandmarks\(geometryFramePairs,geometryTracksForOutput/);
assert.match(html, /linkTrackSequencesByComponent\(cameraModelPairTracks/);
assert.match(html, /Epipolar inliers \/ other tracks/);
assert.match(html, /coherent moving content can still pass/);
console.log("epipolar inlier geometry-gating integration tests passed");

assert.match(html, /Observed camera-path coverage/);
assert.match(html, /summarizeCameraCoverage\(trajectory\)/);
assert.match(html, /drawCameraCoverage\(coverage\)/);
assert.match(html, /id="coverage-navigation"/);
assert.match(html, /Navigation remains disabled because a camera path does not establish traversable surfaces/);
assert.match(coverage, /gapBridgingAllowed: false/);
assert.match(coverage, /extrapolationAllowed: false/);
assert.match(coverage, /does not establish surface coverage/);
console.log("observed camera-path coverage integration tests passed");

const consistency = await readFile(new URL("../reconstruction/multiview-consistency.js", import.meta.url), "utf8");
assert.match(html,/evaluateMultiViewTrackConsistency\(multiViewTracks,rawTrajectory,K/);
assert.match(html,/tracksToAdjacentPairs\(initialConsistencyAudit\.consistentTracks,framePairs\.length\)/);
assert.match(html,/tracksToAdjacentPairs\(staticGeometryReady\?geometryTracks:\[\],framePairs\.length\)/);
assert.match(html,/id="static-track-count"/);
assert.match(html,/id="static-track-inconsistent"/);
assert.match(html,/id="static-track-uncertain"/);
assert.match(html,/id="static-pose-segments"/);
assert.match(consistency,/export function evaluateMultiViewTrackConsistency/);
assert.match(consistency,/heldOutIndex/);
assert.match(consistency,/not semantic segmentation/);
console.log("leave-one-view-out static-scene geometry gate integration tests passed");


const staticSupport = await readFile(new URL("../reconstruction/static-scene-support.js", import.meta.url), "utf8");
assert.match(html, /assessStaticSceneTrackSupport\(geometryTracks/);
assert.match(html, /minimumTracksPerComponent:16,minimumOccupiedCells:6/);
assert.match(html, /supportedStaticComponentIds/);
assert.match(html, /id="static-support"/);
assert.match(html, /id="static-support-detail"/);
assert.match(html, /checked per connected camera component for spatial and temporal coverage/);
assert.ok(
  html.indexOf("assessStaticSceneTrackSupport(geometryTracks") < html.indexOf("regularizeCameraTrajectory(trajectoryBase"),
  "distributed support must gate tracks before trajectory refinement"
);
assert.match(staticSupport, /componentFrameSpanRatio/);
assert.match(staticSupport, /not semantic object detection/);
console.log("distributed static-scene candidate support integration test passed");


const trackExclusion = await readFile(new URL("../reconstruction/track-exclusion-mask.js", import.meta.url), "utf8");
assert.ok(html.includes('import { buildTrackExclusionMasks, filterTracksByTrackExclusionMasks } from "./reconstruction/track-exclusion-mask.js"'));
assert.ok(html.includes("buildTrackExclusionMasks(finalConsistencyAudit.inconsistentTracks"));
assert.ok(html.includes("filterTracksByTrackExclusionMasks(geometryTracks,trackExclusionMasks"));
assert.ok(html.indexOf("filterTracksByTrackExclusionMasks(geometryTracks") < html.indexOf("assessStaticSceneTrackSupport(geometryTracks"), "mask gate must run before distributed support");
assert.ok(html.includes("drawTrackExclusionMask(trackExclusionMasks"));
assert.ok(html.includes('id="track-exclusion-count"'));
assert.ok(html.includes('id="track-exclusion-cells"'));
assert.ok(html.includes('id="track-exclusion-frames"'));
assert.ok(html.includes('id="track-exclusion-detail"'));
assert.match(trackExclusion,/export function buildTrackExclusionMasks/);
assert.match(trackExclusion,/export function filterTracksByTrackExclusionMasks/);
assert.match(trackExclusion,/multi-view-inconsistent/);
assert.match(trackExclusion,/not semantic labels/);
console.log("component-local geometric-instability exclusion-mask integration tests passed");


const sourceFrameAuditModule = await readFile(new URL("../reconstruction/source-frame-reprojection.js", import.meta.url), "utf8");
assert.ok(html.includes("summarizeSourceFrameReprojection(geometryTracks"));
assert.ok(html.includes("drawSourceReprojectionFrame(0)"));
assert.ok(html.includes('id="reprojection-frame"'));
assert.ok(html.includes('id="reprojection-stage"'));
assert.ok(html.includes('id="reprojection-summary"'));
assert.ok(html.includes('id="reprojection-caption"'));
assert.match(consistency, /heldOutProjections/);
assert.match(sourceFrameAuditModule, /export function summarizeSourceFrameReprojection/);
assert.match(sourceFrameAuditModule, /projectedOutsideFrame/);
console.log("source-frame held-out reprojection inspection integration tests passed");

assert.match(html, /referenceFocalLengthPixels:analysisFocalLength/);
assert.match(html, /Median \/ p95 Δ rotation/);
assert.match(html, /Median \/ p95 Δ translation direction/);
assert.match(html, /pose\.medianRotationDeltaDegrees/);
assert.match(html, /pose\.medianTranslationDirectionDeltaDegrees/);
assert.match(html, /not ground truth/);
console.log("pairwise camera-pose calibration sensitivity integration tests passed");

const sourceColoredCloudModule = await readFile(new URL("../reconstruction/source-colored-multiview-cloud.js", import.meta.url), "utf8");
const trajectoryReconstructionModule = await readFile(new URL("../reconstruction/trajectory-reconstruction.js", import.meta.url), "utf8");
const sparseCloudViewModule = await readFile(new URL("../reconstruction/sparse-cloud-view.js", import.meta.url), "utf8");
const pointCloudExportModule = await readFile(new URL("../reconstruction/point-cloud-export.js", import.meta.url), "utf8");
assert.ok(html.includes('import { buildSourceColoredMultiViewCloud } from "./reconstruction/source-colored-multiview-cloud.js"'));
assert.ok(html.includes("buildSourceColoredMultiViewCloud(multiViewLandmarks,sampled"));
assert.ok(html.includes("validatedComponents=sourceColoredCloud.components"));
assert.ok(html.includes("drawSparseCloud(previewComponent?.points || [])"));
assert.doesNotMatch(html,/const previewSegment=sparse\\.segments/);
assert.ok(html.includes("Export validated component (.ply)"));
assert.ok(html.includes('id="colorized-landmark-count"'));
assert.ok(html.includes('id="uncolored-landmark-count"'));
assert.match(trajectoryReconstructionModule,/sourceObservations: observationRecords\\.map/);
assert.match(sourceColoredCloudModule,/sampleObservationRgb/);
assert.match(sourceColoredCloudModule,/original decoded source frames/);
assert.match(sparseCloudViewModule,/rgb: Array\\.isArray\\(p\\.source\\.rgb\\)/);
assert.match(pointCloudExportModule,/property uchar red/);
console.log("source-colored multi-view landmark preview/export integration tests passed");
