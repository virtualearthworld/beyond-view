# Original video validation status — Beyond View

## User's exact target video

The target is the previously supplied IMG_1325(1).mov, a waterfront recording. We are not switching to a new video or a single-object sample. The desired output must be derived from the actual footage and preserve its source content.

- 1920 × 1080
- approximately 29.9975 FPS
- 595 frames
- 19.835 seconds
- approximately 37.9 MB
- The original file is deliberately not committed to this public repository.

## Evidence already collected

The following results are from earlier independent local OpenCV analyses of the exact source file. They are not a fresh end-to-end browser reconstruction:

| Test | Result | What it means |
|---|---:|---|
| Camera-coverage sample | 40 frames / 39 adjacent pairs | Broad temporal sample of the clip |
| Median ratio-filtered ORB matches | 310 per pair | Repeated visual texture is available |
| Median fundamental-matrix inliers | 210 per pair | Many matches are epipolar-consistent |
| Median homography inliers | 146 per pair | A dominant image-motion model fits some content |
| Median image-grid coverage | 7 of 12 cells | Matches are spread across much of the image |
| Relative-pose recovery | 39 / 39 pairs | Pairwise pose estimation was possible under provisional calibration |
| Median triangulation angle | 4.60° | Depth conditioning is limited for many observations |
| Pair-local points below 2° | 27.3% | A substantial minority have weak parallax |
| Median two-view reprojection error | about 0.388 px | Pairwise image fit is low, but depth can still be inaccurate |

The clip includes people in the foreground, with waterfront/skyline and water behind them. Moving people, water, reflections, and camera/boat motion must not be mistaken for a single static scene. Homography residuals are only independent-motion/parallax candidates, not semantic segmentation.

## Current implementation

- First-party browser Reconstruction Lab: frame sampling, feature tracking, dominant motion and homography diagnostics, multi-frame track linking, relative camera pose estimation, translation-path regularization, experimental landmark/translation bundle adjustment, sparse triangulation, point-cloud fusion, reprojection diagnostics, and PLY export.
- Main workspace now hands the exact selected local video to Reconstruction Lab in a new tab using a browser-local Blob URL.
- The lab automatically imports that video and starts analysis.
- The original tab must remain open until the lab finishes reading the local Blob URL.
- The optional Gausify Orbit Gaussian-splat engine remains separate and is not the primary path for this moving waterfront source.

## What is not yet proven

- A stable globally aligned camera trajectory for the complete clip.
- Accurate or metric depth.
- A coherent, recognizable full-scene point cloud.
- A textured mesh or Gaussian-splat scene generated from this exact clip.
- A collision-aware or freely walkable 3D environment.
- A full browser end-to-end run of the exact clip after the latest integration.

## Next acceptance gate

Run the exact video through the first-party lab and inspect persistent track survival, camera-pose gaps, raw-versus-refined reprojection, sparse point count, connected components, triangulation-angle distribution, and exported PLY. Compare the geometry with original source frames. Preserve uncertain regions; do not generate missing scenery.

Only after a recognizable source-faithful sparse reconstruction passes this gate should we move the same clip into a dense 3DGS/mesh appearance stage and connect the saved scene to the Beyond View viewing experience.
