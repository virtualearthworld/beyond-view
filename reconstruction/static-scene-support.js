/**
 * Beyond View — conservative spatial/temporal support gate for fixed-scene candidates.
 *
 * This does not identify semantic objects. It prevents a small, localized, or
 * temporally brief set of geometrically consistent tracks from being treated
 * as sufficient scene-wide evidence. Each connected camera component is
 * evaluated independently; disconnected components are never pooled.
 */

export function assessStaticSceneTrackSupport(tracks, {
  frameWidth,
  frameHeight,
  frameCount,
  minimumTracksPerComponent = 16,
  gridColumns = 4,
  gridRows = 3,
  minimumOccupiedCells = 6,
  minimumColumns = 3,
  minimumRows = 2,
  minimumCoveredFrameRatio = 0.5,
  minimumComponentFrameSpanRatio = 0.25,
  minimumTracksPerFrame = 2,
  minimumObservations = 4
} = {}) {
  const integer = value => Number.isInteger(value);
  if (!Array.isArray(tracks) ||
      !Number.isFinite(frameWidth) || frameWidth <= 0 ||
      !Number.isFinite(frameHeight) || frameHeight <= 0 ||
      !integer(frameCount) || frameCount < 2 ||
      !integer(minimumTracksPerComponent) || minimumTracksPerComponent < 1 ||
      !integer(gridColumns) || gridColumns < 1 ||
      !integer(gridRows) || gridRows < 1 ||
      !integer(minimumOccupiedCells) || minimumOccupiedCells < 1 ||
      minimumOccupiedCells > gridColumns * gridRows ||
      !integer(minimumColumns) || minimumColumns < 1 || minimumColumns > gridColumns ||
      !integer(minimumRows) || minimumRows < 1 || minimumRows > gridRows ||
      !Number.isFinite(minimumCoveredFrameRatio) ||
      minimumCoveredFrameRatio <= 0 || minimumCoveredFrameRatio > 1 ||
      !Number.isFinite(minimumComponentFrameSpanRatio) ||
      minimumComponentFrameSpanRatio <= 0 || minimumComponentFrameSpanRatio > 1 ||
      !integer(minimumTracksPerFrame) || minimumTracksPerFrame < 1 ||
      !integer(minimumObservations) || minimumObservations < 2) {
    throw new TypeError("Invalid distributed static-scene support inputs.");
  }

  const byComponent = new Map();
  const invalidReasons = {
    invalidTrack: 0,
    insufficientObservations: 0,
    frameRange: 0,
    outOfBoundsObservation: 0
  };

  for (const track of tracks) {
    if (!track || !integer(track.componentId) || track.componentId < 0 ||
        !integer(track.fromPairIndex) || track.fromPairIndex < 0 ||
        !Array.isArray(track.observations)) {
      invalidReasons.invalidTrack++;
      continue;
    }
    if (track.observations.length < minimumObservations) {
      invalidReasons.insufficientObservations++;
      continue;
    }
    const lastFrame = track.fromPairIndex + track.observations.length - 1;
    if (lastFrame >= frameCount) {
      invalidReasons.frameRange++;
      continue;
    }
    const inBounds = track.observations.every(point =>
      point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
      point.x >= 0 && point.x < frameWidth &&
      point.y >= 0 && point.y < frameHeight
    );
    if (!inBounds) {
      invalidReasons.outOfBoundsObservation++;
      continue;
    }

    let component = byComponent.get(track.componentId);
    if (!component) {
      component = {
        componentId: track.componentId,
        tracks: [],
        minimumFrame: frameCount,
        maximumFrame: -1,
        cells: new Set(),
        columns: new Set(),
        rows: new Set(),
        frameCounts: new Map()
      };
      byComponent.set(track.componentId, component);
    }
    component.tracks.push(track);
    component.minimumFrame = Math.min(component.minimumFrame, track.fromPairIndex);
    component.maximumFrame = Math.max(component.maximumFrame, lastFrame);

    const first = track.observations[0];
    const column = Math.min(gridColumns - 1, Math.floor(first.x / frameWidth * gridColumns));
    const row = Math.min(gridRows - 1, Math.floor(first.y / frameHeight * gridRows));
    component.cells.add(row * gridColumns + column);
    component.columns.add(column);
    component.rows.add(row);

    for (let offset = 0; offset < track.observations.length; offset++) {
      const frame = track.fromPairIndex + offset;
      component.frameCounts.set(frame, (component.frameCounts.get(frame) || 0) + 1);
    }
  }

  const componentReports = [];
  const supportedComponentIds = [];
  const unsupportedComponentIds = [];
  let supportedTrackCount = 0;

  for (const component of byComponent.values()) {
    const componentSpanFrames = component.maximumFrame - component.minimumFrame + 1;
    let coveredFrames = 0;
    for (let frame = component.minimumFrame; frame <= component.maximumFrame; frame++) {
      if ((component.frameCounts.get(frame) || 0) >= minimumTracksPerFrame) coveredFrames++;
    }
    const coveredFrameRatio = componentSpanFrames ? coveredFrames / componentSpanFrames : 0;
    const componentFrameSpanRatio = componentSpanFrames / frameCount;
    const failedCriteria = [];
    if (component.tracks.length < minimumTracksPerComponent) {
      failedCriteria.push("minimum track count");
    }
    if (component.cells.size < minimumOccupiedCells) {
      failedCriteria.push("image-cell coverage");
    }
    if (component.columns.size < minimumColumns) {
      failedCriteria.push("image-column coverage");
    }
    if (component.rows.size < minimumRows) {
      failedCriteria.push("image-row coverage");
    }
    if (coveredFrameRatio < minimumCoveredFrameRatio) {
      failedCriteria.push("within-component temporal coverage");
    }
    if (componentFrameSpanRatio < minimumComponentFrameSpanRatio) {
      failedCriteria.push("component duration coverage");
    }
    const supported = failedCriteria.length === 0;
    if (supported) {
      supportedComponentIds.push(component.componentId);
      supportedTrackCount += component.tracks.length;
    } else {
      unsupportedComponentIds.push(component.componentId);
    }
    componentReports.push({
      componentId: component.componentId,
      trackCount: component.tracks.length,
      occupiedCells: component.cells.size,
      totalCells: gridColumns * gridRows,
      occupiedColumns: component.columns.size,
      occupiedRows: component.rows.size,
      componentSpanFrames,
      componentFrameSpanRatio,
      coveredFrames,
      coveredFrameRatio,
      status: supported ? "distributed-support-passed" : "insufficient-distributed-support",
      failedCriteria
    });
  }

  componentReports.sort((a, b) => a.componentId - b.componentId);
  return {
    status: supportedComponentIds.length
      ? "distributed-track-support-passed"
      : "insufficient-distributed-track-support",
    inputTrackCount: tracks.length,
    validTrackCount: [...byComponent.values()].reduce((sum, component) => sum + component.tracks.length, 0),
    invalidTrackCount: Object.values(invalidReasons).reduce((sum, count) => sum + count, 0),
    invalidReasons,
    supportedTrackCount,
    componentReports,
    supportedComponentIds,
    unsupportedComponentIds,
    thresholds: {
      minimumTracksPerComponent,
      gridColumns,
      gridRows,
      minimumOccupiedCells,
      minimumColumns,
      minimumRows,
      minimumCoveredFrameRatio,
      minimumComponentFrameSpanRatio,
      minimumTracksPerFrame,
      minimumObservations
    },
    limitation: "Spatial and temporal distribution measures where fixed-3D candidate tracks are observed; it is not semantic object detection or proof of static scene identity. Moving people or water can still pass if their tracks satisfy the geometric and coverage tests."
  };
}
