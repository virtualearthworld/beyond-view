# Multi-frame trajectory regularization report

## Change delivered

Added `reconstruction/trajectory-optimization.js` and integrated it into Reconstruction Lab after camera-pose segments and persistent image tracks are linked.

The optimizer is intentionally described as **confidence-weighted translation-path regularization**, not bundle adjustment. It applies a second-difference smoothness penalty to accumulated unit-baseline translations within each connected estimated component. Component endpoints are anchored. Failed-pose gaps and disconnected components are not bridged. Persistent image-track support increases a pose's data weight. Rotations and relative-pose measurements remain unchanged.

The lab displays how many translation poses were adjusted, how many had persistent-track support, and the maximum translation adjustment in provisional units.

## Integration correction

During source review, two integration mismatches were found and corrected before the latest commit:
- `linkTrackSequencesByComponent` emits observations as image coordinates and records `fromPairIndex`; it does not attach a `frame` property to each observation. The optimizer now maps observation index to sampled frame index using `fromPairIndex`.
- The lab now derives component IDs from `rawTrajectory` before creating the regularized `trajectory`. This avoids referencing the later variable before initialization.

## Original video check

The uploaded source file was independently decoded:
- 1920 × 1080
- 29.9975 FPS
- 595 frames
- 19.835 seconds
- 37,917,688 bytes

A separate exploratory OpenCV ORB run sampled 40 frames at 0.5-second intervals, resized to 640 pixels wide, and evaluated 39 adjacent pairs. With a 0.75 descriptor ratio test and RANSAC:
- Median ratio-filtered matches: 242
- Median fundamental-matrix inliers: 165
- Median homography inliers: 110
- 39/39 pairs had at least 12 fundamental-matrix inliers
- 39/39 pairs had at least 12 homography inliers

This is an independent correspondence check only. It does not run the browser's exact patch tracker or the new trajectory regularizer, and does not prove that the matched features are all static background.

## Regression coverage added

`tests/trajectory-optimization.test.js` covers:
- smoothing a noisy translation within a connected component;
- anchoring component endpoints;
- preserving explicit gaps and disconnected components;
- leaving rotations unchanged;
- checking persistent-track support using the actual `fromPairIndex` / coordinate-observation shape; and
- rejecting invalid parameters.

The test file is committed. Execution of the test suite and deployment were not independently confirmed in this work session.

## Limitations

This is not full bundle adjustment: it does not optimize camera rotations, 3D landmarks, or image reprojection residuals jointly. It does not solve loop closure, lens distortion, rolling shutter, camera calibration, or metric scale. Translation smoothing can make a path visually smoother without making it more physically accurate. Raw and regularized translations are retained for comparison. The next gate is to compare source-frame reprojection residuals before and after regularization and reject any smoothing that worsens measured image fit.

No generated pixels or replacement scenery are introduced.
