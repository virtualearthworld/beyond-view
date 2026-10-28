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
