/**
 * Calibrated two-view relative camera-pose candidates.
 *
 * Input F follows x2^T F x1 = 0; K1/K2 are 3x3 camera intrinsics.
 * Returns the four standard (R, +/-t) candidates. Translation has unit
 * length only: two-view geometry cannot recover absolute scale. Select the
 * physically correct candidate later with triangulation/cheirality checks.
 */
const finiteMatrix = (m) => Array.isArray(m) && m.length === 3 &&
  m.every(r => Array.isArray(r) && r.length === 3 && r.every(Number.isFinite));
const tr = a => a[0].map((_,j)=>a.map(r=>r[j]));
const mm = (a,b) => a.map(r=>b[0].map((_,j)=>r.reduce((s,x,k)=>s+x*b[k][j],0)));
const mv = (a,v) => a.map(r=>r.reduce((s,x,i)=>s+x*v[i],0));
const scale = (a,s) => a.map(r=>r.map(x=>x*s));
const sub = (a,b) => a.map((r,i)=>r.map((x,j)=>x-b[i][j]));
const norm = v => Math.hypot(...v);
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
const unit = v => { const n=norm(v); if(n<1e-12) throw new Error("Degenerate matrix decomposition."); return v.map(x=>x/n); };
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const det = a => a[0][0]*(a[1][1]*a[2][2]-a[1][2]*a[2][1])-a[0][1]*(a[1][0]*a[2][2]-a[1][2]*a[2][0])+a[0][2]*(a[1][0]*a[2][1]-a[1][1]*a[2][0]);
function eigenSymmetric3(input) {
  const a=input.map(r=>r.slice()), v=[[1,0,0],[0,1,0],[0,0,1]];
  for(let iter=0;iter<100;iter++){
    let p=0,q=1,max=Math.abs(a[0][1]);
    for(const [i,j] of [[0,2],[1,2]]) if(Math.abs(a[i][j])>max){p=i;q=j;max=Math.abs(a[i][j]);}
    if(max<1e-13) break;
    const phi=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(phi),s=Math.sin(phi);
    const app=c*c*a[p][p]-2*s*c*a[p][q]+s*s*a[q][q], aqq=s*s*a[p][p]+2*s*c*a[p][q]+c*c*a[q][q];
    for(let k=0;k<3;k++) if(k!==p&&k!==q){const x=a[k][p],y=a[k][q];a[k][p]=a[p][k]=c*x-s*y;a[k][q]=a[q][k]=s*x+c*y;}
    a[p][p]=app;a[q][q]=aqq;a[p][q]=a[q][p]=0;
    for(let k=0;k<3;k++){const x=v[k][p],y=v[k][q];v[k][p]=c*x-s*y;v[k][q]=s*x+c*y;}
  }
  const order=[0,1,2].sort((i,j)=>a[j][j]-a[i][i]);
  return {values:order.map(i=>Math.max(0,a[i][i])), vectors:v.map(r=>order.map(i=>r[i]))};
}
function orthonormalSvd(E) {
  const eig=eigenSymmetric3(mm(tr(E),E));
  const V=eig.vectors, singular=eig.values.map(x=>Math.sqrt(x));
  if(singular[0]<1e-10 || singular[1]<singular[0]*1e-8) throw new Error("Fundamental matrix is degenerate.");
  let u0=unit(mv(E,[V[0][0],V[1][0],V[2][0]]));
  let u1=mv(E,[V[0][1],V[1][1],V[2][1]]);
  u1=unit(u1.map((x,i)=>x-dot(u0,u1)*u0[i]));
  let u2=unit(cross(u0,u1));
  let U=[[u0[0],u1[0],u2[0]],[u0[1],u1[1],u2[1]],[u0[2],u1[2],u2[2]]];
  let VV=V.map(r=>r.slice());
  if(det(VV)<0) { for(let i=0;i<3;i++) VV[i][2]*=-1; }
  if(det(U)<0) { for(let i=0;i<3;i++) U[i][2]*=-1; }
  return {U,V:VV,singular};
}
function rotationDistance(a,b) {
  const d=mm(a,tr(b)); return Math.acos(Math.max(-1,Math.min(1,(d[0][0]+d[1][1]+d[2][2]-1)/2)));
}
const W=[[0,-1,0],[1,0,0],[0,0,1]];
const Wt=tr(W);
/**
 * Estimate four calibrated relative-pose candidates from F and intrinsics.
 * Options: { minimumSingularRatio }, which rejects nearly degenerate inputs.
 */
export function recoverCameraPoseCandidates(F,K1,K2=K1,{minimumSingularRatio=1e-6}={}) {
  if(!finiteMatrix(F)||!finiteMatrix(K1)||!finiteMatrix(K2)||
     !Number.isFinite(minimumSingularRatio)||minimumSingularRatio<=0)
    throw new TypeError("Expected finite 3x3 F, K1, K2 matrices and a positive singular-ratio threshold.");
  const E=mm(mm(tr(K2),F),K1);
  const svd=orthonormalSvd(E);
  if(svd.singular[1]/svd.singular[0]<minimumSingularRatio)
    throw new Error("Essential matrix is too close to degenerate for stable pose recovery.");
  const {U,V}=svd;
  const avg=(svd.singular[0]+svd.singular[1])/2;
  const D=[[avg,0,0],[0,avg,0],[0,0,0]];
  const essential=mm(mm(U,D),tr(V));
  const r1=mm(mm(U,W),tr(V)),r2=mm(mm(U,Wt),tr(V));
  const t=unit([U[0][2],U[1][2],U[2][2]]);
  const rotations=[r1,r2].map(R=>det(R)<0?scale(R,-1):R);
  const candidates=[];
  for(let i=0;i<2;i++) for(const sign of [1,-1]) candidates.push({
    rotation:rotations[i], translationDirection:t.map(x=>x*sign),
    rotationDeterminant:det(rotations[i])
  });
  return {status:"pose-candidates-recovered",essentialMatrix:essential,
    candidates, singularValues:svd.singular,
    limitation:"Four relative-pose candidates are returned. Choose the valid candidate using triangulation and positive-depth (cheirality) checks. Translation scale and absolute world pose are not observable from two views alone."};
}


function inverse3(a) {
  const d=det(a);
  if(!Number.isFinite(d)||Math.abs(d)<1e-12) throw new Error("Camera intrinsic matrix is singular.");
  return [
    [(a[1][1]*a[2][2]-a[1][2]*a[2][1])/d,(a[0][2]*a[2][1]-a[0][1]*a[2][2])/d,(a[0][1]*a[1][2]-a[0][2]*a[1][1])/d],
    [(a[1][2]*a[2][0]-a[1][0]*a[2][2])/d,(a[0][0]*a[2][2]-a[0][2]*a[2][0])/d,(a[0][2]*a[1][0]-a[0][0]*a[1][2])/d],
    [(a[1][0]*a[2][1]-a[1][1]*a[2][0])/d,(a[0][1]*a[2][0]-a[0][0]*a[2][1])/d,(a[0][0]*a[1][1]-a[0][1]*a[1][0])/d]
  ];
}
function solve3(A,b) {
  const m=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<3;c++){
    let p=c;for(let r=c+1;r<3;r++)if(Math.abs(m[r][c])>Math.abs(m[p][c]))p=r;
    if(Math.abs(m[p][c])<1e-11)return null;
    [m[c],m[p]]=[m[p],m[c]];
    const q=m[c][c];for(let j=c;j<4;j++)m[c][j]/=q;
    for(let r=0;r<3;r++)if(r!==c){const z=m[r][c];for(let j=c;j<4;j++)m[r][j]-=z*m[c][j];}
  }
  const x=m.map(r=>r[3]);return x.every(Number.isFinite)?x:null;
}
function triangulateNormalized(R,t,p1,p2) {
  const [x,y]=p1,[u,v]=p2;
  const rows=[[1,0,-x],[0,1,-y],
    R[0].map((z,i)=>z-u*R[2][i]),
    R[1].map((z,i)=>z-v*R[2][i])];
  const rhs=[0,0,u*t[2]-t[0],v*t[2]-t[1]];
  const ata=Array.from({length:3},()=>Array(3).fill(0)),atb=Array(3).fill(0);
  for(let k=0;k<rows.length;k++)for(let i=0;i<3;i++){
    atb[i]+=rows[k][i]*rhs[k];
    for(let j=0;j<3;j++)ata[i][j]+=rows[k][i]*rows[k][j];
  }
  return solve3(ata,atb);
}
/**
 * Choose among the four candidates using positive-depth triangulation.
 * points are {from:{x,y},to:{x,y}} pixel correspondences. The candidate pose
 * convention is X2 = R*X1 + t; K1/K2 are the same intrinsics used for recovery.
 */
export function selectCameraPose(candidates,points,K1,K2=K1,{minimumPoints=8,minimumPositiveDepthRatio=0.6}={}) {
  if(!Array.isArray(candidates)||candidates.length!==4||
     !Array.isArray(points)||!finiteMatrix(K1)||!finiteMatrix(K2)||
     !Number.isInteger(minimumPoints)||minimumPoints<1||
     !Number.isFinite(minimumPositiveDepthRatio)||minimumPositiveDepthRatio<=0||minimumPositiveDepthRatio>1)
    throw new TypeError("Expected four pose candidates, image correspondences, valid intrinsics, and valid selection options.");
  const valid=points.filter(p=>Number.isFinite(p?.from?.x)&&Number.isFinite(p?.from?.y)&&Number.isFinite(p?.to?.x)&&Number.isFinite(p?.to?.y));
  if(valid.length<minimumPoints)return {status:"insufficient-correspondences",totalPoints:valid.length,selectedIndex:null,candidates:[]};
  const iK1=inverse3(K1),iK2=inverse3(K2);
  const normalized=(inv,p)=>{const q=mv(inv,[p.x,p.y,1]);if(!Number.isFinite(q[2])||Math.abs(q[2])<1e-12)return null;return [q[0]/q[2],q[1]/q[2]];};
  const scores=candidates.map((candidate,index)=>{
    if(!finiteMatrix(candidate?.rotation)||!Array.isArray(candidate.translationDirection)||candidate.translationDirection.length!==3||!candidate.translationDirection.every(Number.isFinite))
      throw new TypeError("Each candidate must contain a 3x3 rotation and a finite translation direction.");
    let validDepth=0,attempted=0;
    for(const point of valid){
      const p1=normalized(iK1,point.from),p2=normalized(iK2,point.to);if(!p1||!p2)continue;
      const X=triangulateNormalized(candidate.rotation,candidate.translationDirection,p1,p2);if(!X)continue;
      attempted++;
      const X2=mv(candidate.rotation,X).map((v,i)=>v+candidate.translationDirection[i]);
      if(X[2]>1e-8&&X2[2]>1e-8)validDepth++;
    }
    return {index,positiveDepthCount:validDepth,triangulatedCount:attempted,
      positiveDepthRatio:attempted?validDepth/attempted:0};
  }).sort((a,b)=>b.positiveDepthCount-a.positiveDepthCount||b.positiveDepthRatio-a.positiveDepthRatio);
  const best=scores[0],ratio=best?.positiveDepthRatio??0;
  return {status:best&&best.triangulatedCount>=minimumPoints&&ratio>=minimumPositiveDepthRatio?"pose-selected":"ambiguous-pose",
    selectedIndex:best&&best.triangulatedCount>=minimumPoints&&ratio>=minimumPositiveDepthRatio?best.index:null,
    totalPoints:valid.length,minimumPositiveDepthRatio,candidates:scores,
    limitation:"This selects a relative pose only when enough matched points triangulate with positive depth in both cameras. It does not recover absolute scale or validate the real-video pipeline by itself."};
}
