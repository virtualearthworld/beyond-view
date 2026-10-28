import { estimateTwoViewPose } from "./two-view-pipeline.js";

const identity = () => [[1,0,0],[0,1,0],[0,0,1]];
const multiply = (a,b) => a.map(r=>b[0].map((_,j)=>r.reduce((s,x,k)=>s+x*b[k][j],0)));
const apply = (a,v) => a.map(r=>r.reduce((s,x,k)=>s+x*v[k],0));
const add = (a,b) => a.map((x,i)=>x+b[i]);
const transpose = a => a[0].map((_,j)=>a.map(r=>r[j]));
const norm = v => Math.hypot(...v);
const determinant = a => a[0][0]*(a[1][1]*a[2][2]-a[1][2]*a[2][1])-a[0][1]*(a[1][0]*a[2][2]-a[1][2]*a[2][0])+a[0][2]*(a[1][0]*a[2][1]-a[1][1]*a[2][0]);

/**
 * Estimate a relative camera trajectory from adjacent-frame match sets.
 * framePairs: [{fromFrame,toFrame,tracks:[{from:{x,y},to:{x,y}}]}]
 * Calibration K must correspond to the same frame pixel coordinates.
 * Translation steps are normalized; without known scale, the path is not metric.
 * Failed segments are reported as gaps and never silently interpolated.
 */
export function estimateCameraTrajectory(framePairs, {
  K, thresholdPixels = 2, iterations = 250, minInliers = 12,
  minimumPoints = 8, minimumPositiveDepthRatio = 0.6
} = {}) {
  if (!Array.isArray(framePairs) || !Array.isArray(K) ||
      framePairs.length === 0) {
    throw new TypeError("Provide a non-empty array of adjacent frame pairs and calibrated intrinsics K.");
  }
  const segments = [];
  let cumulativeR = identity();
  let cumulativeT = [0,0,0];
  let componentId = 0;
  const poses = [{frame: framePairs[0].fromFrame ?? 0, rotation: identity(), translation: [0,0,0], componentId, componentOrigin: true, status:"estimated"}];
  for (let index=0; index<framePairs.length; index++) {
    const pair=framePairs[index];
    if (!pair || !Array.isArray(pair.tracks) ||
        (pair.fromFrame !== undefined && !Number.isFinite(pair.fromFrame)) ||
        (pair.toFrame !== undefined && !Number.isFinite(pair.toFrame))) {
      throw new TypeError("Each frame pair needs tracks and optional numeric fromFrame/toFrame values.");
    }
    const estimate=estimateTwoViewPose(pair.tracks,{
      K1:K,K2:K,thresholdPixels,iterations,minInliers,minimumPoints,minimumPositiveDepthRatio
    });
    if (estimate.status !== "two-view-pose-estimated" || !estimate.pose) {
      segments.push({index,fromFrame:pair.fromFrame ?? index,toFrame:pair.toFrame ?? index+1,
        status:estimate.status,pose:null,diagnostics:estimate.epipolar ?? null});
      poses.push({frame:pair.toFrame ?? index+1,status:"gap",rotation:null,translation:null,componentId:null});
      // The missing relative transform breaks the chain. Restart subsequent
      // poses in a new local component rather than pretending the path connects.
      componentId += 1;
      cumulativeR = identity();
      cumulativeT = [0,0,0];
      continue;
    }
    const R=estimate.pose.rotation;
    const t=estimate.pose.translationDirection;
    if (Math.abs(determinant(R)-1)>0.05 || Math.abs(norm(t)-1)>1e-5) {
      segments.push({index,fromFrame:pair.fromFrame ?? index,toFrame:pair.toFrame ?? index+1,
        status:"invalid-pose-matrix",pose:null});
      poses.push({frame:pair.toFrame ?? index+1,status:"gap",rotation:null,translation:null});
      continue;
    }
    cumulativeT=add(apply(R,cumulativeT),t);
    cumulativeR=multiply(R,cumulativeR);
    const segment={index,fromFrame:pair.fromFrame ?? index,toFrame:pair.toFrame ?? index+1,
      status:"estimated",componentId,pose:{rotation:R,translationDirection:t},diagnostics:estimate.epipolar};
    segments.push(segment);
    poses.push({frame:pair.toFrame ?? index+1,rotation:cumulativeR.map(r=>r.slice()),translation:cumulativeT.slice(),status:"estimated",componentId,componentOrigin:index>0 && segments[index-1].status!=="estimated"});
  }
  const estimated=segments.filter(s=>s.status==="estimated").length;
  return {
    status:estimated===segments.length?"trajectory-estimated":estimated>0?"partial-trajectory":"trajectory-unavailable",
    segmentCount:segments.length,estimatedSegmentCount:estimated,
    estimatedSegmentRatio:estimated/segments.length,segments,poses,
    scaleKnown:false,
    limitation:"This is a relative, unit-baseline trajectory. Failed segments remain explicit gaps; accumulated translation is not metric and may drift. Use verified calibration and multi-frame bundle adjustment/loop closure before treating it as a stable world trajectory."
  };
}
