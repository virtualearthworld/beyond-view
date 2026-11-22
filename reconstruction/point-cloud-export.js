/** Serialize one connected provisional point-cloud component as ASCII PLY. */
const validRgb = rgb => Array.isArray(rgb) && rgb.length === 3 &&
  rgb.every(value => Number.isFinite(value) && value >= 0 && value <= 255);

const nonNegativeInteger = value =>
  Number.isInteger(value) && value >= 0 ? value : 0;

const finiteOrUnknown = value => Number.isFinite(value) ? value : -1;

function sourceFrameRange(point) {
  const frames = Array.isArray(point.sourceFrames)
    ? [...new Set(point.sourceFrames.filter(frame =>
        Number.isInteger(frame) && frame >= 0))].sort((a, b) => a - b)
    : [];
  return frames.length
    ? [frames[0], frames[frames.length - 1]]
    : [-1, -1];
}

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
    "comment coordinate_frame component_local",
    "comment monocular_scale_unknown true",
    "comment metric_geometry false",
    "comment navigation_enabled false"
  ];
  if (includeColor) {
    lines.push("comment appearance original_source_frame_rgb_samples");
    lines.push("comment color_valid 1 means sampled source RGB; 0 means no valid source color");
    lines.push("comment colorized_points " + colorizedCount);
    lines.push("comment uncolored_points " + (points.length - colorizedCount));
  }
  lines.push(
    "element vertex " + points.length,
    "property float x",
    "property float y",
    "property float z",
    "property uint support",
    "property uint source_view_count",
    "property int first_source_frame",
    "property int last_source_frame",
    "property uint color_observation_count",
    "property float mean_reprojection_error",
    "property float max_reprojection_error",
    "property float maximum_triangulation_angle_degrees"
  );
  if (includeColor) {
    lines.push(
      "property uchar color_valid",
      "property uchar red",
      "property uchar green",
      "property uchar blue"
    );
  }
  lines.push("end_header");
  for (const point of points) {
    const [firstFrame, lastFrame] = sourceFrameRange(point);
    const values = [
      ...point.position,
      point.support,
      nonNegativeInteger(point.sourceViewCount ?? point.sourceFrames?.length),
      firstFrame,
      lastFrame,
      nonNegativeInteger(point.colorObservationCount),
      finiteOrUnknown(point.meanReprojectionError),
      finiteOrUnknown(point.maxReprojectionError),
      finiteOrUnknown(point.maximumTriangulationAngleDegrees)
    ];
    if (includeColor) {
      const hasColor = validRgb(point.rgb);
      // PLY requires scalar RGB values for every vertex once the properties
      // are declared. A black placeholder is explicitly marked invalid rather
      // than being mistaken for a measured source color.
      values.push(hasColor ? 1 : 0, ...(hasColor ? point.rgb.map(Math.round) : [0, 0, 0]));
    }
    lines.push(values.map(value =>
      Number.isInteger(value) ? String(value) : Number(value).toPrecision(9)).join(" "));
  }
  return lines.join("\n") + "\n";
}
