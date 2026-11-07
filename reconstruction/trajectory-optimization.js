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
  // Move each fixed-variable contribution to the right-hand side before
  // removing its column; otherwise the interior solution is biased.
  for (const endpoint of [0,n-1]) {
    const fixedValue = values[endpoint];
    for (let j=0;j<n;j++) {
      if (j !== endpoint) b[j] -= A[j][endpoint] * fixedValue;
    }
    for(let j=0;j<n;j++){ A[endpoint][j]=0; A[j][endpoint]=0; }
    A[endpoint][endpoint]=1; b[endpoint]=fixedValue;
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
        !Number.isInteger(track.fromPairIndex) || track.fromPairIndex < 0) continue;
    // linkTrackSequencesByComponent stores image coordinates without a frame
    // field. Its first observation is fromPairIndex; each subsequent
    // observation belongs to the next sampled frame.
    track.observations.forEach((observation, observationIndex) => {
      if (!observation || !Number.isFinite(observation.x) || !Number.isFinite(observation.y)) return;
      const frame = track.fromPairIndex + observationIndex;
      const key = track.componentId + ":" + frame;
      support.set(key, (support.get(key) || 0) + 1);
    });
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
  let adjusted=0, maxDisplacement=0, totalDisplacement=0, supportedPoseCount=0, validPoseCount=0;
  let rawSecondDifferenceSum=0, optimizedSecondDifferenceSum=0, secondDifferenceCount=0;
  for (const [componentId, indices] of components) {
    if(indices.length<3) continue;
    const originals=indices.map(i=>poses[i].translation);
    validPoseCount += indices.length;
    for(let j=1;j<originals.length-1;j++){
      const raw=originals[j-1].map((v,k)=>originals[j+1][k]-2*originals[j][k]+v);
      rawSecondDifferenceSum += raw.reduce((sum,v)=>sum+v*v,0);
      secondDifferenceCount++;
    }
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
    const optimized=indices.map(i=>poses[i].translation);
    for(let j=1;j<optimized.length-1;j++){
      const smooth=optimized[j-1].map((v,k)=>optimized[j+1][k]-2*optimized[j][k]+v);
      optimizedSecondDifferenceSum += smooth.reduce((sum,v)=>sum+v*v,0);
    }
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
      meanTranslationAdjustment:validPoseCount?totalDisplacement/validPoseCount:0,
      rawPathAccelerationRms:secondDifferenceCount?Math.sqrt(rawSecondDifferenceSum/secondDifferenceCount):0,
      regularizedPathAccelerationRms:secondDifferenceCount?Math.sqrt(optimizedSecondDifferenceSum/secondDifferenceCount):0,
      pathSmoothnessMetric:"RMS second difference of translation within each connected component; lower means smoother, not necessarily more accurate",
      persistentTrackCount:persistentTracks.length,
      lambda,
      rotationsOptimized:false,
      reprojectionBundleAdjustment:false,
      scaleKnown:false
    },
    limitation:"Only accumulated translation positions are regularized using persistent image-track support. Rotations are unchanged; this is not reprojection bundle adjustment, loop closure, calibrated or metric trajectory recovery. Verify against image reprojection and independent views before using for geometry."
  };
}
