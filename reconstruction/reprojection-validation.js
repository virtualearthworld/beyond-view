/**
 * Compare camera-path candidates against the same measured 3D landmark observations.
 *
 * This evaluator does not optimize poses or invent landmarks. Callers must
 * supply identical, independently established 3D points and image observations
 * for both projection sets. A lower RMS is evidence of a better fit to those
 * observations, not proof of correct calibration or metric scale.
 */
const validProjection = P => Array.isArray(P) && P.length === 12 && P.every(Number.isFinite);
const validPoint = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const validImagePoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

function project(P, X) {
  const h=[...X,1];
  const dot=row=>row.reduce((sum,value,index)=>sum+value*h[index],0);
  const z=dot(P.slice(8,12));
  if (!Number.isFinite(z) || z <= 1e-10) return {point:null, positiveDepth:false};
  const point=[dot(P.slice(0,4))/z,dot(P.slice(4,8))/z];
  return {point:point.every(Number.isFinite)?point:null,positiveDepth:true};
}

function summarize(errors, rejected, cameraCount) {
  const sorted=errors.slice().sort((a,b)=>a-b);
  const rms=errors.length?Math.sqrt(errors.reduce((sum,e)=>sum+e*e,0)/errors.length):null;
  const median=sorted.length?(sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2):null;
  return {observationCount:errors.length,rejectedObservationCount:rejected,medianErrorPixels:median,rmsErrorPixels:rms,cameraCount};
}

/**
 * observations: [{cameraIndex, point3D:[X,Y,Z], imagePoint:[u,v]}]
 * raw/optimizedProjectionMatrices: arrays of 3x4 row-major projection matrices.
 */
export function compareReprojectionCandidates(rawProjectionMatrices, optimizedProjectionMatrices, observations) {
  if (!Array.isArray(rawProjectionMatrices) || !rawProjectionMatrices.length ||
      !Array.isArray(optimizedProjectionMatrices) ||
      rawProjectionMatrices.length!==optimizedProjectionMatrices.length ||
      !rawProjectionMatrices.every(validProjection) ||
      !optimizedProjectionMatrices.every(validProjection) ||
      !Array.isArray(observations)) {
    throw new TypeError("Provide equally sized arrays of finite 3x4 projection matrices and observations.");
  }
  const rawErrors=[], optimizedErrors=[];
  let rawRejected=0, optimizedRejected=0;
  for (const observation of observations) {
    if (!observation || !Number.isInteger(observation.cameraIndex) ||
        observation.cameraIndex<0 || observation.cameraIndex>=rawProjectionMatrices.length ||
        !validPoint(observation.point3D) || !validImagePoint(observation.imagePoint)) {
      rawRejected++; optimizedRejected++; continue;
    }
    const raw=project(rawProjectionMatrices[observation.cameraIndex],observation.point3D);
    const optimized=project(optimizedProjectionMatrices[observation.cameraIndex],observation.point3D);
    if (!raw.point) rawRejected++;
    else rawErrors.push(Math.hypot(raw.point[0]-observation.imagePoint[0],raw.point[1]-observation.imagePoint[1]));
    if (!optimized.point) optimizedRejected++;
    else optimizedErrors.push(Math.hypot(optimized.point[0]-observation.imagePoint[0],optimized.point[1]-observation.imagePoint[1]));
  }
  const raw=summarize(rawErrors,rawRejected,rawProjectionMatrices.length);
  const optimized=summarize(optimizedErrors,optimizedRejected,optimizedProjectionMatrices.length);
  const comparable=raw.observationCount>0 && optimized.observationCount>0;
  const improvement=comparable?raw.rmsErrorPixels-optimized.rmsErrorPixels:null;
  return {
    status:comparable?"reprojection-comparison-complete":"insufficient-valid-observations",
    raw,optimized,
    rmsImprovementPixels:improvement,
    rmsImprovementPercent:comparable && raw.rmsErrorPixels>1e-12?100*improvement/raw.rmsErrorPixels:null,
    interpretation:!comparable?"Insufficient valid positive-depth projections to compare candidates."
      :improvement>1e-9?"Optimized projections fit the supplied observations better."
      :improvement< -1e-9?"Optimized projections fit the supplied observations worse."
      :"The candidates have effectively equal RMS reprojection error.",
    limitation:"This comparison is meaningful only when both candidates use the same independently established 3D landmarks and image observations. It does not establish calibration, metric scale, or physical correctness by itself."
  };
}
