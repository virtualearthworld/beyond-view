/**
 * Beyond View — first-party multiview geometry.
 *
 * These routines triangulate measured image correspondences when camera
 * projection matrices are already known. They do not guess hidden scenery.
 * Camera-pose estimation and dense surface reconstruction are separate stages.
 */

function finiteArray(values, length, name) {
  if (!Array.isArray(values) || values.length !== length ||
      values.some(v => !Number.isFinite(v))) {
    throw new TypeError(name + " must be an array of " + length + " finite numbers.");
  }
}


/** Solve a square linear system with partial pivoting. */
function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-10) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const scale = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= scale;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j];
    }
  }
  const result = a.map(row => row[n]);
  return result.every(Number.isFinite) ? result : null;
}

/**
 * Fit a 2D projective homography from four or more image correspondences.
 * This models perspective image-to-image mapping, not a 3D camera pose.
 */
export function estimateHomography(tracks) {
  if (!Array.isArray(tracks) || tracks.length < 4) return null;
  const rows = [], values = [];
  for (const t of tracks) {
    if (!t?.from || !t?.to ||
        ![t.from.x,t.from.y,t.to.x,t.to.y].every(Number.isFinite)) continue;
    const {x,y}=t.from, {x:u,y:v}=t.to;
    rows.push([x,y,1,0,0,0,-u*x,-u*y]); values.push(u);
    rows.push([0,0,0,x,y,1,-v*x,-v*y]); values.push(v);
  }
  if (rows.length < 8) return null;
  // Least-squares normal equations for h33 fixed to 1.
  const ata=Array.from({length:8},()=>Array(8).fill(0));
  const atb=Array(8).fill(0);
  for(let r=0;r<rows.length;r++) for(let i=0;i<8;i++){
    atb[i]+=rows[r][i]*values[r];
    for(let j=0;j<8;j++) ata[i][j]+=rows[r][i]*rows[r][j];
  }
  const h=solveLinearSystem(ata,atb);
  return h ? [...h,1] : null;
}

export function projectHomography(H, point) {
  finiteArray(H,9,"H"); finiteArray(point,2,"point");
  const [x,y]=point;
  const z=H[6]*x+H[7]*y+H[8];
  if(!Number.isFinite(z)||Math.abs(z)<1e-10)return null;
  const out=[(H[0]*x+H[1]*y+H[2])/z,(H[3]*x+H[4]*y+H[5])/z];
  return out.every(Number.isFinite)?out:null;
}

/**
 * Deterministic RANSAC for a dominant perspective mapping between two frames.
 * Returns inlier/outlier tracks and pixel reprojection errors. This is useful
 * for camera-motion diagnostics but is not an essential-matrix pose solution.
 */
export function estimateHomographyRansac(tracks, { thresholdPixels=3, iterations=160 } = {}) {
  if(!Array.isArray(tracks)||!Number.isFinite(thresholdPixels)||thresholdPixels<=0||
     !Number.isInteger(iterations)||iterations<1) throw new TypeError("Invalid homography RANSAC options.");
  const valid=tracks.filter(t=>t?.from&&t?.to&&[t.from.x,t.from.y,t.to.x,t.to.y].every(Number.isFinite));
  if(valid.length<4)return {H:null,inliers:[],outliers:valid,inlierRatio:0,status:"insufficient-tracks"};
  let bestH=null,bestInliers=[],bestError=Infinity;
  // Seeded pseudo-random sampling keeps tests reproducible.
  let seed=0x51f15e;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let it=0;it<iterations;it++){
    const sample=[];
    while(sample.length<4){const candidate=valid[Math.floor(random()*valid.length)];if(!sample.includes(candidate))sample.push(candidate);}
    const H=estimateHomography(sample); if(!H)continue;
    const inliers=[];let error=0;
    for(const track of valid){
      const p=projectHomography(H,[track.from.x,track.from.y]);if(!p)continue;
      const e=Math.hypot(p[0]-track.to.x,p[1]-track.to.y);
      if(e<=thresholdPixels){inliers.push({...track,homographyErrorPixels:e});error+=e;}
    }
    if(inliers.length>bestInliers.length||(inliers.length===bestInliers.length&&error<bestError)){
      bestH=H;bestInliers=inliers;bestError=error;
    }
  }
  if(bestInliers.length>=4){
    const refined=estimateHomography(bestInliers);
    if(refined){
      const recalculated=[];
      for(const track of valid){
        const p=projectHomography(refined,[track.from.x,track.from.y]);if(!p)continue;
        const e=Math.hypot(p[0]-track.to.x,p[1]-track.to.y);
        if(e<=thresholdPixels)recalculated.push({...track,homographyErrorPixels:e});
      }
      if(recalculated.length>=bestInliers.length) {bestH=refined;bestInliers=recalculated;}
    }
  }
  const inlierSet=new Set(bestInliers);
  // Compare by object identity is unreliable after error metadata is attached; classify by coordinates instead.
  const keys=new Set(bestInliers.map(t=>[t.from.x,t.from.y,t.to.x,t.to.y].join(",")));
  const outliers=valid.filter(t=>!keys.has([t.from.x,t.from.y,t.to.x,t.to.y].join(",")));
  return {H:bestH,inliers:bestInliers,outliers,inlierRatio:bestInliers.length/valid.length,
    status:bestInliers.length>=8?"perspective-model-found": "weak-model-support",
    limitation:"A 2D homography can explain planar or rotation-dominated image motion; it does not by itself recover camera pose or scene depth."};
}

/**
 * Triangulate one point from two calibrated 3x4 projection matrices and two
 * image coordinates using the DLT equations and a 4x4 smallest-eigenvector
 * solve. Coordinates are pixel coordinates; projection matrices must use the
 * same pixel convention. Returns null for degenerate observations.
 */
export function triangulatePoint(P1, P2, image1, image2) {
  finiteArray(P1, 12, "P1");
  finiteArray(P2, 12, "P2");
  finiteArray(image1, 2, "image1");
  finiteArray(image2, 2, "image2");

  const [u1, v1] = image1;
  const [u2, v2] = image2;
  const rows = [
    P1.slice(0, 4).map((x, i) => u1 * P1[8 + i] - x),
    P1.slice(4, 8).map((x, i) => v1 * P1[8 + i] - x),
    P2.slice(0, 4).map((x, i) => u2 * P2[8 + i] - x),
    P2.slice(4, 8).map((x, i) => v2 * P2[8 + i] - x)
  ];

  // Form A^T A. The smallest eigenvector is found with Jacobi rotations.
  const ata = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  for (const row of rows) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) ata[i][j] += row[i] * row[j];
    }
  }
  const a = ata.map(row => row.slice());
  const vectors = Array.from({ length: 4 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => i === j ? 1 : 0)
  );

  for (let iteration = 0; iteration < 80; iteration++) {
    let p = 0, q = 1, largest = Math.abs(a[0][1]);
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        if (Math.abs(a[i][j]) > largest) {
          largest = Math.abs(a[i][j]); p = i; q = j;
        }
      }
    }
    if (largest < 1e-12) break;
    const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
    const c = Math.cos(angle), s = Math.sin(angle);
    const app = c*c*a[p][p] - 2*s*c*a[p][q] + s*s*a[q][q];
    const aqq = s*s*a[p][p] + 2*s*c*a[p][q] + c*c*a[q][q];
    for (let k = 0; k < 4; k++) {
      if (k !== p && k !== q) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = a[p][k] = c*akp - s*akq;
        a[k][q] = a[q][k] = s*akp + c*akq;
      }
    }
    a[p][p] = app; a[q][q] = aqq; a[p][q] = a[q][p] = 0;
    for (let k = 0; k < 4; k++) {
      const vkp = vectors[k][p], vkq = vectors[k][q];
      vectors[k][p] = c*vkp - s*vkq;
      vectors[k][q] = s*vkp + c*vkq;
    }
  }

  let smallest = 0;
  for (let i = 1; i < 4; i++) {
    if (a[i][i] < a[smallest][smallest]) smallest = i;
  }
  const X = vectors.map(row => row[smallest]);
  if (!X.every(Number.isFinite) || Math.abs(X[3]) < 1e-10) return null;
  return [X[0] / X[3], X[1] / X[3], X[2] / X[3]];
}

/** Reproject a 3D point through a 3x4 camera projection matrix. */
export function projectPoint(P, point) {
  finiteArray(P, 12, "P");
  finiteArray(point, 3, "point");
  const X = [...point, 1];
  const dot = row => row.reduce((sum, value, i) => sum + value * X[i], 0);
  const z = dot(P.slice(8, 12));
  if (!Number.isFinite(z) || Math.abs(z) < 1e-10) return null;
  return [dot(P.slice(0, 4)) / z, dot(P.slice(4, 8)) / z];
}

/**
 * Triangulate tracks into sparse 3D points and reject points whose reprojection
 * error is too large. The caller must supply estimated/calibrated camera poses.
 */
export function triangulateTracks(P1, P2, tracks, { maxReprojectionError = 3 } = {}) {
  const points = [];
  for (const track of tracks) {
    const point = triangulatePoint(
      P1, P2,
      [track.from.x, track.from.y],
      [track.to.x, track.to.y]
    );
    if (!point) continue;
    const p1 = projectPoint(P1, point);
    const p2 = projectPoint(P2, point);
    if (!p1 || !p2) continue;
    const error1 = Math.hypot(p1[0] - track.from.x, p1[1] - track.from.y);
    const error2 = Math.hypot(p2[0] - track.to.x, p2[1] - track.to.y);
    const reprojectionError = (error1 + error2) / 2;
    if (reprojectionError <= maxReprojectionError) {
      points.push({ position: point, reprojectionError, observations: 2 });
    }
  }
  return points;
}
