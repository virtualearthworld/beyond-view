/**
 * Conservative multi-frame sparse point fusion.
 *
 * Points are transformed from each pair's local "from-frame" coordinates
 * into the origin of their connected camera component. Nearby observations
 * are merged only within that component. Translation is unit-baseline, so
 * output is provisional and must not be interpreted as metric geometry.
 */
const transpose = R => R[0].map((_, j) => R.map(row => row[j]));
const multiplyVector = (R, v) => R.map(row => row.reduce((sum, value, i) => sum + value * v[i], 0));
const distance = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);

function validPoint(point) {
  return point && Array.isArray(point.position) && point.position.length === 3 &&
    point.position.every(Number.isFinite);
}

/**
 * @param {object} reconstruction result from reconstructSparseTrajectory
 * @param {object} trajectory result from estimateCameraTrajectory
 * @param {object} options
 * @returns provisional component-local fused clouds and diagnostics
 */
export function fuseSparsePointClouds(reconstruction, trajectory, {
  mergeDistance = 0.025,
  minimumSupport = 1
} = {}) {
  if (!reconstruction || !Array.isArray(reconstruction.segments) ||
      !trajectory || !Array.isArray(trajectory.segments) ||
      !Array.isArray(trajectory.poses) ||
      reconstruction.segments.length !== trajectory.segments.length ||
      !Number.isFinite(mergeDistance) || mergeDistance <= 0 ||
      !Number.isInteger(minimumSupport) || minimumSupport < 1) {
    throw new TypeError("Invalid point-cloud fusion inputs or options.");
  }

  const poseByFrame = new Map(trajectory.poses
    .filter(p => p && p.status === "estimated" && Number.isFinite(p.frame) &&
      Array.isArray(p.rotation) && p.rotation.length === 3 &&
      Array.isArray(p.translation) && p.translation.length === 3)
    .map(p => [p.frame, p]));

  const components = new Map();
  let rejected = 0;
  let acceptedObservations = 0;

  for (let i = 0; i < reconstruction.segments.length; i++) {
    const cloud = reconstruction.segments[i];
    const motion = trajectory.segments[i];
    if (!cloud || cloud.status !== "sparse-points-estimated" ||
        motion?.status !== "estimated" || !Number.isInteger(motion.componentId)) {
      if (cloud?.points) rejected += cloud.points.length;
      continue;
    }
    const frame = Number.isFinite(cloud.fromFrame) ? cloud.fromFrame : motion.fromFrame;
    const cameraPose = poseByFrame.get(frame);
    if (!cameraPose) {
      rejected += cloud.points?.length || 0;
      continue;
    }
    const Rt = transpose(cameraPose.rotation);
    const componentId = motion.componentId;
    if (!components.has(componentId)) components.set(componentId, []);
    const fused = components.get(componentId);

    for (const point of cloud.points || []) {
      if (!validPoint(point)) { rejected++; continue; }
      // X_frame = R_frame * X_origin + t_frame; invert to component origin.
      const shifted = point.position.map((v, k) => v - cameraPose.translation[k]);
      const position = multiplyVector(Rt, shifted);
      if (!position.every(Number.isFinite)) { rejected++; continue; }

      let match = null;
      for (const candidate of fused) {
        if (distance(candidate.position, position) <= mergeDistance) {
          match = candidate;
          break;
        }
      }
      if (match) {
        const n = match.support;
        match.position = match.position.map((v, k) => (v * n + position[k]) / (n + 1));
        match.support++;
        if (Number.isFinite(point.reprojectionError)) {
          match.reprojectionErrorSum += point.reprojectionError;
          match.reprojectionErrorCount++;
        }
        match.sourceSegments.add(i);
      } else {
        fused.push({
          position,
          support: 1,
          sourceSegments: new Set([i]),
          reprojectionErrorSum: Number.isFinite(point.reprojectionError) ? point.reprojectionError : 0,
          reprojectionErrorCount: Number.isFinite(point.reprojectionError) ? 1 : 0
        });
      }
      acceptedObservations++;
    }
  }

  const output = [...components.entries()].map(([componentId, points]) => {
    const filtered = points.filter(p => p.support >= minimumSupport);
    const serialized = filtered.map(p => ({
      position: p.position,
      support: p.support,
      sourceSegments: [...p.sourceSegments].sort((a,b) => a-b),
      meanReprojectionError: p.reprojectionErrorCount
        ? p.reprojectionErrorSum / p.reprojectionErrorCount : null
    }));
    return {
      componentId,
      pointCount: serialized.length,
      observationCount: serialized.reduce((sum, p) => sum + p.support, 0),
      points: serialized
    };
  });

  return {
    status: output.length ? "provisional-component-clouds-fused" : "no-fusable-points",
    componentCount: output.length,
    components: output,
    acceptedObservations,
    rejectedObservations: rejected,
    fusedPointCount: output.reduce((sum, c) => sum + c.pointCount, 0),
    mergeDistance,
    scaleKnown: false,
    metricGeometry: false,
    limitation: "Clouds are fused only within connected camera components using unit-baseline trajectory translations. Unknown monocular scale and accumulated pose drift remain; these provisional clouds are not a metrically accurate or globally optimized world model."
  };
}
