# Experimental bundle-adjustment milestone report

## What changed
- Added `reconstruction/bundle-adjustment.js`, an experimental robust block-coordinate optimizer.
- It initializes 3D landmarks from persistent tracks, alternates landmark refinement with camera-translation refinement, and uses robust residual weighting.
- The first estimated camera pose in each connected component is anchored to remove the free translation gauge.
- Connected the optimizer to Reconstruction Lab. The browser report now shows optimizer status, median reprojection error before and after refinement, and the number of landmarks refined.
- Added regression tests for a consistent synthetic three-view track and the insufficient-track case.

## Explicit scope limits
This is an experimental partial bundle-adjustment stage, not full production bundle adjustment:
- Camera rotations are fixed.
- Camera intrinsics are fixed at the user's provisional focal-length assumption.
- Scale remains arbitrary for monocular reconstruction.
- Each connected component is optimized separately; no loop closure or cross-component alignment.
- The same observations initialize and evaluate the landmarks, so the before/after residual is an optimization diagnostic, not held-out accuracy.
- The optimizer caps work at 250 tracks and three outer iterations in the Reconstruction Lab.

## Original uploaded video
The uploaded MOV was successfully opened for independent feature inspection:
- 1920 × 1080
- 595 frames
- 29.9975 FPS
- 19.835 seconds

A fresh ORB/RANSAC sample used 39 frames at 0.5-second spacing, producing 38 adjacent pairs. Median ratio-filtered matches: 238. Median fundamental-matrix inliers: 162.5. All 38 pairs had at least 12 inliers. This supports trackability but does not prove correct calibration, depth, or a navigable scene.

## Follow-up validation and optimizer safeguard
A fresh independent OpenCV run on the uploaded MOV sampled 39 frames at 0.5-second intervals (38 adjacent pairs). With ORB at 640 × 360, the median ratio-filtered match count was 294 and the median fundamental-matrix RANSAC inlier count was 195; all 38 pairs had at least 64 inliers. This supports visual trackability, not calibrated depth or successful browser reconstruction.

The optimizer now uses backtracking on each 3-parameter refinement block. A candidate update is accepted only if it does not increase that block's robust reprojection objective; otherwise the step is reduced up to seven times and then rejected.

## Verification
- GitHub source re-fetched and confirmed: optimizer module, Reconstruction Lab import and invocation, result display, and regression test file.
- The backtracking safeguard is present in the latest optimizer source.
- Latest optimizer commit: `40bb3ef8bb9da1d821c30bd68b57c3c37b09333e`.
- Automated test execution and deployment remain unverified; the commit status endpoint returned no statuses and no pull-request workflow runs were returned.
- The browser Reconstruction Lab has not yet been run end-to-end with the uploaded video after this integration. No bundle-adjustment numerical result is claimed.

## Next validation
Run the browser lab on the original MOV, check that enough persistent tracks triangulate, compare before/after reprojection error, and add held-out observations so the optimizer is not judged on its training observations. If the optimizer degrades held-out residuals, reject or constrain the update. Then progress to rotation refinement and calibrated bundle adjustment.
