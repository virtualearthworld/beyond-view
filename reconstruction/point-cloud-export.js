/** Serialize one connected provisional point-cloud component as ASCII PLY. */
export function componentToAsciiPly(component) {
  if (!component || !Number.isInteger(component.componentId) || !Array.isArray(component.points)) {
    throw new TypeError("Expected a fused point-cloud component.");
  }
  const points = component.points.filter(point => point && Array.isArray(point.position) &&
    point.position.length === 3 && point.position.every(Number.isFinite) &&
    Number.isInteger(point.support) && point.support >= 1);
  if (!points.length) throw new Error("The selected component contains no exportable points.");
  const lines = [
    "ply",
    "format ascii 1.0",
    "comment Beyond View provisional component-local sparse point cloud",
    "comment component_id " + component.componentId,
    "comment monocular_scale_unknown true",
    "comment metric_geometry false",
    "element vertex " + points.length,
    "property float x",
    "property float y",
    "property float z",
    "property uint support",
    "property float mean_reprojection_error",
    "end_header"
  ];
  for (const point of points) {
    const error = Number.isFinite(point.meanReprojectionError) ? point.meanReprojectionError : -1;
    lines.push([...point.position, point.support, error].map(value =>
      Number.isInteger(value) ? String(value) : Number(value).toPrecision(9)).join(" "));
  }
  return lines.join("\n") + "\n";
}
