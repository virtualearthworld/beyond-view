/**
 * Build a source-colored sparse cloud from already validated multi-view landmarks.
 *
 * Geometry is not changed here. RGB is sampled from the original decoded source
 * frames at the measured observations; no texture, surface, or hidden pixel is
 * synthesized. Points remain component-local and monocular scale remains unknown.
 */
function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function validFrame(frame) {
  return frame && Number.isInteger(frame.width) && frame.width > 0 &&
    Number.isInteger(frame.height) && frame.height > 0 &&
    frame.rgba && Number.isFinite(frame.rgba.length) &&
    frame.rgba.length >= frame.width * frame.height * 4;
}

function sampleObservationRgb(frame, observation, patchRadius) {
  if (!validFrame(frame) || !observation ||
      !Number.isFinite(observation.x) || !Number.isFinite(observation.y) ||
      observation.x < 0 || observation.x >= frame.width ||
      observation.y < 0 || observation.y >= frame.height) return null;

  const centerX = Math.round(observation.x);
  const centerY = Math.round(observation.y);
  const channels = [[], [], []];
  for (let dy = -patchRadius; dy <= patchRadius; dy++) {
    for (let dx = -patchRadius; dx <= patchRadius; dx++) {
      const x = centerX + dx, y = centerY + dy;
      if (x < 0 || x >= frame.width || y < 0 || y >= frame.height) continue;
      const offset = (y * frame.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const value = Number(frame.rgba[offset + channel]);
        if (Number.isFinite(value)) channels[channel].push(value);
      }
    }
  }
  if (channels.some(values => !values.length)) return null;
  return channels.map(values => Math.round(median(values)));
}

const validPosition = point => Array.isArray(point?.position) &&
  point.position.length === 3 && point.position.every(Number.isFinite);

export function buildSourceColoredMultiViewCloud(landmarks, sourceFrames, {
  minimumColorViews = 2,
  patchRadius = 1
} = {}) {
  if (!landmarks || !Array.isArray(landmarks.points) ||
      !Array.isArray(sourceFrames) ||
      !Number.isInteger(minimumColorViews) || minimumColorViews < 1 ||
      !Number.isInteger(patchRadius) || patchRadius < 0 || patchRadius > 4) {
    throw new TypeError("Invalid multi-view landmarks, source frames, or color-sampling options.");
  }

  const components = new Map();
  let rejectedGeometryPointCount = 0;
  let colorizedPointCount = 0;
  let uncoloredPointCount = 0;

  for (const landmark of landmarks.points) {
    if (!validPosition(landmark) ||
        !Number.isInteger(landmark.componentId) || landmark.componentId < 0) {
      rejectedGeometryPointCount++;
      continue;
    }

    // A repeated observation from the same decoded frame is still one view.
    // Count distinct source frames so duplicate records cannot satisfy the
    // multi-view appearance requirement by themselves.
    const samplesByFrame = new Map();
    const sourceObservations = Array.isArray(landmark.sourceObservations)
      ? landmark.sourceObservations : [];
    for (const observation of sourceObservations) {
      if (!Number.isInteger(observation?.frame) ||
          observation.frame < 0 || observation.frame >= sourceFrames.length ||
          samplesByFrame.has(observation.frame)) continue;
      const rgb = sampleObservationRgb(
        sourceFrames[observation.frame], observation, patchRadius
      );
      if (rgb) samplesByFrame.set(observation.frame, {
        frame: observation.frame,
        rgb
      });
    }
    const samples = [...samplesByFrame.values()]
      .sort((a, b) => a.frame - b.frame);

    const rgb = samples.length >= minimumColorViews
      ? [0, 1, 2].map(channel =>
          Math.round(median(samples.map(sample => sample.rgb[channel]))))
      : null;
    if (rgb) colorizedPointCount++;
    else uncoloredPointCount++;

    if (!components.has(landmark.componentId)) {
      components.set(landmark.componentId, []);
    }
    const observedFrames = samples.map(sample => sample.frame);
    components.get(landmark.componentId).push({
      position: landmark.position.slice(),
      componentId: landmark.componentId,
      coordinateFrame: "component-local",
      rgb,
      support: Number.isInteger(landmark.observations)
        ? landmark.observations : sourceObservations.length,
      sourceFrames: observedFrames,
      sourceTimesSeconds: observedFrames
        .map(frame => sourceFrames[frame]?.time)
        .filter(Number.isFinite),
      sourceViewCount: observedFrames.length,
      colorObservationCount: samples.length,
      meanReprojectionError: Number.isFinite(landmark.meanReprojectionError)
        ? landmark.meanReprojectionError : null,
      maxReprojectionError: Number.isFinite(landmark.maxReprojectionError)
        ? landmark.maxReprojectionError : null,
      maximumTriangulationAngleDegrees: Number.isFinite(landmark.maximumTriangulationAngleDegrees)
        ? landmark.maximumTriangulationAngleDegrees : null
    });
  }

  const output = [...components.entries()].map(([componentId, points]) => ({
    componentId,
    pointCount: points.length,
    observationCount: points.reduce((sum, point) => sum + point.support, 0),
    colorizedPointCount: points.filter(point => Array.isArray(point.rgb)).length,
    points
  }));

  return {
    status: output.length
      ? colorizedPointCount ? "source-colored-multiview-cloud-ready" : "multiview-cloud-without-source-color"
      : "no-validated-multiview-points",
    componentCount: output.length,
    components: output,
    inputPointCount: landmarks.points.length,
    rejectedGeometryPointCount,
    colorizedPointCount,
    uncoloredPointCount,
    minimumColorViews,
    patchRadius,
    scaleKnown: false,
    metricGeometry: false,
    appearanceSource: "Median RGB samples from distinct measured observations in original decoded source frames; no texture synthesis.",
    limitation: "These are sparse, component-local multi-view landmarks with source-sampled point colors, not a continuous texture, surface mesh, dense reconstruction, metric world model, or navigable environment."
  };
}
