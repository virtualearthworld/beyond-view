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
