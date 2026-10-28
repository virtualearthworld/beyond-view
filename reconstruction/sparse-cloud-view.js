/**
 * Project a pair-local sparse 3D point set into a simple diagnostic 2D preview.
 * This is a visualization helper, not surface reconstruction or world fusion.
 */
export function projectSparseCloud(points, { width = 640, height = 360, margin = 24, yaw = 0.55, pitch = -0.25 } = {}) {
  if (!Array.isArray(points) ||
      ![width, height, margin, yaw, pitch].every(Number.isFinite) ||
      width < 1 || height < 1 || margin < 0 || margin * 2 >= Math.min(width, height)) {
    throw new TypeError("Invalid sparse-cloud projection inputs.");
  }
  const valid = points.filter(p => Array.isArray(p?.position) &&
    p.position.length === 3 && p.position.every(Number.isFinite));
  if (!valid.length) return { points: [], bounds: null, status: "no-valid-points" };
  const center = [0, 1, 2].map(i => valid.reduce((s, p) => s + p.position[i], 0) / valid.length);
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const rotated = valid.map(p => {
    const x = p.position[0] - center[0], y = p.position[1] - center[1], z = p.position[2] - center[2];
    const x1 = cy * x + sy * z;
    const z1 = -sy * x + cy * z;
    return { source: p, x: x1, y: cp * y - sp * z1, depth: sp * y + cp * z1 };
  });
  const minX = Math.min(...rotated.map(p => p.x)), maxX = Math.max(...rotated.map(p => p.x));
  const minY = Math.min(...rotated.map(p => p.y)), maxY = Math.max(...rotated.map(p => p.y));
  const spanX = Math.max(maxX - minX, 1e-6), spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((width - 2 * margin) / spanX, (height - 2 * margin) / spanY);
  const points2d = rotated.map(p => ({
    x: width / 2 + (p.x - (minX + maxX) / 2) * scale,
    y: height / 2 - (p.y - (minY + maxY) / 2) * scale,
    depth: p.depth,
    reprojectionError: Number.isFinite(p.source.reprojectionError) ? p.source.reprojectionError : null
  }));
  return {
    points: points2d,
    bounds: { minX, maxX, minY, maxY, spanX, spanY },
    status: points2d.length >= 8 ? "preview-available" : "few-points",
    pointCount: points2d.length,
    coordinateFrame: "pair-local",
    scaleKnown: false
  };
}
