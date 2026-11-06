/**
 * Confidence-weighted multi-frame trajectory regularization.
 *
 * This is deliberately not called bundle adjustment: it smooths the
 * accumulated unit-baseline translation path using persistent image-track
 * support. Rotations and relative-pose measurements are unchanged. Components
 * and gaps are hard boundaries; each component's endpoints remain anchored.
 * The result is a diagnostic regularized path, not metric camera calibration.
 */
const finiteVector = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

function solve(matrix, rhs) {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-10) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const d = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= d;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = a[row][col];
      for (let j = col; j <= n; j++) a[row][j] -= f * a[col][j];
    }
  }
  return a.map(row => row[n]);
}

function regularizeAxis(values, weights, lambda) {
  const n = values.length;
  if (n < 3) return values.slice();
  const A = Array.from({length:n},()=>Array(n).fill(0));
  const b = values.map((v,i)=>{ A[i][i] += weights[i]; return weights[i]*v; });
  // Penalize second differences: (x[i-1] - 2*x[i] + x[i+1])^2.
  for (let i=1;i<n-1;i++) {
    const ids=[i-1,i,i+1], c=[1,-2,1];
    for(let r=0;r<3;r++) for(let s=0;s<3;s++) A[ids[r]][ids[s]] += lambda*c[r]*c[s];
  }
  // Hard-anchor both endpoints to the measured component endpoints.
  for (const endpoint of [0,n-1]) {
    for(let j=0;j<n;j++){ A[endpoint][j]=0; A[j][endpoint]=0; }
    A[endpoint][endpoint]=1; b[endpoint]=values[endpoint];
  }
  return solve(A,b) || values.slice();
}

/**
 * @param trajectory result of estimateCameraTrajectory
 * @param persistentTracks output of linkTrackSequencesByComponent
 * @param options lambda controls smoothing strength; minimumObservations gates
 * track confidence. No scale or pose is invented across failed components.
 */
export function regularizeCameraTrajectory(trajectory, persistentTracks = [], {
  lambda = 0.35,
  minimumObservations = 3
} = {}) {
  if (!trajectory || !Array.isArray(trajectory.poses) ||
      !Array.isArray(trajectory.segments) || !Array.isArray(persistentTracks) ||
      !Number.isFinite(lambda) || lambda < 0 ||
      !Number.isInteger(minimumObservations) || minimumObservations < 2) {
    throw new TypeError("Invalid trajectory regularization inputs.");
  }
  const support = new Map();
  for (const track of persistentTracks) {
    if (!track || !Array.isArray(track.observations) ||
        !Number.isInteger(track.componentId) ||
        track.observations.some(p => !p || !Number.isFinite(p.frame))) continue;
    for (const observation of track.observations) {
      const key = track.componentId + ":" + observation.frame;
      support.set(key, (support.get(key) || 0) + 1);
    }
  }
  const poses = trajectory.poses.map(p => ({...p,
    translation: finiteVector(p.translation) ? p.translation.slice() : p.translation
  }));
  const components = new Map();
  for (let i=0;i<poses.length;i++) {
    const p=poses[i];
    if (p.status!=="estimated" || !Number.isInteger(p.componentId) ||
        !finiteVector(p.translation)) continue;
    if(!components.has(p.componentId)) components.set(p.componentId,[]);
    components.get(p.componentId).push(i);
  }
  let adjusted=0, maxDisplacement=0, totalDisplacement=0, supportedPoseCount=0;
  for (const [componentId, indices] of components) {
    if(indices.length<3) continue;
    const originals=indices.map(i=>poses[i].translation);
    const weights=indices.map(i=>{
      const count=support.get(componentId+":"+poses[i].frame)||0;
      if(count>=minimumObservations) supportedPoseCount++;
      return 1+Math.min(8,count);
    });
    const axes=[0,1,2].map(axis=>regularizeAxis(originals.map(v=>v[axis]),weights,lambda));
    indices.forEach((poseIndex,j)=>{
      const next=axes.map(axis=>axis[j]);
      const delta=Math.hypot(...next.map((v,k)=>v-originals[j][k]));
      poses[poseIndex]={...poses[poseIndex],translation:next,rawTranslation:originals[j]};
      if(delta>1e-8) adjusted++;
      maxDisplacement=Math.max(maxDisplacement,delta);
      totalDisplacement+=delta;
    });
  }
  return {
    ...trajectory,
    poses,
    optimization:{
      status:"confidence-weighted-translation-regularization",
      componentCount:components.size,
      adjustedPoseCount:adjusted,
      supportedPoseCount,
      maxTranslationAdjustment:maxDisplacement,
      meanTranslationAdjustment:poses.length?totalDisplacement/poses.length:0,
      persistentTrackCount:persistentTracks.length,
      lambda,
      rotationsOptimized:false,
      reprojectionBundleAdjustment:false,
      scaleKnown:false
    },
    limitation:"Only accumulated translation positions are regularized using persistent image-track support. Rotations are unchanged; this is not reprojection bundle adjustment, loop closure, calibrated or metric trajectory recovery. Verify against image reprojection and independent views before using for geometry."
  };
}
