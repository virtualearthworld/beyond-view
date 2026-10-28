/**
 * First-party epipolar model estimation from image correspondences.
 * This estimates an unconstrained fundamental-matrix hypothesis and its
 * inliers. It is an intermediate diagnostic, NOT calibrated camera pose.
 */
function finitePoint(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y);
}
function smallestEigenvectorSymmetric(input) {
  const n = input.length;
  const a = input.map(r => r.slice());
  const v = Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
  for (let iter=0; iter<Math.max(100,n*n*12); iter++) {
    let p=0,q=1,max=0;
    for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) {
      if(Math.abs(a[i][j])>max){max=Math.abs(a[i][j]);p=i;q=j;}
    }
    if(max<1e-10) break;
    const theta=0.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]);
    const c=Math.cos(theta),s=Math.sin(theta);
    const app=c*c*a[p][p]-2*s*c*a[p][q]+s*s*a[q][q];
    const aqq=s*s*a[p][p]+2*s*c*a[p][q]+c*c*a[q][q];
    for(let k=0;k<n;k++) if(k!==p&&k!==q){
      const x=a[k][p],y=a[k][q];
      a[k][p]=a[p][k]=c*x-s*y; a[k][q]=a[q][k]=s*x+c*y;
    }
    a[p][p]=app;a[q][q]=aqq;a[p][q]=a[q][p]=0;
    for(let k=0;k<n;k++){const x=v[k][p],y=v[k][q];v[k][p]=c*x-s*y;v[k][q]=s*x+c*y;}
  }
  let idx=0;for(let i=1;i<n;i++)if(a[i][i]<a[idx][idx])idx=i;
  return v.map(row=>row[idx]);
}
function fitFundamental(tracks) {
  if(tracks.length<8)return null;
  const ata=Array.from({length:9},()=>Array(9).fill(0));
  for(const t of tracks){
    const x=t.from.x,y=t.from.y,u=t.to.x,w=t.to.y;
    const r=[u*x,u*y,u,w*x,w*y,w,x,y,1];
    for(let i=0;i<9;i++)for(let j=0;j<9;j++)ata[i][j]+=r[i]*r[j];
  }
  const f=smallestEigenvectorSymmetric(ata);
  const norm=Math.hypot(...f);
  return norm>1e-12?f.map(x=>x/norm):null;
}
function epipolarError(F,t) {
  const {x,y}=t.from,{x:u,y:w}=t.to;
  const l2=[F[0]*x+F[1]*y+F[2],F[3]*x+F[4]*y+F[5],F[6]*x+F[7]*y+F[8]];
  const l1=[F[0]*u+F[3]*w+F[6],F[1]*u+F[4]*w+F[7],F[2]*u+F[5]*w+F[8]];
  const e=u*l2[0]+w*l2[1]+l2[2];
  const d2=Math.hypot(l2[0],l2[1]),d1=Math.hypot(l1[0],l1[1]);
  if(d1<1e-10||d2<1e-10)return Infinity;
  return Math.abs(e)*Math.sqrt(0.5*(1/(d1*d1)+1/(d2*d2)));
}
/** Robustly estimate an epipolar model using deterministic RANSAC. */
export function estimateEpipolarModel(tracks,{thresholdPixels=2,iterations=250,minInliers=8}={}) {
  if(!Array.isArray(tracks)||!Number.isFinite(thresholdPixels)||thresholdPixels<=0||
     !Number.isInteger(iterations)||iterations<1||!Number.isInteger(minInliers)||minInliers<8)
    throw new TypeError("Invalid epipolar estimation inputs.");
  const valid=tracks.filter(t=>finitePoint(t?.from)&&finitePoint(t?.to));
  if(valid.length<8)return {status:"insufficient-tracks",totalTracks:valid.length,inliers:[],F:null};
  let seed=0x51f15e;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  let bestF=null,best=[],bestError=Infinity;
  for(let it=0;it<iterations;it++){
    const sample=[];while(sample.length<8){const t=valid[Math.floor(rand()*valid.length)];if(!sample.includes(t))sample.push(t);}
    const F=fitFundamental(sample);if(!F)continue;
    const inside=[];let sum=0;
    for(const t of valid){const e=epipolarError(F,t);if(e<=thresholdPixels){inside.push({...t,epipolarErrorPixels:e});sum+=e;}}
    if(inside.length>best.length||(inside.length===best.length&&sum<bestError)){bestF=F;best=inside;bestError=sum;}
  }
  if(best.length>=8){const refined=fitFundamental(best);if(refined){const inside=[];for(const t of valid){const e=epipolarError(refined,t);if(e<=thresholdPixels)inside.push({...t,epipolarErrorPixels:e});}if(inside.length>=best.length){bestF=refined;best=inside;}}}
  const errors=best.map(t=>t.epipolarErrorPixels).sort((a,b)=>a-b);
  return {status:best.length>=minInliers?"epipolar-model-found":"weak-model-support",
    totalTracks:valid.length,inliers:best,F:bestF,inlierRatio:best.length/valid.length,
    medianEpipolarErrorPixels:errors.length?errors[Math.floor(errors.length/2)]:null,
    limitation:"An epipolar model is not a 3D camera pose. Calibration, rank-2 enforcement, pose decomposition, and real-video validation are still required."};
}
