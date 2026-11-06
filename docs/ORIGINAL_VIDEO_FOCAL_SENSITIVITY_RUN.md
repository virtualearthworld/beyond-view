# Original Video — Five-Point Focal-Length Sensitivity Run

## Source clip

- File: `IMG_1325(1).mov`
- Resolution: 1920 × 1080
- Frame rate: 29.997 FPS
- Frame count: 595
- Duration: 19.835 seconds

## Independent test procedure

- Sampled 40 frames at 0.5-second intervals (0.0 to 19.5 seconds), resized to 640 × 360.
- Detected ORB features (up to 2,500 per frame).
- Matched consecutive samples using Hamming KNN and a 0.75 ratio threshold.
- Estimated essential matrices with RANSAC (1.5-pixel threshold, 0.999 confidence).
- Ran relative-pose recovery with cheirality selection at five provisional focal lengths. The assumed principal point was (320, 180), with square pixels.

## Results

| Focal assumption | Analysis focal length | Relative poses recovered | Median cheirality inliers |
|---:|---:|---:|---:|
| 0.8 × image width | 512 px | 39 / 39 | 119 |
| 1.0 × image width | 640 px | 39 / 39 | 129 |
| 1.2 × image width | 768 px | 39 / 39 | 124 |
| 1.4 × image width | 896 px | 39 / 39 | 132 |
| 1.6 × image width | 1024 px | 39 / 39 | 127 |

## Interpretation and limitations

All 39 adjacent half-second pairs produced a recoverable relative pose at all five assumptions. This is a positive indication that pairwise geometry is numerically recoverable across the tested range. The inlier counts are correspondence/cheirality support, not a direct measurement of pose accuracy.

The test does not determine the true focal length, principal point, lens distortion, rolling-shutter behavior, camera stabilization, or metric scale. Pairwise poses may still be biased by moving people, water, reflections, or repeated textures. Chaining them can accumulate drift. No globally optimized trajectory, multi-frame triangulated world cloud, dense surface, or walkable scene was established by this test.

## Code change in the Reconstruction Lab

The lab now runs a five-assumption focal-length sensitivity sweep on its own measured frame-pair tracks and displays recovered-pose counts and median epipolar inlier support for each assumption. It deliberately does not auto-select a focal length. The sweep is diagnostic and must not be presented as calibration.

Added a reusable helper at `reconstruction/calibration-sensitivity.js` and Node tests at `tests/calibration-sensitivity.test.js`. The two new Node tests passed locally.

## Next gate

Obtain verified camera intrinsics and distortion coefficients for this exact recording mode (or calibrate with a suitable target), then test persistent static-background tracks, pose stability across focal assumptions, global trajectory consistency/bundle adjustment, and multi-view triangulation with reprojection and positive-depth checks. Preserve ambiguous and dynamic observations for later layers. Do not synthesize missing scenery.