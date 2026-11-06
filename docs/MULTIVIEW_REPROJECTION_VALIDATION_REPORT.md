# Multi-view reprojection validation milestone

## Purpose
The prior milestone measured camera-path smoothness. Smoothness alone cannot show whether the optimized camera path better explains the original image observations. This milestone adds a strict comparison utility for raw and optimized camera projection candidates.

## Implemented
- Added `reconstruction/reprojection-validation.js`.
- Added `compareReprojectionCandidates(rawProjectionMatrices, optimizedProjectionMatrices, observations)`.
- Both candidates are evaluated against the same supplied 3D landmarks and 2D image observations.
- Reports RMS and median pixel reprojection error, valid and rejected observation counts, and absolute/percentage RMS improvement.
- Points with non-positive camera depth are rejected.
- Explicitly reports whether the optimized candidate fits better, worse, or equally well.
- Added four regression tests covering improvement, behind-camera rejection, malformed inputs, and equal-quality candidates.

## Important limitation
The evaluator does not estimate camera poses, create 3D landmarks, or optimize bundle adjustment. It is only valid when both projection candidates are tested against the same independently established 3D landmarks and image observations. The current browser pipeline has not yet wired its estimated scene landmarks into this comparison. Therefore no raw-versus-optimized reprojection score for the user's video is claimed in this commit.

## Original-video spot check
The uploaded original clip was readable: 1920 x 1080, approximately 29.9975 fps, 595 frames, 19.835 seconds, approximately 37.9 MB.

An independent OpenCV ORB check sampled 39 frames at 0.5-second intervals. Across 38 adjacent pairs, 38 had sufficient ratio-filtered matches to run a fundamental-matrix RANSAC check. Median ratio-filtered matches: 208.5. Median fundamental-matrix inliers: 139. Minimum and maximum inliers: 43 and 411.

These are image-correspondence diagnostics only. They do not prove correct camera calibration, depth, 3D reconstruction, or a walkable scene. This independent check is not the browser Reconstruction Lab run.

## Verification status
- GitHub source files created and then retrieved for verification.
- Regression test source committed; automated execution/CI status not confirmed in this work session.
- GitHub Actions runs associated with the new commits have not been verified.
- Website deployment has not been verified.
- Actual video has not yet been processed through the updated browser application with 3D landmarks connected to the reprojection evaluator.

## Next step
Wire multi-view landmark observations from the reconstruction pipeline into this evaluator, compare raw and optimized camera paths on the same landmarks, and only then use measured reprojection improvement as evidence for or against trajectory optimization. Continue to preserve the original recorded imagery; do not synthesize replacement scenery.
