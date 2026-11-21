/** Serialize one connected provisional point-cloud component as ASCII PLY. */
const validRgb = rgb => Array.isArray(rgb) && rgb.length === 3 &&
  rgb.every(value => Number.isFinite(value) && value >= 0 && value <= 255);

export function componentToAsciiPly(component) {
  if (!component || !Number.isInteger(component.componentId) || !Array.isArray(component.points)) {
    throw new TypeError("Expected a point-cloud component.");
  }
  const points = component.points.filter(point => point && Array.isArray(point.position) &&
    point.position.length === 3 && point.position.every(Number.isFinite) &&
    Number.isInteger(point.support) && point.support >= 1);
  if (!points.length) throw new Error("The selected component contains no exportable points.");
  const colorizedCount = points.filter(point => validRgb(point.rgb)).length;
  const includeColor = colorizedCount > 0;
  const lines = [
    "ply",
    "format ascii 1.0",
    "comment Beyond View provisional component-local sparse point cloud",
    "comment component_id " + component.componentId,
    "comment monocular_scale_unknown true",
    "comment metric_geometry false"
  ];
  if (includeColor) {
    lines.push("comment appearance original_source_frame_rgb_samples");
    lines.push("comment colorized_points " + colorizedCount);
    lines.push("comment uncolored_points " + (points.length - colorizedCount));
  }
  lines.push(
    "element vertex " + points.length,
    "property float x",
    "property float y",
    "property float z",
    "property uint support",
    "property float mean_reprojection_error"
  );
  if (includeColor) {
    lines.push("property uchar red", "property uchar green", "property uchar blue");
  }
  lines.push("end_header");
  for (const point of points) {
    const error = Number.isFinite(point.meanReprojectionError) ? point.meanReprojectionError : -1;
    const values = [...point.position, point.support, error];
    if (includeColor) values.push(...(validRgb(point.rgb) ? point.rgb.map(Math.round) : [128, 128, 128]));
    lines.push(values.map(value =>
      Number.isInteger(value) ? String(value) : Number(value).toPrecision(9)).join(" "));
  }
  return lines.join("\n") + "\n";
}
